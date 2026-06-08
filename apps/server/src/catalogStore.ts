import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildingSchema,
  defenseUnitSchema,
  planetTypeSchema,
  researchItemSchema,
  unitSchema,
  type GameCatalog,
} from "@sw/shared";
import { z } from "zod";
import { contentDir, loadCatalog } from "./catalog.js";

export type CatalogRef = { current: GameCatalog };

export type CatalogSection =
  | "buildings"
  | "units"
  | "defense"
  | "research"
  | "planetTypes";

const SECTION_META: Record<
  CatalogSection,
  { file: string; key: keyof GameCatalog; itemSchema: z.ZodTypeAny }
> = {
  buildings: { file: "buildings.json", key: "buildings", itemSchema: buildingSchema },
  units: { file: "units.json", key: "units", itemSchema: unitSchema },
  defense: { file: "defense.json", key: "defense", itemSchema: defenseUnitSchema },
  research: { file: "research.json", key: "research", itemSchema: researchItemSchema },
  planetTypes: {
    file: "planet_types.json",
    key: "planetTypes",
    itemSchema: planetTypeSchema,
  },
};

export function catalogSectionItems(
  catalog: GameCatalog,
  section: CatalogSection
): unknown[] {
  const key = SECTION_META[section].key;
  const items = catalog[key];
  return Array.isArray(items) ? items : [];
}

export async function patchCatalogItem(
  ref: CatalogRef,
  section: CatalogSection,
  id: string,
  patch: Record<string, unknown>
): Promise<unknown> {
  const meta = SECTION_META[section];
  const filePath = path.join(contentDir(), meta.file);
  const raw = JSON.parse(await readFile(filePath, "utf-8")) as Record<string, unknown>[];
  if (!Array.isArray(raw)) throw new Error("invalid_catalog_file");

  const idx = raw.findIndex((x) => x.id === id);
  if (idx < 0) throw new Error("not_found");

  const merged = { ...raw[idx], ...patch, id };
  meta.itemSchema.parse(merged);
  raw[idx] = merged;

  await writeFile(filePath, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");
  ref.current = await loadCatalog();
  return merged;
}
