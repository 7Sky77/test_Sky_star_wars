import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, setToken } from "./api.js";
import type { GameCatalogWithCheats, GameState } from "./types.js";

interface GameCtx {
  catalog: GameCatalogWithCheats | null;
  state: GameState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  reloadCatalog: () => Promise<void>;
}

const Ctx = createContext<GameCtx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<GameCatalogWithCheats | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const c = await apiFetch<GameCatalogWithCheats>("/api/catalog");
        if (alive) setCatalog(c);
      } catch (e) {
        if (!alive) return;
        const code = e instanceof Error ? e.message : "";
        setError(
          code.startsWith("http_") || code === "Failed to fetch"
            ? "Сервер не запущен — в терминале: npm run dev"
            : "Каталог не загрузился"
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const reloadCatalog = useCallback(async () => {
    try {
      const c = await apiFetch<GameCatalogWithCheats>("/api/catalog");
      setCatalog(c);
    } catch {
      setError("Каталог не загрузился");
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await apiFetch<GameState>("/api/game/state");
      setState(s);
      setError(null);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "http_401") {
        setToken(null);
        window.location.href = "/login";
        return;
      }
      setError(
        code === "http_503" || code.startsWith("http_5")
          ? "Сервер недоступен — запустите npm run dev"
          : "Состояние игры недоступно"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <Ctx.Provider value={{ catalog, state, loading, error, refresh, reloadCatalog }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGame() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGame outside GameProvider");
  return v;
}
