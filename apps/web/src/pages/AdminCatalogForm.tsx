import { useEffect, useState } from "react";

type CatalogSection =
  | "buildings"
  | "units"
  | "defense"
  | "research"
  | "planetTypes";

export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  maxLevel?: number;
  /** КУ — коэффициент удорожания (общий для всех ресурсов). */
  costGrowth?: number;
  costs?: { resourceId: string; base: number; growth?: number }[];
  upgradeTimeSeconds?: { base: number; growth: number };
  buildTimeSeconds?: number;
  energyPerUnit?: number;
  produces?: Record<string, unknown>;
  energyProduction?: Record<string, number>;
  energyConsumption?: Record<string, number>;
  storageBonusAll?: { base: number; perLevel: number };
  stats?: Record<string, unknown>;
  bonuses?: Record<string, number>;
  [key: string]: unknown;
}

interface CostRow {
  resourceId: string;
  base: string;
}

function costGrowthFromItem(item: CatalogItem): string {
  if (item.costGrowth != null) return String(item.costGrowth);
  const fromCost = item.costs?.find((c) => c.growth != null)?.growth;
  return fromCost != null ? String(fromCost) : "1";
}

function nstr(v: unknown): string {
  return v != null && v !== "" ? String(v) : "";
}

function npart(obj: Record<string, number> | undefined, key: string): string {
  return obj && obj[key] != null ? String(obj[key]) : "";
}

function NumInput({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <label className="admin-num-field">
      <span>{label}</span>
      <input
        type="number"
        step={step ?? "any"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="admin-form-section">{children}</h3>;
}

function buildPatch(
  section: CatalogSection,
  original: CatalogItem,
  fields: {
    name: string;
    description: string;
    maxLevel: string;
    costGrowth: string;
    costs: CostRow[];
    upgradeBase: string;
    upgradeGrowth: string;
    buildTime: string;
    energyPerUnit: string;
    prodResourceId: string;
    prodCoef: string;
    prodGrowth: string;
    prodPower: string;
    enProdCoef: string;
    enProdGrowth: string;
    enConsCoef: string;
    enConsGrowth: string;
    storeBase: string;
    storePerLevel: string;
    statArmor: string;
    statShield: string;
    statSpeed: string;
    statCapacity: string;
    statFuel: string;
    statAttack: string;
    statSize: string;
    statArmorType: string;
    bonusMetal: string;
    bonusMinerals: string;
    bonusVespene: string;
  }
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    name: fields.name.trim(),
    description: fields.description.trim() || undefined,
  };

  if (fields.maxLevel !== "" && (section === "buildings" || section === "research")) {
    patch.maxLevel = Number(fields.maxLevel);
  }

  const costs = fields.costs
    .filter((c) => c.resourceId.trim())
    .map((c) => ({
      resourceId: c.resourceId.trim(),
      base: Number(c.base) || 0,
    }));
  if (costs.length > 0) patch.costs = costs;

  if (section === "buildings" || section === "research") {
    if (fields.costGrowth !== "") {
      patch.costGrowth = Number(fields.costGrowth) || 1;
    }
  }

  if (section === "buildings") {
    if (fields.upgradeBase !== "" || fields.upgradeGrowth !== "") {
      patch.upgradeTimeSeconds = {
        base: Number(fields.upgradeBase) || original.upgradeTimeSeconds?.base || 1,
        growth: Number(fields.upgradeGrowth) || original.upgradeTimeSeconds?.growth || 1,
      };
    }
    const produces: Record<string, unknown> = { ...(original.produces as object) };
    if (fields.prodResourceId) produces.resourceId = fields.prodResourceId;
    if (fields.prodCoef !== "") produces.amountCoef = Number(fields.prodCoef);
    if (fields.prodGrowth !== "") produces.amountGrowth = Number(fields.prodGrowth);
    if (fields.prodPower !== "") produces.amountPower = Number(fields.prodPower);
    if (Object.keys(produces).length > 0) patch.produces = produces;

    const ep: Record<string, number> = { ...original.energyProduction };
    if (fields.enProdCoef !== "") ep.coef = Number(fields.enProdCoef);
    if (fields.enProdGrowth !== "") ep.growth = Number(fields.enProdGrowth);
    if (Object.keys(ep).length > 0) patch.energyProduction = ep;

    const ec: Record<string, number> = { ...original.energyConsumption };
    if (fields.enConsCoef !== "") ec.coef = Number(fields.enConsCoef);
    if (fields.enConsGrowth !== "") ec.growth = Number(fields.enConsGrowth);
    if (Object.keys(ec).length > 0) patch.energyConsumption = ec;

    if (fields.storeBase !== "" || fields.storePerLevel !== "") {
      patch.storageBonusAll = {
        base: Number(fields.storeBase) || 0,
        perLevel: Number(fields.storePerLevel) || 0,
      };
    }
  }

  if (section === "units" || section === "defense") {
    if (fields.buildTime !== "") patch.buildTimeSeconds = Number(fields.buildTime);
    if (fields.energyPerUnit !== "") patch.energyPerUnit = Number(fields.energyPerUnit);

    const stats: Record<string, unknown> = { ...original.stats };
    const setStat = (key: string, val: string, isNum = true) => {
      if (val === "") return;
      stats[key] = isNum ? Number(val) : val;
    };
    setStat("armor", fields.statArmor);
    setStat("shield", fields.statShield);
    setStat("speed", fields.statSpeed);
    setStat("capacity", fields.statCapacity);
    setStat("fuel", fields.statFuel);
    setStat("attack", fields.statAttack);
    setStat("size", fields.statSize, false);
    setStat("armorType", fields.statArmorType, false);
    if (Object.keys(stats).length > 0) patch.stats = stats;
  }

  if (section === "planetTypes") {
    const bonuses: Record<string, number> = { ...original.bonuses };
    const pct = (s: string) => {
      if (s === "") return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? n / 100 : undefined;
    };
    const m = pct(fields.bonusMetal);
    const mi = pct(fields.bonusMinerals);
    const v = pct(fields.bonusVespene);
    if (m != null) bonuses.metalProductionPct = m;
    if (mi != null) bonuses.mineralsProductionPct = mi;
    if (v != null) bonuses.vespeneProductionPct = v;
    if (Object.keys(bonuses).length > 0) patch.bonuses = bonuses;
  }

  return patch;
}

export function AdminCatalogForm({
  section,
  item,
  saving,
  onSave,
}: {
  section: CatalogSection;
  item: CatalogItem;
  saving: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [costGrowth, setCostGrowth] = useState("");
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [upgradeBase, setUpgradeBase] = useState("");
  const [upgradeGrowth, setUpgradeGrowth] = useState("");
  const [buildTime, setBuildTime] = useState("");
  const [energyPerUnit, setEnergyPerUnit] = useState("");
  const [prodResourceId, setProdResourceId] = useState("");
  const [prodCoef, setProdCoef] = useState("");
  const [prodGrowth, setProdGrowth] = useState("");
  const [prodPower, setProdPower] = useState("");
  const [enProdCoef, setEnProdCoef] = useState("");
  const [enProdGrowth, setEnProdGrowth] = useState("");
  const [enConsCoef, setEnConsCoef] = useState("");
  const [enConsGrowth, setEnConsGrowth] = useState("");
  const [storeBase, setStoreBase] = useState("");
  const [storePerLevel, setStorePerLevel] = useState("");
  const [statArmor, setStatArmor] = useState("");
  const [statShield, setStatShield] = useState("");
  const [statSpeed, setStatSpeed] = useState("");
  const [statCapacity, setStatCapacity] = useState("");
  const [statFuel, setStatFuel] = useState("");
  const [statAttack, setStatAttack] = useState("");
  const [statSize, setStatSize] = useState("");
  const [statArmorType, setStatArmorType] = useState("");
  const [bonusMetal, setBonusMetal] = useState("");
  const [bonusMinerals, setBonusMinerals] = useState("");
  const [bonusVespene, setBonusVespene] = useState("");

  useEffect(() => {
    setName(item.name ?? "");
    setDescription(item.description ?? "");
    setMaxLevel(nstr(item.maxLevel));
    setCostGrowth(costGrowthFromItem(item));
    setCosts(
      (item.costs ?? []).map((c) => ({
        resourceId: c.resourceId,
        base: nstr(c.base),
      }))
    );
    setUpgradeBase(nstr(item.upgradeTimeSeconds?.base));
    setUpgradeGrowth(nstr(item.upgradeTimeSeconds?.growth));
    setBuildTime(nstr(item.buildTimeSeconds));
    setEnergyPerUnit(nstr(item.energyPerUnit));
    const p = item.produces ?? {};
    setProdResourceId(nstr(p.resourceId));
    setProdCoef(nstr(p.amountCoef));
    setProdGrowth(nstr(p.amountGrowth));
    setProdPower(nstr(p.amountPower));
    setEnProdCoef(npart(item.energyProduction, "coef"));
    setEnProdGrowth(npart(item.energyProduction, "growth"));
    setEnConsCoef(npart(item.energyConsumption, "coef"));
    setEnConsGrowth(npart(item.energyConsumption, "growth"));
    setStoreBase(nstr(item.storageBonusAll?.base));
    setStorePerLevel(nstr(item.storageBonusAll?.perLevel));
    const s = item.stats ?? {};
    setStatArmor(nstr(s.armor));
    setStatShield(nstr(s.shield));
    setStatSpeed(nstr(s.speed));
    setStatCapacity(nstr(s.capacity));
    setStatFuel(nstr(s.fuel));
    setStatAttack(nstr(s.attack));
    setStatSize(nstr(s.size));
    setStatArmorType(nstr(s.armorType));
    const b = item.bonuses ?? {};
    setBonusMetal(b.metalProductionPct != null ? String(b.metalProductionPct * 100) : "");
    setBonusMinerals(
      b.mineralsProductionPct != null ? String(b.mineralsProductionPct * 100) : ""
    );
    setBonusVespene(
      b.vespeneProductionPct != null ? String(b.vespeneProductionPct * 100) : ""
    );
  }, [item]);

  function updateCost(i: number, key: keyof CostRow, val: string) {
    setCosts((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r))
    );
  }

  async function submit() {
    const patch = buildPatch(section, item, {
      name,
      description,
      maxLevel,
      costGrowth,
      costs,
      upgradeBase,
      upgradeGrowth,
      buildTime,
      energyPerUnit,
      prodResourceId,
      prodCoef,
      prodGrowth,
      prodPower,
      enProdCoef,
      enProdGrowth,
      enConsCoef,
      enConsGrowth,
      storeBase,
      storePerLevel,
      statArmor,
      statShield,
      statSpeed,
      statCapacity,
      statFuel,
      statAttack,
      statSize,
      statArmorType,
      bonusMetal,
      bonusMinerals,
      bonusVespene,
    });
    await onSave(patch);
  }

  return (
    <>
      <h2>
        <code>{item.id}</code>
      </h2>

      <div className="field">
        <label htmlFor="adm-name">Название</label>
        <input id="adm-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="adm-desc">Описание</label>
        <textarea
          id="adm-desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {(section === "buildings" || section === "research") && (
        <div className="admin-num-grid single">
          <NumInput label="Макс. уровень" value={maxLevel} onChange={setMaxLevel} step="1" />
        </div>
      )}

      <SectionTitle>Стоимость (1-й уровень)</SectionTitle>
      {(section === "buildings" || section === "research") && (
        <div className="admin-num-grid single" style={{ marginBottom: "0.75rem" }}>
          <NumInput
            label="КУ (коэфф. удорожания)"
            value={costGrowth}
            onChange={setCostGrowth}
            step="0.01"
          />
        </div>
      )}
      <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
        {section === "buildings" || section === "research"
          ? "КУ один на все ресурсы: стоимость уровня N = база × КУ^(N−1)."
          : "Фиксированная цена за единицу (уровней нет)."}
      </p>
      <table className="data-table admin-cost-table">
        <thead>
          <tr>
            <th>Ресурс</th>
            <th className="num">База</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {costs.map((row, i) => (
            <tr key={i}>
              <td>
                <select
                  value={row.resourceId}
                  onChange={(e) => updateCost(i, "resourceId", e.target.value)}
                >
                  <option value="">—</option>
                  <option value="metal">metal</option>
                  <option value="minerals">minerals</option>
                  <option value="vespene">vespene</option>
                  <option value="energy">energy</option>
                </select>
              </td>
              <td>
                <input
                  className="admin-inline-num"
                  type="number"
                  min={0}
                  value={row.base}
                  onChange={(e) => updateCost(i, "base", e.target.value)}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCosts((r) => r.filter((_, idx) => idx !== i))}
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
        onClick={() => setCosts((r) => [...r, { resourceId: "metal", base: "0" }])}
      >
        + Ресурс
      </button>

      {section === "buildings" && (
        <>
          <SectionTitle>Время улучшения (сек)</SectionTitle>
          <div className="admin-num-grid">
            <NumInput label="База" value={upgradeBase} onChange={setUpgradeBase} />
            <NumInput label="Рост" value={upgradeGrowth} onChange={setUpgradeGrowth} step="0.01" />
          </div>

          <SectionTitle>Производство</SectionTitle>
          <div className="admin-num-grid">
            <label className="admin-num-field">
              <span>Ресурс</span>
              <select
                value={prodResourceId}
                onChange={(e) => setProdResourceId(e.target.value)}
              >
                <option value="">—</option>
                <option value="metal">metal</option>
                <option value="minerals">minerals</option>
                <option value="vespene">vespene</option>
              </select>
            </label>
            <NumInput label="Коэф." value={prodCoef} onChange={setProdCoef} />
            <NumInput label="Рост" value={prodGrowth} onChange={setProdGrowth} step="0.001" />
            <NumInput label="Степень" value={prodPower} onChange={setProdPower} step="0.1" />
          </div>

          <SectionTitle>Энергия</SectionTitle>
          <div className="admin-num-grid">
            <NumInput label="Выраб. коэф." value={enProdCoef} onChange={setEnProdCoef} />
            <NumInput label="Выраб. рост" value={enProdGrowth} onChange={setEnProdGrowth} step="0.01" />
            <NumInput label="Потреб. коэф." value={enConsCoef} onChange={setEnConsCoef} />
            <NumInput label="Потреб. рост" value={enConsGrowth} onChange={setEnConsGrowth} step="0.01" />
          </div>

          <SectionTitle>Склад (+ко всем)</SectionTitle>
          <div className="admin-num-grid">
            <NumInput label="База" value={storeBase} onChange={setStoreBase} />
            <NumInput label="За уровень" value={storePerLevel} onChange={setStorePerLevel} />
          </div>
        </>
      )}

      {(section === "units" || section === "defense") && (
        <>
          <SectionTitle>Сборка</SectionTitle>
          <div className="admin-num-grid">
            <NumInput
              label="Время (сек)"
              value={buildTime}
              onChange={setBuildTime}
            />
            <NumInput
              label="Энергия/шт."
              value={energyPerUnit}
              onChange={setEnergyPerUnit}
            />
          </div>

          <SectionTitle>Характеристики</SectionTitle>
          <div className="admin-num-grid">
            <NumInput label="Броня" value={statArmor} onChange={setStatArmor} />
            <NumInput label="Щит" value={statShield} onChange={setStatShield} />
            <NumInput label="Скорость" value={statSpeed} onChange={setStatSpeed} />
            <NumInput label="Вместимость" value={statCapacity} onChange={setStatCapacity} />
            <NumInput label="Топливо" value={statFuel} onChange={setStatFuel} />
            <NumInput label="Атака" value={statAttack} onChange={setStatAttack} />
            <label className="admin-num-field">
              <span>Размер</span>
              <input value={statSize} onChange={(e) => setStatSize(e.target.value)} />
            </label>
            <label className="admin-num-field">
              <span>Тип брони</span>
              <input value={statArmorType} onChange={(e) => setStatArmorType(e.target.value)} />
            </label>
          </div>
        </>
      )}

      {section === "planetTypes" && (
        <>
          <SectionTitle>Бонусы добычи (%)</SectionTitle>
          <div className="admin-num-grid">
            <NumInput label="Металл %" value={bonusMetal} onChange={setBonusMetal} step="0.1" />
            <NumInput
              label="Минералы %"
              value={bonusMinerals}
              onChange={setBonusMinerals}
              step="0.1"
            />
            <NumInput
              label="Веспен %"
              value={bonusVespene}
              onChange={setBonusVespene}
              step="0.1"
            />
          </div>
        </>
      )}

      <button
        type="button"
        className="btn btn-active"
        disabled={saving}
        onClick={() => void submit()}
      >
        {saving ? "Сохранение…" : "Сохранить в content/"}
      </button>
    </>
  );
}
