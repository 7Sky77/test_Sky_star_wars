import { describe, expect, it } from "vitest";
import {
  deriveUnitFireProfile,
  massAttackKillCount,
  resolveFleetBattle,
  volleysPerBattleRound,
  type CombatShip,
} from "./combat.js";
import type { CombatRules, GameCatalog } from "./schemas.js";

const rules: CombatRules = {
  battleRoundSeconds: 50,
  damageVariance: 0,
  defaultBlockCoefficient: 1,
  massAttackMinShotPower: 150,
  massAttackShooterSizes: ["large", "flagship"],
  massAttackTargetSizes: ["small"],
};

const miniCatalog = {
  combat: rules,
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
        attackPerShot: 6,
        shotsPerVolley: 1,
        volleyPeriodSeconds: 10,
        size: "small",
        armorType: "light",
      },
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
    {
      id: "bomber",
      name: "Бомбардировщик",
      allowedFactions: ["terran"],
      costs: [{ resourceId: "metal", base: 1 }],
      stats: {
        armor: 8000,
        shield: 1200,
        attack: 2000,
        attackPerShot: 2000,
        shotsPerVolley: 1,
        volleyPeriodSeconds: 30,
        size: "large",
        armorType: "heavy",
      },
    },
  ],
} as unknown as GameCatalog;

const stealthStats = {
  armor: 1000,
  shield: 25,
  attack: 75,
  attackPerShot: 9,
  shotsPerVolley: 1,
  volleyPeriodSeconds: 6,
  size: "medium" as const,
  armorType: "reinforced" as const,
};

describe("deriveUnitFireProfile", () => {
  it("fighter: 5 залпов за 50 с раунд (период 10 с)", () => {
    const p = deriveUnitFireProfile(miniCatalog.units[0].stats, rules);
    expect(p.attackPerRound).toBe(30);
    expect(p.attackPerShot).toBe(6);
    expect(p.volleysPerRound).toBe(5);
    expect(p.roundDurationSeconds).toBe(50);
  });

  it("stealth: 8 залпов за 50 с (период 6 с), средний урон 75", () => {
    const p = deriveUnitFireProfile(stealthStats, rules);
    expect(p.attackPerRound).toBe(75);
    expect(p.attackPerShot).toBe(9);
    expect(p.volleysPerRound).toBe(8);
    expect(p.roundDurationSeconds).toBe(50);
  });

  it("volleysPerBattleRound from period", () => {
    expect(volleysPerBattleRound(10, rules)).toBe(5);
    expect(volleysPerBattleRound(6, rules)).toBe(8);
  });
});

describe("massAttackKillCount", () => {
  it("bomber shot can kill multiple fighters", () => {
    const bomber: CombatShip = {
      unitId: "bomber",
      armor: 8000,
      shield: 1200,
      size: "large",
      fire: deriveUnitFireProfile(miniCatalog.units[2].stats, rules),
    };
    const fighter: CombatShip = {
      unitId: "fighter",
      armor: 400,
      shield: 10,
      size: "small",
      fire: deriveUnitFireProfile(miniCatalog.units[0].stats, rules),
    };
    const kills = massAttackKillCount(miniCatalog, bomber, fighter, rules);
    expect(kills).toBeGreaterThanOrEqual(4);
  });

  it("block coefficient 2 halves kills vs default", () => {
    const bomber: CombatShip = {
      unitId: "bomber",
      armor: 8000,
      shield: 1200,
      size: "large",
      fire: deriveUnitFireProfile(miniCatalog.units[2].stats, rules),
    };
    const fighter: CombatShip = {
      unitId: "fighter",
      armor: 400,
      shield: 10,
      size: "small",
      blockCoefficient: 1,
      fire: deriveUnitFireProfile(miniCatalog.units[0].stats, rules),
    };
    const blocked: CombatShip = { ...fighter, blockCoefficient: 2 };
    const base = massAttackKillCount(miniCatalog, bomber, fighter, rules);
    const halved = massAttackKillCount(miniCatalog, bomber, blocked, rules);
    expect(halved).toBe(Math.floor(base / 2));
  });
});

describe("resolveFleetBattle", () => {
  it("stronger fleet wins against pirates", () => {
    const result = resolveFleetBattle(
      miniCatalog,
      { fighter: 10 },
      { fighter: 5 },
      rules
    );
    expect(result.winner).toBe("attacker");
    expect(result.rounds.length).toBeGreaterThan(0);
  });

  it("records volleys from battle round duration", () => {
    const result = resolveFleetBattle(
      miniCatalog,
      { fighter: 3 },
      { fighter: 3 },
      rules
    );
    const r1 = result.rounds[0];
    expect(r1.attackerVolleys).toBe(3 * 5);
    expect(r1.attackerShots).toBe(3 * 5);
  });
});
