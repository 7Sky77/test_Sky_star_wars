import { describe, it, expect } from "vitest";
import { upgradeCostForLevel, upgradeTimeSecondsForLevel } from "./formulas.js";
import type { BuildingDef } from "./schemas.js";

const sampleMine: BuildingDef = {
  id: "metal_mine",
  name: "Mine",
  maxLevel: 30,
  costs: [
    { resourceId: "metal", base: 60, growth: 1.5 },
    { resourceId: "crystal", base: 15, growth: 1.5 },
  ],
  upgradeTimeSeconds: { base: 30, growth: 1.2 },
};

describe("formulas", () => {
  it("upgrade cost level 0", () => {
    expect(upgradeCostForLevel(sampleMine, 0)).toEqual({ metal: 60, crystal: 15 });
  });
  it("upgrade time grows", () => {
    expect(upgradeTimeSecondsForLevel(sampleMine, 0)).toBe(30);
    expect(upgradeTimeSecondsForLevel(sampleMine, 1)).toBe(Math.floor(30 * 1.2));
  });
});
