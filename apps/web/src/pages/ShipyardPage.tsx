import { useMemo, useState } from "react";
import { flatPurchaseCost } from "@sw/shared";
import { apiFetch } from "../api.js";
import { useGame } from "../gameContext.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

export function ShipyardPage() {
  const { catalog, state, refresh } = useGame();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of state?.units ?? []) m.set(u.unit_id, u.quantity);
    return m;
  }, [state?.units]);

  async function build(id: string) {
    setMsg(null);
    setBusy(id);
    try {
      await apiFetch("/api/game/ships/build", { method: "POST", json: { unitId: id } });
      await refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      const map: Record<string, string> = {
        not_enough_metal: "Недостаточно металла",
        not_enough_crystal: "Недостаточно кристалла",
        not_enough_deuterium: "Недостаточно дейтерия",
        unknown_unit: "Неизвестный корабль",
      };
      setMsg(map[code] ?? code);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Верфь</h1>
      <p className="page-lead">
        Постройка кораблей на планете (MVP: сразу после оплаты). Солнечный спутник даёт{" "}
        <strong>50</strong> энергии за штуку на орбите.
      </p>
      {msg && <div className="error-msg">{msg}</div>}
      <div className="build-grid">
        {(catalog?.units ?? []).map((u) => {
          const cost = flatPurchaseCost(u);
          const n = counts.get(u.id) ?? 0;
          return (
            <div className="build-card" key={u.id}>
              <h3>{u.name}</h3>
              {u.description && <p className="stub" style={{ margin: "0 0 0.5rem" }}>{u.description}</p>}
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
                onClick={() => void build(u.id)}
              >
                {busy === u.id ? "…" : "Построить 1"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
