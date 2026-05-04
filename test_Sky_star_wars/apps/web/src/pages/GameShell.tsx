import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { setToken } from "../api.js";
import { GameProvider, useGame } from "../gameContext.js";
import { BuildingsPage } from "./BuildingsPage.js";
import { GalaxyPage } from "./GalaxyPage.js";
import { StubPage } from "./StubPage.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

function ShellInner() {
  const { state, loading, error } = useGame();

  function logout() {
    setToken(null);
    window.location.href = "/login";
  }

  const p = state?.planet;

  return (
    <div className="shell">
      <header className="shell-top">
        <strong>Sky</strong>
        {p && (
          <>
            <span className="coords">
              {p.name} [{p.arm}:{p.system}:{p.position}]
            </span>
            <div className="res">
              <span style={{ color: "#9ca3af" }}>Металл {fmt(p.resources.metal)}</span>
              <span style={{ color: "#60a5fa" }}>Кристалл {fmt(p.resources.crystal)}</span>
              <span style={{ color: "#4ade80" }}>Дейтерий {fmt(p.resources.deuterium)}</span>
            </div>
          </>
        )}
        {loading && !p && <span className="stub">Загрузка…</span>}
        {error && <span className="error-msg">{error}</span>}
        <div className="shell-meta">
          <button type="button" onClick={logout}>
            Выход
          </button>
        </div>
      </header>

      <nav className="shell-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Обзор
        </NavLink>
        <NavLink to="/buildings" className={({ isActive }) => (isActive ? "active" : "")}>
          Постройки
        </NavLink>
        <NavLink to="/resources" className={({ isActive }) => (isActive ? "active" : "")}>
          Сырьё
        </NavLink>
        <NavLink to="/shipyard" className={({ isActive }) => (isActive ? "active" : "")}>
          Верфь
        </NavLink>
        <NavLink to="/defense" className={({ isActive }) => (isActive ? "active" : "")}>
          Оборона
        </NavLink>
        <NavLink to="/research" className={({ isActive }) => (isActive ? "active" : "")}>
          Исследования
        </NavLink>
        <NavLink to="/fleets" className={({ isActive }) => (isActive ? "active" : "")}>
          Флоты
        </NavLink>
        <NavLink to="/trade" className={({ isActive }) => (isActive ? "active" : "")}>
          Торговля
        </NavLink>
        <NavLink to="/galaxy" className={({ isActive }) => (isActive ? "active" : "")}>
          Галактика
        </NavLink>
      </nav>

      <main className="shell-main">
        <Routes>
          <Route path="/" element={<StubPage title="Обзор" />} />
          <Route path="/buildings" element={<BuildingsPage />} />
          <Route path="/resources" element={<StubPage title="Сырьё" />} />
          <Route path="/shipyard" element={<StubPage title="Верфь" />} />
          <Route path="/defense" element={<StubPage title="Оборона" />} />
          <Route path="/research" element={<StubPage title="Исследования" />} />
          <Route path="/fleets" element={<StubPage title="Флоты" />} />
          <Route path="/trade" element={<StubPage title="Торговля" />} />
          <Route path="/galaxy" element={<GalaxyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function GameShell() {
  return (
    <GameProvider>
      <ShellInner />
    </GameProvider>
  );
}
