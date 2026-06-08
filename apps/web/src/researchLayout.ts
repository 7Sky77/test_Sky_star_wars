/** Порядок ячеек как в XCraft: 3 колонки сверху вниз, слева направо. */
export const TERRAN_RESEARCH_GRID: string[][] = [
  [
    "computer_tech",
    "rocket_drive",
    "impulse_drive",
    "weapons_tech",
    "yamato_cannon",
    "ion_tech",
    "expedition_tech",
    "rocket_drive_opt",
    "colonization",
  ],
  [
    "espionage_tech",
    "pumping_tech",
    "hyperspace_drive",
    "shielding_tech",
    "hyperspace_tech",
    "plasma_tech",
    "superfuel_tech",
    "impulse_drive_opt",
    "wormhole_tech",
  ],
  [
    "energy_tech",
    "emergency_systems",
    "detection_tech",
    "armour_tech",
    "laser_tech",
    "intergalactic_research",
    "fortification_tech",
    "hyperspace_drive_opt",
    "graviton_tech",
  ],
];

/** Плоский список для CSS grid-auto-flow: column. */
export const TERRAN_RESEARCH_FLAT = TERRAN_RESEARCH_GRID.flat();
