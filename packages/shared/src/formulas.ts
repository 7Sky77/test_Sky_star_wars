import type {
  BuildingDef,
  CatalogRequirement,
  FleetUnitDef,
  PlanetTypeDef,
  ResearchItemDef,
  SpecializationModifier,
  WorldConfig,
} from "./schemas.js";

export type ResourceRates = { metal: number; minerals: number; vespene: number };

/** КУ (коэффициент удорожания): один на все ресурсы постройки/исследования. */
export function costGrowthKu(item: {
  costGrowth?: number;
  costs?: { growth?: number }[];
}): number {
  if (item.costGrowth != null) return item.costGrowth;
  const fromPart = item.costs?.find((c) => c.growth != null)?.growth;
  return fromPart ?? 1;
}

/** Cost to upgrade from `currentLevel` -> currentLevel+1 (currentLevel is 0-based level before upgrade). */
export function upgradeCostForLevel(b: BuildingDef, currentLevel: number): Record<string, number> {
  const out: Record<string, number> = {};
  const L = Math.max(0, currentLevel);
  const ku = costGrowthKu(b);
  for (const c of b.costs) {
    out[c.resourceId] = Math.floor(c.base * Math.pow(ku, L));
  }
  return out;
}

/** Стоимость исследования (та же формула КУ, если появится очередь исследований). */
export function researchCostForLevel(
  r: ResearchItemDef,
  currentLevel: number
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!r.costs?.length) return out;
  const L = Math.max(0, currentLevel);
  const ku = costGrowthKu(r);
  for (const c of r.costs) {
    out[c.resourceId] = Math.floor(c.base * Math.pow(ku, L));
  }
  return out;
}

/** Время исследования (сек): от стоимости и уровня лаборатории на планете. */
export function researchDurationSeconds(
  r: ResearchItemDef,
  currentLevel: number,
  labLevel: number
): number {
  const cost = researchCostForLevel(r, currentLevel);
  const sum =
    (cost.metal ?? 0) + (cost.minerals ?? 0) + (cost.vespene ?? 0);
  const lab = Math.max(1, labLevel);
  return Math.max(10, Math.floor(sum / (80 * lab)));
}

export function catalogRequirementsMet(
  requirements: CatalogRequirement[] | undefined,
  buildingLevels: Map<string, number>,
  researchLevels: Map<string, number>
): boolean {
  for (const req of requirements ?? []) {
    const have =
      req.kind === "research"
        ? (researchLevels.get(req.id) ?? 0)
        : (buildingLevels.get(req.id) ?? 0);
    if (have < req.level) return false;
  }
  return true;
}

export function buildingRequirementsMet(
  b: BuildingDef,
  buildingLevels: Map<string, number>,
  researchLevels: Map<string, number>
): boolean {
  return catalogRequirementsMet(b.requirements, buildingLevels, researchLevels);
}

export function researchRequirementsMet(
  r: ResearchItemDef,
  levels: Map<string, number>
): boolean {
  return catalogRequirementsMet(
    r.requirements,
    new Map<string, number>(),
    levels
  );
}

export function upgradeTimeSecondsForLevel(b: BuildingDef, currentLevel: number): number {
  const L = Math.max(0, currentLevel);
  return Math.floor(b.upgradeTimeSeconds.base * Math.pow(b.upgradeTimeSeconds.growth, L));
}

function scaledPerLevel(
  level: number,
  linear: { base?: number; perLevel?: number } | undefined,
  exp: { coef?: number; growth?: number } | undefined,
  round: "floor" | "round" | "ceil" = "floor"
): number {
  if (exp?.coef != null && exp.growth != null) {
    const raw = exp.coef * level * Math.pow(exp.growth, level);
    if (round === "ceil") return Math.ceil(raw);
    if (round === "round") return Math.round(raw);
    return Math.floor(raw);
  }
  const base = linear?.base ?? 0;
  const per = linear?.perLevel ?? 0;
  return base + per * level;
}

export function productionPerHour(
  b: BuildingDef,
  level: number
): { resourceId: string; amount: number } | null {
  if (!b.produces || level <= 0) return null;
  const p = b.produces;
  let amount: number;
  const prodRound = p.amountRound ?? "floor";
  if (p.amountCoef != null && p.amountPower != null) {
    const raw = p.amountCoef * Math.pow(level, p.amountPower);
    if (prodRound === "ceil") amount = Math.ceil(raw);
    else if (prodRound === "round") amount = Math.round(raw);
    else amount = Math.floor(raw);
  } else if (p.amountCoef != null && p.amountGrowth != null) {
    amount = scaledPerLevel(
      level,
      {},
      { coef: p.amountCoef, growth: p.amountGrowth },
      prodRound
    );
  } else {
    amount = scaledPerLevel(
      level,
      { base: p.amountPerHourBase, perLevel: p.amountPerHourPerLevel },
      {},
      "floor"
    );
  }
  return { resourceId: p.resourceId, amount };
}

export function energyProduction(b: BuildingDef, level: number): number {
  if (!b.energyProduction || level <= 0) return 0;
  const e = b.energyProduction;
  return scaledPerLevel(
    level,
    { base: e.base, perLevel: e.perLevel },
    { coef: e.coef, growth: e.growth },
    "floor"
  );
}

export function energyConsumption(b: BuildingDef, level: number): number {
  if (!b.energyConsumption || level <= 0) return 0;
  const e = b.energyConsumption;
  return scaledPerLevel(
    level,
    { base: e.base, perLevel: e.perLevel },
    { coef: e.coef, growth: e.growth },
    "ceil"
  );
}

export function storageBonusForResource(
  b: BuildingDef,
  level: number
): { resourceId: string; amount: number } | null {
  if (!b.storageBonus || level <= 0) return null;
  const s = b.storageBonus;
  let amount: number;
  if (s.capacityBase != null && s.capacityGrowth != null) {
    amount = Math.floor(s.capacityBase * Math.pow(s.capacityGrowth, level - 1));
  } else {
    amount = (s.base ?? 0) + (s.perLevel ?? 0) * level;
  }
  return { resourceId: s.resourceId, amount };
}

/** Extra capacity for metal, minerals, vespene (same value each). */
export function storageBonusAllAmount(b: BuildingDef, level: number): number {
  if (!b.storageBonusAll || level <= 0) return 0;
  return b.storageBonusAll.base + b.storageBonusAll.perLevel * level;
}

export const DEFAULT_STORAGE = { metal: 10_000, minerals: 10_000, vespene: 5_000 };

export type PlanetParams = {
  diameterKm: number;
  temperatureMin: number;
  temperatureMax: number;
};

function coordSeed(arm: number, system: number, position: number, salt: number): number {
  const h =
    arm * 7919 +
    system * 104_729 +
    position * 15_485_863 +
    salt * 2_654_435_761;
  return Math.abs(h | 0);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const PLANET_DIAMETER_MIN_KM = 2400;
const PLANET_DIAMETER_MAX_KM = 20_000;
const PLANET_TEMP_MIN_C = -200;
const PLANET_TEMP_MAX_C = 200;

/**
 * Диаметр и температура по координатам.
 * Ближе к звезде — меньше диаметр и выше t°; дальше — крупнее и холоднее.
 * Координаты дают детерминированный «рандом» в пределах диапазонов.
 */
export function planetParamsForCoords(
  arm: number,
  system: number,
  position: number,
  maxPlanetSlot = 9
): PlanetParams {
  const span = Math.max(1, maxPlanetSlot - 1);
  const dist = clamp(position - 1, 0, span) / span;

  const s1 = coordSeed(arm, system, position, 1);
  const s2 = coordSeed(arm, system, position, 2);
  const s3 = coordSeed(arm, system, position, 3);
  const s4 = coordSeed(arm, system, position, 4);

  const orbitDiameter =
    PLANET_DIAMETER_MIN_KM + dist * (PLANET_DIAMETER_MAX_KM - PLANET_DIAMETER_MIN_KM);
  const randomDiameter =
    PLANET_DIAMETER_MIN_KM +
    (s4 % (PLANET_DIAMETER_MAX_KM - PLANET_DIAMETER_MIN_KM + 1));
  // Орбита задаёт лишь слабый тренд (25–45%), остальное — «рандом» координат.
  const orbitInfluence = 0.25 + (s1 % 21) / 100;
  const baseDiameter =
    orbitDiameter * orbitInfluence + randomDiameter * (1 - orbitInfluence);
  const diamJitter = ((s2 % 41) - 20) / 100;
  const diameterKm = Math.round(
    clamp(baseDiameter * (1 + diamJitter), PLANET_DIAMETER_MIN_KM, PLANET_DIAMETER_MAX_KM)
  );

  const baseTempMax =
    PLANET_TEMP_MAX_C - dist * (PLANET_TEMP_MAX_C - PLANET_TEMP_MIN_C);
  const tempJitter = (s2 % 51) - 25;
  const temperatureMax = clamp(
    Math.round(baseTempMax + tempJitter),
    PLANET_TEMP_MIN_C,
    PLANET_TEMP_MAX_C
  );
  const tempSpan = 10 + (s3 % 41);
  const temperatureMin = clamp(
    temperatureMax - tempSpan,
    PLANET_TEMP_MIN_C,
    temperatureMax - 1
  );

  return { diameterKm, temperatureMin, temperatureMax };
}

function climateDist(position: number, maxPlanetSlot: number): number {
  const span = Math.max(1, maxPlanetSlot - 1);
  return clamp(position - 1, 0, span) / span;
}

function isPlanetTypeClimaticallyAllowed(
  typeId: string,
  temperatureMax: number,
  dist: number
): boolean {
  switch (typeId) {
    case "ice":
      return temperatureMax < 20;
    case "sand":
    case "dry":
      return temperatureMax > 55;
    case "jungle":
      return temperatureMax > 12 && temperatureMax < 105;
    case "water":
      return temperatureMax > 0 && temperatureMax < 85;
    case "gas":
      return dist > 0.55 || temperatureMax > 35;
    default:
      return true;
  }
}

/** Тип планеты по климату (температура + орбита), с детерминированным выбором среди подходящих. */
function planetTypeForClimate(
  temperatureMax: number,
  dist: number,
  arm: number,
  system: number,
  position: number,
  typeIds: readonly string[]
): string {
  if (typeIds.length === 0) return "normal";

  const allowed = typeIds.filter((id) =>
    isPlanetTypeClimaticallyAllowed(id, temperatureMax, dist)
  );
  const pool = allowed.length > 0 ? allowed : [...typeIds];

  const weights = new Map<string, number>();
  for (const id of pool) weights.set(id, 0);

  const add = (id: string, n: number) => {
    if (!pool.includes(id)) return;
    weights.set(id, (weights.get(id) ?? 0) + n);
  };

  if (temperatureMax < -20) {
    add("ice", 12);
    add("normal", 2);
    add("industrial", 1);
  } else if (temperatureMax < 15) {
    add("ice", 6);
    add("normal", 4);
    add("industrial", 3);
    add("water", 2);
  } else if (temperatureMax < 45) {
    add("normal", 5);
    add("water", 6);
    add("jungle", 5);
    add("industrial", 3);
  } else if (temperatureMax < 90) {
    add("jungle", 6);
    add("water", 4);
    add("sand", 4);
    add("normal", 3);
    add("industrial", 2);
  } else {
    add("sand", 8);
    add("dry", 7);
    add("gas", 4);
    add("normal", 1);
  }

  if (dist < 0.35) {
    add("sand", 4);
    add("dry", 4);
    add("gas", 2);
    add("ice", -8);
    add("jungle", -2);
  } else if (dist > 0.65) {
    add("ice", 7);
    add("gas", 4);
    add("sand", -5);
    add("dry", -4);
    add("jungle", -3);
  } else if (temperatureMax > 5) {
    add("jungle", 3);
    add("water", 3);
    add("normal", 2);
  }

  const candidates = pool.filter((id) => (weights.get(id) ?? 0) > 0);
  const pickFrom = candidates.length > 0 ? candidates : pool;

  let total = 0;
  for (const id of pickFrom) total += Math.max(1, weights.get(id) ?? 0);

  let roll = coordSeed(arm, system, position, 9) % total;
  for (const id of pickFrom) {
    roll -= Math.max(1, weights.get(id) ?? 0);
    if (roll < 0) return id;
  }
  return pickFrom[pickFrom.length - 1] ?? "normal";
}

/** Тип планеты по координатам — согласован с температурой и орбитой. */
export function planetTypeForCoords(
  arm: number,
  system: number,
  position: number,
  typeIds: readonly string[],
  maxPlanetSlot = 9
): string {
  const params = planetParamsForCoords(arm, system, position, maxPlanetSlot);
  const dist = climateDist(position, maxPlanetSlot);
  return planetTypeForClimate(
    params.temperatureMax,
    dist,
    arm,
    system,
    position,
    typeIds
  );
}

export function planetTypeProductionMultipliers(
  planetType: PlanetTypeDef | undefined
): { metal: number; minerals: number; vespene: number } {
  const b = planetType?.bonuses;
  return {
    metal: 1 + (b?.metalProductionPct ?? 0),
    minerals: 1 + (b?.mineralsProductionPct ?? 0),
    vespene: 1 + (b?.vespeneProductionPct ?? 0),
  };
}

/** Базовая добыча планеты (без зданий), в час. */
export function baseProductionPerHour(world: WorldConfig): ResourceRates {
  const b = world.baseProductionPerHour;
  return {
    metal: b?.metal ?? 20,
    minerals: b?.minerals ?? 10,
    vespene: b?.vespene ?? 0,
  };
}

/** Производство в час: база планеты + здания (с учётом энергии) + бонус типа планеты. */
export function computeProductionRatesPerHour(opts: {
  buildings: BuildingDef[];
  levels: Map<string, number>;
  units: FleetUnitDef[];
  fleetCounts: Map<string, number>;
  planetType: PlanetTypeDef | undefined;
  world: WorldConfig;
}): {
  rates: ResourceRates;
  produced: number;
  consumed: number;
  energyFactor: number;
  baseRates: ResourceRates;
} {
  let produced = 0;
  let consumed = 0;
  for (const b of opts.buildings) {
    const lv = opts.levels.get(b.id) ?? 0;
    produced += energyProduction(b, lv);
    consumed += energyConsumption(b, lv);
  }
  produced += energyFromFleetUnits(opts.units, opts.fleetCounts);
  const energyFactor = consumed <= 0 ? 1 : Math.min(1, produced / consumed);

  const baseRates = baseProductionPerHour(opts.world);
  const rates: ResourceRates = { ...baseRates };
  for (const b of opts.buildings) {
    const lv = opts.levels.get(b.id) ?? 0;
    const p = productionPerHour(b, lv);
    if (!p) continue;
    const amt = p.amount * energyFactor;
    if (p.resourceId === "metal") rates.metal += amt;
    else if (p.resourceId === "minerals") rates.minerals += amt;
    else if (p.resourceId === "vespene") rates.vespene += amt;
  }

  return {
    rates: applyPlanetTypeProductionBonus(rates, opts.planetType),
    produced,
    consumed,
    energyFactor,
    baseRates: applyPlanetTypeProductionBonus(baseRates, opts.planetType),
  };
}

export function applyPlanetTypeProductionBonus(
  rates: ResourceRates,
  planetType: PlanetTypeDef | undefined
): ResourceRates {
  const m = planetTypeProductionMultipliers(planetType);
  return {
    metal: rates.metal * m.metal,
    minerals: rates.minerals * m.minerals,
    vespene: rates.vespene * m.vespene,
  };
}

/** Вместимость складов: база + бонусы зданий. */
export function computeResourceCaps(
  buildings: BuildingDef[],
  levels: Map<string, number>
): { metal: number; minerals: number; vespene: number } {
  let metal = DEFAULT_STORAGE.metal;
  let minerals = DEFAULT_STORAGE.minerals;
  let vespene = DEFAULT_STORAGE.vespene;
  for (const b of buildings) {
    const lv = levels.get(b.id) ?? 0;
    const bonus = storageBonusForResource(b, lv);
    if (bonus) {
      if (bonus.resourceId === "metal") metal += bonus.amount;
      else if (bonus.resourceId === "minerals") minerals += bonus.amount;
      else if (bonus.resourceId === "vespene") vespene += bonus.amount;
    }
    const all = storageBonusAllAmount(b, lv);
    if (all > 0) {
      metal += all;
      minerals += all;
      vespene += all;
    }
  }
  return { metal, minerals, vespene };
}

/** Стоимость одной единицы флота/обороны (уровней нет — берём base с учётом growth^0). */
export function flatPurchaseCost(item: { costs: BuildingDef["costs"] }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of item.costs) {
    out[c.resourceId] = Math.floor(c.base);
  }
  return out;
}

/** Энергия от орбитальных юнитов (например солнечные спутники). */
export function energyFromFleetUnits(
  units: FleetUnitDef[],
  counts: Map<string, number>
): number {
  let sum = 0;
  for (const u of units) {
    const n = counts.get(u.id) ?? 0;
    const e = u.energyPerUnit ?? 0;
    sum += e * n;
  }
  return sum;
}

export const UNIT_SIZES = ["small", "medium", "large", "flagship"] as const;
export const UNIT_ARMOR_TYPES = ["light", "reinforced", "heavy"] as const;

export type UnitSizeId = (typeof UNIT_SIZES)[number];
export type UnitArmorTypeId = (typeof UNIT_ARMOR_TYPES)[number];

export const SIZE_LABELS_RU: Record<UnitSizeId, string> = {
  small: "малый размер",
  medium: "средний размер",
  large: "крупный размер",
  flagship: "флагман",
};

export const ARMOR_TYPE_LABELS_RU: Record<UnitArmorTypeId, string> = {
  light: "лёгкая броня",
  reinforced: "усиленная броня",
  heavy: "тяжёлая броня",
};

/** Ключ цели специализации: `size:medium`, `armorType:heavy`. */
export function specializationTargetKey(
  kind: "size" | "armorType",
  target: string
): string {
  return `${kind}:${target}`;
}

export function parseSpecializationTargetKey(
  key: string
): { kind: "size" | "armorType"; target: string } | null {
  const sep = key.indexOf(":");
  if (sep < 0) return null;
  const kind = key.slice(0, sep);
  const target = key.slice(sep + 1);
  if (kind !== "size" && kind !== "armorType") return null;
  if (!target) return null;
  return { kind, target };
}

/** Боевой юнит может выбрать специализацию (есть урон). */
export function unitCanSpecialize(unit: { stats?: { attack?: number } }): boolean {
  return (unit.stats?.attack ?? 0) > 0;
}

export function specializationModifierLabel(mod: SpecializationModifier): string {
  const target =
    mod.kind === "size"
      ? (SIZE_LABELS_RU[mod.target as UnitSizeId] ?? mod.target)
      : (ARMOR_TYPE_LABELS_RU[mod.target as UnitArmorTypeId] ?? mod.target);
  return `урон по ${target} ×${mod.multiplier}`;
}

/** Множитель урона атакующего с профилем специализации против цели. */
export function specializationDamageMultiplier(
  modifiers: SpecializationModifier[],
  target: { size?: string; armorType?: string }
): number {
  let mult = 1;
  for (const m of modifiers) {
    if (m.kind === "size" && m.target === target.size) mult *= m.multiplier;
    if (m.kind === "armorType" && m.target === target.armorType) mult *= m.multiplier;
  }
  return mult;
}

/** Модификаторы специализации юнита из каталога. */
export function unitSpecializationModifiers(unit: {
  specialization?: SpecializationModifier[];
}): SpecializationModifier[] {
  return unit.specialization ?? [];
}
