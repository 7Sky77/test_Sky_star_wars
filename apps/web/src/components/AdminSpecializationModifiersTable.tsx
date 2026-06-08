import type { SpecializationModifier } from "@sw/shared";
import {
  ARMOR_TYPE_LABELS_RU,
  parseSpecializationTargetKey,
  SIZE_LABELS_RU,
  specializationTargetKey,
  UNIT_ARMOR_TYPES,
  UNIT_SIZES,
} from "@sw/shared";

export type ModifierRow = {
  targetKey: string;
  multiplier: string;
};

export function modifierToRow(mod: SpecializationModifier): ModifierRow {
  return {
    targetKey: specializationTargetKey(mod.kind, mod.target),
    multiplier: String(mod.multiplier),
  };
}

export function emptyModifierRow(): ModifierRow {
  return { targetKey: specializationTargetKey("size", "small"), multiplier: "1" };
}

export function rowsToModifiers(rows: ModifierRow[]): SpecializationModifier[] {
  return rows
    .map((row) => {
      const parsed = parseSpecializationTargetKey(row.targetKey);
      if (!parsed || row.multiplier === "") return null;
      const multiplier = Number(row.multiplier);
      if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
      return { kind: parsed.kind, target: parsed.target, multiplier };
    })
    .filter((m): m is SpecializationModifier => m != null);
}

export function AdminSpecializationModifiersTable({
  rows,
  onChange,
}: {
  rows: ModifierRow[];
  onChange: (rows: ModifierRow[]) => void;
}) {
  function updateRow(i: number, patch: Partial<ModifierRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <>
      <h3 className="admin-form-section">Специализация</h3>
      <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
        Бонус или штраф урона по размеру или типу брони цели. Можно добавить несколько строк.
      </p>
      <table className="data-table admin-cost-table">
        <thead>
          <tr>
            <th>Цель (размер / броня)</th>
            <th className="num">Множитель урона</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>
                <select
                  value={row.targetKey}
                  onChange={(e) => updateRow(i, { targetKey: e.target.value })}
                >
                  <optgroup label="Размер">
                    {UNIT_SIZES.map((id) => (
                      <option key={`size:${id}`} value={specializationTargetKey("size", id)}>
                        {SIZE_LABELS_RU[id]}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Тип брони">
                    {UNIT_ARMOR_TYPES.map((id) => (
                      <option
                        key={`armorType:${id}`}
                        value={specializationTargetKey("armorType", id)}
                      >
                        {ARMOR_TYPE_LABELS_RU[id]}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </td>
              <td>
                <input
                  className="admin-inline-num"
                  type="number"
                  step="0.1"
                  min={0.01}
                  value={row.multiplier}
                  onChange={(e) => updateRow(i, { multiplier: e.target.value })}
                  title="×1 — без изменений, ×2 — двойной урон"
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                  title="Удалить строку"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="btn"
        style={{ marginBottom: "1rem" }}
        onClick={() => onChange([...rows, emptyModifierRow()])}
      >
        + Модификатор
      </button>
    </>
  );
}
