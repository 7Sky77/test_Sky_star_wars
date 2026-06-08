import { useMemo, useState } from "react";
import type { BuildingDef, ResearchItemDef } from "@sw/shared";
import {
  buildingRequirementsMet,
  costGrowthKu,
  upgradeCostForLevel,
  upgradeTimeSecondsForLevel,
} from "@sw/shared";
import { buildingIcon } from "../buildingVisuals.js";
import { researchIcon } from "../researchVisuals.js";
import { RequirementLinks } from "./RequirementLinks.js";

const RESOURCE_STYLE: Record<string, { color: string; label: string }> = {
  metal: { color: "#9ca3af", label: "Металл" },
  minerals: { color: "#60a5fa", label: "Минералы" },
  vespene: { color: "#4ade80", label: "Веспен" },
};

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

export function BuildingDetailModal({
  item,
  level,
  buildingLevels,
  researchLevels,
  buildingById,
  researchById,
  inQueue,
  queueFull,
  busy,
  onClose,
  onBack,
  onUpgrade,
  onOpenRequirement,
}: {
  item: BuildingDef;
  level: number;
  buildingLevels: Map<string, number>;
  researchLevels: Map<string, number>;
  buildingById: Map<string, BuildingDef>;
  researchById: Map<string, ResearchItemDef>;
  inQueue: boolean;
  queueFull: boolean;
  busy: boolean;
  onClose: () => void;
  onBack?: () => void;
  onUpgrade: (id: string) => Promise<void>;
  onOpenRequirement?: (id: string, kind?: "building" | "research") => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const icon = buildingIcon(item.id);
  const ku = costGrowthKu(item);
  const atMax = level >= item.maxLevel;
  const nextCost = useMemo(() => upgradeCostForLevel(item, level), [item, level]);
  const buildSeconds = useMemo(
    () => upgradeTimeSecondsForLevel(item, level),
    [item, level]
  );
  const reqsMet = buildingRequirementsMet(item, buildingLevels, researchLevels);

  const canUpgrade =
    !busy && !atMax && !inQueue && !queueFull && reqsMet;

  let blockReason = "";
  if (atMax) blockReason = "Максимальный уровень";
  else if (inQueue) blockReason = "Уже в очереди";
  else if (queueFull) blockReason = "Все слоты очереди заняты";
  else if (!reqsMet) blockReason = "Не выполнены требования";

  async function upgrade() {
    if (!canUpgrade) return;
    setMsg(null);
    try {
      await onUpgrade(item.id);
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      const map: Record<string, string> = {
        queue_full: "Все слоты очереди заняты",
        building_in_queue: "Уже в очереди",
        requirements_not_met: "Не выполнены требования",
        max_level: "Максимальный уровень",
        not_enough_metal: "Недостаточно металла",
        not_enough_minerals: "Недостаточно минералов",
        not_enough_vespene: "Недостаточно веспена",
      };
      setMsg(map[code] ?? code);
    }
  }

  function resolveName(id: string, label?: string, kind?: "building" | "research") {
    if (label) return label;
    if (kind === "research") return researchById.get(id)?.name ?? id;
    return buildingById.get(id)?.name ?? id;
  }

  function resolveIcon(id: string, kind?: "building" | "research") {
    return kind === "research" ? researchIcon(id) : buildingIcon(id);
  }

  return (
    <div className="research-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="research-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="building-modal-title"
      >
        <div className="research-modal-chrome">
          {onBack ? (
            <button type="button" className="research-modal-back" onClick={onBack} aria-label="Назад">
              ←
            </button>
          ) : (
            <span />
          )}
          <div className="research-modal-title-wrap">
            <h2 id="building-modal-title">{item.name}</h2>
            <div className="research-modal-level">
              Уровень: {level} / {item.maxLevel}
            </div>
          </div>
          <button type="button" className="research-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="research-modal-body">
          <div className="research-modal-desc-layout">
            <div className="research-modal-aside">
              <div className="research-modal-art" style={{ background: icon.bg }} aria-hidden>
                {icon.glyph}
              </div>
              <div className="research-modal-costs">
                <div className="research-modal-costs-title">
                  {atMax ? "Максимальный уровень" : `Стоимость ур. ${level + 1}:`}
                </div>
                {!atMax && (
                  <ul className="research-cost-list">
                    {Object.entries(nextCost).map(([resourceId, amount]) => {
                      const meta = RESOURCE_STYLE[resourceId] ?? {
                        color: "#ccc",
                        label: resourceId,
                      };
                      return (
                        <li key={resourceId}>
                          <span className="research-cost-dot" style={{ background: meta.color }} />
                          <span className="research-cost-val" style={{ color: meta.color }}>
                            {fmt(amount)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="research-modal-ku">КУ {ku}</div>
                {!atMax && (
                  <div className="muted small" style={{ marginTop: "0.5rem" }}>
                    Время: {fmt(buildSeconds)} с
                  </div>
                )}
              </div>
            </div>
            <div className="research-modal-text">
              {item.description ? <p>{item.description}</p> : <p className="stub">Нет описания.</p>}
            </div>
          </div>

          <div className="research-modal-actions">
            <button
              type="button"
              className={`btn${canUpgrade ? " btn-study-ready" : ""}`}
              disabled={!canUpgrade}
              onClick={() => void upgrade()}
            >
              {busy ? "…" : inQueue ? "В очереди…" : atMax ? "Макс. уровень" : `Улучшить → ур. ${level + 1}`}
            </button>
            {blockReason && !canUpgrade && !busy && (
              <p className="muted small research-action-hint">{blockReason}</p>
            )}
            {msg && <p className="error-msg research-action-hint">{msg}</p>}
          </div>

          {item.requirements && item.requirements.length > 0 && (
            <RequirementLinks
              title="Требования для постройки"
              requirements={item.requirements}
              levels={buildingLevels}
              researchLevels={researchLevels}
              resolveName={(id, label) => {
                const req = item.requirements?.find((r) => r.id === id);
                return resolveName(id, label, req?.kind);
              }}
              resolveIcon={(id) => {
                const req = item.requirements?.find((r) => r.id === id);
                return resolveIcon(id, req?.kind);
              }}
              canOpen={(id, kind) =>
                kind === "research" ? researchById.has(id) : buildingById.has(id)
              }
              onOpen={(id, kind) => onOpenRequirement?.(id, kind)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
