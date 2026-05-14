import type Database from "better-sqlite3";
import type { GameCatalog } from "@sw/shared";
import {
  DEFAULT_STORAGE,
  energyConsumption,
  energyFromFleetUnits,
  energyProduction,
  flatPurchaseCost,
  productionPerHour,
  storageBonusAllAmount,
  upgradeCostForLevel,
  upgradeTimeSecondsForLevel,
} from "@sw/shared";
import { buildingMap, fleetUnitMap, defenseUnitMap } from "./catalog.js";

export interface PlanetRow {
  id: number;
  user_id: number;
  name: string;
  arm: number;
  system: number;
  position: number;
  last_processed_at: number;
  metal: number;
  crystal: number;
  deuterium: number;
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
  crystal: number;
  deuterium: number;
} {
  const bmap = buildingMap(catalog);
  let extra = 0;
  const wh = bmap.get("warehouse");
  const wl = levels.get("warehouse") ?? 0;
  if (wh) extra += storageBonusAllAmount(wh, wl);
  return {
    metal: DEFAULT_STORAGE.metal + extra,
    crystal: DEFAULT_STORAGE.crystal + extra,
    deuterium: DEFAULT_STORAGE.deuterium + extra,
  };
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

function computeEnergy(
  levels: Map<string, number>,
  catalog: GameCatalog,
  fleetUnitCounts: Map<string, number>
): {
  produced: number;
  consumed: number;
} {
  let produced = 0;
  let consumed = 0;
  for (const b of catalog.buildings) {
    const lv = levels.get(b.id) ?? 0;
    produced += energyProduction(b, lv);
    consumed += energyConsumption(b, lv);
  }
  produced += energyFromFleetUnits(catalog.units, fleetUnitCounts);
  return { produced, consumed };
}

function productionRates(
  levels: Map<string, number>,
  catalog: GameCatalog,
  energyFactor: number
): { metal: number; crystal: number; deuterium: number } {
  const rates = { metal: 0, crystal: 0, deuterium: 0 };
  for (const b of catalog.buildings) {
    const lv = levels.get(b.id) ?? 0;
    const p = productionPerHour(b, lv);
    if (!p) continue;
    const amt = p.amount * energyFactor;
    if (p.resourceId === "metal") rates.metal += amt;
    else if (p.resourceId === "crystal") rates.crystal += amt;
    else if (p.resourceId === "deuterium") rates.deuterium += amt;
  }
  return rates;
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
      `SELECT id, user_id, name, arm, system, position, last_processed_at, metal, crystal, deuterium FROM planets WHERE id = ?`
    )
    .get(planetId) as PlanetRow | undefined;
  if (!planet) return;

  const levels = getBuildingLevels(db, planetId);
  const fleetCounts = getFleetUnitCounts(db, planetId);
  const caps = computeCaps(catalog, levels);
  let metal = planet.metal;
  let crystal = planet.crystal;
  let deuterium = planet.deuterium;
  let t = planet.last_processed_at;

  const processProduction = (from: number, to: number) => {
    if (to <= from) return;
    const hours = (to - from) / 3_600_000;
    const { produced, consumed } = computeEnergy(levels, catalog, fleetCounts);
    const energyFactor =
      consumed <= 0 ? 1 : Math.min(1, produced / consumed);
    const r = productionRates(levels, catalog, energyFactor);
    metal += r.metal * hours;
    crystal += r.crystal * hours;
    deuterium += r.deuterium * hours;
    metal = Math.min(metal, caps.metal);
    crystal = Math.min(crystal, caps.crystal);
    deuterium = Math.min(deuterium, caps.deuterium);
  };

  const completeQueued = (): boolean => {
    const q = db
      .prepare(
        `SELECT id, building_id, target_level, started_at, finishes_at FROM build_queue WHERE planet_id = ? ORDER BY id ASC LIMIT 1`
      )
      .get(planetId) as
      | {
          id: number;
          building_id: string;
          target_level: number;
          started_at: number;
          finishes_at: number;
        }
      | undefined;
    if (!q || q.finishes_at > now) return false;

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
    `UPDATE planets SET metal = ?, crystal = ?, deuterium = ?, last_processed_at = ? WHERE id = ?`
  ).run(metal, crystal, deuterium, t, planetId);
}

export function queueBuild(
  db: Database.Database,
  catalog: GameCatalog,
  planetId: number,
  buildingId: string,
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  const bmap = buildingMap(catalog);
  const def = bmap.get(buildingId);
  if (!def) return { ok: false, error: "unknown_building" };

  const existing = db
    .prepare(
      `SELECT id FROM build_queue WHERE planet_id = ? ORDER BY id ASC LIMIT 1`
    )
    .get(planetId) as { id: number } | undefined;
  if (existing) return { ok: false, error: "queue_busy" };

  const row = db
    .prepare(
      `SELECT metal, crystal, deuterium FROM planets WHERE id = ?`
    )
    .get(planetId) as
    | { metal: number; crystal: number; deuterium: number }
    | undefined;
  if (!row) return { ok: false, error: "no_planet" };

  const lvRow = db
    .prepare(
      `SELECT level FROM planet_buildings WHERE planet_id = ? AND building_id = ?`
    )
    .get(planetId, buildingId) as { level: number } | undefined;
  const currentLevel = lvRow?.level ?? 0;
  if (currentLevel >= def.maxLevel) return { ok: false, error: "max_level" };

  const cost = upgradeCostForLevel(def, currentLevel);
  if (row.metal < (cost.metal ?? 0)) return { ok: false, error: "not_enough_metal" };
  if (row.crystal < (cost.crystal ?? 0))
    return { ok: false, error: "not_enough_crystal" };
  if (row.deuterium < (cost.deuterium ?? 0))
    return { ok: false, error: "not_enough_deuterium" };

  const durationMs = upgradeTimeSecondsForLevel(def, currentLevel) * 1000;
  const finishesAt = now + durationMs;

  const tx = db.transaction(() => {
    advancePlanet(db, catalog, planetId, now);
    const p2 = db
      .prepare(`SELECT metal, crystal, deuterium FROM planets WHERE id = ?`)
      .get(planetId) as { metal: number; crystal: number; deuterium: number };
    if (p2.metal < (cost.metal ?? 0)) throw new Error("not_enough_metal");
    if (p2.crystal < (cost.crystal ?? 0)) throw new Error("not_enough_crystal");
    if (p2.deuterium < (cost.deuterium ?? 0))
      throw new Error("not_enough_deuterium");
    db.prepare(
      `UPDATE planets SET metal = metal - ?, crystal = crystal - ?, deuterium = deuterium - ? WHERE id = ?`
    ).run(cost.metal ?? 0, cost.crystal ?? 0, cost.deuterium ?? 0, planetId);
    db.prepare(
      `INSERT INTO build_queue (planet_id, building_id, target_level, started_at, finishes_at) VALUES (?, ?, ?, ?, ?)`
    ).run(planetId, buildingId, currentLevel + 1, now, finishesAt);
  });

  try {
    tx();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_enough_metal") return { ok: false, error: msg };
    if (msg === "not_enough_crystal") return { ok: false, error: msg };
    if (msg === "not_enough_deuterium") return { ok: false, error: msg };
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
    .prepare(`SELECT metal, crystal, deuterium FROM planets WHERE id = ?`)
    .get(planetId) as { metal: number; crystal: number; deuterium: number };
  if (row.metal < (cost.metal ?? 0)) throw new Error("not_enough_metal");
  if (row.crystal < (cost.crystal ?? 0)) throw new Error("not_enough_crystal");
  if (row.deuterium < (cost.deuterium ?? 0))
    throw new Error("not_enough_deuterium");
  db.prepare(
    `UPDATE planets SET metal = metal - ?, crystal = crystal - ?, deuterium = deuterium - ? WHERE id = ?`
  ).run(cost.metal ?? 0, cost.crystal ?? 0, cost.deuterium ?? 0, planetId);
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
    if (msg === "not_enough_crystal") return { ok: false, error: msg };
    if (msg === "not_enough_deuterium") return { ok: false, error: msg };
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
    if (msg === "not_enough_crystal") return { ok: false, error: msg };
    if (msg === "not_enough_deuterium") return { ok: false, error: msg };
    throw e;
  }
  return { ok: true };
}

export function grantResources(
  db: Database.Database,
  catalog: GameCatalog,
  planetId: number,
  adds: { metal: number; crystal: number; deuterium: number },
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  const MAX = 100_000_000;
  if (adds.metal > MAX || adds.crystal > MAX || adds.deuterium > MAX) {
    return { ok: false, error: "grant_too_large" };
  }
  advancePlanet(db, catalog, planetId, now);
  db.prepare(
    `UPDATE planets SET metal = metal + ?, crystal = crystal + ?, deuterium = deuterium + ? WHERE id = ?`
  ).run(adds.metal, adds.crystal, adds.deuterium, planetId);
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
