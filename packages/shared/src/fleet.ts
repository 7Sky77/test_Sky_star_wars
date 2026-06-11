import type { LocalOrbitId } from "./coords.js";
import { ORBIT_LABELS_RU } from "./coords.js";
import type { GameCatalog, WorldConfig } from "./schemas.js";
import { isValidGalaxyCoords } from "./coords.js";

/** Базовая скорость корабля для расчёта полёта (истребитель ≈ 700). */
export const FLEET_SPEED_REFERENCE = 400;

export type FleetMissionType = "hold" | "attack";
export type FleetMissionStatus = "outbound" | "holding" | "returning";

export const FLEET_MISSION_STATUS_RU: Record<FleetMissionStatus, string> = {
  outbound: "В пути",
  holding: "На орбите",
  returning: "Возврат на планету",
};

export const FLEET_MISSION_LABELS_RU: Record<FleetMissionType, string> = {
  hold: "Оборона (удержание)",
  attack: "Атака",
};

export function orbitLabel(orbit: LocalOrbitId): string {
  return ORBIT_LABELS_RU[orbit];
}

export function validateMissionTarget(
  arm: number,
  system: number,
  position: number,
  world: Pick<
    WorldConfig,
    "minArm" | "maxArm" | "minSystem" | "maxSystem" | "starSlot" | "maxPlanetSlot"
  >
): boolean {
  return isValidGalaxyCoords(arm, system, position, world);
}

/** Скорость флота = самый медленный корабль в составе (как в OGame). */
export function fleetSlowestSpeed(
  catalog: Pick<GameCatalog, "units">,
  units: Record<string, number>
): number {
  const byId = new Map(catalog.units.map((u) => [u.id, u]));
  let slowest = Infinity;
  for (const [unitId, rawQty] of Object.entries(units)) {
    const qty = Math.floor(Number(rawQty));
    if (qty <= 0) continue;
    const def = byId.get(unitId);
    const spd = def?.stats?.speed ?? 0;
    if (spd > 0) slowest = Math.min(slowest, spd);
  }
  return slowest === Infinity ? 500 : slowest;
}

export function fleetSlowestUnitName(
  catalog: Pick<GameCatalog, "units">,
  units: Record<string, number>
): string | null {
  const byId = new Map(catalog.units.map((u) => [u.id, u]));
  let slowest = Infinity;
  let name: string | null = null;
  for (const [unitId, rawQty] of Object.entries(units)) {
    const qty = Math.floor(Number(rawQty));
    if (qty <= 0) continue;
    const def = byId.get(unitId);
    const spd = def?.stats?.speed ?? 0;
    if (spd > 0 && spd < slowest) {
      slowest = spd;
      name = def?.name ?? unitId;
    }
  }
  return name;
}

/** Время полёта в секундах: расстояние + медленнейший корабль + ползунок %. */
export function fleetFlightSeconds(
  from: { arm: number; system: number; position: number },
  to: { arm: number; system: number; position: number },
  speedPct: number,
  fleetSlowestSpeedStat = 500
): number {
  const da = Math.abs(to.arm - from.arm);
  const ds = Math.abs(to.system - from.system);
  const dp = Math.abs(to.position - from.position);

  if (da === 0 && ds === 0 && dp === 0) return 12;

  let seconds = 18;
  seconds += dp * 6;
  seconds += ds * 75;
  seconds += da * 240;

  const shipSpeed = Math.max(100, fleetSlowestSpeedStat);
  const speedFactor = shipSpeed / FLEET_SPEED_REFERENCE;
  const throttle = Math.max(10, Math.min(100, speedPct)) / 100;

  return Math.max(12, Math.floor(seconds / (speedFactor * throttle)));
}

export function formatMissionTarget(
  arm: number,
  system: number,
  position: number,
  orbit: LocalOrbitId
): string {
  return `[${arm}:${system}:${position}] · ${orbitLabel(orbit)}`;
}
