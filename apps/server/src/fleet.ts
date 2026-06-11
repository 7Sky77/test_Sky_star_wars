import type Database from "better-sqlite3";
import type { GameCatalog, LocalOrbitId } from "@sw/shared";
import { resolveArrivalBattles } from "./combat.js";
import {
  fleetFlightSeconds,
  fleetSlowestSpeed,
  validateMissionTarget,
  type FleetMissionStatus,
  type FleetMissionType,
} from "@sw/shared";
import { fleetUnitMap } from "./catalog.js";

export interface FleetMissionRow {
  id: number;
  user_id: number;
  origin_planet_id: number;
  origin_arm: number;
  origin_system: number;
  origin_position: number;
  target_arm: number;
  target_system: number;
  target_position: number;
  target_orbit: string;
  mission_type: string;
  status: string;
  units_json: string;
  speed_pct: number;
  hold_seconds: number;
  launched_at: number;
  arrives_at: number;
  hold_until: number | null;
}

const VALID_ORBITS = new Set<LocalOrbitId>(["low", "medium", "high"]);

function parseUnitsJson(json: string): Record<string, number> {
  try {
    return JSON.parse(json) as Record<string, number>;
  } catch {
    return {};
  }
}

function addUnitsToPlanet(
  db: Database.Database,
  planetId: number,
  units: Record<string, number>
) {
  const upsert = db.prepare(
    `INSERT INTO planet_units (planet_id, unit_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT(planet_id, unit_id) DO UPDATE SET quantity = quantity + excluded.quantity`
  );
  for (const [unitId, rawQty] of Object.entries(units)) {
    const qty = Math.floor(Number(rawQty));
    if (qty > 0) upsert.run(planetId, unitId, qty);
  }
}

export function advanceFleetMissions(
  db: Database.Database,
  catalog: GameCatalog,
  now: number
) {
  resolveArrivalBattles(db, catalog, now);

  const returning = db
    .prepare(
      `SELECT * FROM fleet_missions WHERE status = 'returning' AND arrives_at <= ?`
    )
    .all(now) as FleetMissionRow[];

  for (const row of returning) {
    let units: Record<string, number> = {};
    try {
      units = JSON.parse(row.units_json) as Record<string, number>;
    } catch {
      units = {};
    }
    const tx = db.transaction(() => {
      addUnitsToPlanet(db, row.origin_planet_id, units);
      db.prepare(`DELETE FROM fleet_missions WHERE id = ?`).run(row.id);
    });
    tx();
  }
}

export function listFleetMissions(
  db: Database.Database,
  userId: number
): FleetMissionRow[] {
  return db
    .prepare(
      `SELECT * FROM fleet_missions WHERE user_id = ? ORDER BY launched_at DESC`
    )
    .all(userId) as FleetMissionRow[];
}

export function sendFleetMission(
  db: Database.Database,
  catalog: GameCatalog,
  userId: number,
  planetId: number,
  payload: {
    targetArm: number;
    targetSystem: number;
    targetPosition: number;
    targetOrbit: LocalOrbitId;
    missionType: FleetMissionType;
    units: Record<string, number>;
    speedPct: number;
    holdMinutes: number;
  },
  now: number
): { ok: true; missionId: number; arrivesAt: number } | { ok: false; error: string } {
  const planet = db
    .prepare(
      `SELECT id, user_id, arm, system, position FROM planets WHERE id = ? AND user_id = ?`
    )
    .get(planetId, userId) as
    | { id: number; user_id: number; arm: number; system: number; position: number }
    | undefined;
  if (!planet) return { ok: false, error: "planet_not_found" };

  if (!VALID_ORBITS.has(payload.targetOrbit)) {
    return { ok: false, error: "invalid_orbit" };
  }

  const w = catalog.world;
  if (
    !validateMissionTarget(
      payload.targetArm,
      payload.targetSystem,
      payload.targetPosition,
      w
    )
  ) {
    return { ok: false, error: "invalid_coords" };
  }

  const unitsMap = fleetUnitMap(catalog);
  const cleaned: Record<string, number> = {};
  let totalShips = 0;
  for (const [unitId, rawQty] of Object.entries(payload.units)) {
    const qty = Math.floor(Number(rawQty));
    if (qty <= 0) continue;
    if (!unitsMap.has(unitId)) return { ok: false, error: "unknown_unit" };
    cleaned[unitId] = qty;
    totalShips += qty;
  }
  if (totalShips <= 0) return { ok: false, error: "empty_fleet" };

  const owned = db
    .prepare(`SELECT unit_id, quantity FROM planet_units WHERE planet_id = ?`)
    .all(planetId) as { unit_id: string; quantity: number }[];
  const ownedMap = new Map(owned.map((r) => [r.unit_id, r.quantity]));
  for (const [unitId, qty] of Object.entries(cleaned)) {
    const have = ownedMap.get(unitId) ?? 0;
    if (qty > have) return { ok: false, error: "insufficient_units" };
  }

  const speedPct = Math.max(10, Math.min(100, Math.floor(payload.speedPct)));
  const holdMinutes = Math.max(0, Math.min(720, Math.floor(payload.holdMinutes)));
  const holdSeconds = holdMinutes * 60;

  const slowestSpeed = fleetSlowestSpeed(catalog, cleaned);
  const flightSec = fleetFlightSeconds(
    { arm: planet.arm, system: planet.system, position: planet.position },
    {
      arm: payload.targetArm,
      system: payload.targetSystem,
      position: payload.targetPosition,
    },
    speedPct,
    slowestSpeed
  );
  const arrivesAt = now + flightSec * 1000;
  const holdUntil =
    holdSeconds > 0 ? arrivesAt + holdSeconds * 1000 : null;

  const missionType: FleetMissionType =
    payload.missionType === "attack" ? "attack" : "hold";

  const tx = db.transaction(() => {
    for (const [unitId, qty] of Object.entries(cleaned)) {
      db.prepare(
        `UPDATE planet_units SET quantity = quantity - ? WHERE planet_id = ? AND unit_id = ?`
      ).run(qty, planetId, unitId);
      db.prepare(
        `DELETE FROM planet_units WHERE planet_id = ? AND unit_id = ? AND quantity <= 0`
      ).run(planetId, unitId);
    }

    const info = db
      .prepare(
        `INSERT INTO fleet_missions (
          user_id, origin_planet_id, origin_arm, origin_system, origin_position,
          target_arm, target_system, target_position, target_orbit,
          mission_type, status, units_json, speed_pct, hold_seconds,
          launched_at, arrives_at, hold_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'outbound', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        planet.id,
        planet.arm,
        planet.system,
        planet.position,
        payload.targetArm,
        payload.targetSystem,
        payload.targetPosition,
        payload.targetOrbit,
        missionType,
        JSON.stringify(cleaned),
        speedPct,
        holdSeconds,
        now,
        arrivesAt,
        holdUntil
      );

    return Number(info.lastInsertRowid);
  });

  const missionId = tx();
  return { ok: true, missionId, arrivesAt };
}

export function recallFleetMission(
  db: Database.Database,
  catalog: GameCatalog,
  userId: number,
  missionId: number,
  now: number
): { ok: true; arrivesAt: number } | { ok: false; error: string } {
  const row = db
    .prepare(`SELECT * FROM fleet_missions WHERE id = ? AND user_id = ?`)
    .get(missionId, userId) as FleetMissionRow | undefined;
  if (!row) return { ok: false, error: "mission_not_found" };
  if (row.status !== "holding") return { ok: false, error: "not_at_coords" };

  const planet = db
    .prepare(`SELECT id FROM planets WHERE id = ? AND user_id = ?`)
    .get(row.origin_planet_id, userId) as { id: number } | undefined;
  if (!planet) return { ok: false, error: "planet_not_found" };

  const missionUnits = parseUnitsJson(row.units_json);
  const slowestSpeed = fleetSlowestSpeed(catalog, missionUnits);
  const flightSec = fleetFlightSeconds(
    {
      arm: row.target_arm,
      system: row.target_system,
      position: row.target_position,
    },
    {
      arm: row.origin_arm,
      system: row.origin_system,
      position: row.origin_position,
    },
    row.speed_pct,
    slowestSpeed
  );
  const arrivesAt = now + flightSec * 1000;

  db.prepare(
    `UPDATE fleet_missions
     SET status = 'returning', arrives_at = ?, hold_until = NULL, launched_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(arrivesAt, now, missionId, userId);

  return { ok: true, arrivesAt };
}

export function serializeFleetMission(row: FleetMissionRow) {
  let units: Record<string, number> = {};
  try {
    units = JSON.parse(row.units_json) as Record<string, number>;
  } catch {
    units = {};
  }
  const totalShips = Object.values(units).reduce((s, n) => s + n, 0);
  return {
    id: row.id,
    origin: {
      arm: row.origin_arm,
      system: row.origin_system,
      position: row.origin_position,
      planetId: row.origin_planet_id,
    },
    target: {
      arm: row.target_arm,
      system: row.target_system,
      position: row.target_position,
      orbit: row.target_orbit as LocalOrbitId,
    },
    missionType: row.mission_type as FleetMissionType,
    status: row.status as FleetMissionStatus,
    units,
    totalShips,
    speedPct: row.speed_pct,
    holdSeconds: row.hold_seconds,
    launchedAt: row.launched_at,
    arrivesAt: row.arrives_at,
    holdUntil: row.hold_until,
  };
}
