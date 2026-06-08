import { useMemo, useState } from "react";
import type { ResearchItemDef } from "@sw/shared";
import { apiFetch } from "../api.js";
import { useGame } from "../gameContext.js";
import { ResearchDetailModal } from "../components/ResearchDetailModal.js";
import { TERRAN_RESEARCH_FLAT } from "../researchLayout.js";
import { researchIcon } from "../researchVisuals.js";

export function ResearchPage() {
  const { catalog, state, refresh } = useGame();
  const [modalId, setModalId] = useState<string | null>(null);

  const faction = catalog?.factions?.find((f) => f.id === state?.user.factionId);
  const factionLabel = faction?.displayName ?? "Люди";

  const byId = useMemo(() => {
    const m = new Map<string, ResearchItemDef>();
    for (const r of catalog?.research ?? []) m.set(r.id, r);
    return m;
  }, [catalog?.research]);

  const researchLevels = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of state?.research ?? []) m.set(r.research_id, r.level);
    return m;
  }, [state?.research]);

  const labLevel = useMemo(() => {
    const row = state?.buildings?.find((b) => b.building_id === "research_lab");
    return row?.level ?? 0;
  }, [state?.buildings]);

  const researchQueue = state?.researchQueue ?? null;
  const now = state?.serverTime ?? Date.now();

  const items = useMemo(() => {
    const list: ResearchItemDef[] = [];
    for (const id of TERRAN_RESEARCH_FLAT) {
      const r = byId.get(id);
      if (r) list.push(r);
    }
    for (const r of catalog?.research ?? []) {
      if (!TERRAN_RESEARCH_FLAT.includes(r.id)) list.push(r);
    }
    return list;
  }, [byId, catalog?.research]);

  const modalItem = modalId ? byId.get(modalId) : null;

  const queueName = researchQueue
    ? byId.get(researchQueue.research_id)?.name ?? researchQueue.research_id
    : null;

  async function study(researchId: string) {
    await apiFetch("/api/game/research", { method: "POST", json: { researchId } });
    await refresh();
  }

  return (
    <div>
      <h1 className="page-title">Исследования</h1>

      {researchQueue && (
        <div className="queue" style={{ marginBottom: "1rem" }}>
          Идёт исследование: <strong>{queueName}</strong> → уровень {researchQueue.target_level}
          <br />
          Готово через: {Math.max(0, Math.ceil((researchQueue.finishes_at - now) / 1000))} с
        </div>
      )}

      {labLevel < 1 && (
        <p className="page-lead">
          Для исследований нужна <strong>исследовательская лаборатория</strong> на планете (раздел
          «Постройки»).
        </p>
      )}

      <div className="research-panel">
        <div className="research-panel-head">
          <span className="research-faction-icon" aria-hidden />
          <span className="research-faction-name">{factionLabel}</span>
        </div>

        <div className="research-grid">
          {items.map((r) => {
            const icon = researchIcon(r.id);
            const lv = researchLevels.get(r.id) ?? 0;
            const queued = researchQueue?.research_id === r.id;
            return (
              <button
                key={r.id}
                type="button"
                className={`research-item${modalId === r.id ? " active" : ""}${queued ? " queued" : ""}`}
                onClick={() => setModalId(r.id)}
                title={r.name}
              >
                <span
                  className="research-item-icon"
                  style={{ background: icon.bg }}
                  aria-hidden
                >
                  {icon.glyph}
                </span>
                <span className="research-item-name">
                  {r.name}
                  {lv > 0 ? <span className="research-item-lv"> {lv}</span> : null}
                  {queued ? <span className="research-item-lv"> …</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {modalItem && (
        <ResearchDetailModal
          key={modalItem.id}
          item={modalItem}
          level={researchLevels.get(modalItem.id) ?? 0}
          researchLevels={researchLevels}
          researchById={byId}
          labLevel={labLevel}
          researchBusyId={researchQueue?.research_id ?? null}
          onClose={() => setModalId(null)}
          onStudy={study}
          onOpenRequirement={(id) => setModalId(id)}
          treeSlot={
            <div className="research-grid research-grid-mini">
              {items.map((r) => {
                const icon = researchIcon(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`research-item${modalItem.id === r.id ? " active" : ""}`}
                    onClick={() => setModalId(r.id)}
                  >
                    <span className="research-item-icon" style={{ background: icon.bg }}>
                      {icon.glyph}
                    </span>
                    <span className="research-item-name">{r.name}</span>
                  </button>
                );
              })}
            </div>
          }
        />
      )}
    </div>
  );
}
