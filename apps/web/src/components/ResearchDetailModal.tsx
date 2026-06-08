import { useMemo, useState, type ReactNode } from "react";
import type { ResearchItemDef } from "@sw/shared";
import { costGrowthKu, researchCostForLevel, researchRequirementsMet } from "@sw/shared";
import { RequirementLinks } from "./RequirementLinks.js";
import { researchIcon } from "../researchVisuals.js";

type Tab = "tree" | "description" | "handbook";

const RESOURCE_STYLE: Record<string, { color: string; label: string }> = {
  metal: { color: "#9ca3af", label: "Металл" },
  minerals: { color: "#60a5fa", label: "Минералы" },
  vespene: { color: "#4ade80", label: "Веспен" },
  energy: { color: "#fbbf24", label: "Энергия" },
};

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

export function ResearchDetailModal({
  item,
  level,
  researchLevels,
  researchById,
  labLevel,
  researchBusyId,
  onClose,
  onBack,
  onStudy,
  onOpenRequirement,
  treeSlot,
}: {
  item: ResearchItemDef;
  level: number;
  researchLevels: Map<string, number>;
  researchById: Map<string, ResearchItemDef>;
  labLevel: number;
  researchBusyId: string | null;
  onClose: () => void;
  onBack?: () => void;
  onStudy: (id: string) => Promise<void>;
  onOpenRequirement?: (id: string) => void;
  treeSlot?: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("description");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const icon = researchIcon(item.id);
  const ku = costGrowthKu(item);
  const maxLevel = item.maxLevel ?? 20;
  const nextCost = useMemo(() => researchCostForLevel(item, level), [item, level]);
  const reqsMet = researchRequirementsMet(item, researchLevels);
  const hasEnergyCost = (nextCost.energy ?? 0) > 0;
  const inQueue = researchBusyId === item.id;
  const otherBusy = researchBusyId != null && researchBusyId !== item.id;
  const atMax = level >= maxLevel;

  const canStudy =
    !busy &&
    !atMax &&
    !otherBusy &&
    !inQueue &&
    labLevel >= 1 &&
    reqsMet &&
    !hasEnergyCost;

  let blockReason = "";
  if (atMax) blockReason = "Максимальный уровень";
  else if (otherBusy) blockReason = "Уже идёт другое исследование";
  else if (inQueue) blockReason = "Уже в очереди";
  else if (labLevel < 1) blockReason = "Нужна исследовательская лаборатория (1+)";
  else if (!reqsMet) blockReason = "Не выполнены требования";
  else if (hasEnergyCost) blockReason = "Стоимость в энергии пока не поддерживается";

  async function study() {
    if (!canStudy) return;
    setMsg(null);
    setBusy(true);
    try {
      await onStudy(item.id);
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      const map: Record<string, string> = {
        research_busy: "Уже идёт исследование",
        no_research_lab: "Постройте исследовательскую лабораторию",
        requirements_not_met: "Не выполнены требования",
        max_level: "Максимальный уровень",
        not_enough_metal: "Недостаточно металла",
        not_enough_minerals: "Недостаточно минералов",
        not_enough_vespene: "Недостаточно веспена",
        unsupported_cost: "Такая стоимость пока не поддерживается",
      };
      setMsg(map[code] ?? code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="research-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="research-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="research-modal-title"
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
            <h2 id="research-modal-title">{item.name}</h2>
            <div className="research-modal-level">Уровень: {level}</div>
          </div>
          <button type="button" className="research-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="research-modal-tabs">
          {(
            [
              ["tree", "Дерево эволюции"],
              ["description", "Описание"],
              ["handbook", "Справочник"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="research-modal-body">
          {tab === "tree" && (
            <div className="research-modal-tree">{treeSlot ?? <p className="stub">Дерево технологий.</p>}</div>
          )}

          {tab === "description" && (
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
                </div>
              </div>
              <div className="research-modal-text">
                {item.description ? <p>{item.description}</p> : <p className="stub">Нет описания.</p>}
              </div>
            </div>
          )}

          {tab === "handbook" && (
            <div className="research-modal-handbook">
              <p>
                <strong>ID:</strong> <code>{item.id}</code>
              </p>
              <p>
                <strong>Максимальный уровень:</strong> {maxLevel}
              </p>
              <p>
                <strong>КУ:</strong> {ku}
              </p>
              <p>
                <strong>Лаборатория на планете:</strong> {labLevel}
              </p>
              {item.levelTable && (
                <table className="data-table research-level-table">
                  <thead>
                    <tr>
                      <th>Уровень</th>
                      <th>{item.levelTable.valueLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.levelTable.rows.map((row) => (
                      <tr key={row.levels}>
                        <td>{row.levels}</td>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {tab === "description" && (
          <div className="research-modal-actions">
            <button
              type="button"
              className={`btn${canStudy ? " btn-study-ready" : ""}`}
              disabled={!canStudy}
              onClick={() => void study()}
            >
              {busy ? "…" : inQueue ? "В очереди…" : atMax ? "Макс. уровень" : `Изучить → ур. ${level + 1}`}
            </button>
            {blockReason && !canStudy && !busy && (
              <p className="muted small research-action-hint">{blockReason}</p>
            )}
            {msg && <p className="error-msg research-action-hint">{msg}</p>}
          </div>
        )}

        {tab === "description" && item.requirements && item.requirements.length > 0 && (
          <RequirementLinks
            title="Требования для изучения"
            requirements={item.requirements}
            levels={researchLevels}
            resolveName={(id, label) => label ?? researchById.get(id)?.name ?? id}
            resolveIcon={(id) => researchIcon(id)}
            canOpen={(id) => researchById.has(id)}
            onOpen={(id) => onOpenRequirement?.(id)}
          />
        )}

        {tab === "description" && item.levelTable && (
          <div className="research-modal-info">
            <div className="research-modal-info-bar">Информация</div>
            <table className="data-table research-level-table">
              <thead>
                <tr>
                  <th>Уровень</th>
                  <th>{item.levelTable.valueLabel}</th>
                </tr>
              </thead>
              <tbody>
                {item.levelTable.rows.map((row) => {
                  const highlight =
                    level > 0 &&
                    row.levels.includes(String(level)) &&
                    !row.levels.includes("—");
                  return (
                    <tr key={row.levels} className={highlight ? "current-level" : undefined}>
                      <td>{row.levels}</td>
                      <td>{row.value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
