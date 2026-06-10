import {
  intruderKindLabel,
  intrudersAtCoords,
  orbitLabel,
  type LocalOrbitId,
  type OrbitIntruderDef,
} from "@sw/shared";
import { CoordsDisplay } from "./CoordsDisplay.js";
import type { OrbitIntruderState } from "../types.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

type IntruderLike = OrbitIntruderState | OrbitIntruderDef;

function unitSummary(intruder: IntruderLike, names?: Map<string, string>) {
  if ("unitDetails" in intruder && intruder.unitDetails.length > 0) {
    return intruder.unitDetails.map((u) => `${u.name} ×${fmt(u.quantity)}`).join(", ");
  }
  return Object.entries(intruder.units)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => `${names?.get(id) ?? id} ×${fmt(q)}`)
    .join(", ");
}

export function OrbitIntruderCard({
  intruder,
  unitNames,
  compact,
}: {
  intruder: IntruderLike;
  unitNames?: Map<string, string>;
  compact?: boolean;
}) {
  return (
    <article className={`orbit-intruder-card${compact ? " compact" : ""}`}>
      <header>
        <strong>{intruder.name}</strong>
        <span className="orbit-intruder-kind">
          {intruderKindLabel(intruder.intruderKind)}
        </span>
      </header>
      <p className="orbit-intruder-meta">
        <CoordsDisplay
          arm={intruder.arm}
          system={intruder.system}
          position={intruder.position}
          className="coords-inline"
        />{" "}
        · <strong>{orbitLabel(intruder.orbit)}</strong>
      </p>
      <p className="orbit-intruder-fleet">
        {fmt("totalShips" in intruder ? intruder.totalShips : Object.values(intruder.units).reduce((s, n) => s + n, 0))}{" "}
        корабл. · {unitSummary(intruder, unitNames)}
      </p>
    </article>
  );
}

export function OrbitIntrudersAtTarget({
  intruders,
  arm,
  system,
  position,
  orbit,
  unitNames,
}: {
  intruders: IntruderLike[];
  arm: number;
  system: number;
  position: number;
  orbit: LocalOrbitId;
  unitNames?: Map<string, string>;
}) {
  const hits = intrudersAtCoords(intruders, arm, system, position, orbit);
  if (hits.length === 0) return null;

  return (
    <div className="orbit-intruders-alert">
      <strong>На орбите противник:</strong>
      {hits.map((i) => (
        <OrbitIntruderCard key={i.id} intruder={i} unitNames={unitNames} compact />
      ))}
    </div>
  );
}

export function OrbitIntrudersList({
  intruders,
  unitNames,
  title = "Противники на орбитах",
}: {
  intruders: IntruderLike[];
  unitNames?: Map<string, string>;
  title?: string;
}) {
  if (intruders.length === 0) return null;

  return (
    <section className="orbit-intruders-list">
      <h2 className="section-title">{title}</h2>
      <div className="orbit-intruders-grid">
        {intruders.map((i) => (
          <OrbitIntruderCard key={i.id} intruder={i} unitNames={unitNames} />
        ))}
      </div>
    </section>
  );
}
