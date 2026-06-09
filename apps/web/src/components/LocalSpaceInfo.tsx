import {
  formatLocalSpaceCoords,
  LOCAL_SPACE_CENTER,
  type LocalSpaceDef,
} from "@sw/shared";

export function LocalSpaceInfo({ localSpace }: { localSpace: LocalSpaceDef }) {
  return (
    <section className="local-space-panel">
      <h3>Локальные координаты</h3>
      <p className="local-space-lead">{localSpace.description}</p>
      <p className="local-space-center">
        Центр объекта:{" "}
        <strong>{formatLocalSpaceCoords(LOCAL_SPACE_CENTER.x, LOCAL_SPACE_CENTER.y, LOCAL_SPACE_CENTER.z)}</strong>
        <span className="stub-inline"> (оси X · Y · Z)</span>
      </p>
      <div className="local-space-orbits">
        {localSpace.orbits.map((orbit) => (
          <div className="local-space-orbit" key={orbit.id}>
            <strong>{orbit.name}</strong>
            <p className="stub">{orbit.description}</p>
          </div>
        ))}
      </div>
      <p className="stub local-space-kinds">
        Центр может быть: {localSpace.centerKinds.map((k) => k.name.toLowerCase()).join(", ")}.
      </p>
      <div className="local-space-intruders">
        <strong>Противники на координатах</strong>
        <div className="local-space-orbits">
          {localSpace.intruderKinds.map((kind) => (
            <div className="local-space-orbit" key={kind.id}>
              <strong>{kind.name}</strong>
              <p className="stub">{kind.description}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="stub">Механика орбит, флотов и появления противников — в разработке.</p>
    </section>
  );
}
