import { useCallback, useEffect, useState } from "react";
import { formatGalaxyCoords, formatSystemAddress, orbitLabel } from "@sw/shared";
import { apiFetch, setToken } from "../api.js";
import { useGame } from "../gameContext.js";
import { formatDiameterKm, formatTemperatureRange } from "../planetFormat.js";
import { planetTypeClass, planetVariantStyle } from "../planetVisuals.js";
import type {
  GalaxySectorResponse,
  GalaxySlot,
  GalaxySystemResponse,
} from "../types.js";

type ViewMode = "sector" | "system";

/** Углы для орбитального вида одной системы (слоты 1–9). */
const ORBIT_ANGLES: Record<number, number> = {
  1: 270,
  2: 310,
  3: 350,
  4: 20,
  5: 60,
  6: 120,
  7: 160,
  8: 200,
  9: 240,
};

function orbitRadius(position: number): number {
  if (position <= 3) return 38;
  if (position <= 6) return 52;
  return 66;
}

export function GalaxyPage() {
  const { state, catalog } = useGame();
  const planetTypeName = (id?: string) =>
    catalog?.planetTypes?.find((t) => t.id === id)?.name ?? id;
  const w = catalog?.world;
  const [viewMode, setViewMode] = useState<ViewMode>("sector");
  const [arm, setArm] = useState(state?.planet.arm ?? 1);
  const [system, setSystem] = useState(state?.planet.system ?? 1);
  const [sector, setSector] = useState<GalaxySectorResponse | null>(null);
  const [systemData, setSystemData] = useState<GalaxySystemResponse | null>(null);
  const [selected, setSelected] = useState<{
    arm: number;
    system: number;
    slot: GalaxySlot;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [spyLevel, setSpyLevel] = useState(1);

  const minA = w?.minArm ?? 1;
  const maxA = w?.maxArm ?? 50;
  const minS = w?.minSystem ?? 1;
  const maxS = w?.maxSystem ?? 50;

  const clampArm = useCallback(
    (n: number) => Math.min(maxA, Math.max(minA, n)),
    [minA, maxA]
  );
  const clampSys = useCallback(
    (n: number) => Math.min(maxS, Math.max(minS, n)),
    [minS, maxS]
  );

  useEffect(() => {
    if (state?.planet) {
      setArm(state.planet.arm);
      setSystem(state.planet.system);
    }
  }, [state?.planet.arm, state?.planet.system]);

  const coordsValid =
    Number.isFinite(arm) &&
    Number.isFinite(system) &&
    arm >= minA &&
    arm <= maxA &&
    system >= minS &&
    system <= maxS;

  useEffect(() => {
    if (!coordsValid) {
      setErr("Некорректные координаты рукава или системы");
      return;
    }

    let alive = true;
    void (async () => {
      try {
        if (viewMode === "sector") {
          const r = await apiFetch<GalaxySectorResponse>(
            `/api/galaxy/sector?arm=${arm}&system=${system}&span=7`
          );
          if (alive) {
            setSector(r);
            setSystemData(null);
            setErr(null);
          }
        } else {
          const r = await apiFetch<GalaxySystemResponse>(
            `/api/galaxy/system?arm=${arm}&system=${system}`
          );
          if (alive) {
            setSystemData(r);
            setSector(null);
            setErr(null);
          }
        }
      } catch (e) {
        if (!alive) return;
        const code = e instanceof Error ? e.message : "";
        if (code === "http_401") {
          setToken(null);
          window.location.href = "/login";
          return;
        }
        if (code === "http_404") {
          setErr(
            "Сервер устарел — перезапустите npm run dev (нужен маршрут /api/galaxy/sector)"
          );
          return;
        }
        if (code === "Failed to fetch" || code.startsWith("http_5")) {
          setErr("Сервер не отвечает — запустите npm run dev в терминале");
          return;
        }
        setErr(`Не удалось загрузить галактику (${code || "ошибка сети"})`);
      }
    })();
    return () => {
      alive = false;
    };
  }, [arm, system, viewMode, coordsValid, minA, maxA, minS, maxS]);

  function goHome() {
    if (!state?.planet) return;
    setArm(state.planet.arm);
    setSystem(state.planet.system);
    setSelected(null);
  }

  function selectSlot(a: number, s: number, slot: GalaxySlot) {
    setSelected({ arm: a, system: s, slot });
    if (slot.kind === "planet" && viewMode === "sector") {
      setArm(a);
      setSystem(s);
    }
  }

  function openSystem(a: number, s: number) {
    setArm(a);
    setSystem(s);
    setViewMode("system");
    setSelected(null);
  }

  const planetSlots =
    systemData?.slots.filter((s) => s.kind === "planet") ?? [];

  return (
    <div className="galaxy-page">
      <h1 className="page-title">Галактика</h1>

      <div className="galaxy-toolbar">
        <div className="galaxy-view-tabs">
          <button
            type="button"
            className={`btn ${viewMode === "sector" ? "btn-active" : ""}`}
            onClick={() => {
              setViewMode("sector");
              setSelected(null);
            }}
          >
            Сектор
          </button>
          <button
            type="button"
            className={`btn ${viewMode === "system" ? "btn-active" : ""}`}
            onClick={() => {
              setViewMode("system");
              setSelected(null);
            }}
          >
            Система
          </button>
        </div>
        <button type="button" className="btn" onClick={goHome}>
          К моей планете
        </button>
      </div>

      {err && <div className="error-msg">{err}</div>}

      <div className="galaxy-layout">
        <div className="galaxy-map-wrap">
          {viewMode === "sector" && sector && (
            <div className="galaxy-sector-scroll">
              <div className="galaxy-sector">
                {sector.systems.map((sys) => (
                  <div className="sys-column" key={`${sys.arm}:${sys.system}`}>
                    <button
                      type="button"
                      className={`sys-label-btn ${sys.system === sector.centerSystem ? "center" : ""}`}
                      onClick={() => openSystem(sys.arm, sys.system)}
                      title="Открыть систему"
                    >
                      {formatSystemAddress(sys.arm, sys.system)}
                    </button>
                    {sys.slots
                      .filter((s) => s.kind === "planet")
                      .map((slot) => (
                        <button
                          key={slot.position}
                          type="button"
                          className={`slot planet ${planetTypeClass(slot.planetTypeId)} ${slot.isYours ? "yours" : ""} ${slot.ownerUsername ? "occupied" : "empty"} ${selected?.slot.label === slot.label ? "selected" : ""}`}
                          style={planetVariantStyle(slot.position)}
                          onClick={() => selectSlot(sys.arm, sys.system, slot)}
                          title={
                            slot.planetTypeId
                              ? `${slot.label} · ${planetTypeName(slot.planetTypeId)}`
                              : slot.label
                          }
                        >
                          <span className="slot-num">{slot.position}</span>
                          {slot.ownerUsername && (
                            <span className="who">{slot.ownerUsername}</span>
                          )}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === "system" && systemData && (
            <div className="galaxy-system-view">
              <div className="galaxy-system-orbit">
                <button
                  type="button"
                  className={`orbit-star ${selected?.slot.kind === "star" ? "selected" : ""}`}
                  onClick={() => {
                    const star = systemData.slots.find((s) => s.kind === "star");
                    if (star) selectSlot(systemData.arm, systemData.system, star);
                  }}
                  title={formatGalaxyCoords(systemData.arm, systemData.system, 0)}
                >
                  ☀
                </button>
                {planetSlots.map((slot) => {
                  const angle = ORBIT_ANGLES[slot.position] ?? 0;
                  const r = orbitRadius(slot.position);
                  const rad = (angle * Math.PI) / 180;
                  const x = 50 + r * Math.cos(rad);
                  const y = 50 + r * Math.sin(rad);
                  return (
                    <button
                      key={slot.position}
                      type="button"
                      className={`orbit-planet ${planetTypeClass(slot.planetTypeId)} ${slot.isYours ? "yours" : ""} ${slot.ownerUsername ? "occupied" : "empty"} ${selected?.slot.label === slot.label ? "selected" : ""}`}
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        ...planetVariantStyle(slot.position),
                      }}
                      onClick={() =>
                        selectSlot(systemData.arm, systemData.system, slot)
                      }
                      title={
                        slot.planetTypeId
                          ? `${slot.label} · ${planetTypeName(slot.planetTypeId)}`
                          : slot.label
                      }
                    >
                      <span className="orbit-num">{slot.position}</span>
                    </button>
                  );
                })}
                <div className="orbit-ring orbit-ring-1" />
                <div className="orbit-ring orbit-ring-2" />
                <div className="orbit-ring orbit-ring-3" />
              </div>
              <p className="galaxy-system-caption">
                Система {formatSystemAddress(systemData.arm, systemData.system)} —
                клик по планете для координат на карте галактики
              </p>
            </div>
          )}
        </div>

        <aside className="galaxy-side">
          <div className="galaxy-side-section">
            <strong>Адрес системы</strong>
            <p className="stub-inline">Рукав и система — для навигации по галактике.</p>
          </div>
          <div className="row">
            <label htmlFor="ga">Рукав</label>
            <input
              id="ga"
              type="number"
              min={minA}
              max={maxA}
              value={arm}
              onChange={(e) => setArm(clampArm(Number(e.target.value) || minA))}
            />
          </div>
          <div className="row">
            <label htmlFor="gs">Система</label>
            <input
              id="gs"
              type="number"
              min={minS}
              max={maxS}
              value={system}
              onChange={(e) => setSystem(clampSys(Number(e.target.value) || minS))}
            />
          </div>
          <div className="nav-arrows">
            <button type="button" className="btn" onClick={() => setArm((a) => clampArm(a - 1))}>
              ◀ Рукав
            </button>
            <button type="button" className="btn" onClick={() => setArm((a) => clampArm(a + 1))}>
              Рукав ▶
            </button>
            <button type="button" className="btn" onClick={() => setSystem((s) => clampSys(s - 1))}>
              ◀ Сист.
            </button>
            <button type="button" className="btn" onClick={() => setSystem((s) => clampSys(s + 1))}>
              Сист. ▶
            </button>
          </div>

          <div className="galaxy-side-section" style={{ marginTop: "1rem" }}>
            <strong>Шпион</strong>
            <span className="stub-inline"> (скоро)</span>
          </div>
          <div className="row">
            <label htmlFor="spy">Уровень: {spyLevel}</label>
            <input
              id="spy"
              type="range"
              min={1}
              max={50}
              value={spyLevel}
              onChange={(e) => setSpyLevel(Number(e.target.value))}
            />
          </div>

          <div className="galaxy-side-section" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn btn-block" disabled title="Скоро">
              Закладки
            </button>
            <button type="button" className="btn btn-block" disabled title="Скоро">
              Фильтры
            </button>
          </div>
        </aside>
      </div>

      {selected && (
        <div className="galaxy-detail">
          <div className="galaxy-detail-head">
            <strong>
              {selected.slot.kind === "star"
                ? `Звезда ${selected.slot.label}`
                : selected.slot.planetName
                  ? `${selected.slot.planetName} ${selected.slot.label}`
                  : selected.slot.label}
            </strong>
            <span className="coords-inline stub-inline">
              {selected.slot.systemAddress ?? formatSystemAddress(selected.arm, selected.system)}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
          {selected.slot.kind === "star" ? (
            <p className="stub">Солнце системы. Спец-логика у звезды — позже.</p>
          ) : selected.slot.planetTypeId ? (
            <p>
              Тип: <strong>{planetTypeName(selected.slot.planetTypeId)}</strong>
            </p>
          ) : null}
          {selected.slot.kind === "planet" &&
            selected.slot.diameterKm != null &&
            selected.slot.temperatureMin != null &&
            selected.slot.temperatureMax != null && (
              <p>
                Диаметр: <strong>{formatDiameterKm(selected.slot.diameterKm)}</strong>
                {" · "}
                Температура:{" "}
                <strong>
                  {formatTemperatureRange(
                    selected.slot.temperatureMin,
                    selected.slot.temperatureMax
                  )}
                </strong>
              </p>
            )}
          {selected.slot.orbitIntruders && selected.slot.orbitIntruders.length > 0 && (
            <div className="galaxy-orbit-intruders">
              <strong>Флоты на орбитах</strong>
              <ul>
                {selected.slot.orbitIntruders.map((i) => (
                  <li key={i.id}>
                    <strong>{i.name}</strong> ({orbitLabel(i.orbit)}) — {i.totalShips} корабл.
                    {i.units.fighter ? ` · истребитель ×${i.units.fighter}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selected.slot.kind === "star" ? null : selected.slot.ownerUsername ? (
            <>
              <p>
                Владелец: <strong>{selected.slot.ownerUsername}</strong>
                {selected.slot.isYours && " (вы)"}
              </p>
              <div className="galaxy-actions">
                <button type="button" className="btn" disabled title="Скоро">
                  Шпионаж
                </button>
                <button type="button" className="btn" disabled title="Скоро">
                  Атака
                </button>
                <button type="button" className="btn" disabled title="Скоро">
                  Транспорт
                </button>
              </div>
            </>
          ) : (
            <>
              <p>Свободная планета — никем не занята.</p>
              <p className="stub">
                Колонизация и требования (технология, колонизатор) — в следующих
                обновлениях.
              </p>
              <div className="galaxy-actions">
                <button type="button" className="btn" disabled title="Скоро">
                  Колонизировать
                </button>
                <button type="button" className="btn" disabled title="Скоро">
                  Шпионаж
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
