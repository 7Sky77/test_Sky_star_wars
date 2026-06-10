import type Database from "better-sqlite3";
import type { GameCatalog, LocalOrbitId, OrbitIntruderDef } from "@sw/shared";
import { intruderTotalShips } from "@sw/shared";

export interface OrbitIntruderRow {
  id: string;
  name: string;
  intruder_kind: string;
  arm: number;
  system: number;
  position: number;
  orbit: string;
  units_json: string;
}

function parseUnits(json: string): Record<string, number> {
  try {
    return JSON.parse(json) as Record<string, number>;
  } catch {
    return {};
  }
}

export function rowToIntruder(row: OrbitIntruderRow): OrbitIntruderDef {
  return {
    id: row.id,
    name: row.name,
    intruderKind: row.intruder_kind as OrbitIntruderDef["intruderKind"],
    arm: row.arm,
    system: row.system,
    position: row.position,
    orbit: row.orbit as LocalOrbitId,
    units: parseUnits(row.units_json),
  };
}

export function listOrbitIntruders(db: Database.Database): OrbitIntruderDef[] {
  const rows = db
    .prepare(`SELECT * FROM orbit_intruders ORDER BY arm, system, position, orbit`)
    .all() as OrbitIntruderRow[];
  return rows.map(rowToIntruder);
}

export function intrudersAtCoords(
  db: Database.Database,
  arm: number,
  system: number,
  position: number,
  orbit?: LocalOrbitId
): OrbitIntruderDef[] {
  const rows = orbit == null
    ? (db
        .prepare(
          `SELECT * FROM orbit_intruders WHERE arm = ? AND system = ? AND position = ?`
        )
        .all(arm, system, position) as OrbitIntruderRow[])
    : (db
        .prepare(
          `SELECT * FROM orbit_intruders WHERE arm = ? AND system = ? AND position = ? AND orbit = ?`
        )
        .all(arm, system, position, orbit) as OrbitIntruderRow[]);
  return rows.map(rowToIntruder);
}

export function serializeOrbitIntruder(
  intruder: OrbitIntruderDef,
  catalog: GameCatalog
) {
  const unitNames = new Map(catalog.units.map((u) => [u.id, u.name]));
  const units = Object.entries(intruder.units)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({
      unitId: id,
      name: unitNames.get(id) ?? id,
      quantity: qty,
    }));
  return {
    id: intruder.id,
    name: intruder.name,
    intruderKind: intruder.intruderKind,
    arm: intruder.arm,
    system: intruder.system,
    position: intruder.position,
    orbit: intruder.orbit,
    units: intruder.units,
    unitDetails: units,
    totalShips: intruderTotalShips(intruder.units),
  };
}

/** Пират на высокой орбите в системе игрока (если ещё нет). */
export function ensureSystemPirate(
  db: Database.Database,
  arm: number,
  system: number,
  excludePosition: number
) {
  const hit = db
    .prepare(
      `SELECT 1 FROM orbit_intruders
       WHERE arm = ? AND system = ? AND orbit = 'high' AND intruder_kind = 'pirate_bot'
       LIMIT 1`
    )
    .get(arm, system);
  if (hit) return;

  let position = 8;
  if (position === excludePosition) {
    position = excludePosition >= 9 ? 1 : excludePosition + 1;
  }

  const id = `pirate_${arm}_${system}_${position}_high`;
  db.prepare(
    `INSERT OR IGNORE INTO orbit_intruders
     (id, name, intruder_kind, arm, system, position, orbit, units_json)
     VALUES (?, 'Пират', 'pirate_bot', ?, ?, ?, 'high', ?)`
  ).run(id, arm, system, position, JSON.stringify({ fighter: 5 }));
}

export function seedOrbitIntrudersFromCatalog(
  db: Database.Database,
  catalog: GameCatalog
) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO orbit_intruders
     (id, name, intruder_kind, arm, system, position, orbit, units_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const i of catalog.orbitIntruders) {
    insert.run(
      i.id,
      i.name,
      i.intruderKind,
      i.arm,
      i.system,
      i.position,
      i.orbit,
      JSON.stringify(i.units)
    );
  }
}
