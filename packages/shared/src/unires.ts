import type { UniresDef } from "./schemas.js";

export type ResourceCost = {
  metal?: number;
  minerals?: number;
  vespene?: number;
};

/** Сколько ресурса даёт 1 унирес (обратный курс из perThousand). */
export function resourcesPerUnire(config: UniresDef): ResourceCost {
  const k = 1000;
  return {
    metal: config.perThousand.metal / k,
    minerals: config.perThousand.minerals / k,
    vespene: config.perThousand.vespene / k,
  };
}

/** Стоимость набора ресурсов в униресах. */
export function uniresFromResources(resources: ResourceCost, config: UniresDef): number {
  const k = 1000;
  let sum = 0;
  const metal = resources.metal ?? 0;
  const minerals = resources.minerals ?? 0;
  const vespene = resources.vespene ?? 0;
  if (metal > 0 && config.perThousand.metal > 0) {
    sum += (metal * k) / config.perThousand.metal;
  }
  if (minerals > 0 && config.perThousand.minerals > 0) {
    sum += (minerals * k) / config.perThousand.minerals;
  }
  if (vespene > 0 && config.perThousand.vespene > 0) {
    sum += (vespene * k) / config.perThousand.vespene;
  }
  return sum;
}

/** Стоимость из Record (как flatPurchaseCost) в униресах. */
export function uniresFromCostRecord(
  cost: Record<string, number>,
  config: UniresDef
): number {
  return uniresFromResources(
    {
      metal: cost.metal,
      minerals: cost.minerals,
      vespene: cost.vespene,
    },
    config
  );
}

/** Сколько ресурса можно купить за заданное число униреса. */
export function resourceFromUnires(
  unires: number,
  resourceId: "metal" | "minerals" | "vespene",
  config: UniresDef
): number {
  const perK = config.perThousand[resourceId];
  return (unires * perK) / 1000;
}
