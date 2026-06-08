const PLANET_TYPE_IDS = new Set([
  "gas",
  "water",
  "sand",
  "industrial",
  "dry",
  "ice",
  "jungle",
  "normal",
]);

/** CSS-класс оформления планеты по типу из каталога. */
export function planetTypeClass(typeId?: string): string {
  const id = typeId && PLANET_TYPE_IDS.has(typeId) ? typeId : "normal";
  return `ptype-${id}`;
}

/** Лёгкое отличие планет одного типа в системе (позиция 1–9). */
export function planetVariantStyle(position: number): { filter: string } {
  const deg = ((position * 17) % 25) - 12;
  return { filter: `hue-rotate(${deg}deg)` };
}
