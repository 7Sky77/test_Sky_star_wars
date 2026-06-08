import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { planetParamsForCoords, planetTypeForCoords } from "@sw/shared";

export function openDatabase(filePath: string): Database.Database {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      faction_id TEXT NOT NULL DEFAULT 'terran',
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT,
      planet_id INTEGER REFERENCES planets(id) ON DELETE SET NULL,
      message TEXT NOT NULL,
      details_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_game_log_created ON game_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_game_log_kind ON game_log(kind);

    CREATE TABLE IF NOT EXISTS planets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      arm INTEGER NOT NULL,
      system INTEGER NOT NULL,
      position INTEGER NOT NULL,
      last_processed_at INTEGER NOT NULL,
      metal REAL NOT NULL DEFAULT 500,
      minerals REAL NOT NULL DEFAULT 300,
      vespene REAL NOT NULL DEFAULT 0,
      UNIQUE(arm, system, position)
    );

    CREATE INDEX IF NOT EXISTS idx_planets_user ON planets(user_id);

    CREATE TABLE IF NOT EXISTS planet_buildings (
      planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
      building_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (planet_id, building_id)
    );

    CREATE TABLE IF NOT EXISTS build_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
      building_id TEXT NOT NULL,
      target_level INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      finishes_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_queue_planet ON build_queue(planet_id);

    CREATE TABLE IF NOT EXISTS planet_units (
      planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
      unit_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (planet_id, unit_id)
    );

    CREATE TABLE IF NOT EXISTS planet_defense (
      planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
      defense_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (planet_id, defense_id)
    );

    CREATE TABLE IF NOT EXISTS user_research (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      research_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, research_id)
    );

    CREATE TABLE IF NOT EXISTS research_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
      research_id TEXT NOT NULL,
      target_level INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      finishes_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_research_queue_user ON research_queue(user_id);
  `);

  migrateResourceColumns(db);
  migrateBuildingIds(db);
  migratePlanetTypeColumn(db);
  migratePlanetParamsColumns(db);
  migrateAdminColumn(db);
  collapseUnitSpecializationStacks(db);
}

/** Свернуть стопки по specialization_id в одну запись на юнит (откат per-build выбора). */
function collapseUnitSpecializationStacks(db: Database.Database) {
  collapseStackableIfNeeded(db, "planet_units", "unit_id");
  collapseStackableIfNeeded(db, "planet_defense", "defense_id");
}

function collapseStackableIfNeeded(
  db: Database.Database,
  table: "planet_units" | "planet_defense",
  itemCol: "unit_id" | "defense_id"
) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === "specialization_id")) return;

  const tmp = `${table}_spec_collapse`;
  db.exec(`
    CREATE TABLE ${tmp} (
      planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
      ${itemCol} TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (planet_id, ${itemCol})
    );
    INSERT INTO ${tmp} (planet_id, ${itemCol}, quantity)
      SELECT planet_id, ${itemCol}, SUM(quantity) FROM ${table} GROUP BY planet_id, ${itemCol};
    DROP TABLE ${table};
    ALTER TABLE ${tmp} RENAME TO ${table};
  `);
}

function migrateAdminColumn(db: Database.Database) {
  const cols = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("is_admin")) {
    db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`);
  }
}

function planetColumnNames(db: Database.Database): Set<string> {
  const cols = db.prepare(`PRAGMA table_info(planets)`).all() as { name: string }[];
  return new Set(cols.map((c) => c.name));
}

function migrateResourceColumns(db: Database.Database) {
  const names = planetColumnNames(db);
  if (names.has("crystal") && !names.has("minerals")) {
    db.exec(`ALTER TABLE planets RENAME COLUMN crystal TO minerals`);
  }
  if (names.has("deuterium") && !names.has("vespene")) {
    db.exec(`ALTER TABLE planets RENAME COLUMN deuterium TO vespene`);
  }
}

function migratePlanetTypeColumn(db: Database.Database) {
  const names = planetColumnNames(db);
  if (!names.has("planet_type_id")) {
    db.exec(`ALTER TABLE planets ADD COLUMN planet_type_id TEXT NOT NULL DEFAULT 'normal'`);
  }
}

function migratePlanetParamsColumns(db: Database.Database) {
  const names = planetColumnNames(db);
  if (!names.has("diameter_km")) {
    db.exec(`ALTER TABLE planets ADD COLUMN diameter_km INTEGER NOT NULL DEFAULT 10000`);
  }
  if (!names.has("temperature_min")) {
    db.exec(`ALTER TABLE planets ADD COLUMN temperature_min INTEGER NOT NULL DEFAULT -20`);
  }
  if (!names.has("temperature_max")) {
    db.exec(`ALTER TABLE planets ADD COLUMN temperature_max INTEGER NOT NULL DEFAULT 40`);
  }
}

/** Заполнить диаметр и температуру по координатам (для существующих планет). */
export function backfillPlanetParams(db: Database.Database, maxPlanetSlot = 9) {
  const rows = db
    .prepare(`SELECT id, arm, system, position FROM planets`)
    .all() as { id: number; arm: number; system: number; position: number }[];
  const upd = db.prepare(
    `UPDATE planets SET diameter_km = ?, temperature_min = ?, temperature_max = ? WHERE id = ?`
  );
  for (const r of rows) {
    const p = planetParamsForCoords(r.arm, r.system, r.position, maxPlanetSlot);
    upd.run(p.diameterKm, p.temperatureMin, p.temperatureMax, r.id);
  }
}

/** Привести тип планеты к климату по координатам. */
export function backfillPlanetTypes(
  db: Database.Database,
  typeIds: string[],
  maxPlanetSlot = 9
) {
  if (typeIds.length === 0) return;
  const rows = db
    .prepare(`SELECT id, arm, system, position, planet_type_id FROM planets`)
    .all() as {
    id: number;
    arm: number;
    system: number;
    position: number;
    planet_type_id: string;
  }[];
  const upd = db.prepare(`UPDATE planets SET planet_type_id = ? WHERE id = ?`);
  for (const r of rows) {
    const expected = planetTypeForCoords(
      r.arm,
      r.system,
      r.position,
      typeIds,
      maxPlanetSlot
    );
    if (r.planet_type_id !== expected) upd.run(expected, r.id);
  }
}

function migrateBuildingIds(db: Database.Database) {
  const pairs: [string, string][] = [
    ["crystal_mine", "minerals_mine"],
    ["deuterium_synthesizer", "vespene_extractor"],
  ];
  for (const [oldId, newId] of pairs) {
    db.prepare(
      `UPDATE planet_buildings SET building_id = ? WHERE building_id = ?`
    ).run(newId, oldId);
    db.prepare(`UPDATE build_queue SET building_id = ? WHERE building_id = ?`).run(
      newId,
      oldId
    );
  }
}
