import { Link } from "react-router-dom";
import { useGame } from "../gameContext.js";
import { formatDiameterKm, formatTemperatureRange } from "../planetFormat.js";
import { CoordsDisplay } from "../components/CoordsDisplay.js";
import { LocalSpaceInfo } from "../components/LocalSpaceInfo.js";
import { planetTypeClass, planetVisualStyle } from "../planetVisuals.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

export function OverviewPage() {
  const { catalog, state, loading } = useGame();
  const p = state?.planet;
  const planetType = catalog?.planetTypes?.find((t) => t.id === p?.planetTypeId);
  const faction = catalog?.factions?.[0];
  const queue = state?.buildQueue ?? [];
  const maxSlots = catalog?.world?.buildQueueSlots ?? 3;
  const buildingName = (id: string) =>
    catalog?.buildings?.find((b) => b.id === id)?.name ?? id;
  const now = state?.serverTime ?? Date.now();

  return (
    <div>
      <h1 className="page-title">Обзор</h1>
      {loading && !p && <p className="stub">Загрузка…</p>}
      {p && (
        <>
          <p className="page-lead">
            Колония <strong>{p.name}</strong> · галактика{" "}
            <CoordsDisplay arm={p.arm} system={p.system} position={p.position} className="coords-inline" />
            {planetType && (
              <>
                {" "}
                · тип: <strong>{planetType.name}</strong>
                {planetType.description ? ` (${planetType.description})` : null}
              </>
            )}
            {faction && (
              <>
                {" "}
                · фракция: <strong>{faction.displayName}</strong>
                {faction.loreName ? ` (${faction.loreName})` : null}
              </>
            )}
            .
          </p>

          <div className="overview-hero">
            <div
              className={`overview-planet ${planetTypeClass(p.planetTypeId)}`}
              style={planetVisualStyle(
                p.planetTypeId,
                p.position,
                p.arm,
                p.system
              )}
              title={planetType?.name ?? "Планета"}
              aria-hidden
            />
            {planetType && (
              <p className="overview-planet-caption">
                {planetType.name}
                {planetType.description ? ` — ${planetType.description}` : null}
              </p>
            )}
          </div>

          <div className="overview-cards">
            <div className="overview-card">
              <h3>Планета</h3>
              <ul className="overview-list">
                <li>Диаметр: {formatDiameterKm(p.diameterKm)}</li>
                <li>
                  Температура: {formatTemperatureRange(p.temperatureMin, p.temperatureMax)}
                </li>
              </ul>
            </div>
            <div className="overview-card">
              <h3>Ресурсы</h3>
              <ul className="overview-list">
                <li>Металл: {fmt(p.resources.metal)}</li>
                <li>Минералы: {fmt(p.resources.minerals)}</li>
                <li>Веспен: {fmt(p.resources.vespene)}</li>
              </ul>
            </div>
            <div className="overview-card">
              <h3>Очередь ({queue.length}/{maxSlots})</h3>
              {queue.length > 0 ? (
                <ul className="overview-list overview-queue">
                  {queue.map((q) => (
                    <li key={q.id}>
                      <strong>{buildingName(q.building_id)}</strong> → ур. {q.target_level}
                      {" · "}
                      ~{Math.max(0, Math.ceil((q.finishes_at - now) / 1000))} с
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="stub">Очередь построек пуста.</p>
              )}
            </div>
            <div className="overview-card">
              <h3>Дальше</h3>
              <ul className="overview-links">
                <li>
                  <Link to="/resources">Сырьё</Link> — производство и склады
                </li>
                <li>
                  <Link to="/buildings">Постройки</Link> — улучшения
                </li>
                <li>
                  <Link to="/galaxy">Галактика</Link> — соседние системы
                </li>
              </ul>
            </div>
          </div>

          {catalog?.localSpace && <LocalSpaceInfo localSpace={catalog.localSpace} />}
        </>
      )}
    </div>
  );
}
