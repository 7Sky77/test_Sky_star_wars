import { unitCanSpecialize, unitSpecializationModifiers } from "@sw/shared";
import { SpecializationModifiers } from "./SpecializationModifiers.js";

type UnitLike = {
  stats?: { attack?: number };
  specialization?: { kind: "size" | "armorType"; target: string; multiplier: number }[];
};

export function UnitSpecializationInfo({ unit }: { unit: UnitLike }) {
  if (!unitCanSpecialize(unit)) return null;
  const modifiers = unitSpecializationModifiers(unit);
  if (!modifiers.length) return null;

  return (
    <div className="spec-block">
      <div className="spec-label">Специализация</div>
      <SpecializationModifiers modifiers={modifiers} />
    </div>
  );
}
