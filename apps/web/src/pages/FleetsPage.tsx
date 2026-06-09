import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type FleetUnitDef } from "@sw/shared";
import { CoordsDisplay } from "../components/CoordsDisplay.js";
import { QuantityPicker } from "../components/QuantityPicker.js";
import { useGame } from "../gameContext.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

type FleetRow = { def: FleetUnitDef; owned: number };

export function FleetsPage() {
  const { catalog, state, loading } = useGame();
  const [selected, setSelected] = useState<Record<string, number>>({});

  const rows = useMemo((): FleetRow[] => {
    if (!catalog || !state) return [];
    const byId = new Map(catalog.units.map((u) => [u.id, u]));
    const result: FleetRow[] = [];
    for (const row of state.units) {
      if (row.quantity <= 0) continue;
      const def = byId.get(row.unit_id);
      if (!def) continue;
      result.push({ def, owned: row.quantity });
    }
    result.sort((a, b) => a.def.name.localeCompare(b.def.name, "ru"));
    return result;
  }, [catalog, state]);

  function qtyFor(id: string, owned: number) {
    const raw = selected[id] ?? 0;
    return Math.min(Math.max(0, Math.floor(raw)), owned);
  }

  function selectAll() {
    const next: Record<string, number> = {};
    for (const { def, owned } of rows) next[def.id] = owned;
    setSelected(next);
  }

  function resetAll() {
    setSelected({});
  }

  const selectionTotals = useMemo(() => {
    let ships = 0;
    let types = 0;
    for (const { def, owned } of rows) {
      const raw = selected[def.id] ?? 0;
      const q = Math.min(Math.max(0, Math.floor(raw)), owned);
      if (q > 0) {
        ships += q;
        types += 1;
      }
    }
    return { ships, types };
  }, [rows, selected]);

  const totals = useMemo(() => {
    let ships = 0;
    for (const { owned } of rows) ships += owned;
    return { ships, types: rows.length };
  }, [rows]);

  if (!catalog) return null;

  const p = state?.planet;

  return (
    <div className="fleet-page">
      <h1 className="page-title">Флот</h1>
      {p && (
        <p className="page-lead">
          Флот на планете <strong>{p.name}</strong>{" "}
          <CoordsDisplay
            arm={p.arm}
            system={p.system}
            position={p.position}
            className="coords-inline"
          />
          . Выберите корабли для будущих приказов (отправка — позже).
        </p>
      )}

      {loading && !state && <p className="stub">Загрузка…</p>}

      {!loading && rows.length === 0 && (
        <div className="fleet-empty">
          <p>На планете пока нет кораблей.</p>
          <Link to="/shipyard" className="btn">
            Перейти на верфь
          </Link>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="fleet-toolbar">
            <button type="button" className="btn btn-ghost" onClick={selectAll}>
              Выбрать все
            </button>
            <button type="button" className="btn btn-ghost" onClick={resetAll}>
              Сброс
            </button>
            <span className="fleet-toolbar-meta stub-inline">
              На планете: <strong>{fmt(totals.ships)}</strong>
              {selectionTotals.ships > 0 && (
                <>
                  {" "}
                  · выбрано: <strong>{fmt(selectionTotals.ships)}</strong> (
                  {selectionTotals.types} тип.)
                </>
              )}
            </span>
          </div>

          <div className="fleet-select-grid">
            {rows.map(({ def, owned }) => {
              const q = qtyFor(def.id, owned);
              return (
                <div className={`fleet-select-card${q > 0 ? " selected" : ""}`} key={def.id}>
                  <div className="fleet-select-head">
                    <strong>{def.name}</strong>
                    <span className="fleet-owned-badge">{fmt(owned)}</span>
                  </div>
                  <QuantityPicker
                    value={q}
                    max={owned}
                    min={0}
                    compact
                    showSlider={owned > 5}
                    onChange={(v) =>
                      setSelected((prev) => ({
                        ...prev,
                        [def.id]: v,
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>

          <p className="stub" style={{ marginTop: "1rem" }}>
            Приказы атаки, транспорта и оборона орбит — в следующих обновлениях.
          </p>
        </>
      )}
    </div>
  );
}
