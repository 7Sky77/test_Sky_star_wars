import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

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
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS planets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      arm INTEGER NOT NULL,
      system INTEGER NOT NULL,
      position INTEGER NOT NULL,
      last_processed_at INTEGER NOT NULL,
      metal REAL NOT NULL DEFAULT 500,
      crystal REAL NOT NULL DEFAULT 300,
      deuterium REAL NOT NULL DEFAULT 0,
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
  `);
}
