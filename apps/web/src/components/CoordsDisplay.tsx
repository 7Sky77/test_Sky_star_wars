import { formatGalaxyCoords, formatSystemAddress } from "@sw/shared";

type CoordsDisplayProps = {
  arm: number;
  system: number;
  position?: number;
  /** Показывать адрес системы `[A:S]` (по умолчанию — да, если есть слот). */
  showSystemAddress?: boolean;
  className?: string;
};

export function CoordsDisplay({
  arm,
  system,
  position,
  showSystemAddress = position !== undefined,
  className = "coords-group",
}: CoordsDisplayProps) {
  if (position === undefined) {
    return (
      <span className={className}>
        <span className="coords-system" title="Адрес системы на карте галактики">
          {formatSystemAddress(arm, system)}
        </span>
      </span>
    );
  }

  return (
    <span className={className}>
      {showSystemAddress && (
        <>
          <span className="coords-system" title="Адрес системы на карте галактики">
            {formatSystemAddress(arm, system)}
          </span>
          <span className="coords-sep" aria-hidden>
            ·
          </span>
        </>
      )}
      <span className="coords-galaxy" title="Координаты на карте галактики (рукав:система:слот)">
        {formatGalaxyCoords(arm, system, position)}
      </span>
    </span>
  );
}
