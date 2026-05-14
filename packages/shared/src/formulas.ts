import type { BuildingDef, FleetUnitDef } from "./schemas.js";

/** Cost to upgrade from `currentLevel` -> currentLevel+1 (currentLevel is 0-based level before upgrade). */
export function upgradeCostForLevel(b: BuildingDef, currentLevel: number): Record<string, number> {
  const out: Record<string, number> = {};
  const L = Math.max(0, currentLevel);
  for (const c of b.costs) {
    out[c.resourceId] = Math.floor(c.base * Math.pow(c.growth, L));
  }
  return out;
}

export function upgradeTimeSecondsForLevel(b: BuildingDef, currentLevel: number): number {
  const L = Math.max(0, currentLevel);
  return Math.floor(b.upgradeTimeSeconds.base * Math.pow(b.upgradeTimeSeconds.growth, L));
}

export function productionPerHour(
  b: BuildingDef,
  level: number
): { resourceId: string; amount: number } | null {
  if (!b.produces || level <= 0) return null;
  const amount =
    b.produces.amountPerHourBase + b.produces.amountPerHourPerLevel * level;
  return { resourceId: b.produces.resourceId, amount };
}

export function energyProduction(b: BuildingDef, level: number): number {
  if (!b.energyProduction || level <= 0) return 0;
  return b.energyProduction.base + b.energyProduction.perLevel * level;
}

export function energyConsumption(b: BuildingDef, level: number): number {
  if (!b.energyConsumption || level <= 0) return 0;
  return b.energyConsumption.base + b.energyConsumption.perLevel * level;
}

export function storageBonusForResource(
  b: BuildingDef,
  level: number
): { resourceId: string; amount: number } | null {
  if (!b.storageBonus || level <= 0) return null;
  return {
    resourceId: b.storageBonus.resourceId,
    amount: b.storageBonus.base + b.storageBonus.perLevel * level,
  };
}

/** Extra capacity for metal, crystal, deuterium (same value each). */
export function storageBonusAllAmount(b: BuildingDef, level: number): number {
  if (!b.storageBonusAll || level <= 0) return 0;
  return b.storageBonusAll.base + b.storageBonusAll.perLevel * level;
}

export const DEFAULT_STORAGE = { metal: 10_000, crystal: 10_000, deuterium: 5_000 };

/** Стоимость одной единицы флота/обороны (уровней нет — берём base с учётом growth^0). */
export function flatPurchaseCost(item: { costs: BuildingDef["costs"] }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of item.costs) {
    out[c.resourceId] = Math.floor(c.base * Math.pow(c.growth, 0));
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
