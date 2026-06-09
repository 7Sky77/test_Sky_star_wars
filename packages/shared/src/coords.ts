import type { WorldConfig } from "./schemas.js";

/** Адрес системы на карте галактики (`[A:S]`). Для навигации по галактике. */
export interface SystemAddress {
  arm: number;
  system: number;
}

/** Координаты на карте галактики (`[A:S:P]`). `P=0` — звезда, `1…9` — планеты. */
export interface GalaxyCoords {
  arm: number;
  system: number;
  position: number;
}

/** @deprecated Используйте SystemAddress */
export type LocalCoords = SystemAddress;

/** @deprecated Используйте GalaxyCoords */
export type PlanetCoords = GalaxyCoords;

/** Локальные координаты вокруг объекта: осями X Y Z с центром в `0:0:0`. */
export interface LocalSpaceCoords {
  x: number;
  y: number;
  z: number;
}

/** Низкая / средняя / высокая орбита в локальном пространстве объекта. */
export type LocalOrbitId = "low" | "medium" | "high";

/** Что может быть в центре локальных координат вместо планеты. */
export type LocalCenterKind =
  | "planet"
  | "asteroid"
  | "temple"
  | "pirate_station"
  | "star";

/** Кто может появиться на локальных координатах как противник. */
export type LocalIntruderKind = "pirate_bot" | "player";

export const LOCAL_SPACE_CENTER: LocalSpaceCoords = { x: 0, y: 0, z: 0 };

export const LOCAL_SPACE_DESCRIPTION_RU =
  "Планета имеет мощную гравитацию и помимо обычных координат на карте галактики создаёт окрестности с локальными координатами в трёхмерном пространстве. " +
  "Центр локальных координат с осями X Y Z совпадает с центром планеты и имеет локальные координаты 0:0:0. " +
  "Планета обладает низкой, средней и высокой орбитами. На низкую орбиту встают обороняющие планету флоты. " +
  "На средней орбите могут появиться луны в результате боя или телепортироваться другие спутники. " +
  "На высокую орбиту выходят из подпространства флоты для обороны координат. " +
  "Вместо планеты в центре локальных координат может быть другой объект, например астероид, храм или планетарная пиратская станция. " +
  "На локальных координатах может появиться противник — бот-пират или другой игрок.";

export const ORBIT_LABELS_RU: Record<LocalOrbitId, string> = {
  low: "низкая орбита",
  medium: "средняя орбита",
  high: "высокая орбита",
};

export const ORBIT_DESCRIPTIONS_RU: Record<LocalOrbitId, string> = {
  low: "Обороняющие планету флоты.",
  medium: "Луны после боя и телепортируемые спутники.",
  high: "Флоты, выходящие из подпространства для обороны координат.",
};

export const CENTER_KIND_LABELS_RU: Record<LocalCenterKind, string> = {
  planet: "планета",
  asteroid: "астероид",
  temple: "храм",
  pirate_station: "планетарная пиратская станция",
  star: "звезда",
};

export const INTRUDER_KIND_LABELS_RU: Record<LocalIntruderKind, string> = {
  pirate_bot: "бот-пират",
  player: "другой игрок",
};

const SYSTEM_ADDRESS_RE = /^(\d+):(\d+)$/;
const GALAXY_COORDS_RE = /^(\d+):(\d+):(\d+)$/;
const LOCAL_SPACE_RE = /^(-?\d+):(-?\d+):(-?\d+)$/;

export function formatSystemAddress(arm: number, system: number): string {
  return `[${arm}:${system}]`;
}

export function formatGalaxyCoords(arm: number, system: number, position: number): string {
  return `[${arm}:${system}:${position}]`;
}

export function formatLocalSpaceCoords(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

/** @deprecated Используйте formatSystemAddress */
export const formatLocalCoords = formatSystemAddress;

/** @deprecated Используйте formatGalaxyCoords */
export const formatPlanetCoords = formatGalaxyCoords;

export function parseSystemAddress(input: string): SystemAddress | null {
  const s = input.trim().replace(/^\[|\]$/g, "");
  const m = SYSTEM_ADDRESS_RE.exec(s);
  if (!m) return null;
  return { arm: Number(m[1]), system: Number(m[2]) };
}

export function parseGalaxyCoords(input: string): GalaxyCoords | null {
  const s = input.trim().replace(/^\[|\]$/g, "");
  const m = GALAXY_COORDS_RE.exec(s);
  if (!m) return null;
  return { arm: Number(m[1]), system: Number(m[2]), position: Number(m[3]) };
}

export function parseLocalSpaceCoords(input: string): LocalSpaceCoords | null {
  const s = input.trim().replace(/^\[|\]$/g, "");
  const m = LOCAL_SPACE_RE.exec(s);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) };
}

/** @deprecated Используйте parseSystemAddress */
export const parseLocalCoords = parseSystemAddress;

/** @deprecated Используйте parseGalaxyCoords */
export const parsePlanetCoords = parseGalaxyCoords;

export function isValidSystemAddress(
  arm: number,
  system: number,
  world: Pick<WorldConfig, "minArm" | "maxArm" | "minSystem" | "maxSystem">
): boolean {
  return (
    Number.isInteger(arm) &&
    Number.isInteger(system) &&
    arm >= world.minArm &&
    arm <= world.maxArm &&
    system >= world.minSystem &&
    system <= world.maxSystem
  );
}

export function isValidGalaxyCoords(
  arm: number,
  system: number,
  position: number,
  world: Pick<
    WorldConfig,
    "minArm" | "maxArm" | "minSystem" | "maxSystem" | "starSlot" | "maxPlanetSlot"
  >
): boolean {
  return (
    isValidSystemAddress(arm, system, world) &&
    Number.isInteger(position) &&
    position >= world.starSlot &&
    position <= world.maxPlanetSlot
  );
}

/** @deprecated Используйте isValidSystemAddress */
export const isValidLocalCoords = isValidSystemAddress;

/** @deprecated Используйте isValidGalaxyCoords */
export const isValidPlanetCoords = isValidGalaxyCoords;

export function isColonizableSlot(
  position: number,
  world: Pick<WorldConfig, "maxPlanetSlot">
): boolean {
  return Number.isInteger(position) && position >= 1 && position <= world.maxPlanetSlot;
}

export function slotKind(position: number, starSlot = 0): "star" | "planet" {
  return position === starSlot ? "star" : "planet";
}

export function slotLabelRu(position: number, starSlot = 0): string {
  if (position === starSlot) return "звезда";
  return `слот ${position}`;
}

export function systemAddressFromGalaxy(
  coords: Pick<GalaxyCoords, "arm" | "system">
): SystemAddress {
  return { arm: coords.arm, system: coords.system };
}

/** @deprecated Используйте systemAddressFromGalaxy */
export const localCoordsFromPlanet = systemAddressFromGalaxy;

export function isLocalSpaceCenter(coords: LocalSpaceCoords): boolean {
  return coords.x === 0 && coords.y === 0 && coords.z === 0;
}
