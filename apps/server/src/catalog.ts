import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogSchema, type FleetUnitDef, type GameCatalog } from "@sw/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolve repo `content/` from apps/server (dev or dist). */
export function contentDir(): string {
  return path.resolve(__dirname, "..", "..", "..", "content");
}

async function readJsonFile(dir: string, filename: string): Promise<unknown> {
  const raw = await readFile(path.join(dir, filename), "utf-8");
  return JSON.parse(raw);
}

export async function loadCatalog(): Promise<GameCatalog> {
  const dir = contentDir();
  const [
    world,
    resources,
    factions,
    buildings,
    units,
    research,
    defense,
    satelliteBuildings,
    officers,
    items,
    abilities,
    planetTypes,
    localSpace,
  ] = await Promise.all([
    readJsonFile(dir, "world.json"),
    readJsonFile(dir, "resources.json"),
    readJsonFile(dir, "factions.json"),
    readJsonFile(dir, "buildings.json"),
    readJsonFile(dir, "units.json"),
    readJsonFile(dir, "research.json"),
    readJsonFile(dir, "defense.json"),
    readJsonFile(dir, "satellite_buildings.json"),
    readJsonFile(dir, "officers.json"),
    readJsonFile(dir, "items.json"),
    readJsonFile(dir, "abilities.json"),
    readJsonFile(dir, "planet_types.json"),
    readJsonFile(dir, "local_space.json"),
  ]);
  const raw = {
    world,
    resources,
    factions,
    buildings,
    units,
    research,
    defense,
    satelliteBuildings,
    officers,
    items,
    abilities,
    planetTypes,
    localSpace,
  };
  return catalogSchema.parse(raw);
}

export function planetTypeMap(
  catalog: GameCatalog
): Map<string, (typeof catalog.planetTypes)[0]> {
  return new Map(catalog.planetTypes.map((t) => [t.id, t]));
}

export function buildingMap(catalog: GameCatalog): Map<string, (typeof catalog.buildings)[0]> {
  return new Map(catalog.buildings.map((b) => [b.id, b]));
}

export function fleetUnitMap(catalog: GameCatalog): Map<string, FleetUnitDef> {
  return new Map(catalog.units.map((u) => [u.id, u]));
}

export function defenseUnitMap(catalog: GameCatalog): Map<string, FleetUnitDef> {
  return new Map(catalog.defense.map((d) => [d.id, d]));
}

export function researchMap(
  catalog: GameCatalog
): Map<string, (typeof catalog.research)[0]> {
  return new Map(catalog.research.map((r) => [r.id, r]));
}

