import type { LocalOrbitId, LocalIntruderKind } from "./coords.js";
import { INTRUDER_KIND_LABELS_RU } from "./coords.js";
import type { OrbitIntruderDef } from "./schemas.js";

export type { OrbitIntruderDef };

export function intruderKindLabel(kind: LocalIntruderKind): string {
  return INTRUDER_KIND_LABELS_RU[kind];
}

export function intruderTotalShips(units: Record<string, number>): number {
  return Object.values(units).reduce((s, n) => s + Math.max(0, Math.floor(n)), 0);
}

export function intrudersAtCoords(
  intruders: OrbitIntruderDef[],
  arm: number,
  system: number,
  position: number,
  orbit?: LocalOrbitId
): OrbitIntruderDef[] {
  return intruders.filter(
    (i) =>
      i.arm === arm &&
      i.system === system &&
      i.position === position &&
      (orbit == null || i.orbit === orbit)
  );
}

export function intrudersInSystem(
  intruders: OrbitIntruderDef[],
  arm: number,
  system: number
): OrbitIntruderDef[] {
  return intruders.filter((i) => i.arm === arm && i.system === system);
}
