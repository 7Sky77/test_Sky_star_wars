import { useMemo } from "react";
import type { GameCatalog } from "@sw/shared";
import {
  DEFAULT_STORAGE,
  energyConsumption,
  energyFromFleetUnits,
  energyProduction,
  productionPerHour,
  storageBonusAllAmount,
} from "@sw/shared";
import { useGame } from "../gameContext.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

function fmtRate(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString("ru-RU");
}

function economyFromState(
  catalog: GameCatalog,
  buildings: { building_id: string; level: number }[],
  fleetCounts: Map<string, number>
) {
  const levels = new Map(buildings.map((b) => [b.building_id, b.level]));
  let produced = 0;
  let consumed = 0;
  for (const b of catalog.buildings) {
    const lv = levels.get(b.id) ?? 0;
    produced += energyProduction(b, lv);
    consumed += energyConsumption(b, lv);
  }
  produced += energyFromFleetUnits(catalog.units, fleetCounts);
  const energyFactor = consumed <= 0 ? 1 : Math.min(1, produced / consumed);

  const rates = { metal: 0, crystal: 0, deuterium: 0 };
  for (const b of catalog.buildings) {
    const lv = levels.get(b.id) ?? 0;
    const p = productionPerHour(b, lv);
    if (!p) continue;
    const amt = p.amount * energyFactor;
    if (p.resourceId === "metal") rates.metal += amt;
    else if (p.resourceId === "crystal") rates.crystal += amt;
    else if (p.resourceId === "deuterium") rates.deuterium += amt;
  }

  const wh = catalog.buildings.find((b) => b.id === "warehouse");
  const wl = levels.get("warehouse") ?? 0;
  const extra = wh ? storageBonusAllAmount(wh, wl) : 0;
  const caps = {
    metal: DEFAULT_STORAGE.metal + extra,
    crystal: DEFAULT_STORAGE.crystal + extra,
    deuterium: DEFAULT_STORAGE.deuterium + extra,
  };

  const rows = catalog.buildings.map((b) => {
    const lv = levels.get(b.id) ?? 0;
    const prod = productionPerHour(b, lv);
    const ep = energyProduction(b, lv);
    const ec = energyConsumption(b, lv);
    const storageExtra = storageBonusAllAmount(b, lv);
    return {
      id: b.id,
      name: b.name,
      level: lv,
      prodPerHour: prod ? prod.amount * energyFactor : null,
      prodResourceId: prod?.resourceId,
      rawProdPerHour: prod?.amount ?? null,
      energyProd: ep,
      energyUse: ec,
      storageExtra: storageExtra > 0 ? storageExtra : null,
    };
  });

  return { produced, consumed, energyFactor, rates, caps, rows, fleetEnergy: energyFromFleetUnits(catalog.units, fleetCounts) };
}

export function ResourcesPage() {
  const { catalog, state } = useGame();

  const fleetCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of state?.units ?? []) m.set(u.unit_id, u.quantity);
    return m;
  }, [state?.units]);

  const eco = useMemo(() => {
    if (!catalog || !state) return null;
    return economyFromState(catalog, state.buildings, fleetCounts);
  }, [catalog, state, fleetCounts]);

  const res = state?.planet.resources;
  const resMeta = catalog?.resources ?? [];

  const nameFor = (id: string) => resMeta.find((r) => r.id === id)?.name ?? id;

  if (!catalog || !state || !eco) {
    return (
      <div>
        <h1 className="page-title">Сырьё</h1>
        <p className="stub">Загрузка данных…</p>
      </div>
    );
  }

  const pct = (cur: number, cap: number) =>
    cap <= 0 ? 0 : Math.min(100, Math.round((cur / cap) * 1000) / 10);

  return (
    <div>
      <h1 className="page-title">Сырьё</h1>
      <p className="page-lead">
        Производство в час (с учётом энергии), склады и баланс энергии — те же формулы, что на
        сервере.
      </p>

      <section className="eco-section">
        <h2>Энергия</h2>
        <div className="eco-cards">
          <div className="eco-card">
            <div className="eco-label">Выработка</div>
            <div className="eco-value">{fmt(eco.produced)}</div>
          </div>
          <div className="eco-card">
            <div className="eco-label">Потребление</div>
            <div className="eco-value">{fmt(eco.consumed)}</div>
          </div>
          <div className="eco-card accent">
            <div className="eco-label">Коэффициент на производство</div>
            <div className="eco-value">{Math.round(eco.energyFactor * 100)}%</div>
          </div>
        </div>
        {eco.fleetEnergy > 0 && (
          <p className="stub" style={{ marginTop: "0.5rem" }}>
            Солнечные спутники и др.: <strong>+{fmt(eco.fleetEnergy)}</strong> к выработке энергии на орбите.
          </p>
        )}
        {eco.consumed > eco.produced && eco.consumed > 0 && (
          <p className="eco-warn">
            Нехватка энергии снижает добычу ресурсов (как в движке <code>advancePlanet</code>).
          </p>
        )}
      </section>

      <section className="eco-section">
        <h2>Склады и запасы</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ресурс</th>
              <th>Есть</th>
              <th>Вместимость</th>
              <th>Заполнение</th>
            </tr>
          </thead>
          <tbody>
            {(["metal", "crystal", "deuterium"] as const).map((id) => (
              <tr key={id}>
                <td>{nameFor(id)}</td>
                <td className="num">{fmt(res?.[id] ?? 0)}</td>
                <td className="num">{fmt(eco.caps[id])}</td>
                <td>
                  <div className="bar-wrap">
                    <div
                      className="bar-fill"
                      style={{ width: `${pct(res?.[id] ?? 0, eco.caps[id])}%` }}
                    />
                  </div>
                  <span className="bar-pct">{pct(res?.[id] ?? 0, eco.caps[id])}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="eco-section">
        <h2>Производство в час (эффективное)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ресурс</th>
              <th className="num">/ч</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{nameFor("metal")}</td>
              <td className="num">{fmtRate(eco.rates.metal)}</td>
            </tr>
            <tr>
              <td>{nameFor("crystal")}</td>
              <td className="num">{fmtRate(eco.rates.crystal)}</td>
            </tr>
            <tr>
              <td>{nameFor("deuterium")}</td>
              <td className="num">{fmtRate(eco.rates.deuterium)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="eco-section">
        <h2>По зданиям</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Здание</th>
              <th className="num">Ур.</th>
              <th>Производство</th>
              <th className="num">Эн. +</th>
              <th className="num">Эн. −</th>
              <th>Склад</th>
            </tr>
          </thead>
          <tbody>
            {eco.rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="num">{r.level}</td>
                <td>
                  {r.prodPerHour != null && r.prodResourceId ? (
                    <>
                      {fmtRate(r.prodPerHour)} {nameFor(r.prodResourceId)}/ч
                      {eco.energyFactor < 1 && r.rawProdPerHour != null ? (
                        <span className="muted small">
                          {" "}
                          (база {fmtRate(r.rawProdPerHour)})
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num">{r.energyProd > 0 ? fmt(r.energyProd) : "—"}</td>
                <td className="num">{r.energyUse > 0 ? fmt(r.energyUse) : "—"}</td>
                <td>
                  {r.storageExtra != null
                    ? `+${fmt(r.storageExtra)} ко всем складам`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
