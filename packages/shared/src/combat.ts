import type { FleetUnitDef, GameCatalog } from "./schemas.js";
import {
  specializationDamageMultiplier,
  unitSpecializationModifiers,
} from "./formulas.js";

export type BattleSide = "attacker" | "defender";

export interface CombatShip {
  unitId: string;
  shield: number;
  armor: number;
  attack: number;
  size?: string;
  armorType?: string;
}

export interface BattleRoundReport {
  round: number;
  attackerShips: number;
  defenderShips: number;
  attackerDamage: number;
  defenderDamage: number;
  attackerDestroyed: number;
  defenderDestroyed: number;
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

function unitDef(
  catalog: GameCatalog,
  unitId: string
): FleetUnitDef | undefined {
  return catalog.units.find((u) => u.id === unitId);
}

function shipFromUnit(def: FleetUnitDef): CombatShip {
  const s = def.stats ?? {};
  return {
    unitId: def.id,
    shield: s.shield ?? DEFAULT_SHIELD,
    armor: s.armor ?? DEFAULT_ARMOR,
    attack: s.attack ?? 0,
    size: s.size,
    armorType: s.armorType,
  };
}

function expandFleet(
  catalog: GameCatalog,
  stacks: Record<string, number>
): CombatShip[] {
  const ships: CombatShip[] = [];
  for (const [unitId, rawQty] of Object.entries(stacks)) {
    const qty = Math.floor(Number(rawQty));
    if (qty <= 0) continue;
    const def = unitDef(catalog, unitId);
    if (!def) continue;
    const template = shipFromUnit(def);
    for (let i = 0; i < qty; i++) {
      ships.push({ ...template });
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
  target: CombatShip
): number {
  if (shooter.attack <= 0) return 0;
  const def = unitDef(catalog, shooter.unitId);
  const mult = def
    ? specializationDamageMultiplier(unitSpecializationModifiers(def), {
        size: target.size,
        armorType: target.armorType,
      })
    : 1;
  return shooter.attack * mult;
}

function pickTarget(ships: CombatShip[]): CombatShip | null {
  if (ships.length === 0) return null;
  return ships[Math.floor(Math.random() * ships.length)] ?? null;
}

function fireSalvo(
  catalog: GameCatalog,
  shooters: CombatShip[],
  targets: CombatShip[]
): { damage: number; destroyed: number } {
  let totalDamage = 0;
  let destroyed = 0;
  for (const shooter of shooters) {
    if (targets.length === 0) break;
    const target = pickTarget(targets);
    if (!target) break;
    const dmg = shotDamage(catalog, shooter, target);
    totalDamage += dmg;
    if (applyDamage(target, dmg)) {
      destroyed += 1;
      const idx = targets.indexOf(target);
      if (idx >= 0) targets.splice(idx, 1);
    }
  }
  return { damage: Math.floor(totalDamage), destroyed };
}

/** Пошаговый бой флотов (MVP: каждый корабль стреляет раз за раунд). */
export function resolveFleetBattle(
  catalog: GameCatalog,
  attacker: Record<string, number>,
  defender: Record<string, number>
): BattleResult {
  const attackerStart = { ...attacker };
  const defenderStart = { ...defender };
  const atkShips = expandFleet(catalog, attacker);
  const defShips = expandFleet(catalog, defender);
  const rounds: BattleRoundReport[] = [];

  let round = 0;
  while (round < MAX_ROUNDS && atkShips.length > 0 && defShips.length > 0) {
    round += 1;
    const defSalvo = fireSalvo(catalog, defShips, atkShips);
    const atkSalvo = fireSalvo(catalog, atkShips, defShips);
    rounds.push({
      round,
      attackerShips: atkShips.length + atkSalvo.destroyed,
      defenderShips: defShips.length + defSalvo.destroyed,
      attackerDamage: atkSalvo.damage,
      defenderDamage: defSalvo.damage,
      attackerDestroyed: defSalvo.destroyed,
      defenderDestroyed: atkSalvo.destroyed,
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
