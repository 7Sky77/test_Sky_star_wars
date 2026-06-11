export const PLANET_TYPE_IDS = [
  "gas",
  "water",
  "sand",
  "industrial",
  "dry",
  "ice",
  "jungle",
  "normal",
] as const;

export type PlanetTypeId = (typeof PLANET_TYPE_IDS)[number];

const PLANET_TYPE_SET = new Set<string>(PLANET_TYPE_IDS);

export const PLANET_VARIANT_COUNT = 10;

/** CSS-класс оформления планеты по типу из каталога. */
export function planetTypeClass(typeId?: string): string {
  const id = typeId && PLANET_TYPE_SET.has(typeId) ? typeId : "normal";
  return `ptype-${id}`;
}

export function normalizePlanetTypeId(typeId?: string): PlanetTypeId {
  return typeId && PLANET_TYPE_SET.has(typeId)
    ? (typeId as PlanetTypeId)
    : "normal";
}

/** Индекс спрайта 0…9 по координатам слота (стабильный для системы). */
export function planetVariantIndex(
  position: number,
  arm = 0,
  system = 0
): number {
  const hash = arm * 73856093 ^ system * 19349663 ^ position * 83492791;
  return ((hash % PLANET_VARIANT_COUNT) + PLANET_VARIANT_COUNT) % PLANET_VARIANT_COUNT;
}

export function planetSpriteUrl(
  typeId?: string,
  variant = 0
): string {
  const type = normalizePlanetTypeId(typeId);
  const v =
    ((Math.floor(variant) % PLANET_VARIANT_COUNT) + PLANET_VARIANT_COUNT) %
    PLANET_VARIANT_COUNT;
  return `/assets/planets/${type}/${v}.png`;
}

/** Стили для кнопки-планеты: фон-спрайт + лёгкая CSS-вариация. */
export function planetVisualStyle(
  typeId: string | undefined,
  position: number,
  arm?: number,
  system?: number
): { backgroundImage: string; filter: string } {
  const variant = planetVariantIndex(position, arm ?? 0, system ?? 0);
  const microTone = ((position * 11 + (arm ?? 0) + (system ?? 0)) % 7) - 3;
  return {
    backgroundImage: `url(${planetSpriteUrl(typeId, variant)})`,
    filter: `hue-rotate(${microTone}deg)`,
  };
}

/** @deprecated Используйте planetVisualStyle */
export function planetVariantStyle(position: number): { filter: string } {
  const deg = ((position * 17) % 25) - 12;
  return { filter: `hue-rotate(${deg}deg)` };
}
