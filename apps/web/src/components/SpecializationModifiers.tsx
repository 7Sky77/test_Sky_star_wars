import type { SpecializationModifier } from "@sw/shared";
import { specializationModifierLabel } from "@sw/shared";

export function SpecializationModifiers({
  modifiers,
}: {
  modifiers: SpecializationModifier[];
}) {
  if (!modifiers.length) {
    return <p className="spec-modifiers stub">Без модификаторов урона.</p>;
  }
  return (
    <ul className="spec-modifiers">
      {modifiers.map((m) => (
        <li key={`${m.kind}-${m.target}`}>{specializationModifierLabel(m)}</li>
      ))}
    </ul>
  );
}
