/** Плейсхолдеры иконок построек до спрайтов. */
const BUILDING_ICON: Record<string, { bg: string; glyph: string }> = {
  metal_mine: { bg: "#5c4a3a", glyph: "⛏" },
  metal_well: { bg: "#4a5c3a", glyph: "◎" },
  minerals_mine: { bg: "#3a4a5c", glyph: "◆" },
  crystal_lake: { bg: "#2d4a6b", glyph: "❄" },
  vespene_extractor: { bg: "#2d5c4a", glyph: "⛽" },
  geyser: { bg: "#4a6b2d", glyph: "↑" },
  solar_plant: { bg: "#6b5a2d", glyph: "☀" },
  fusion_reactor: { bg: "#5c2d4a", glyph: "⚛" },
  metal_storage: { bg: "#4a4a4a", glyph: "▣" },
  minerals_storage: { bg: "#3d4a5c", glyph: "▣" },
  vespene_tank: { bg: "#2d5c3d", glyph: "▣" },
  metal_hideout: { bg: "#3d3d2d", glyph: "⌂" },
  minerals_hideout: { bg: "#2d3d3d", glyph: "⌂" },
  vespene_hideout: { bg: "#2d4a3d", glyph: "⌂" },
  robot_factory: { bg: "#5c5c3a", glyph: "⚙" },
  shipyard: { bg: "#3a3a5c", glyph: "🚀" },
  nanite_factory: { bg: "#4a2d5c", glyph: "N" },
  research_lab: { bg: "#2d3d6b", glyph: "⚗" },
  nano_lab: { bg: "#3d2d6b", glyph: "⚗" },
  hangar: { bg: "#3d3d5c", glyph: "✈" },
  radar: { bg: "#2d5c5c", glyph: "◎" },
  missile_silo: { bg: "#5c3d2d", glyph: "▲" },
  energy_supply_tower: { bg: "#5c4a2d", glyph: "⚡" },
  nuclear_bunker: { bg: "#2d2d2d", glyph: "☢" },
  terraformer: { bg: "#2d5c2d", glyph: "♁" },
  psi_disruptor: { bg: "#4a2d6b", glyph: "Ψ" },
};

const DEFAULT_ICON = { bg: "#3d3d3d", glyph: "?" };

export function buildingIcon(id: string) {
  return BUILDING_ICON[id] ?? DEFAULT_ICON;
}
