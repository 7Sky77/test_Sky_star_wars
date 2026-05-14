import { useMemo, useState } from "react";
import { flatPurchaseCost } from "@sw/shared";
import { apiFetch } from "../api.js";
import { useGame } from "../gameContext.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

export function DefensePage() {
  const { catalog, state, refresh } = useGame();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of state?.defense ?? []) m.set(d.defense_id, d.quantity);
    return m;
  }, [state?.defense]);

  async function build(id: string) {
    setMsg(null);
    setBusy(id);
    try {
      await apiFetch("/api/game/defense/build", { method: "POST", json: { defenseId: id } });
      await refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      const map: Record<string, string> = {
        not_enough_metal: "Недостаточно металла",
        not_enough_crystal: "Недостаточно кристалла",
        not_enough_deuterium: "Недостаточно дейтерия",
        unknown_defense: "Неизвестная оборона",
      };
      setMsg(map[code] ?? code);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Оборона</h1>
      <p className="page-lead">Планетарная оборона (MVP: мгновенная постройка после оплаты).</p>
      {msg && <div className="error-msg">{msg}</div>}
      <div className="build-grid">
        {(catalog?.defense ?? []).map((d) => {
          const cost = flatPurchaseCost(d);
          const n = counts.get(d.id) ?? 0;
          return (
            <div className="build-card" key={d.id}>
              <h3>{d.name}</h3>
              {d.description && <p className="stub" style={{ margin: "0 0 0.5rem" }}>{d.description}</p>}
              <div className="lv">
                На планете: <strong>{fmt(n)}</strong>
              </div>
              <div className="lv">
                Металл {fmt(cost.metal ?? 0)} · Кристалл {fmt(cost.crystal ?? 0)} · Дейтерий{" "}
                {fmt(cost.deuterium ?? 0)}
              </div>
              <button
                type="button"
                className="btn"
                disabled={busy !== null}
                onClick={() => void build(d.id)}
              >
                {busy === d.id ? "…" : "Построить 1"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
