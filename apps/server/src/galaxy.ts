import type Database from "better-sqlite3";
import type { GameCatalog, LocalOrbitId, OrbitIntruderDef } from "@sw/shared";
import {
  formatGalaxyCoords,
  formatSystemAddress,
  intruderTotalShips,
  planetParamsForCoords,
  planetTypeForCoords,
} from "@sw/shared";
import { rowToIntruder, type OrbitIntruderRow } from "./intruders.js";

export interface GalaxySlot {
  position: number;
  kind: "star" | "planet";
  /** Полные координаты `[A:S:P]`. */
  label: string;
  /** Адрес системы на карте галактики `[A:S]`. */
  systemAddress: string;
  ownerUsername?: string;
  planetName?: string;
  planetTypeId?: string;
  diameterKm?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  isYours?: boolean;
  isEmpty?: boolean;
  orbitIntruders?: {
    id: string;
    name: string;
    intruderKind: string;
    orbit: LocalOrbitId;
    totalShips: number;
    units: Record<string, number>;
  }[];
}

export interface GalaxySystemData {
  arm: number;
  system: number;
  slots: GalaxySlot[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function buildSystemSlots(
  db: Database.Database,
  catalog: GameCatalog,
  arm: number,
  system: number,
  viewerUserId: number
): GalaxySystemData {
  const w = catalog.world;
  const typeIds = catalog.planetTypes.map((t) => t.id);

  const rows = db
    .prepare(
      `SELECT p.position, p.name AS planet_name, p.user_id, p.planet_type_id,
              p.diameter_km, p.temperature_min, p.temperature_max, u.username
       FROM planets p JOIN users u ON u.id = p.user_id
       WHERE p.arm = ? AND p.system = ? AND p.position >= 1 AND p.position <= ?
       ORDER BY p.position`
    )
    .all(arm, system, w.maxPlanetSlot) as {
    position: number;
    planet_name: string;
    user_id: number;
    planet_type_id: string;
    diameter_km: number;
    temperature_min: number;
    temperature_max: number;
    username: string;
  }[];

  const byPos = new Map<number, (typeof rows)[0]>();
  for (const r of rows) byPos.set(r.position, r);

  const intruderRows = db
    .prepare(`SELECT * FROM orbit_intruders WHERE arm = ? AND system = ?`)
    .all(arm, system) as OrbitIntruderRow[];
  const intrudersByPos = new Map<number, OrbitIntruderDef[]>();
  for (const row of intruderRows) {
    const list = intrudersByPos.get(row.position) ?? [];
    list.push(rowToIntruder(row));
    intrudersByPos.set(row.position, list);
  }

  function intrudersForSlot(position: number) {
    const list = intrudersByPos.get(position);
    if (!list?.length) return undefined;
    return list.map((i) => ({
      id: i.id,
      name: i.name,
      intruderKind: i.intruderKind,
      orbit: i.orbit,
      totalShips: intruderTotalShips(i.units),
      units: i.units,
    }));
  }

  const slots: GalaxySlot[] = [
    {
      position: w.starSlot,
      kind: "star",
      label: formatGalaxyCoords(arm, system, w.starSlot),
      systemAddress: formatSystemAddress(arm, system),
    },
  ];

  for (let pos = 1; pos <= w.maxPlanetSlot; pos++) {
    const hit = byPos.get(pos);
    if (hit) {
      slots.push({
        position: pos,
        kind: "planet",
        label: formatGalaxyCoords(arm, system, pos),
        systemAddress: formatSystemAddress(arm, system),
        ownerUsername: hit.username,
        planetName: hit.planet_name,
        planetTypeId: hit.planet_type_id,
        diameterKm: hit.diameter_km,
        temperatureMin: hit.temperature_min,
        temperatureMax: hit.temperature_max,
        isYours: hit.user_id === viewerUserId,
        isEmpty: false,
        orbitIntruders: intrudersForSlot(pos),
      });
    } else {
      const params = planetParamsForCoords(arm, system, pos, w.maxPlanetSlot);
      slots.push({
        position: pos,
        kind: "planet",
        label: formatGalaxyCoords(arm, system, pos),
        systemAddress: formatSystemAddress(arm, system),
        planetTypeId: planetTypeForCoords(arm, system, pos, typeIds, w.maxPlanetSlot),
        diameterKm: params.diameterKm,
        temperatureMin: params.temperatureMin,
        temperatureMax: params.temperatureMax,
        isEmpty: true,
        orbitIntruders: intrudersForSlot(pos),
      });
    }
  }

  return { arm, system, slots };
}

export function buildGalaxySector(
  db: Database.Database,
  catalog: GameCatalog,
  arm: number,
  centerSystem: number,
  viewerUserId: number,
  span = 7
): {
  arm: number;
  centerSystem: number;
  systems: GalaxySystemData[];
} {
  const w = catalog.world;
  const a = clamp(arm, w.minArm, w.maxArm);
  const center = clamp(centerSystem, w.minSystem, w.maxSystem);
  const count = clamp(span, 3, 15);
  const half = Math.floor(count / 2);

  const systems: GalaxySystemData[] = [];
  for (let s = center - half; s <= center + half; s++) {
    if (s < w.minSystem || s > w.maxSystem) continue;
    systems.push(buildSystemSlots(db, catalog, a, s, viewerUserId));
  }

  return { arm: a, centerSystem: center, systems };
}
