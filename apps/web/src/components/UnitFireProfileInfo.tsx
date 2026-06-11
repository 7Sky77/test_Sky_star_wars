import {
  COMBAT_STAT_HELP_RU,
  deriveUnitFireProfile,
  unitHasExplicitFireProfile,
  unitHasFireProfile,
  type FleetUnitDef,
} from "@sw/shared";
import { useGame } from "../gameContext.js";

export function UnitFireProfileInfo({ unit }: { unit: FleetUnitDef }) {
  const { catalog } = useGame();
  const stats = unit.stats;
  if (!unitHasFireProfile(stats)) return null;

  const rules = catalog?.combat;
  const p = deriveUnitFireProfile(stats, rules);
  const derived = !unitHasExplicitFireProfile(stats);
  const massCapable =
    stats &&
    (stats.size === "large" || stats.size === "flagship") &&
    p.attackPerShot >= (rules?.massAttackMinShotPower ?? 150);
  const blockCoeff =
    stats?.blockCoefficient ?? rules?.defaultBlockCoefficient ?? 1;

  return (
    <dl className="fire-profile-block">
      <div className="fire-profile-label">
        Бой (залпы){derived ? " · оценка" : ""}
      </div>
      <div className="fire-profile-row" title={COMBAT_STAT_HELP_RU.attackPerRound}>
        <dt>Атака за раунд</dt>
        <dd>{p.attackPerRound}</dd>
      </div>
      <div className="fire-profile-row" title={COMBAT_STAT_HELP_RU.attackPerShot}>
        <dt>Атака за выстрел</dt>
        <dd>{p.attackPerShot}</dd>
      </div>
      <div className="fire-profile-row" title={COMBAT_STAT_HELP_RU.shotsPerVolley}>
        <dt>Число выстрелов за залп</dt>
        <dd>{p.shotsPerVolley}</dd>
      </div>
      <div
        className="fire-profile-row"
        title={COMBAT_STAT_HELP_RU.volleyPeriodSeconds}
      >
        <dt>Период между залпами</dt>
        <dd>{p.volleyPeriodSeconds} сек</dd>
      </div>
      <div className="fire-profile-row" title={COMBAT_STAT_HELP_RU.volleysPerRound}>
        <dt>Залпов за раунд</dt>
        <dd>{p.volleysPerRound}</dd>
      </div>
      <div
        className="fire-profile-row"
        title={COMBAT_STAT_HELP_RU.roundDurationSeconds}
      >
        <dt>Длина раунда</dt>
        <dd>{p.roundDurationSeconds} сек</dd>
      </div>
      <div
        className="fire-profile-row"
        title={COMBAT_STAT_HELP_RU.blockCoefficient}
      >
        <dt>Блокировка</dt>
        <dd>{blockCoeff}</dd>
      </div>
      {massCapable && (
        <p className="fire-profile-mass" title={COMBAT_STAT_HELP_RU.massAttack}>
          Массовая атака по малым целям
        </p>
      )}
      {p.attackRadius != null && (
        <div className="fire-profile-row">
          <dt>Радиус атаки</dt>
          <dd>{p.attackRadius}</dd>
        </div>
      )}
    </dl>
  );
}
