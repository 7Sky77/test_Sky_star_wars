import { useState } from "react";
import { orbitLabel } from "@sw/shared";
import { CoordsDisplay } from "./CoordsDisplay.js";
import type { BattleReportState } from "../types.js";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("ru-RU");
}

const WINNER_RU: Record<string, string> = {
  attacker: "Победа",
  defender: "Поражение",
  draw: "Ничья",
};

function stacksLine(
  stacks: { name: string; quantity: number }[]
): string {
  if (stacks.length === 0) return "—";
  return stacks.map((s) => `${s.name} ×${fmt(s.quantity)}`).join(", ");
}

export function BattleReportsList({ reports }: { reports: BattleReportState[] }) {
  const [openId, setOpenId] = useState<number | null>(reports[0]?.id ?? null);

  if (reports.length === 0) return null;

  return (
    <section className="battle-reports-list">
      <h2 className="section-title">Боевые отчёты</h2>
      <div className="battle-reports-grid">
        {reports.map((r) => {
          const open = openId === r.id;
          const winnerClass =
            r.winner === "attacker"
              ? "win"
              : r.winner === "defender"
                ? "loss"
                : "draw";
          return (
            <article className={`battle-report-card ${winnerClass}`} key={r.id}>
              <button
                type="button"
                className="battle-report-head"
                onClick={() => setOpenId(open ? null : r.id)}
              >
                <span>
                  <strong>{WINNER_RU[r.winner] ?? r.winner}</strong> vs{" "}
                  {r.defenderName}
                </span>
                <span className="battle-report-coords">
                  <CoordsDisplay
                    arm={r.location.arm}
                    system={r.location.system}
                    position={r.location.position}
                    className="coords-inline"
                  />{" "}
                  · {orbitLabel(r.location.orbit)}
                </span>
              </button>
              {open && (
                <div className="battle-report-body">
                  <p>
                    <strong>Атакующий (старт):</strong> {stacksLine(r.attackerStart)}
                  </p>
                  <p>
                    <strong>Противник (старт):</strong> {stacksLine(r.defenderStart)}
                  </p>
                  <p>
                    <strong>Выжили:</strong> {stacksLine(r.attackerSurvivors)}
                  </p>
                  <p>
                    <strong>Противник остался:</strong>{" "}
                    {stacksLine(r.defenderSurvivors)}
                  </p>
                  <table className="battle-rounds-table">
                    <thead>
                      <tr>
                        <th>Раунд</th>
                        <th>Атак.</th>
                        <th>Защ.</th>
                        <th>Залпы →</th>
                        <th>Выстр. →</th>
                        <th>Урон →</th>
                        <th>Залпы ←</th>
                        <th>Выстр. ←</th>
                        <th>Урон ←</th>
                        <th>Потери</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.rounds.map((round) => (
                        <tr key={round.round}>
                          <td>{round.round}</td>
                          <td>{round.attackerShips}</td>
                          <td>{round.defenderShips}</td>
                          <td>{round.attackerVolleys ?? "—"}</td>
                          <td>{round.attackerShots ?? "—"}</td>
                          <td>{fmt(round.attackerDamage)}</td>
                          <td>{round.defenderVolleys ?? "—"}</td>
                          <td>{round.defenderShots ?? "—"}</td>
                          <td>{fmt(round.defenderDamage)}</td>
                          <td>
                            −{round.attackerDestroyed} / −{round.defenderDestroyed}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
