import { describe, expect, it } from "vitest";
import { resolveFleetBattle } from "./combat.js";
import type { GameCatalog } from "./schemas.js";

const miniCatalog = {
  units: [
    {
      id: "fighter",
      name: "Истребитель",
      allowedFactions: ["terran"],
      costs: [{ resourceId: "metal", base: 1 }],
      stats: {
        armor: 400,
        shield: 10,
        attack: 30,
        size: "small",
        armorType: "light",
      },
      specialization: [{ kind: "size", target: "large", multiplier: 1.5 }],
    },
    {
      id: "cruiser",
      name: "Крейсер",
      allowedFactions: ["terran"],
      costs: [{ resourceId: "metal", base: 1 }],
      stats: {
        armor: 2500,
        shield: 50,
        attack: 250,
        size: "large",
        armorType: "reinforced",
      },
    },
  ],
} as unknown as GameCatalog;

describe("resolveFleetBattle", () => {
  it("stronger fleet wins against pirates", () => {
    const result = resolveFleetBattle(
      miniCatalog,
      { fighter: 10 },
      { fighter: 5 }
    );
    expect(result.winner).toBe("attacker");
    expect(
      Object.values(result.attackerSurvivors).reduce((s, n) => s + n, 0)
    ).toBeGreaterThan(0);
    expect(
      Object.values(result.defenderSurvivors).reduce((s, n) => s + n, 0)
    ).toBe(0);
    expect(result.rounds.length).toBeGreaterThan(0);
  });

  it("produces loss records", () => {
    const result = resolveFleetBattle(
      miniCatalog,
      { fighter: 3 },
      { fighter: 3 }
    );
    const atkLost = Object.values(result.attackerLosses).reduce((s, n) => s + n, 0);
    const defLost = Object.values(result.defenderLosses).reduce((s, n) => s + n, 0);
    expect(atkLost + defLost).toBeGreaterThan(0);
  });
});
