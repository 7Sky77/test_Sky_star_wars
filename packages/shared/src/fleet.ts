import type { LocalOrbitId } from "./coords.js";
import { ORBIT_LABELS_RU } from "./coords.js";
import type { WorldConfig } from "./schemas.js";
import { isValidGalaxyCoords } from "./coords.js";

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

/** Время полёта в секундах (MVP: расстояние по галактике, скорость %). */
export function fleetFlightSeconds(
  from: { arm: number; system: number; position: number },
  to: { arm: number; system: number; position: number },
  speedPct: number
): number {
  const da = Math.abs(to.arm - from.arm);
  const ds = Math.abs(to.system - from.system);
  const dp = Math.abs(to.position - from.position);
  const dist = da * 2000 + ds * 100 + dp * 10 + 30;
  const speed = Math.max(10, Math.min(100, speedPct)) / 100;
  return Math.max(30, Math.floor(dist / speed));
}

export function formatMissionTarget(
  arm: number,
  system: number,
  position: number,
  orbit: LocalOrbitId
): string {
  return `[${arm}:${system}:${position}] · ${orbitLabel(orbit)}`;
}
