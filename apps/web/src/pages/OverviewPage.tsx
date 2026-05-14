import { Link } from "react-router-dom";
import { useGame } from "../gameContext.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

export function OverviewPage() {
  const { catalog, state, loading } = useGame();
  const p = state?.planet;
  const faction = catalog?.factions?.[0];
  const q = state?.buildQueue?.[0];
  const now = state?.serverTime ?? Date.now();

  return (
    <div>
      <h1 className="page-title">Обзор</h1>
      {loading && !p && <p className="stub">Загрузка…</p>}
      {p && (
        <>
          <p className="page-lead">
            Колония <strong>{p.name}</strong> в секторе{" "}
            <span className="coords-inline">
              [{p.arm}:{p.system}:{p.position}]
            </span>
            {faction && (
              <>
                {" "}
                · фракция: <strong>{faction.displayName}</strong>
                {faction.loreName ? ` (${faction.loreName})` : null}
              </>
            )}
            .
          </p>

          <div className="overview-cards">
            <div className="overview-card">
              <h3>Ресурсы</h3>
              <ul className="overview-list">
                <li>Металл: {fmt(p.resources.metal)}</li>
                <li>Кристалл: {fmt(p.resources.crystal)}</li>
                <li>Дейтерий: {fmt(p.resources.deuterium)}</li>
              </ul>
            </div>
            <div className="overview-card">
              <h3>Очередь</h3>
              {q ? (
                <p className="overview-queue">
                  Идёт улучшение <strong>{q.building_id}</strong> до уровня {q.target_level}.
                  <br />
                  Осталось ~{Math.max(0, Math.ceil((q.finishes_at - now) / 1000))} с
                </p>
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
        </>
      )}
    </div>
  );
}
