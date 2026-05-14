import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogSchema, type FleetUnitDef, type GameCatalog } from "@sw/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolve repo `content/` from apps/server (dev or dist). */
export function contentDir(): string {
  return path.resolve(__dirname, "..", "..", "..", "content");
}

export async function loadCatalog(): Promise<GameCatalog> {
  const dir = contentDir();
  const [world, resources, factions, buildings, units, research, defense] =
    await Promise.all([
      readFile(path.join(dir, "world.json"), "utf-8"),
      readFile(path.join(dir, "resources.json"), "utf-8"),
      readFile(path.join(dir, "factions.json"), "utf-8"),
      readFile(path.join(dir, "buildings.json"), "utf-8"),
      readFile(path.join(dir, "units.json"), "utf-8"),
      readFile(path.join(dir, "research.json"), "utf-8"),
      readFile(path.join(dir, "defense.json"), "utf-8"),
    ]);
  const raw = {
    world: JSON.parse(world),
    resources: JSON.parse(resources),
    factions: JSON.parse(factions),
    buildings: JSON.parse(buildings),
    units: JSON.parse(units),
    research: JSON.parse(research),
    defense: JSON.parse(defense),
  };
  return catalogSchema.parse(raw);
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
