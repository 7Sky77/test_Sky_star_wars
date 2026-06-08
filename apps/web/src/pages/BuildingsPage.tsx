import { useMemo, useState } from "react";
import type { BuildingDef, ResearchItemDef } from "@sw/shared";
import { buildingRequirementsMet } from "@sw/shared";
import { apiFetch } from "../api.js";
import { BuildingDetailModal } from "../components/BuildingDetailModal.js";
import { useGame } from "../gameContext.js";

export function BuildingsPage() {
  const { catalog, state, refresh } = useGame();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [reqStack, setReqStack] = useState<string[]>([]);

  const buildingById = useMemo(() => {
    const m = new Map<string, BuildingDef>();
    for (const b of catalog?.buildings ?? []) m.set(b.id, b);
    return m;
  }, [catalog?.buildings]);

  const researchById = useMemo(() => {
    const m = new Map<string, ResearchItemDef>();
    for (const r of catalog?.research ?? []) m.set(r.id, r);
    return m;
  }, [catalog?.research]);

  const buildingLevels = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of state?.buildings ?? []) m.set(b.building_id, b.level);
    return m;
  }, [state?.buildings]);

  const researchLevels = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of state?.research ?? []) m.set(r.research_id, r.level);
    return m;
  }, [state?.research]);

  const queue = state?.buildQueue ?? [];
  const maxSlots = catalog?.world?.buildQueueSlots ?? 3;
  const queuedIds = useMemo(
    () => new Set(queue.map((q) => q.building_id)),
    [queue]
  );
  const buildingName = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of catalog?.buildings ?? []) m.set(b.id, b.name);
    return (id: string) => m.get(id) ?? id;
  }, [catalog?.buildings]);

  const modalItem = modalId ? buildingById.get(modalId) : null;
  const queueFull = queue.length >= maxSlots;

  function openBuilding(id: string) {
    setModalId(id);
    setReqStack([]);
  }

  function openRequirement(id: string, kind?: "building" | "research") {
    if (kind === "research") return;
    if (!buildingById.has(id)) return;
    if (modalId) setReqStack((s) => [...s, modalId]);
    setModalId(id);
  }

  function closeModal() {
    setModalId(null);
    setReqStack([]);
  }

  function backModal() {
    const prev = reqStack[reqStack.length - 1];
    if (!prev) {
      closeModal();
      return;
    }
    setReqStack((s) => s.slice(0, -1));
    setModalId(prev);
  }

  async function build(id: string) {
    setMsg(null);
    setBusy(id);
    try {
      await apiFetch("/api/game/build", { method: "POST", json: { buildingId: id } });
      await refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      const map: Record<string, string> = {
        queue_full: `Все ${maxSlots} слота заняты`,
        building_in_queue: "Эта постройка уже улучшается",
        requirements_not_met: "Не выполнены требования",
        max_level: "Максимальный уровень",
        not_enough_metal: "Недостаточно металла",
        not_enough_minerals: "Недостаточно минералов",
        not_enough_vespene: "Недостаточно веспена",
      };
      setMsg(map[code] ?? code);
      throw e;
    } finally {
      setBusy(null);
    }
  }

  const now = state?.serverTime ?? Date.now();
  const slotsFree = maxSlots - queue.length;

  return (
    <div>
      <h1 className="page-title">Постройки</h1>
      <p className="page-lead">
        Одновременно можно вести до <strong>{maxSlots}</strong> улучшений (
        {slotsFree > 0 ? `свободно: ${slotsFree}` : "все слоты заняты"}). Нажмите на карточку
        для подробностей и требований.
      </p>
      {msg && <div className="error-msg">{msg}</div>}
      <div className="build-grid">
        {(catalog?.buildings ?? []).map((b) => {
          const lv = buildingLevels.get(b.id) ?? 0;
          const inQueue = queuedIds.has(b.id);
          const reqsMet = buildingRequirementsMet(b, buildingLevels, researchLevels);
          const canBuild =
            busy === null &&
            lv < b.maxLevel &&
            !inQueue &&
            !queueFull &&
            reqsMet;
          return (
            <button
              type="button"
              key={b.id}
              className={`build-card build-card-btn${canBuild ? " build-card-ready" : ""}`}
              onClick={() => openBuilding(b.id)}
            >
              <h3>{b.name}</h3>
              <div className="lv">
                Уровень {lv} / {b.maxLevel}
              </div>
              {inQueue && <div className="lv muted">В очереди…</div>}
              {!reqsMet && lv < b.maxLevel && (
                <div className="lv muted">Требования не выполнены</div>
              )}
            </button>
          );
        })}
      </div>
      {queue.length > 0 && (
        <div className="queue">
          <strong>Очередь ({queue.length}/{maxSlots})</strong>
          <ul className="overview-list" style={{ marginTop: "0.5rem" }}>
            {queue.map((q) => (
              <li key={q.id}>
                {buildingName(q.building_id)} → уровень {q.target_level}
                {" · "}
                готово через {Math.max(0, Math.ceil((q.finishes_at - now) / 1000))} с
              </li>
            ))}
          </ul>
        </div>
      )}

      {modalItem && (
        <BuildingDetailModal
          item={modalItem}
          level={buildingLevels.get(modalItem.id) ?? 0}
          buildingLevels={buildingLevels}
          researchLevels={researchLevels}
          buildingById={buildingById}
          researchById={researchById}
          inQueue={queuedIds.has(modalItem.id)}
          queueFull={queueFull}
          busy={busy === modalItem.id}
          onClose={closeModal}
          onBack={reqStack.length > 0 ? backModal : undefined}
          onUpgrade={build}
          onOpenRequirement={openRequirement}
        />
      )}
    </div>
  );
}
