import { useState } from "react";
import { apiFetch } from "../api.js";
import { useGame } from "../gameContext.js";

export function DevGrantPanel() {
  const { catalog, refresh } = useGame();
  const [metal, setMetal] = useState("50000");
  const [crystal, setCrystal] = useState("25000");
  const [deuterium, setDeuterium] = useState("10000");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const show =
    catalog?.cheats?.grantResources === true ||
    import.meta.env.DEV ||
    import.meta.env.VITE_ALLOW_RESOURCE_CHEAT === "true";

  if (!show) return null;

  async function grant() {
    setMsg(null);
    setBusy(true);
    try {
      await apiFetch("/api/game/dev/grant-resources", {
        method: "POST",
        json: {
          metal: Number(metal) || 0,
          crystal: Number(crystal) || 0,
          deuterium: Number(deuterium) || 0,
        },
      });
      await refresh();
      setMsg("Начислено.");
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      const map: Record<string, string> = {
        http_404: "Чит выключен на сервере (нужен dev или ALLOW_RESOURCE_CHEAT=1)",
        nothing_to_grant: "Введите хотя бы одно число > 0",
        grant_too_large: "Слишком большое значение",
      };
      setMsg(map[code] ?? code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="dev-grant">
      <summary>Поставка ресурсов (тест)</summary>
      <div className="dev-grant-body">
        <label>
          Металл
          <input
            type="number"
            min={0}
            value={metal}
            onChange={(e) => setMetal(e.target.value)}
          />
        </label>
        <label>
          Кристалл
          <input
            type="number"
            min={0}
            value={crystal}
            onChange={(e) => setCrystal(e.target.value)}
          />
        </label>
        <label>
          Дейтерий
          <input
            type="number"
            min={0}
            value={deuterium}
            onChange={(e) => setDeuterium(e.target.value)}
          />
        </label>
        <button type="button" className="btn dev-grant-btn" disabled={busy} onClick={() => void grant()}>
          {busy ? "…" : "Начислить"}
        </button>
        {msg && <span className={msg.includes("Начислено") ? "stub" : "error-msg"}>{msg}</span>}
      </div>
    </details>
  );
}
