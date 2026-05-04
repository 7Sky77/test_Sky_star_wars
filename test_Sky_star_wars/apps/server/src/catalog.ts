import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogSchema, type GameCatalog } from "@sw/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolve repo `content/` from apps/server (dev or dist). */
export function contentDir(): string {
  return path.resolve(__dirname, "..", "..", "..", "content");
}

export async function loadCatalog(): Promise<GameCatalog> {
  const dir = contentDir();
  const [world, resources, factions, buildings, units] = await Promise.all([
    readFile(path.join(dir, "world.json"), "utf-8"),
    readFile(path.join(dir, "resources.json"), "utf-8"),
    readFile(path.join(dir, "factions.json"), "utf-8"),
    readFile(path.join(dir, "buildings.json"), "utf-8"),
    readFile(path.join(dir, "units.json"), "utf-8"),
  ]);
  const raw = {
    world: JSON.parse(world),
    resources: JSON.parse(resources),
    factions: JSON.parse(factions),
    buildings: JSON.parse(buildings),
    units: JSON.parse(units),
  };
  return catalogSchema.parse(raw);
}

export function buildingMap(catalog: GameCatalog): Map<string, (typeof catalog.buildings)[0]> {
  return new Map(catalog.buildings.map((b) => [b.id, b]));
}
