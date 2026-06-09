import { describe, it, expect } from "vitest";
import {
  applyPlanetTypeProductionBonus,
  buildingRequirementsMet,
  computeProductionRatesPerHour,
  energyConsumption,
  energyFromFleetUnits,
  flatPurchaseCost,
  maxAffordableQuantity,
  scalePurchaseCost,
  planetParamsForCoords,
  planetTypeForCoords,
  productionPerHour,
  storageBonusForResource,
  upgradeCostForLevel,
  upgradeTimeSecondsForLevel,
} from "./formulas.js";
import type { WorldConfig } from "./schemas.js";
import type { BuildingDef, FleetUnitDef } from "./schemas.js";

const sampleMine: BuildingDef = {
  id: "metal_mine",
  name: "Mine",
  maxLevel: 30,
  costs: [
    { resourceId: "metal", base: 60, growth: 1.5 },
    { resourceId: "minerals", base: 15, growth: 1.5 },
  ],
  upgradeTimeSeconds: { base: 30, growth: 1.2 },
};

const metalMineRef: BuildingDef = {
  id: "metal_mine",
  name: "Metal Mine",
  maxLevel: 30,
  costs: [
    { resourceId: "metal", base: 60, growth: 1.5 },
    { resourceId: "minerals", base: 15, growth: 1.5 },
  ],
  upgradeTimeSeconds: { base: 20, growth: 1.15 },
  produces: { resourceId: "metal", amountCoef: 16, amountGrowth: 1.088 },
  energyConsumption: { coef: 10, growth: 1.1 },
};

describe("formulas", () => {
  it("minerals mine production (XCraft ref)", () => {
    const mine: BuildingDef = {
      id: "minerals_mine",
      name: "Minerals",
      maxLevel: 30,
      costs: [{ resourceId: "metal", base: 48, growth: 1.6 }],
      upgradeTimeSeconds: { base: 25, growth: 1.15 },
      produces: { resourceId: "minerals", amountCoef: 10, amountGrowth: 1.088 },
      energyConsumption: { coef: 10, growth: 1.1 },
    };
    expect(productionPerHour(mine, 1)?.amount).toBe(10);
    expect(productionPerHour(mine, 5)?.amount).toBe(76);
  });

  it("metal mine production and energy (XCraft ref levels 1-5)", () => {
    const levels = [
      { lv: 1, prod: 17, energy: 11 },
      { lv: 2, prod: 37, energy: 25 },
      { lv: 3, prod: 61, energy: 40 },
      { lv: 4, prod: 89, energy: 59 },
      { lv: 5, prod: 121, energy: 81 },
    ];
    for (const { lv, prod, energy } of levels) {
      expect(productionPerHour(metalMineRef, lv)?.amount).toBe(prod);
      expect(energyConsumption(metalMineRef, lv)).toBe(energy);
    }
  });

  it("upgrade cost level 0", () => {
    expect(upgradeCostForLevel(sampleMine, 0)).toEqual({ metal: 60, minerals: 15 });
  });

  it("upgrade cost uses shared costGrowth (КУ)", () => {
    const factory: BuildingDef = {
      id: "robot_factory",
      name: "Robot Factory",
      maxLevel: 10,
      costGrowth: 2,
      costs: [
        { resourceId: "metal", base: 400 },
        { resourceId: "minerals", base: 120 },
        { resourceId: "vespene", base: 200 },
      ],
      upgradeTimeSeconds: { base: 30, growth: 1.2 },
    };
    expect(upgradeCostForLevel(factory, 0)).toEqual({
      metal: 400,
      minerals: 120,
      vespene: 200,
    });
    expect(upgradeCostForLevel(factory, 1)).toEqual({
      metal: 800,
      minerals: 240,
      vespene: 400,
    });
  });
  it("upgrade time grows", () => {
    expect(upgradeTimeSecondsForLevel(sampleMine, 0)).toBe(30);
    expect(upgradeTimeSecondsForLevel(sampleMine, 1)).toBe(Math.floor(30 * 1.2));
  });

  it("storage capacity exponential", () => {
    const wh: BuildingDef = {
      id: "metal_storage",
      name: "Storage",
      maxLevel: 30,
      costs: [{ resourceId: "metal", base: 10000, growth: 2 }],
      upgradeTimeSeconds: { base: 45, growth: 1.14 },
      storageBonus: {
        resourceId: "metal",
        capacityBase: 91437,
        capacityGrowth: 1.75,
      },
    };
    expect(storageBonusForResource(wh, 1)?.amount).toBe(91437);
    expect(storageBonusForResource(wh, 2)?.amount).toBe(160014);
  });

  it("flat purchase cost for fleet unit", () => {
    const sat: FleetUnitDef = {
      id: "solar_satellite",
      name: "Sat",
      costs: [
        { resourceId: "minerals", base: 2000, growth: 1 },
        { resourceId: "vespene", base: 500, growth: 1 },
      ],
      buildTimeSeconds: 0,
      energyPerUnit: 50,
    };
    expect(flatPurchaseCost(sat)).toEqual({ minerals: 2000, vespene: 500 });
    expect(scalePurchaseCost({ metal: 100, minerals: 50 }, 3)).toEqual({
      metal: 300,
      minerals: 150,
    });
    expect(
      maxAffordableQuantity({ metal: 1000, minerals: 500, vespene: 100 }, {
        metal: 4500,
        minerals: 1200,
        vespene: 250,
      })
    ).toBe(2);
    const m = new Map<string, number>([["solar_satellite", 2]]);
    expect(energyFromFleetUnits([sat], m)).toBe(100);
  });

  it("base planet production without buildings", () => {
    const world: WorldConfig = {
      minArm: 1,
      maxArm: 50,
      minSystem: 1,
      maxSystem: 50,
      starSlot: 0,
      maxPlanetSlot: 9,
      buildQueueSlots: 3,
      baseProductionPerHour: { metal: 20, minerals: 10, vespene: 0 },
    };
    const { rates } = computeProductionRatesPerHour({
      buildings: [],
      levels: new Map(),
      units: [],
      fleetCounts: new Map(),
      planetType: undefined,
      world,
    });
    expect(rates).toEqual({ metal: 20, minerals: 10, vespene: 0 });
  });

  it("planet type production bonuses", () => {
    const base = { metal: 100, minerals: 200, vespene: 50 };
    expect(
      applyPlanetTypeProductionBonus(base, {
        id: "gas",
        name: "Газовые",
        bonuses: { vespeneProductionPct: 0.08 },
      })
    ).toEqual({ metal: 100, minerals: 200, vespene: 54 });
    expect(
      applyPlanetTypeProductionBonus(base, {
        id: "sand",
        name: "Песчаные",
        bonuses: { metalProductionPct: 0.03 },
      })
    ).toEqual({ metal: 103, minerals: 200, vespene: 50 });
  });

  it("planet type from coords is stable", () => {
    const ids = ["gas", "water", "sand", "normal"];
    expect(planetTypeForCoords(1, 1, 1, ids)).toBe(
      planetTypeForCoords(1, 1, 1, ids)
    );
  });

  it("planet params from coords are stable and in range", () => {
    const a = planetParamsForCoords(3, 42, 5);
    const b = planetParamsForCoords(3, 42, 5);
    expect(a).toEqual(b);
    expect(a.diameterKm).toBeGreaterThanOrEqual(2400);
    expect(a.diameterKm).toBeLessThanOrEqual(20_000);
    expect(a.temperatureMin).toBeGreaterThanOrEqual(-200);
    expect(a.temperatureMax).toBeLessThanOrEqual(200);
    expect(a.temperatureMin).toBeLessThan(a.temperatureMax);

    let innerAvg = 0;
    let outerAvg = 0;
    let overlap = false;
    for (let arm = 1; arm <= 5; arm++) {
      for (let system = 1; system <= 10; system++) {
        const inner = planetParamsForCoords(arm, system, 1);
        const outer = planetParamsForCoords(arm, system, 9);
        innerAvg += inner.diameterKm;
        outerAvg += outer.diameterKm;
        if (inner.diameterKm > outer.diameterKm) overlap = true;
        expect(inner.temperatureMax).toBeGreaterThan(outer.temperatureMax);
      }
    }
    expect(innerAvg / 50).toBeLessThan(outerAvg / 50);
    expect(overlap).toBe(true);
  });

  it("planet type matches climate (ice cold, deserts hot)", () => {
    const typeIds = [
      "gas",
      "water",
      "sand",
      "industrial",
      "dry",
      "ice",
      "jungle",
      "normal",
    ];

    for (let arm = 1; arm <= 3; arm++) {
      for (let system = 1; system <= 5; system++) {
        for (let position = 1; position <= 9; position++) {
          const type = planetTypeForCoords(arm, system, position, typeIds);
          const params = planetParamsForCoords(arm, system, position);

          if (type === "ice") {
            expect(params.temperatureMax).toBeLessThan(20);
          }
          if (type === "sand" || type === "dry") {
            expect(params.temperatureMax).toBeGreaterThan(60);
          }
          if (type === "jungle" || type === "water") {
            expect(params.temperatureMax).toBeGreaterThan(5);
            expect(params.temperatureMax).toBeLessThan(110);
          }
        }
      }
    }
  });

  it("building requirements check building and research levels", () => {
    const radar: BuildingDef = {
      id: "radar",
      name: "Radar",
      maxLevel: 30,
      costs: [{ resourceId: "metal", base: 400 }],
      upgradeTimeSeconds: { base: 40, growth: 1.15 },
      requirements: [
        { id: "robot_factory", level: 1 },
        { id: "detection_tech", level: 1, kind: "research" },
      ],
    };
    const buildings = new Map([["robot_factory", 1]]);
    const research = new Map([["detection_tech", 0]]);
    expect(buildingRequirementsMet(radar, buildings, research)).toBe(false);
    research.set("detection_tech", 1);
    expect(buildingRequirementsMet(radar, buildings, research)).toBe(true);
  });
});
