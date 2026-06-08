import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, Navigate } from "react-router-dom";

import { apiFetch } from "../api.js";

import { useGame } from "../gameContext.js";

import { AdminCatalogForm, type CatalogItem } from "./AdminCatalogForm.js";



type AdminTab = "logs" | "catalog";



type CatalogSection =

  | "buildings"

  | "units"

  | "defense"

  | "research"

  | "planetTypes";



interface LogEntry {

  id: number;

  kind: string;

  userId: number | null;

  username: string | null;

  planetId: number | null;

  message: string;

  details: unknown;

  createdAt: number;

}



const SECTION_LABELS: Record<CatalogSection, string> = {

  buildings: "Постройки",

  units: "Флот",

  defense: "Оборона",

  research: "Исследования",

  planetTypes: "Типы планет",

};



const LOG_KINDS = [

  { value: "", label: "Все события" },

  { value: "auth.login", label: "Вход" },

  { value: "auth.register", label: "Регистрация" },

  { value: "build.queue", label: "Постройки" },

  { value: "fleet.purchase", label: "Флот" },

  { value: "defense.purchase", label: "Оборона" },

  { value: "combat.report", label: "Бои (будущее)" },

  { value: "admin.catalog_edit", label: "Правки каталога" },

  { value: "cheat.grant", label: "Читы ресурсов" },

];



function fmtTime(ts: number) {

  return new Date(ts).toLocaleString("ru-RU");

}



export function AdminPage() {

  const { state, reloadCatalog, refresh } = useGame();

  const [tab, setTab] = useState<AdminTab>("logs");

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [logKind, setLogKind] = useState("");

  const [logErr, setLogErr] = useState<string | null>(null);

  const [section, setSection] = useState<CatalogSection>("buildings");

  const [items, setItems] = useState<CatalogItem[]>([]);

  const [selectedId, setSelectedId] = useState<string>("");

  const [catMsg, setCatMsg] = useState<string | null>(null);

  const [catErr, setCatErr] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);



  const isAdmin = state?.user.isAdmin === true;



  const selected = useMemo(

    () => items.find((i) => i.id === selectedId),

    [items, selectedId]

  );



  const loadLogs = useCallback(async () => {

    setLogErr(null);

    try {

      const q = logKind ? `?kind=${encodeURIComponent(logKind)}&limit=150` : "?limit=150";

      const r = await apiFetch<{ logs: LogEntry[] }>(`/api/admin/logs${q}`);

      setLogs(r.logs);

    } catch {

      setLogErr("Не удалось загрузить логи (нужны права админа)");

    }

  }, [logKind]);



  const loadCatalogSection = useCallback(async (sec: CatalogSection) => {

    setCatErr(null);

    try {

      const r = await apiFetch<{ items: CatalogItem[] }>(

        `/api/admin/catalog/${sec}`

      );

      setItems(r.items);

      if (r.items.length > 0) {

        setSelectedId(r.items[0].id);

      }

    } catch {

      setCatErr("Не удалось загрузить каталог");

    }

  }, []);



  useEffect(() => {

    if (!isAdmin) return;

    void loadLogs();

  }, [isAdmin, loadLogs]);



  useEffect(() => {

    if (!isAdmin || tab !== "catalog") return;

    void loadCatalogSection(section);

  }, [isAdmin, tab, section, loadCatalogSection]);



  async function saveCatalogItem(patch: Record<string, unknown>) {

    if (!selectedId) return;

    setSaving(true);

    setCatMsg(null);

    setCatErr(null);

    try {

      await apiFetch(`/api/admin/catalog/${section}/${selectedId}`, {

        method: "PATCH",

        json: patch,

      });

      setCatMsg(`Сохранено: ${selectedId}`);

      await loadCatalogSection(section);

      await reloadCatalog();

      await refresh();

      await loadLogs();

    } catch (e) {

      const code = e instanceof Error ? e.message : "error";

      setCatErr(

        code === "validation_failed"

          ? "Ошибка валидации — проверьте числа в полях"

          : `Не удалось сохранить (${code})`

      );

    } finally {

      setSaving(false);

    }

  }



  if (!state) {

    return <p className="stub">Загрузка…</p>;

  }



  if (!isAdmin) {

    return <Navigate to="/" replace />;

  }



  return (

    <div className="admin-page">

      <div className="admin-head">

        <h1 className="page-title">Админка</h1>

        <Link to="/" className="btn">

          ← В игру

        </Link>

      </div>



      <p className="page-lead">

        Журнал действий и правка каталога с полями ввода (сохраняется в{" "}

        <code>content/*.json</code>).

      </p>



      <div className="galaxy-view-tabs admin-tabs">

        <button

          type="button"

          className={`btn ${tab === "logs" ? "btn-active" : ""}`}

          onClick={() => setTab("logs")}

        >

          Логи

        </button>

        <button

          type="button"

          className={`btn ${tab === "catalog" ? "btn-active" : ""}`}

          onClick={() => setTab("catalog")}

        >

          Каталог

        </button>

      </div>



      {tab === "logs" && (

        <section className="admin-section">

          <div className="admin-toolbar">

            <label>

              Фильтр{" "}

              <select

                value={logKind}

                onChange={(e) => setLogKind(e.target.value)}

              >

                {LOG_KINDS.map((k) => (

                  <option key={k.value || "all"} value={k.value}>

                    {k.label}

                  </option>

                ))}

              </select>

            </label>

            <button type="button" className="btn" onClick={() => void loadLogs()}>

              Обновить

            </button>

          </div>

          {logErr && <div className="error-msg">{logErr}</div>}

          <div className="admin-log-scroll">

            <table className="data-table admin-log-table">

              <thead>

                <tr>

                  <th>Время</th>

                  <th>Тип</th>

                  <th>Игрок</th>

                  <th>Событие</th>

                </tr>

              </thead>

              <tbody>

                {logs.map((l) => (

                  <tr key={l.id}>

                    <td className="admin-log-time">{fmtTime(l.createdAt)}</td>

                    <td>

                      <code>{l.kind}</code>

                    </td>

                    <td>{l.username ?? "—"}</td>

                    <td>

                      {l.message}

                      {l.details != null ? (

                        <details className="admin-log-details">

                          <summary>детали</summary>

                          <pre>{JSON.stringify(l.details, null, 2)}</pre>

                        </details>

                      ) : null}

                    </td>

                  </tr>

                ))}

                {logs.length === 0 && (

                  <tr>

                    <td colSpan={4} className="stub">

                      Пока нет записей.

                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </section>

      )}



      {tab === "catalog" && (

        <section className="admin-section">

          <div className="admin-catalog-layout">

            <aside className="admin-catalog-side">

              <label>

                Раздел

                <select

                  value={section}

                  onChange={(e) => {

                    setSection(e.target.value as CatalogSection);

                    setSelectedId("");

                  }}

                >

                  {(Object.keys(SECTION_LABELS) as CatalogSection[]).map((s) => (

                    <option key={s} value={s}>

                      {SECTION_LABELS[s]}

                    </option>

                  ))}

                </select>

              </label>

              <ul className="admin-item-list">

                {items.map((it) => (

                  <li key={it.id}>

                    <button

                      type="button"

                      className={`admin-item-btn ${it.id === selectedId ? "active" : ""}`}

                      onClick={() => setSelectedId(it.id)}

                    >

                      <span className="admin-item-id">{it.id}</span>

                      <span className="admin-item-name">{it.name}</span>

                    </button>

                  </li>

                ))}

              </ul>

            </aside>



            <div className="admin-catalog-editor">

              {catErr && <div className="error-msg">{catErr}</div>}

              {catMsg && <p className="stub">{catMsg}</p>}

              {selected ? (
                <AdminCatalogForm
                  key={`${section}:${selected.id}`}
                  section={section}
                  item={selected}
                  saving={saving}
                  onSave={saveCatalogItem}
                />
              ) : (

                <p className="stub">Выберите элемент каталога слева.</p>

              )}

            </div>

          </div>

        </section>

      )}

    </div>

  );

}


