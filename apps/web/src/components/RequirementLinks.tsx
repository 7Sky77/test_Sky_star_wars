export interface RequirementEntry {
  id: string;
  level: number;
  kind?: "building" | "research";
  label?: string;
}

export function RequirementLinks({
  title,
  requirements,
  levels,
  researchLevels,
  resolveName,
  resolveIcon,
  canOpen,
  onOpen,
}: {
  title: string;
  requirements: RequirementEntry[];
  /** Уровни зданий на планете (или исследований, если researchLevels не задан). */
  levels: Map<string, number>;
  /** Уровни исследований игрока — для смешанных требований построек. */
  researchLevels?: Map<string, number>;
  resolveName: (id: string, label?: string) => string;
  resolveIcon: (id: string) => { bg: string; glyph: string };
  canOpen: (id: string, kind?: "building" | "research") => boolean;
  onOpen: (id: string, kind?: "building" | "research") => void;
}) {
  if (!requirements.length) return null;

  return (
    <div className="research-modal-reqs">
      <h3>{title}</h3>
      <ul>
        {requirements.map((req) => {
          const have =
            req.kind === "research"
              ? (researchLevels?.get(req.id) ?? 0)
              : (levels.get(req.id) ?? 0);
          const name = resolveName(req.id, req.label);
          const met = have >= req.level;
          const openable = canOpen(req.id, req.kind);
          const icon = resolveIcon(req.id);

          return (
            <li key={`${req.id}-${req.level}`} className={met ? "met" : "unmet"}>
              {openable ? (
                <button
                  type="button"
                  className="research-req-link"
                  onClick={() => onOpen(req.id, req.kind)}
                  title={`Открыть: ${name}`}
                >
                  <span className="research-req-icon" style={{ background: icon.bg }}>
                    {icon.glyph}
                  </span>
                  <span className="research-req-name">{name}</span>
                  <span className="research-req-lv">
                    {have} из {req.level}
                  </span>
                </button>
              ) : (
                <div className="research-req-static">
                  <span className="research-req-icon" style={{ background: icon.bg }}>
                    {icon.glyph}
                  </span>
                  <span className="research-req-name">{name}</span>
                  <span className="research-req-lv">
                    {have} из {req.level}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
