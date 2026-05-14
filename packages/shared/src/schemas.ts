import { z } from "zod";

export const worldSchema = z.object({
  minArm: z.number().int().min(1),
  maxArm: z.number().int().min(1),
  minSystem: z.number().int().min(1),
  maxSystem: z.number().int().min(1),
  starSlot: z.literal(0),
  maxPlanetSlot: z.number().int().min(1).max(9),
});

export const resourceTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
});

export const factionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  loreName: z.string().optional(),
});

const costPartSchema = z.object({
  resourceId: z.string(),
  base: z.number().nonnegative(),
  growth: z.number().positive(),
});

const scaledPartSchema = z.object({
  base: z.number().nonnegative(),
  perLevel: z.number().nonnegative(),
});

export const buildingSchema = z.object({
  id: z.string(),
  name: z.string(),
  maxLevel: z.number().int().positive(),
  costs: z.array(costPartSchema).min(1),
  upgradeTimeSeconds: z.object({
    base: z.number().positive(),
    growth: z.number().positive(),
  }),
  produces: z
    .object({
      resourceId: z.string(),
      amountPerHourBase: z.number().nonnegative(),
      amountPerHourPerLevel: z.number().nonnegative(),
    })
    .optional(),
  energyProduction: scaledPartSchema.optional(),
  energyConsumption: scaledPartSchema.optional(),
  storageBonus: z
    .object({
      resourceId: z.string(),
      base: z.number().nonnegative(),
      perLevel: z.number().nonnegative(),
    })
    .optional(),
  /** Same bonus applied to metal, crystal, deuterium capacity (optional). */
  storageBonusAll: scaledPartSchema.optional(),
});

export const fleetUnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  /** Стоимость одной единицы (growth обычно 1). */
  costs: z.array(costPartSchema).min(1),
  buildTimeSeconds: z.number().nonnegative().default(0),
  /** Солнечный спутник: энергия на орбите за штуку. */
  energyPerUnit: z.number().nonnegative().optional(),
});

export const unitSchema = fleetUnitSchema;
export const defenseUnitSchema = fleetUnitSchema;

/** Исследования: минимальная схема для каталога (расширяем позже). */
export const researchItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

export const catalogSchema = z.object({
  world: worldSchema,
  resources: z.array(resourceTypeSchema),
  factions: z.array(factionSchema),
  buildings: z.array(buildingSchema),
  units: z.array(unitSchema),
  research: z.array(researchItemSchema),
  defense: z.array(defenseUnitSchema),
});

export type WorldConfig = z.infer<typeof worldSchema>;
export type ResourceType = z.infer<typeof resourceTypeSchema>;
export type Faction = z.infer<typeof factionSchema>;
export type BuildingDef = z.infer<typeof buildingSchema>;
export type FleetUnitDef = z.infer<typeof fleetUnitSchema>;
export type GameCatalog = z.infer<typeof catalogSchema>;
