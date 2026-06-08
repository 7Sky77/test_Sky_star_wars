/** Цвета иконок исследований (плейсхолдер до спрайтов). */
const RESEARCH_ICON: Record<string, { bg: string; glyph: string }> = {
  computer_tech: { bg: "#3b4a6b", glyph: "CPU" },
  rocket_drive: { bg: "#6b4423", glyph: "R" },
  impulse_drive: { bg: "#7c4a2d", glyph: "I" },
  weapons_tech: { bg: "#5c2d2d", glyph: "⚔" },
  yamato_cannon: { bg: "#4a1f5c", glyph: "Y" },
  ion_tech: { bg: "#2d4a6b", glyph: "⊛" },
  expedition_tech: { bg: "#2d5c4a", glyph: "★" },
  rocket_drive_opt: { bg: "#5a4030", glyph: "R+" },
  colonization: { bg: "#2d4a3b", glyph: "♁" },
  espionage_tech: { bg: "#3d3d5c", glyph: "👁" },
  pumping_tech: { bg: "#2d4a5c", glyph: "⛽" },
  hyperspace_drive: { bg: "#4a2d6b", glyph: "H" },
  shielding_tech: { bg: "#2d4a6b", glyph: "◈" },
  hyperspace_tech: { bg: "#3d2d6b", glyph: "◇" },
  plasma_tech: { bg: "#6b3d2d", glyph: "P" },
  superfuel_tech: { bg: "#5c4a2d", glyph: "F" },
  impulse_drive_opt: { bg: "#6b4a2d", glyph: "I+" },
  wormhole_tech: { bg: "#2d2d5c", glyph: "◎" },
  energy_tech: { bg: "#6b5a2d", glyph: "⚡" },
  emergency_systems: { bg: "#4a4a2d", glyph: "SOS" },
  detection_tech: { bg: "#2d5c5c", glyph: "◎" },
  armour_tech: { bg: "#4a4a4a", glyph: "⛨" },
  laser_tech: { bg: "#6b2d2d", glyph: "▶" },
  intergalactic_research: { bg: "#2d3d6b", glyph: "NET" },
  fortification_tech: { bg: "#3d4a2d", glyph: "▣" },
  hyperspace_drive_opt: { bg: "#4a306b", glyph: "H+" },
  graviton_tech: { bg: "#1f1f3d", glyph: "G" },
};

const DEFAULT_ICON = { bg: "#3d3d3d", glyph: "?" };

export function researchIcon(id: string) {
  return RESEARCH_ICON[id] ?? DEFAULT_ICON;
}
