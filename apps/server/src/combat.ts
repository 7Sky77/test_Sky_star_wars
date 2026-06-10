import type Database from "better-sqlite3";
import type { GameCatalog, LocalOrbitId } from "@sw/shared";
import { resolveFleetBattle, type BattleResult } from "@sw/shared";
import type { FleetMissionRow } from "./fleet.js";
import { logGameEvent } from "./gameLog.js";
import { intrudersAtCoords } from "./intruders.js";

export interface BattleReportRow {
  id: number;
  user_id: number;
  mission_id: number | null;
  intruder_id: string | null;
  location_arm: number;
  location_system: number;
  location_position: number;
  location_orbit: string;
  defender_name: string;
  winner: string;
  attacker_start_json: string;
  defender_start_json: string;
  attacker_survivors_json: string;
  defender_survivors_json: string;
  rounds_json: string;
  created_at: number;
}

function parseJsonRecord(json: string): Record<string, number> {
  try {
    return JSON.parse(json) as Record<string, number>;
  } catch {
    return {};
  }
}

function totalShips(units: Record<string, number>): number {
  return Object.values(units).reduce((s, n) => s + Math.max(0, Math.floor(n)), 0);
}

function saveBattleReport(
  db: Database.Database,
  payload: {
    userId: number;
    missionId: number | null;
    intruderId: string | null;
    arm: number;
    system: number;
    position: number;
    orbit: LocalOrbitId;
    defenderName: string;
    result: BattleResult;
    now: number;
  }
): number {
  const info = db
    .prepare(
      `INSERT INTO battle_reports (
        user_id, mission_id, intruder_id,
        location_arm, location_system, location_position, location_orbit,
        defender_name, winner,
        attacker_start_json, defender_start_json,
        attacker_survivors_json, defender_survivors_json,
        rounds_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.userId,
      payload.missionId,
      payload.intruderId,
      payload.arm,
      payload.system,
      payload.position,
      payload.orbit,
      payload.defenderName,
      payload.result.winner,
      JSON.stringify(payload.result.attackerStart),
      JSON.stringify(payload.result.defenderStart),
      JSON.stringify(payload.result.attackerSurvivors),
      JSON.stringify(payload.result.defenderSurvivors),
      JSON.stringify(payload.result.rounds),
      payload.now
    );
  return Number(info.lastInsertRowid);
}

export function applyIntruderBattleResult(
  db: Database.Database,
  intruderId: string,
  defenderSurvivors: Record<string, number>
) {
  if (totalShips(defenderSurvivors) <= 0) {
    db.prepare(`DELETE FROM orbit_intruders WHERE id = ?`).run(intruderId);
    return;
  }
  db.prepare(`UPDATE orbit_intruders SET units_json = ? WHERE id = ?`).run(
    JSON.stringify(defenderSurvivors),
    intruderId
  );
}

export function fightMissionAgainstIntruder(
  db: Database.Database,
  catalog: GameCatalog,
  mission: FleetMissionRow,
  intruder: {
    id: string;
    name: string;
    units: Record<string, number>;
  },
  now: number
): { reportId: number; result: BattleResult } {
  const attackerUnits = parseJsonRecord(mission.units_json);
  const result = resolveFleetBattle(catalog, attackerUnits, intruder.units);

  const reportId = saveBattleReport(db, {
    userId: mission.user_id,
    missionId: mission.id,
    intruderId: intruder.id,
    arm: mission.target_arm,
    system: mission.target_system,
    position: mission.target_position,
    orbit: mission.target_orbit as LocalOrbitId,
    defenderName: intruder.name,
    result,
    now,
  });

  applyIntruderBattleResult(db, intruder.id, result.defenderSurvivors);

  if (totalShips(result.attackerSurvivors) <= 0) {
    db.prepare(`DELETE FROM fleet_missions WHERE id = ?`).run(mission.id);
  } else {
    db.prepare(`UPDATE fleet_missions SET units_json = ? WHERE id = ?`).run(
      JSON.stringify(result.attackerSurvivors),
      mission.id
    );
  }

  return { reportId, result };
}

export function listBattleReports(
  db: Database.Database,
  userId: number,
  limit = 20
): BattleReportRow[] {
  return db
    .prepare(
      `SELECT * FROM battle_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(userId, limit) as BattleReportRow[];
}

export function serializeBattleReport(
  row: BattleReportRow,
  catalog: GameCatalog
) {
  const unitNames = new Map(catalog.units.map((u) => [u.id, u.name]));
  const fmtStacks = (json: string) => {
    const stacks = parseJsonRecord(json);
    return Object.entries(stacks)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({
        unitId: id,
        name: unitNames.get(id) ?? id,
        quantity: q,
      }));
  };

  let rounds: BattleResult["rounds"] = [];
  try {
    rounds = JSON.parse(row.rounds_json) as BattleResult["rounds"];
  } catch {
    rounds = [];
  }

  return {
    id: row.id,
    missionId: row.mission_id,
    intruderId: row.intruder_id,
    location: {
      arm: row.location_arm,
      system: row.location_system,
      position: row.location_position,
      orbit: row.location_orbit as LocalOrbitId,
    },
    defenderName: row.defender_name,
    winner: row.winner as BattleResult["winner"],
    attackerStart: fmtStacks(row.attacker_start_json),
    defenderStart: fmtStacks(row.defender_start_json),
    attackerSurvivors: fmtStacks(row.attacker_survivors_json),
    defenderSurvivors: fmtStacks(row.defender_survivors_json),
    rounds,
    createdAt: row.created_at,
  };
}

export function resolveArrivalBattles(
  db: Database.Database,
  catalog: GameCatalog,
  now: number
): number[] {
  const arriving = db
    .prepare(
      `SELECT * FROM fleet_missions WHERE status = 'outbound' AND arrives_at <= ?`
    )
    .all(now) as FleetMissionRow[];

  const reportIds: number[] = [];

  for (const mission of arriving) {
    const intruders = intrudersAtCoords(
      db,
      mission.target_arm,
      mission.target_system,
      mission.target_position,
      mission.target_orbit as LocalOrbitId
    );

    if (intruders.length > 0) {
      const intruder = intruders[0];
      const { reportId, result } = fightMissionAgainstIntruder(db, catalog, mission, {
        id: intruder.id,
        name: intruder.name,
        units: intruder.units,
      }, now);
      reportIds.push(reportId);
      logGameEvent(db, {
        kind: "battle.arrival",
        userId: mission.user_id,
        message: `Бой при прибытии на [${mission.target_arm}:${mission.target_system}:${mission.target_position}] — ${intruder.name}`,
        details: {
          reportId,
          missionId: mission.id,
          intruderId: intruder.id,
          winner: result.winner,
        },
      });

      const stillAlive = db
        .prepare(`SELECT 1 FROM fleet_missions WHERE id = ?`)
        .get(mission.id);
      if (stillAlive) {
        db.prepare(`UPDATE fleet_missions SET status = 'holding' WHERE id = ?`).run(
          mission.id
        );
      }
    } else {
      db.prepare(`UPDATE fleet_missions SET status = 'holding' WHERE id = ?`).run(
        mission.id
      );
    }
  }

  return reportIds;
}

export function attackIntruderFromMission(
  db: Database.Database,
  catalog: GameCatalog,
  userId: number,
  missionId: number,
  now: number
): { ok: true; reportId: number; winner: string } | { ok: false; error: string } {
  const mission = db
    .prepare(`SELECT * FROM fleet_missions WHERE id = ? AND user_id = ?`)
    .get(missionId, userId) as FleetMissionRow | undefined;
  if (!mission) return { ok: false, error: "mission_not_found" };
  if (mission.status !== "holding") return { ok: false, error: "not_at_coords" };

  const intruders = intrudersAtCoords(
    db,
    mission.target_arm,
    mission.target_system,
    mission.target_position,
    mission.target_orbit as LocalOrbitId
  );
  if (intruders.length === 0) return { ok: false, error: "no_intruder" };

  const intruder = intruders[0];
  const { reportId, result } = fightMissionAgainstIntruder(
    db,
    catalog,
    mission,
    { id: intruder.id, name: intruder.name, units: intruder.units },
    now
  );

  return { ok: true, reportId, winner: result.winner };
}
