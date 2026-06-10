import { useMemo, useState } from "react";
import {
  fleetFlightSeconds,
  intrudersAtCoords,
  orbitLabel,
  FLEET_MISSION_LABELS_RU,
  FLEET_MISSION_STATUS_RU,
  type FleetMissionType,
  type LocalOrbitId,
} from "@sw/shared";
import { apiFetch } from "../api.js";
import { CoordsDisplay } from "./CoordsDisplay.js";
import { OrbitIntrudersAtTarget } from "./OrbitIntrudersInfo.js";
import type { FleetMissionState } from "../types.js";
import { useGame } from "../gameContext.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

function formatEta(ms: number, serverTime: number): string {
  const left = Math.max(0, ms - serverTime);
  const sec = Math.ceil(left / 1000);
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m} мин ${s} с`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h} ч ${rm} мин`;
}

const ORBITS: LocalOrbitId[] = ["low", "medium", "high"];

const ERROR_RU: Record<string, string> = {
  invalid_coords: "Некорректные координаты.",
  invalid_orbit: "Выберите орбиту.",
  empty_fleet: "Выберите хотя бы один корабль.",
  insufficient_units: "Недостаточно кораблей на планете.",
  unknown_unit: "Неизвестный тип корабля.",
  planet_not_found: "Планета не найдена.",
};

interface FleetMissionPanelProps {
  selected: Record<string, number>;
  selectionShips: number;
  onSent: () => void;
}

export function FleetMissionPanel({
  selected,
  selectionShips,
  onSent,
}: FleetMissionPanelProps) {
  const { catalog, state } = useGame();
  const p = state?.planet;
  const [targetArm, setTargetArm] = useState(p?.arm ?? 1);
  const [targetSystem, setTargetSystem] = useState(p?.system ?? 1);
  const [targetPosition, setTargetPosition] = useState(p?.position ?? 1);
  const [targetOrbit, setTargetOrbit] = useState<LocalOrbitId>("high");
  const [speedPct, setSpeedPct] = useState(100);
  const [holdMinutes, setHoldMinutes] = useState(0);
  const [missionType, setMissionType] = useState<FleetMissionType>("attack");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flightSec = useMemo(() => {
    if (!p) return 0;
    return fleetFlightSeconds(
      { arm: p.arm, system: p.system, position: p.position },
      { arm: targetArm, system: targetSystem, position: targetPosition },
      speedPct
    );
  }, [p, targetArm, targetSystem, targetPosition, speedPct]);

  async function send() {
    if (!p || selectionShips <= 0) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch("/api/game/fleet/send", {
        method: "POST",
        json: {
          targetArm,
          targetSystem,
          targetPosition,
          targetOrbit,
          missionType,
          units: selected,
          speedPct,
          holdMinutes,
        },
      });
      onSent();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(ERROR_RU[code] ?? "Не удалось отправить флот.");
    } finally {
      setSending(false);
    }
  }

  if (!catalog || !p) return null;

  const w = catalog.world;
  const serverTime = state?.serverTime ?? Date.now();
  const arrivesAtPreview = serverTime + flightSec * 1000;
  const intruders = state?.orbitIntruders ?? catalog.orbitIntruders ?? [];
  const unitNames = new Map(catalog.units.map((u) => [u.id, u.name]));

  return (
    <section className="fleet-mission-panel">
      <h2 className="section-title">Отправка флота</h2>
      <p className="stub-inline">
        Цель: координаты <strong>[A:S:P]</strong> и орбита вокруг объекта (
        {catalog.localSpace?.orbits.map((o) => o.name).join(" / ") ?? "низкая / средняя / высокая"}).
      </p>

      <div className="fleet-mission-form">
        <div className="fleet-mission-coords">
          <label>
            Рукав
            <input
              type="number"
              min={w.minArm}
              max={w.maxArm}
              value={targetArm}
              onChange={(e) => setTargetArm(Number(e.target.value))}
            />
          </label>
          <label>
            Система
            <input
              type="number"
              min={w.minSystem}
              max={w.maxSystem}
              value={targetSystem}
              onChange={(e) => setTargetSystem(Number(e.target.value))}
            />
          </label>
          <label>
            Слот
            <input
              type="number"
              min={w.starSlot}
              max={w.maxPlanetSlot}
              value={targetPosition}
              onChange={(e) => setTargetPosition(Number(e.target.value))}
            />
          </label>
          <label>
            Орбита
            <select
              value={targetOrbit}
              onChange={(e) => setTargetOrbit(e.target.value as LocalOrbitId)}
            >
              {ORBITS.map((id) => (
                <option key={id} value={id}>
                  {orbitLabel(id)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="fleet-mission-options">
          <label>
            Приказ
            <select
              value={missionType}
              onChange={(e) => setMissionType(e.target.value as FleetMissionType)}
            >
              {(["attack", "hold"] as FleetMissionType[]).map((t) => (
                <option key={t} value={t}>
                  {FLEET_MISSION_LABELS_RU[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Скорость, %
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={speedPct}
              onChange={(e) => setSpeedPct(Number(e.target.value))}
            />
            <span>{speedPct}%</span>
          </label>
          <label>
            Удержание, мин (0 = бессрочно)
            <input
              type="number"
              min={0}
              max={720}
              value={holdMinutes}
              onChange={(e) => setHoldMinutes(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="fleet-mission-summary">
          <span>
            Приказ: <strong>{FLEET_MISSION_LABELS_RU[missionType]}</strong>
          </span>
          <span>
            Цель:{" "}
            <CoordsDisplay
              arm={targetArm}
              system={targetSystem}
              position={targetPosition}
              className="coords-inline"
            />{" "}
            · <strong>{orbitLabel(targetOrbit)}</strong>
          </span>
          <span>
            Время в пути: <strong>{formatEta(arrivesAtPreview, serverTime)}</strong> (
            {flightSec} с при {speedPct}%)
          </span>
          <span>
            Кораблей: <strong>{fmt(selectionShips)}</strong>
          </span>
        </div>

        <OrbitIntrudersAtTarget
          intruders={intruders}
          arm={targetArm}
          system={targetSystem}
          position={targetPosition}
          orbit={targetOrbit}
          unitNames={unitNames}
        />

        {error && <p className="form-error">{error}</p>}

        <button
          type="button"
          className="btn"
          disabled={sending || selectionShips <= 0}
          onClick={() => void send()}
        >
          {sending ? "Отправка…" : "Отправить флот"}
        </button>
      </div>
    </section>
  );
}

export function FleetMissionsList() {
  const { catalog, state, refresh } = useGame();
  const missions = state?.fleetMissions ?? [];
  const serverTime = state?.serverTime ?? Date.now();
  const intruders = state?.orbitIntruders ?? [];

  if (!catalog || missions.length === 0) return null;

  const unitNames = new Map(catalog.units.map((u) => [u.id, u.name]));

  return (
    <section className="fleet-missions-list">
      <h2 className="section-title">Активные миссии</h2>
      <div className="fleet-missions-grid">
        {missions.map((m) => (
          <FleetMissionCard
            key={m.id}
            mission={m}
            serverTime={serverTime}
            unitNames={unitNames}
            intruders={intruders}
            onAction={() => void refresh()}
          />
        ))}
      </div>
    </section>
  );
}

const RECALL_ERROR_RU: Record<string, string> = {
  mission_not_found: "Миссия не найдена.",
  not_at_coords: "Флот ещё не на координатах.",
  planet_not_found: "Планета-источник недоступна.",
};

const ATTACK_ERROR_RU: Record<string, string> = {
  ...RECALL_ERROR_RU,
  no_intruder: "На орбите нет противника.",
};

function FleetMissionCard({
  mission: m,
  serverTime,
  unitNames,
  intruders,
  onAction,
}: {
  mission: FleetMissionState;
  serverTime: number;
  unitNames: Map<string, string>;
  intruders: import("../types.js").OrbitIntruderState[];
  onAction: () => void;
}) {
  const [recalling, setRecalling] = useState(false);
  const [attacking, setAttacking] = useState(false);
  const [recallError, setRecallError] = useState<string | null>(null);
  const [attackError, setAttackError] = useState<string | null>(null);

  const intruderHere =
    m.status === "holding" &&
    intrudersAtCoords(
      intruders,
      m.target.arm,
      m.target.system,
      m.target.position,
      m.target.orbit
    ).length > 0;

  const statusLabel =
    m.status === "outbound"
      ? `${FLEET_MISSION_STATUS_RU.outbound} · ${formatEta(m.arrivesAt, serverTime)}`
      : m.status === "returning"
        ? `${FLEET_MISSION_STATUS_RU.returning} · ${formatEta(m.arrivesAt, serverTime)}`
        : m.holdUntil
          ? `${FLEET_MISSION_STATUS_RU.holding} · удержание ${formatEta(m.holdUntil, serverTime)}`
          : FLEET_MISSION_STATUS_RU.holding;

  async function recall() {
    setRecalling(true);
    setRecallError(null);
    try {
      await apiFetch("/api/game/fleet/recall", {
        method: "POST",
        json: { missionId: m.id },
      });
      onAction();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setRecallError(RECALL_ERROR_RU[code] ?? "Не удалось отправить на планету.");
    } finally {
      setRecalling(false);
    }
  }

  async function attack() {
    setAttacking(true);
    setAttackError(null);
    try {
      await apiFetch("/api/game/fleet/attack", {
        method: "POST",
        json: { missionId: m.id },
      });
      onAction();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setAttackError(ATTACK_ERROR_RU[code] ?? "Не удалось начать бой.");
    } finally {
      setAttacking(false);
    }
  }

  const unitLines = Object.entries(m.units)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => `${unitNames.get(id) ?? id} ×${fmt(q)}`)
    .join(", ");

  return (
    <article className="fleet-mission-card">
      <header>
        <strong>
          <CoordsDisplay
            arm={m.target.arm}
            system={m.target.system}
            position={m.target.position}
            className="coords-inline"
          />
        </strong>
        <span className="fleet-mission-orbit">{orbitLabel(m.target.orbit)}</span>
      </header>
      <p className="fleet-mission-status">{statusLabel}</p>
      <p className="fleet-mission-ships">
        {fmt(m.totalShips)} корабл. · {unitLines}
      </p>
      <p className="stub-inline">
        {m.status === "returning" ? "К планете " : "От "}
        <CoordsDisplay
          arm={m.origin.arm}
          system={m.origin.system}
          position={m.origin.position}
          className="coords-inline"
        />{" "}
        · скорость {m.speedPct}%
      </p>
      {m.status === "holding" && (
        <div className="fleet-mission-actions">
          {intruderHere && (
            <button
              type="button"
              className="btn"
              disabled={attacking || recalling}
              onClick={() => void attack()}
            >
              {attacking ? "Бой…" : "Атаковать"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={recalling || attacking}
            onClick={() => void recall()}
          >
            {recalling ? "Отправка…" : "На планету"}
          </button>
        </div>
      )}
      {attackError && <p className="form-error">{attackError}</p>}
      {recallError && <p className="form-error">{recallError}</p>}
    </article>
  );
}
