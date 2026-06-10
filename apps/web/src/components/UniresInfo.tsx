import { uniresFromResources, type UniresDef } from "@sw/shared";

function fmt(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString("ru-RU");
}

type UniresInfoProps = {
  unires: UniresDef;
  planetResources?: { metal: number; minerals: number; vespene: number };
};

export function UniresInfo({ unires, planetResources }: UniresInfoProps) {
  const wealth =
    planetResources != null ? uniresFromResources(planetResources, unires) : null;

  return (
    <details className="unires-panel">
      <summary className="unires-panel-summary">{unires.name}</summary>
      <div className="unires-panel-body">
        <p className="unires-lead">{unires.description}</p>
        {wealth != null && (
          <p className="unires-wealth">
            Запасы планеты: <strong>{fmt(wealth)}</strong> {unires.shortName}
          </p>
        )}
        <table className="data-table unires-table">
          <thead>
            <tr>
              <th>1000 {unires.shortName}</th>
              <th className="num">Металл</th>
              <th className="num">Минералы</th>
              <th className="num">Веспен</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>эквивалент</td>
              <td className="num">{unires.perThousand.metal.toLocaleString("ru-RU")}</td>
              <td className="num">{unires.perThousand.minerals.toLocaleString("ru-RU")}</td>
              <td className="num">{unires.perThousand.vespene.toLocaleString("ru-RU")}</td>
            </tr>
            <tr>
              <td>за 1 {unires.shortName}</td>
              <td className="num">4</td>
              <td className="num">2</td>
              <td className="num">1</td>
            </tr>
          </tbody>
        </table>
        <p className="stub unires-footnote">
          Энергия в униресы не переводится. Сравнение цен в интерфейсе — постепенно.
        </p>
      </div>
    </details>
  );
}
