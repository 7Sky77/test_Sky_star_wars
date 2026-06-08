import { z } from "zod";

const hourlyResourceRatesSchema = z.object({
  metal: z.number().nonnegative(),
  minerals: z.number().nonnegative(),
  vespene: z.number().nonnegative(),
});

export const worldSchema = z.object({
  minArm: z.number().int().min(1),
  maxArm: z.number().int().min(1),
  minSystem: z.number().int().min(1),
  maxSystem: z.number().int().min(1),
  starSlot: z.literal(0),
  maxPlanetSlot: z.number().int().min(1).max(9),
  /** Сколько построек/улучшений можно вести одновременно на планете. */
  buildQueueSlots: z.number().int().min(1).max(10).default(3),
  /** Пассивная добыча планеты без зданий (в час). */
  baseProductionPerHour: hourlyResourceRatesSchema.default({
    metal: 20,
    minerals: 10,
    vespene: 0,
  }),
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
  /** Устар.: общий КУ задаётся в costGrowth на здании/исследовании. */
  growth: z.number().positive().optional(),
});

const scaledPartSchema = z.object({
  base: z.number().nonnegative(),
  perLevel: z.number().nonnegative(),
});

const allowedFactionsField = z.array(z.string()).optional();

export const catalogRequirementSchema = z.object({
  id: z.string(),
  level: z.number().int().positive(),
  /** building — уровень на планете; research — у игрока. По умолчанию building. */
  kind: z.enum(["building", "research"]).optional(),
  /** Подпись в UI, если отличается от названия в каталоге. */
  label: z.string().optional(),
});

export const buildingSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  allowedFactions: allowedFactionsField,
  maxLevel: z.number().int().positive(),
  /** КУ — во сколько раз дороже каждый следующий уровень (общий для всех ресурсов). */
  costGrowth: z.number().positive().optional(),
  costs: z.array(costPartSchema).min(1),
  upgradeTimeSeconds: z.object({
    base: z.number().positive(),
    growth: z.number().positive(),
  }),
  produces: z
    .object({
      resourceId: z.string(),
      /** Линейно: base + perLevel * level */
      amountPerHourBase: z.number().nonnegative().optional(),
      amountPerHourPerLevel: z.number().nonnegative().optional(),
      /** Экспоненциально: coef * level * growth^level (как в XCraft) */
      amountCoef: z.number().nonnegative().optional(),
      amountGrowth: z.number().positive().optional(),
      /** Степенно: coef * level^power (колодец, озеро, гейзер) */
      amountPower: z.number().positive().optional(),
      amountRound: z.enum(["floor", "round", "ceil"]).optional(),
    })
    .optional(),
  energyProduction: z
    .object({
      base: z.number().nonnegative().optional(),
      perLevel: z.number().nonnegative().optional(),
      coef: z.number().nonnegative().optional(),
      growth: z.number().positive().optional(),
    })
    .optional(),
  /** Линейно: base + perLevel * level; или coef * level * growth^level при coef+growth */
  energyConsumption: z
    .object({
      base: z.number().nonnegative().optional(),
      perLevel: z.number().nonnegative().optional(),
      coef: z.number().nonnegative().optional(),
      growth: z.number().positive().optional(),
    })
    .optional(),
  storageBonus: z
    .object({
      resourceId: z.string(),
      /** Линейно: base + perLevel * level */
      base: z.number().nonnegative().optional(),
      perLevel: z.number().nonnegative().optional(),
      /** Экспоненциально: floor(base * growth^(level-1)) */
      capacityBase: z.number().nonnegative().optional(),
      capacityGrowth: z.number().positive().optional(),
    })
    .optional(),
  /** Same bonus applied to metal, minerals, vespene capacity (optional). */
  storageBonusAll: scaledPartSchema.optional(),
  requirements: z.array(catalogRequirementSchema).optional(),
});

/** Базовые боевые/технические параметры (каталог; бой — позже). */
export const unitStatsSchema = z.object({
  armor: z.number().nonnegative().optional(),
  shield: z.number().nonnegative().optional(),
  speed: z.number().nonnegative().optional(),
  capacity: z.number().nonnegative().optional(),
  fuel: z.number().nonnegative().optional(),
  attack: z.number().nonnegative().optional(),
  size: z.string().optional(),
  armorType: z.string().optional(),
});

export const fleetUnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  allowedFactions: allowedFactionsField,
  /** Стоимость одной единицы (growth обычно 1). */
  costs: z.array(costPartSchema).min(1),
  buildTimeSeconds: z.number().nonnegative().default(0),
  /** Солнечный спутник: энергия на орбите за штуку (база; формула позиции — позже). */
  energyPerUnit: z.number().nonnegative().optional(),
  /** Базовые характеристики с референса (без бонусов технологий). */
  stats: unitStatsSchema.optional(),
});

export const unitSchema = fleetUnitSchema;
export const defenseUnitSchema = fleetUnitSchema;

const researchRequirementSchema = catalogRequirementSchema;

const researchLevelTableRowSchema = z.object({
  levels: z.string(),
  value: z.string(),
});

/** Исследования: каталог (стоимость 1 ур., costGrowth = КУ). */
export const researchItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  allowedFactions: allowedFactionsField,
  costGrowth: z.number().positive().optional(),
  costs: z.array(costPartSchema).min(1).optional(),
  maxLevel: z.number().int().positive().optional(),
  requirements: z.array(researchRequirementSchema).optional(),
  /** Таблица «Информация»: уровень → эффект. */
  levelTable: z
    .object({
      valueLabel: z.string(),
      rows: z.array(researchLevelTableRowSchema).min(1),
    })
    .optional(),
});

/** Бонусы типа планеты к добыче (доля, 0.08 = +8%). */
export const planetTypeBonusesSchema = z.object({
  metalProductionPct: z.number().nonnegative().optional(),
  mineralsProductionPct: z.number().nonnegative().optional(),
  vespeneProductionPct: z.number().nonnegative().optional(),
});

export const planetTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  bonuses: planetTypeBonusesSchema.optional(),
});

/** Справочные записи каталога (спутники, офицеры, предметы, способности). */
export const catalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  allowedFactions: allowedFactionsField,
});

export const catalogSchema = z.object({
  world: worldSchema,
  resources: z.array(resourceTypeSchema),
  factions: z.array(factionSchema),
  buildings: z.array(buildingSchema),
  units: z.array(unitSchema),
  research: z.array(researchItemSchema),
  defense: z.array(defenseUnitSchema),
  satelliteBuildings: z.array(catalogItemSchema).default([]),
  officers: z.array(catalogItemSchema).default([]),
  abilities: z.array(catalogItemSchema).default([]),
  items: z.array(catalogItemSchema).default([]),
  planetTypes: z.array(planetTypeSchema).default([]),
});

export type WorldConfig = z.infer<typeof worldSchema>;
export type ResourceType = z.infer<typeof resourceTypeSchema>;
export type Faction = z.infer<typeof factionSchema>;
export type CatalogRequirement = z.infer<typeof catalogRequirementSchema>;
export type BuildingDef = z.infer<typeof buildingSchema>;
export type ResearchItemDef = z.infer<typeof researchItemSchema>;
export type FleetUnitDef = z.infer<typeof fleetUnitSchema>;
export type CatalogItemDef = z.infer<typeof catalogItemSchema>;
export type PlanetTypeDef = z.infer<typeof planetTypeSchema>;
export type GameCatalog = z.infer<typeof catalogSchema>;
