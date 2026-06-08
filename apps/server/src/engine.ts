import type Database from "better-sqlite3";
import type { GameCatalog } from "@sw/shared";
import {
  computeProductionRatesPerHour,
  computeResourceCaps,
  flatPurchaseCost,
  researchCostForLevel,
  researchDurationSeconds,
  buildingRequirementsMet,
  researchRequirementsMet,
  upgradeCostForLevel,
  upgradeTimeSecondsForLevel,
} from "@sw/shared";
import {
  buildingMap,
  defenseUnitMap,
  fleetUnitMap,
  planetTypeMap,
  researchMap,
} from "./catalog.js";

export interface PlanetRow {
  id: number;
  user_id: number;
  name: string;
  arm: number;
  system: number;
  position: number;
  last_processed_at: number;
  metal: number;
  minerals: number;
  vespene: number;
  planet_type_id: string;
}

function getBuildingLevels(
  db: Database.Database,
  planetId: number
): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT building_id, level FROM planet_buildings WHERE planet_id = ?`
    )
    .all(planetId) as { building_id: string; level: number }[];
  return new Map(rows.map((r) => [r.building_id, r.level]));
}

function computeCaps(catalog: GameCatalog, levels: Map<string, number>): {
  metal: number;
  minerals: number;
  vespene: number;
} {
  return computeResourceCaps(catalog.buildings, levels);
}

function getFleetUnitCounts(
  db: Database.Database,
  planetId: number
): Map<string, number> {
  const rows = db
    .prepare(`SELECT unit_id, quantity FROM planet_units WHERE planet_id = ?`)
    .all(planetId) as { unit_id: string; quantity: number }[];
  return new Map(rows.map((r) => [r.unit_id, r.quantity]));
}

/** Advance planet time, apply production, complete finished queue items (possibly chained in one tick). */
export function advancePlanet(
  db: Database.Database,
  catalog: GameCatalog,
  planetId: number,
  now = Date.now()
): void {
  const planet = db
    .prepare(
      `SELECT id, user_id, name, arm, system, position, last_processed_at, metal, minerals, vespene, planet_type_id FROM planets WHERE id = ?`
    )
    .get(planetId) as PlanetRow | undefined;
  if (!planet) return;

  const levels = getBuildingLevels(db, planetId);
  const fleetCounts = getFleetUnitCounts(db, planetId);
  const caps = computeCaps(catalog, levels);
  const types = planetTypeMap(catalog);
  const planetType = types.get(planet.planet_type_id);
  let metal = planet.metal;
  let minerals = planet.minerals;
  let vespene = planet.vespene;
  let t = planet.last_processed_at;

  const processProduction = (from: number, to: number) => {
    if (to <= from) return;
    const hours = (to - from) / 3_600_000;
    const { rates } = computeProductionRatesPerHour({
      buildings: catalog.buildings,
      levels,
      units: catalog.units,
      fleetCounts,
      planetType,
      world: catalog.world,
    });
    metal += rates.metal * hours;
    minerals += rates.minerals * hours;
    vespene += rates.vespene * hours;
    metal = Math.min(metal, caps.metal);
    minerals = Math.min(minerals, caps.minerals);
    vespene = Math.min(vespene, caps.vespene);
  };

  const completeQueued = (): boolean => {
    const q = db
      .prepare(
        `SELECT id, building_id, target_level, started_at, finishes_at FROM build_queue WHERE planet_id = ? AND finishes_at <= ? ORDER BY finishes_at ASC, id ASC LIMIT 1`
      )
      .get(planetId, now) as
      | {
          id: number;
          building_id: string;
          target_level: number;
          started_at: number;
          finishes_at: number;
        }
      | undefined;
    if (!q) return false;

    processProduction(t, q.finishes_at);
    t = q.finishes_at;

    db.prepare(`DELETE FROM build_queue WHERE id = ?`).run(q.id);
    const upsert = db.prepare(`
      INSERT INTO planet_buildings (planet_id, building_id, level) VALUES (?, ?, ?)
      ON CONFLICT(planet_id, building_id) DO UPDATE SET level = excluded.level
    `);
    upsert.run(planetId, q.building_id, q.target_level);
    levels.set(q.building_id, q.target_level);

    return true;
  };

  while (completeQueued()) {
    /* chain completions */
  }

  processProduction(t, now);
  t = now;

  db.prepare(
    `UPDATE planets SET metal = ?, minerals = ?, vespene = ?, last_processed_at = ? WHERE id = ?`
  ).run(metal, minerals, vespene, t, planetId);
}

function getPlanetBuildingLevels(
  db: Database.Database,
  planetId: number
): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT building_id, level FROM planet_buildings WHERE planet_id = ?`
    )
    .all(planetId) as { building_id: string; level: number }[];
  return new Map(rows.map((r) => [r.building_id, r.level]));
}

export function queueBuild(
  db: Database.Database,
  catalog: GameCatalog,
  planetId: number,
  buildingId: string,
  userId: number,
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  const bmap = buildingMap(catalog);
  const def = bmap.get(buildingId);
  if (!def) return { ok: false, error: "unknown_building" };

  const maxSlots = catalog.world.buildQueueSlots ?? 3;
  const queueCount = db
    .prepare(`SELECT COUNT(*) AS c FROM build_queue WHERE planet_id = ?`)
    .get(planetId) as { c: number };
  if (queueCount.c >= maxSlots) return { ok: false, error: "queue_full" };

  const sameBuilding = db
    .prepare(
      `SELECT id FROM build_queue WHERE planet_id = ? AND building_id = ? LIMIT 1`
    )
    .get(planetId, buildingId) as { id: number } | undefined;
  if (sameBuilding) return { ok: false, error: "building_in_queue" };

  const row = db
    .prepare(
      `SELECT metal, minerals, vespene FROM planets WHERE id = ?`
    )
    .get(planetId) as
    | { metal: number; minerals: number; vespene: number }
    | undefined;
  if (!row) return { ok: false, error: "no_planet" };

  const lvRow = db
    .prepare(
      `SELECT level FROM planet_buildings WHERE planet_id = ? AND building_id = ?`
    )
    .get(planetId, buildingId) as { level: number } | undefined;
  const currentLevel = lvRow?.level ?? 0;
  if (currentLevel >= def.maxLevel) return { ok: false, error: "max_level" };

  const buildingLevels = getPlanetBuildingLevels(db, planetId);
  const researchLevels = getUserResearchLevels(db, userId);
  if (!buildingRequirementsMet(def, buildingLevels, researchLevels))
    return { ok: false, error: "requirements_not_met" };

  const cost = upgradeCostForLevel(def, currentLevel);
  if (row.metal < (cost.metal ?? 0)) return { ok: false, error: "not_enough_metal" };
  if (row.minerals < (cost.minerals ?? 0))
    return { ok: false, error: "not_enough_minerals" };
  if (row.vespene < (cost.vespene ?? 0))
    return { ok: false, error: "not_enough_vespene" };

  const durationMs = upgradeTimeSecondsForLevel(def, currentLevel) * 1000;
  const finishesAt = now + durationMs;

  const tx = db.transaction(() => {
    advancePlanet(db, catalog, planetId, now);
    const p2 = db
      .prepare(`SELECT metal, minerals, vespene FROM planets WHERE id = ?`)
      .get(planetId) as { metal: number; minerals: number; vespene: number };
    if (p2.metal < (cost.metal ?? 0)) throw new Error("not_enough_metal");
    if (p2.minerals < (cost.minerals ?? 0)) throw new Error("not_enough_minerals");
    if (p2.vespene < (cost.vespene ?? 0))
      throw new Error("not_enough_vespene");
    db.prepare(
      `UPDATE planets SET metal = metal - ?, minerals = minerals - ?, vespene = vespene - ? WHERE id = ?`
    ).run(cost.metal ?? 0, cost.minerals ?? 0, cost.vespene ?? 0, planetId);
    db.prepare(
      `INSERT INTO build_queue (planet_id, building_id, target_level, started_at, finishes_at) VALUES (?, ?, ?, ?, ?)`
    ).run(planetId, buildingId, currentLevel + 1, now, finishesAt);
  });

  try {
    tx();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_enough_metal") return { ok: false, error: msg };
    if (msg === "not_enough_minerals") return { ok: false, error: msg };
    if (msg === "not_enough_vespene") return { ok: false, error: msg };
    throw e;
  }

  return { ok: true };
}

function purchaseStackable(
  db: Database.Database,
  catalog: GameCatalog,
  planetId: number,
  table: "planet_units" | "planet_defense",
  itemId: string,
  cost: Record<string, number>,
  now: number
): void {
  advancePlanet(db, catalog, planetId, now);
  const row = db
    .prepare(`SELECT metal, minerals, vespene FROM planets WHERE id = ?`)
    .get(planetId) as { metal: number; minerals: number; vespene: number };
  if (row.metal < (cost.metal ?? 0)) throw new Error("not_enough_metal");
  if (row.minerals < (cost.minerals ?? 0)) throw new Error("not_enough_minerals");
  if (row.vespene < (cost.vespene ?? 0))
    throw new Error("not_enough_vespene");
  db.prepare(
    `UPDATE planets SET metal = metal - ?, minerals = minerals - ?, vespene = vespene - ? WHERE id = ?`
  ).run(cost.metal ?? 0, cost.minerals ?? 0, cost.vespene ?? 0, planetId);
  if (table === "planet_units") {
    db.prepare(
      `INSERT INTO planet_units (planet_id, unit_id, quantity) VALUES (?, ?, 1)
       ON CONFLICT(planet_id, unit_id) DO UPDATE SET quantity = planet_units.quantity + 1`
    ).run(planetId, itemId);
  } else {
    db.prepare(
      `INSERT INTO planet_defense (planet_id, defense_id, quantity) VALUES (?, ?, 1)
       ON CONFLICT(planet_id, defense_id) DO UPDATE SET quantity = planet_defense.quantity + 1`
    ).run(planetId, itemId);
  }
}

export function purchaseFleetUnit(
  db: Database.Database,
  catalog: GameCatalog,
  planetId: number,
  unitId: string,
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  const def = fleetUnitMap(catalog).get(unitId);
  if (!def) return { ok: false, error: "unknown_unit" };
  const cost = flatPurchaseCost(def);
  const tx = db.transaction(() => {
    purchaseStackable(db, catalog, planetId, "planet_units", unitId, cost, now);
  });
  try {
    tx();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_enough_metal") return { ok: false, error: msg };
    if (msg === "not_enough_minerals") return { ok: false, error: msg };
    if (msg === "not_enough_vespene") return { ok: false, error: msg };
    throw e;
  }
  return { ok: true };
}

export function purchaseDefenseUnit(
  db: Database.Database,
  catalog: GameCatalog,
  planetId: number,
  defenseId: string,
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  const def = defenseUnitMap(catalog).get(defenseId);
  if (!def) return { ok: false, error: "unknown_defense" };
  const cost = flatPurchaseCost(def);
  const tx = db.transaction(() => {
    purchaseStackable(db, catalog, planetId, "planet_defense", defenseId, cost, now);
  });
  try {
    tx();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_enough_metal") return { ok: false, error: msg };
    if (msg === "not_enough_minerals") return { ok: false, error: msg };
    if (msg === "not_enough_vespene") return { ok: false, error: msg };
    throw e;
  }
  return { ok: true };
}

export function grantResources(
  db: Database.Database,
  catalog: GameCatalog,
  planetId: number,
  adds: { metal: number; minerals: number; vespene: number },
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  const MAX = 100_000_000;
  if (adds.metal > MAX || adds.minerals > MAX || adds.vespene > MAX) {
    return { ok: false, error: "grant_too_large" };
  }
  advancePlanet(db, catalog, planetId, now);
  db.prepare(
    `UPDATE planets SET metal = metal + ?, minerals = minerals + ?, vespene = vespene + ? WHERE id = ?`
  ).run(adds.metal, adds.minerals, adds.vespene, planetId);
  return { ok: true };
}

export function getUserResearchLevels(
  db: Database.Database,
  userId: number
): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT research_id, level FROM user_research WHERE user_id = ?`
    )
    .all(userId) as { research_id: string; level: number }[];
  return new Map(rows.map((r) => [r.research_id, r.level]));
}

function researchLabLevel(db: Database.Database, planetId: number): number {
  const row = db
    .prepare(
      `SELECT level FROM planet_buildings WHERE planet_id = ? AND building_id = 'research_lab'`
    )
    .get(planetId) as { level: number } | undefined;
  return row?.level ?? 0;
}

/** Завершить готовые исследования в очереди игрока. */
export function advanceResearch(
  db: Database.Database,
  userId: number,
  now = Date.now()
): void {
  const upsert = db.prepare(`
    INSERT INTO user_research (user_id, research_id, level) VALUES (?, ?, ?)
    ON CONFLICT(user_id, research_id) DO UPDATE SET level = excluded.level
  `);

  while (true) {
    const q = db
      .prepare(
        `SELECT id, research_id, target_level FROM research_queue WHERE user_id = ? AND finishes_at <= ? ORDER BY finishes_at ASC, id ASC LIMIT 1`
      )
      .get(userId, now) as
      | { id: number; research_id: string; target_level: number }
      | undefined;
    if (!q) break;
    upsert.run(userId, q.research_id, q.target_level);
    db.prepare(`DELETE FROM research_queue WHERE id = ?`).run(q.id);
  }
}

export function queueResearch(
  db: Database.Database,
  catalog: GameCatalog,
  userId: number,
  planetId: number,
  researchId: string,
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  const rmap = researchMap(catalog);
  const def = rmap.get(researchId);
  if (!def) return { ok: false, error: "unknown_research" };
  if (!def.costs?.length) return { ok: false, error: "no_costs" };

  const busy = db
    .prepare(`SELECT id FROM research_queue WHERE user_id = ? LIMIT 1`)
    .get(userId) as { id: number } | undefined;
  if (busy) return { ok: false, error: "research_busy" };

  const labLv = researchLabLevel(db, planetId);
  if (labLv < 1) return { ok: false, error: "no_research_lab" };

  const levels = getUserResearchLevels(db, userId);
  const currentLevel = levels.get(researchId) ?? 0;
  const maxLevel = def.maxLevel ?? 20;
  if (currentLevel >= maxLevel) return { ok: false, error: "max_level" };
  if (!researchRequirementsMet(def, levels))
    return { ok: false, error: "requirements_not_met" };

  const cost = researchCostForLevel(def, currentLevel);
  if ((cost.energy ?? 0) > 0) return { ok: false, error: "unsupported_cost" };

  const row = db
    .prepare(`SELECT metal, minerals, vespene FROM planets WHERE id = ?`)
    .get(planetId) as
    | { metal: number; minerals: number; vespene: number }
    | undefined;
  if (!row) return { ok: false, error: "no_planet" };
  if (row.metal < (cost.metal ?? 0)) return { ok: false, error: "not_enough_metal" };
  if (row.minerals < (cost.minerals ?? 0))
    return { ok: false, error: "not_enough_minerals" };
  if (row.vespene < (cost.vespene ?? 0))
    return { ok: false, error: "not_enough_vespene" };

  const durationMs = researchDurationSeconds(def, currentLevel, labLv) * 1000;
  const finishesAt = now + durationMs;

  const tx = db.transaction(() => {
    advancePlanet(db, catalog, planetId, now);
    advanceResearch(db, userId, now);
    const p2 = db
      .prepare(`SELECT metal, minerals, vespene FROM planets WHERE id = ?`)
      .get(planetId) as { metal: number; minerals: number; vespene: number };
    if (p2.metal < (cost.metal ?? 0)) throw new Error("not_enough_metal");
    if (p2.minerals < (cost.minerals ?? 0)) throw new Error("not_enough_minerals");
    if (p2.vespene < (cost.vespene ?? 0))
      throw new Error("not_enough_vespene");
    db.prepare(
      `UPDATE planets SET metal = metal - ?, minerals = minerals - ?, vespene = vespene - ? WHERE id = ?`
    ).run(cost.metal ?? 0, cost.minerals ?? 0, cost.vespene ?? 0, planetId);
    db.prepare(
      `INSERT INTO research_queue (user_id, planet_id, research_id, target_level, started_at, finishes_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, planetId, researchId, currentLevel + 1, now, finishesAt);
  });

  try {
    tx();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_enough_metal") return { ok: false, error: msg };
    if (msg === "not_enough_minerals") return { ok: false, error: msg };
    if (msg === "not_enough_vespene") return { ok: false, error: msg };
    throw e;
  }

  return { ok: true };
}

export function pickStartingCoords(db: Database.Database): {
  arm: number;
  system: number;
  position: number;
} {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const arm = 1 + Math.floor(Math.random() * 50);
    const system = 1 + Math.floor(Math.random() * 50);
    const position = 1 + Math.floor(Math.random() * 9);
    const taken = db
      .prepare(
        `SELECT 1 FROM planets WHERE arm = ? AND system = ? AND position = ?`
      )
      .get(arm, system, position);
    if (!taken) return { arm, system, position };
  }
  throw new Error("no_free_coords");
}
