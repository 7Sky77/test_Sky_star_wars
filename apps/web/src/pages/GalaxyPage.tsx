import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useGame } from "../gameContext.js";
import type { GalaxySystemResponse } from "../types.js";

export function GalaxyPage() {
  const { state, catalog } = useGame();
  const w = catalog?.world;
  const [arm, setArm] = useState(state?.planet.arm ?? 1);
  const [system, setSystem] = useState(state?.planet.system ?? 1);
  const [data, setData] = useState<GalaxySystemResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (state?.planet) {
      setArm(state.planet.arm);
      setSystem(state.planet.system);
    }
  }, [state?.planet.arm, state?.planet.system]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await apiFetch<GalaxySystemResponse>(
          `/api/galaxy/system?arm=${arm}&system=${system}`
        );
        if (alive) {
          setData(r);
          setErr(null);
        }
      } catch {
        if (alive) setErr("Не удалось загрузить систему");
      }
    })();
    return () => {
      alive = false;
    };
  }, [arm, system]);

  const minA = w?.minArm ?? 1;
  const maxA = w?.maxArm ?? 50;
  const minS = w?.minSystem ?? 1;
  const maxS = w?.maxSystem ?? 50;

  function clampArm(n: number) {
    return Math.min(maxA, Math.max(minA, n));
  }
  function clampSys(n: number) {
    return Math.min(maxS, Math.max(minS, n));
  }

  return (
    <div>
      <h1 className="page-title">Галактика</h1>
      <p className="stub" style={{ marginBottom: "1rem" }}>
        Просмотр системы по координатам рукав:система. Слот <strong>0</strong> — звезда,{" "}
        <strong>1–9</strong> — планеты.
      </p>
      {err && <div className="error-msg">{err}</div>}
      <div className="galaxy-layout">
        <div>
          <div className="galaxy-grid">
            {data &&
              (() => {
                const cols: Map<string, typeof data.slots> = new Map();
                const key = `${data.arm}:${data.system}`;
                cols.set(key, data.slots);
                return Array.from(cols.entries()).map(([label, slots]) => (
                  <div className="sys-column" key={label}>
                    <div className="sys-label">{label}</div>
                    {slots.map((s) => (
                      <div
                        key={s.position}
                        className={`slot ${s.kind} ${s.kind === "planet" ? "planet" : "star"} ${s.isYours ? "yours" : ""} ${s.ownerUsername ? "occupied" : ""}`}
                        title={s.label}
                      >
                        {s.kind === "star" ? "★" : s.position}
                        {s.ownerUsername && (
                          <span className="who">{s.ownerUsername}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ));
              })()}
          </div>
        </div>
        <aside className="galaxy-side">
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
              Рукав −
            </button>
            <button type="button" className="btn" onClick={() => setArm((a) => clampArm(a + 1))}>
              Рукав +
            </button>
            <button type="button" className="btn" onClick={() => setSystem((s) => clampSys(s - 1))}>
              Сист. −
            </button>
            <button type="button" className="btn" onClick={() => setSystem((s) => clampSys(s + 1))}>
              Сист. +
            </button>
          </div>
          <p className="stub" style={{ marginTop: "0.75rem" }}>
            К мультиплеерной карте и бою подключим позже; сейчас видны колонии из БД.
          </p>
        </aside>
      </div>
    </div>
  );
}
