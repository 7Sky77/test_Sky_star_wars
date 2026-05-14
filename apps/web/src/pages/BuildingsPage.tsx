import { useMemo, useState } from "react";
import { apiFetch } from "../api.js";
import { useGame } from "../gameContext.js";

export function BuildingsPage() {
  const { catalog, state, refresh } = useGame();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const levels = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of state?.buildings ?? []) m.set(b.building_id, b.level);
    return m;
  }, [state?.buildings]);

  async function build(id: string) {
    setMsg(null);
    setBusy(id);
    try {
      await apiFetch("/api/game/build", { method: "POST", json: { buildingId: id } });
      await refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      const map: Record<string, string> = {
        queue_busy: "Очередь занята",
        max_level: "Максимальный уровень",
        not_enough_metal: "Недостаточно металла",
        not_enough_crystal: "Недостаточно кристалла",
        not_enough_deuterium: "Недостаточно дейтерия",
      };
      setMsg(map[code] ?? code);
    } finally {
      setBusy(null);
    }
  }

  const q = state?.buildQueue?.[0];
  const now = state?.serverTime ?? Date.now();

  return (
    <div>
      <h1 className="page-title">Постройки</h1>
      {msg && <div className="error-msg">{msg}</div>}
      <div className="build-grid">
        {(catalog?.buildings ?? []).map((b) => {
          const lv = levels.get(b.id) ?? 0;
          const disabled =
            !!q || busy !== null || lv >= b.maxLevel;
          return (
            <div className="build-card" key={b.id}>
              <h3>{b.name}</h3>
              <div className="lv">
                Уровень {lv} / {b.maxLevel}
              </div>
              <button
                type="button"
                className="btn"
                disabled={disabled}
                onClick={() => void build(b.id)}
              >
                {busy === b.id ? "…" : "Улучшить"}
              </button>
            </div>
          );
        })}
      </div>
      {q && (
        <div className="queue">
          В очереди: <strong>{q.building_id}</strong> → уровень {q.target_level}
          <br />
          Готово через:{" "}
          {Math.max(0, Math.ceil((q.finishes_at - now) / 1000))} с
        </div>
      )}
    </div>
  );
}
