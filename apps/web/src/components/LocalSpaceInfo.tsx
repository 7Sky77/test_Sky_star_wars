import {
  formatLocalSpaceCoords,
  LOCAL_SPACE_CENTER,
  type LocalSpaceDef,
} from "@sw/shared";

export function LocalSpaceInfo({ localSpace }: { localSpace: LocalSpaceDef }) {
  return (
    <details className="local-space-panel">
      <summary className="local-space-panel-summary">Локальные координаты</summary>
      <div className="local-space-panel-body">
        <p className="local-space-lead">{localSpace.description}</p>
        <p className="local-space-center">
          Центр объекта:{" "}
          <strong>
            {formatLocalSpaceCoords(LOCAL_SPACE_CENTER.x, LOCAL_SPACE_CENTER.y, LOCAL_SPACE_CENTER.z)}
          </strong>
          <span className="stub-inline"> (оси X · Y · Z)</span>
        </p>
        <p className="stub local-space-kinds">
          Центр может быть: {localSpace.centerKinds.map((k) => k.name.toLowerCase()).join(", ")}.
        </p>

        <details className="local-space-fold">
          <summary>Орбиты ({localSpace.orbits.length})</summary>
          <div className="local-space-orbits">
            {localSpace.orbits.map((orbit) => (
              <div className="local-space-orbit" key={orbit.id}>
                <strong>{orbit.name}</strong>
                <p className="stub">{orbit.description}</p>
              </div>
            ))}
          </div>
        </details>

        <details className="local-space-fold">
          <summary>Противники на координатах ({localSpace.intruderKinds.length})</summary>
          <div className="local-space-orbits">
            {localSpace.intruderKinds.map((kind) => (
              <div className="local-space-orbit" key={kind.id}>
                <strong>{kind.name}</strong>
                <p className="stub">{kind.description}</p>
              </div>
            ))}
          </div>
        </details>

        <p className="stub local-space-footnote">
          Механика орбит, флотов и появления противников — в разработке.
        </p>
      </div>
    </details>
  );
}
