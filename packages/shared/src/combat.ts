import type { CombatRules, FleetUnitDef, GameCatalog } from "./schemas.js";
import {
  specializationDamageMultiplier,
  unitSpecializationModifiers,
} from "./formulas.js";

export type BattleSide = "attacker" | "defender";

export const DEFAULT_COMBAT_RULES: CombatRules = {
  battleRoundSeconds: 50,
  damageVariance: 0.5,
  defaultBlockCoefficient: 1,
  massAttackMinShotPower: 150,
  massAttackShooterSizes: ["large", "flagship"],
  massAttackTargetSizes: ["small"],
};

/** Пояснения к боевым параметрам (как в XCraft). */
export const COMBAT_STAT_HELP_RU = {
  attackPerRound:
    "Среднее суммарное количество урона, которое единица может нанести за раунд боя.",
  attackPerShot:
    "Урон одного выстрела; в залпе может быть несколько выстрелов.",
  shotsPerVolley: "Число выстрелов за один залп.",
  volleyPeriodSeconds:
    "Секунды на перезарядку всех орудий до следующего залпа.",
  volleysPerRound: "Сколько залпов успевает юнит за стандартный раунд боя.",
  roundDurationSeconds: "Длительность одного боевого раунда.",
  massAttack:
    "Массовая атака крупных юнитов по малым: урон выстрела / (броня+щит) × спец. / блокировка ±50%.",
  blockCoefficient:
    "Способность блокировать урон при массовых атаках. При коэффициенте 2 уничтожается в 2 раза меньше юнитов этого типа.",
} as const;

export interface UnitFireProfile {
  /** Средний урон за раунд (из каталога `attack`). */
  attackPerRound: number;
  attackPerShot: number;
  shotsPerVolley: number;
  volleysPerRound: number;
  volleyPeriodSeconds: number;
  roundDurationSeconds: number;
  attackRadius?: number;
}

export interface CombatShip {
  unitId: string;
  shield: number;
  armor: number;
  fire: UnitFireProfile;
  size?: string;
  armorType?: string;
  blockCoefficient?: number;
}

export interface BattleRoundReport {
  round: number;
  attackerShips: number;
  defenderShips: number;
  attackerDamage: number;
  defenderDamage: number;
  attackerDestroyed: number;
  defenderDestroyed: number;
  attackerVolleys: number;
  defenderVolleys: number;
  attackerShots: number;
  defenderShots: number;
}

export interface BattleResult {
  winner: BattleSide | "draw";
  rounds: BattleRoundReport[];
  attackerStart: Record<string, number>;
  defenderStart: Record<string, number>;
  attackerSurvivors: Record<string, number>;
  defenderSurvivors: Record<string, number>;
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
}

const DEFAULT_ARMOR = 100;
const DEFAULT_SHIELD = 0;
const MAX_EXPANDED_SHIPS = 400;
const MAX_ROUNDS = 24;

type UnitStats = NonNullable<FleetUnitDef["stats"]>;

export function combatRulesFromCatalog(
  catalog: Pick<GameCatalog, "combat">
): CombatRules {
  return catalog.combat ?? DEFAULT_COMBAT_RULES;
}

/** Залпов за раунд: сколько перезарядок помещается в длительность раунда. */
export function volleysPerBattleRound(
  volleyPeriodSeconds: number,
  rules: CombatRules = DEFAULT_COMBAT_RULES
): number {
  if (volleyPeriodSeconds <= 0) return 0;
  return Math.max(
    1,
    Math.floor(rules.battleRoundSeconds / volleyPeriodSeconds)
  );
}

export function unitHasFireProfile(stats?: UnitStats): boolean {
  return (stats?.attack ?? 0) > 0;
}

export function unitHasExplicitFireProfile(stats?: UnitStats): boolean {
  if (!stats) return false;
  return (
    stats.attackPerShot != null ||
    stats.shotsPerVolley != null ||
    stats.volleyPeriodSeconds != null ||
    stats.attackRadius != null
  );
}

export const unitHasDetailedFireProfile = unitHasExplicitFireProfile;

/**
 * Профиль огня: `attack` = средний урон за раунд;
 * залпы = battleRoundSeconds / volleyPeriod;
 * урон выстрела — из каталога или оценка под средний урон.
 */
export function deriveUnitFireProfile(
  stats?: UnitStats,
  rules: CombatRules = DEFAULT_COMBAT_RULES
): UnitFireProfile {
  const attackPerRound = stats?.attack ?? 0;
  if (attackPerRound <= 0) {
    return {
      attackPerRound: 0,
      attackPerShot: 0,
      shotsPerVolley: 1,
      volleysPerRound: 0,
      volleyPeriodSeconds: 10,
      roundDurationSeconds: rules.battleRoundSeconds,
    };
  }

  const shotsPerVolley = stats?.shotsPerVolley ?? 1;
  const volleyPeriodSeconds = stats?.volleyPeriodSeconds ?? 10;
  const volleysPerRound = volleysPerBattleRound(volleyPeriodSeconds, rules);

  let attackPerShot = stats?.attackPerShot;
  if (attackPerShot == null) {
    const shotsPerRound = Math.max(1, volleysPerRound * shotsPerVolley);
    attackPerShot = Math.max(1, Math.round(attackPerRound / shotsPerRound));
  }

  return {
    attackPerRound,
    attackPerShot,
    shotsPerVolley,
    volleysPerRound,
    volleyPeriodSeconds,
    roundDurationSeconds: rules.battleRoundSeconds,
    attackRadius: stats?.attackRadius,
  };
}

export function targetEffectiveHp(ship: CombatShip): number {
  return Math.max(1, ship.armor + ship.shield);
}

export function damageVarianceMultiplier(variance = 0.5): number {
  return 1 - variance + Math.random() * (2 * variance);
}

export function canMassAttack(
  shooter: CombatShip,
  rules: CombatRules = DEFAULT_COMBAT_RULES
): boolean {
  if (!shooter.size) return false;
  if (!(rules.massAttackShooterSizes as readonly string[]).includes(shooter.size)) {
    return false;
  }
  return shooter.fire.attackPerShot >= rules.massAttackMinShotPower;
}

/**
 * Число уничтоженных малых целей одним выстрелом (массовая атака).
 * урон / (броня+щит) × спец. / блокировка ±разброс
 */
export function massAttackKillCount(
  catalog: GameCatalog,
  shooter: CombatShip,
  target: CombatShip,
  rules: CombatRules = DEFAULT_COMBAT_RULES
): number {
  const shooterDef = unitDef(catalog, shooter.unitId);
  const specMult = shooterDef
    ? specializationDamageMultiplier(
        unitSpecializationModifiers(shooterDef),
        { size: target.size, armorType: target.armorType }
      )
    : 1;
  const block =
    target.blockCoefficient ?? rules.defaultBlockCoefficient;
  const variance = damageVarianceMultiplier(rules.damageVariance);
  const score =
    (shooter.fire.attackPerShot / targetEffectiveHp(target)) *
    specMult /
    block *
    variance;
  return Math.max(0, Math.floor(score));
}

function unitDef(
  catalog: GameCatalog,
  unitId: string
): FleetUnitDef | undefined {
  return catalog.units.find((u) => u.id === unitId);
}

function shipFromUnit(
  def: FleetUnitDef,
  rules: CombatRules
): CombatShip {
  const s = def.stats ?? {};
  return {
    unitId: def.id,
    shield: s.shield ?? DEFAULT_SHIELD,
    armor: s.armor ?? DEFAULT_ARMOR,
    fire: deriveUnitFireProfile(s, rules),
    size: s.size,
    armorType: s.armorType,
    blockCoefficient: s.blockCoefficient,
  };
}

function expandFleet(
  catalog: GameCatalog,
  stacks: Record<string, number>,
  rules: CombatRules
): CombatShip[] {
  const ships: CombatShip[] = [];
  for (const [unitId, rawQty] of Object.entries(stacks)) {
    const qty = Math.floor(Number(rawQty));
    if (qty <= 0) continue;
    const def = unitDef(catalog, unitId);
    if (!def) continue;
    const template = shipFromUnit(def, rules);
    for (let i = 0; i < qty; i++) {
      ships.push({
        ...template,
        shield: template.shield,
        armor: template.armor,
        fire: { ...template.fire },
      });
      if (ships.length >= MAX_EXPANDED_SHIPS) return ships;
    }
  }
  return ships;
}

function countStacks(ships: CombatShip[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of ships) {
    out[s.unitId] = (out[s.unitId] ?? 0) + 1;
  }
  return out;
}

function diffStacks(
  before: Record<string, number>,
  after: Record<string, number>
): Record<string, number> {
  const losses: Record<string, number> = {};
  for (const [id, qty] of Object.entries(before)) {
    const left = after[id] ?? 0;
    const lost = qty - left;
    if (lost > 0) losses[id] = lost;
  }
  return losses;
}

function applyDamage(ship: CombatShip, damage: number): boolean {
  let dmg = Math.max(0, Math.floor(damage));
  if (dmg <= 0) return false;
  if (ship.shield > 0) {
    const absorbed = Math.min(ship.shield, dmg);
    ship.shield -= absorbed;
    dmg -= absorbed;
  }
  if (dmg > 0) ship.armor -= dmg;
  return ship.armor <= 0;
}

function shotDamage(
  catalog: GameCatalog,
  shooter: CombatShip,
  target: CombatShip,
  rules: CombatRules
): number {
  const base = shooter.fire.attackPerShot;
  if (base <= 0) return 0;
  const def = unitDef(catalog, shooter.unitId);
  const mult = def
    ? specializationDamageMultiplier(unitSpecializationModifiers(def), {
        size: target.size,
        armorType: target.armorType,
      })
    : 1;
  return base * mult * damageVarianceMultiplier(rules.damageVariance);
}

function pickTarget(
  targets: CombatShip[],
  preferSizes?: string[]
): CombatShip | null {
  if (targets.length === 0) return null;
  if (preferSizes?.length) {
    const preferred = targets.filter(
      (t) => t.size && preferSizes.includes(t.size)
    );
    if (preferred.length > 0) {
      return (
        preferred[Math.floor(Math.random() * preferred.length)] ?? null
      );
    }
  }
  return targets[Math.floor(Math.random() * targets.length)] ?? null;
}

function destroyShipAt(targets: CombatShip[], target: CombatShip): void {
  const idx = targets.indexOf(target);
  if (idx >= 0) targets.splice(idx, 1);
}

function fireOneShot(
  catalog: GameCatalog,
  shooter: CombatShip,
  targets: CombatShip[],
  rules: CombatRules
): { damage: number; destroyed: number } {
  if (targets.length === 0) return { damage: 0, destroyed: 0 };

  if (canMassAttack(shooter, rules)) {
    const target = pickTarget(targets, rules.massAttackTargetSizes);
    if (!target) return { damage: 0, destroyed: 0 };

    const kills = massAttackKillCount(catalog, shooter, target, rules);
    if (kills >= 1) {
      let destroyed = 0;
      let damage = 0;
      const ehp = targetEffectiveHp(target);
      while (destroyed < kills && targets.length > 0) {
        const victim = pickTarget(targets, rules.massAttackTargetSizes);
        if (!victim) break;
        destroyShipAt(targets, victim);
        destroyed += 1;
        damage += ehp;
      }
      return { damage, destroyed };
    }
  }

  const target = pickTarget(targets);
  if (!target) return { damage: 0, destroyed: 0 };
  const dmg = shotDamage(catalog, shooter, target, rules);
  const destroyed = applyDamage(target, dmg) ? 1 : 0;
  if (destroyed > 0) destroyShipAt(targets, target);
  return { damage: Math.floor(dmg), destroyed };
}

function fireSideRound(
  catalog: GameCatalog,
  shooters: CombatShip[],
  targets: CombatShip[],
  rules: CombatRules
): {
  damage: number;
  destroyed: number;
  volleys: number;
  shots: number;
} {
  let totalDamage = 0;
  let destroyed = 0;
  let volleys = 0;
  let shots = 0;

  for (const shooter of shooters) {
    if (targets.length === 0) break;
    const { volleysPerRound, shotsPerVolley } = shooter.fire;
    if (volleysPerRound <= 0 || shotsPerVolley <= 0) continue;

    for (let v = 0; v < volleysPerRound; v++) {
      if (targets.length === 0) break;
      volleys += 1;
      for (let s = 0; s < shotsPerVolley; s++) {
        if (targets.length === 0) break;
        shots += 1;
        const hit = fireOneShot(catalog, shooter, targets, rules);
        totalDamage += hit.damage;
        destroyed += hit.destroyed;
      }
    }
  }

  return { damage: totalDamage, destroyed, volleys, shots };
}

export function resolveFleetBattle(
  catalog: GameCatalog,
  attacker: Record<string, number>,
  defender: Record<string, number>,
  rules: CombatRules = combatRulesFromCatalog(catalog)
): BattleResult {
  const attackerStart = { ...attacker };
  const defenderStart = { ...defender };
  const atkShips = expandFleet(catalog, attacker, rules);
  const defShips = expandFleet(catalog, defender, rules);
  const rounds: BattleRoundReport[] = [];

  let round = 0;
  while (round < MAX_ROUNDS && atkShips.length > 0 && defShips.length > 0) {
    round += 1;
    const defSalvo = fireSideRound(catalog, defShips, atkShips, rules);
    const atkSalvo = fireSideRound(catalog, atkShips, defShips, rules);
    rounds.push({
      round,
      attackerShips: atkShips.length + atkSalvo.destroyed,
      defenderShips: defShips.length + defSalvo.destroyed,
      attackerDamage: atkSalvo.damage,
      defenderDamage: defSalvo.damage,
      attackerDestroyed: defSalvo.destroyed,
      defenderDestroyed: atkSalvo.destroyed,
      attackerVolleys: atkSalvo.volleys,
      defenderVolleys: defSalvo.volleys,
      attackerShots: atkSalvo.shots,
      defenderShots: defSalvo.shots,
    });
  }

  const attackerSurvivors = countStacks(atkShips);
  const defenderSurvivors = countStacks(defShips);

  let winner: BattleSide | "draw" = "draw";
  if (atkShips.length > 0 && defShips.length === 0) winner = "attacker";
  else if (defShips.length > 0 && atkShips.length === 0) winner = "defender";
  else if (atkShips.length > defShips.length) winner = "attacker";
  else if (defShips.length > atkShips.length) winner = "defender";

  return {
    winner,
    rounds,
    attackerStart,
    defenderStart,
    attackerSurvivors,
    defenderSurvivors,
    attackerLosses: diffStacks(attackerStart, attackerSurvivors),
    defenderLosses: diffStacks(defenderStart, defenderSurvivors),
  };
}
