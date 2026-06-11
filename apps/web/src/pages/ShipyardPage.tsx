import { useMemo, useState } from "react";
import { flatPurchaseCost, maxAffordableQuantity, scalePurchaseCost } from "@sw/shared";
import { apiFetch } from "../api.js";
import { QuantityPicker } from "../components/QuantityPicker.js";
import { UnitFireProfileInfo } from "../components/UnitFireProfileInfo.js";
import { UnitSpecializationInfo } from "../components/UnitSpecializationInfo.js";
import { purchaseErrorMessage } from "../purchaseErrors.js";
import { useGame } from "../gameContext.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

export function ShipyardPage() {
  const { catalog, state, refresh } = useGame();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of state?.units ?? []) m.set(u.unit_id, u.quantity);
    return m;
  }, [state?.units]);

  const resources = state?.planet.resources;

  function qtyFor(id: string, max: number) {
    const raw = quantities[id] ?? 1;
    return Math.min(Math.max(1, Math.floor(raw)), Math.max(1, max));
  }

  async function build(id: string, quantity: number) {
    setMsg(null);
    setBusy(id);
    try {
      await apiFetch("/api/game/ships/build", {
        method: "POST",
        json: { unitId: id, quantity },
      });
      await refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      setMsg(purchaseErrorMessage(code));
    } finally {
      setBusy(null);
    }
  }

  if (!catalog || !resources) return null;

  return (
    <div>
      <h1 className="page-title">Верфь</h1>
      <p className="page-lead">
        Постройка кораблей на планете. Выберите количество — ползунок, ввод или max по
        доступным ресурсам. Солнечный спутник даёт <strong>50</strong> энергии за штуку на
        орбите.
      </p>
      {msg && <div className="error-msg">{msg}</div>}
      <div className="build-grid">
        {catalog.units.map((u) => {
          const unitCost = flatPurchaseCost(u);
          const maxQ = maxAffordableQuantity(unitCost, resources);
          const n = counts.get(u.id) ?? 0;
          const q = maxQ > 0 ? qtyFor(u.id, maxQ) : 0;
          const total = scalePurchaseCost(unitCost, q);
          return (
            <div className="build-card" key={u.id}>
              <h3>{u.name}</h3>
              {u.description && (
                <p className="stub" style={{ margin: "0 0 0.5rem" }}>
                  {u.description}
                </p>
              )}
              <div className="lv">
                На планете: <strong>{fmt(n)}</strong>
              </div>
              <div className="lv">
                За 1: металл {fmt(unitCost.metal ?? 0)} · минералы {fmt(unitCost.minerals ?? 0)}{" "}
                · веспен {fmt(unitCost.vespene ?? 0)}
              </div>
              {maxQ > 0 && (
                <>
                  <div className="lv">
                    Итого ({q}): металл {fmt(total.metal ?? 0)} · минералы{" "}
                    {fmt(total.minerals ?? 0)} · веспен {fmt(total.vespene ?? 0)}
                  </div>
                  <QuantityPicker
                    value={q}
                    max={maxQ}
                    min={1}
                    onChange={(v) => setQuantities((prev) => ({ ...prev, [u.id]: v }))}
                    disabled={busy !== null}
                  />
                </>
              )}
              <UnitFireProfileInfo unit={u} />
              <UnitSpecializationInfo unit={u} />
              <button
                type="button"
                className="btn"
                disabled={busy !== null || maxQ < 1}
                onClick={() => void build(u.id, q)}
              >
                {busy === u.id ? "…" : "Построить"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
