import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "./api.js";
import type { GameCatalogWithCheats, GameState } from "./types.js";

interface GameCtx {
  catalog: GameCatalogWithCheats | null;
  state: GameState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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
      } catch {
        if (alive) setError("Каталог не загрузился");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await apiFetch<GameState>("/api/game/state");
      setState(s);
      setError(null);
    } catch {
      setError("Состояние игры недоступно");
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
    <Ctx.Provider value={{ catalog, state, loading, error, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGame() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGame outside GameProvider");
  return v;
}
