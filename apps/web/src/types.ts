export type { GameCatalog } from "@sw/shared";

/** Ответ каталога с опциональными флагами (сервер добавляет вне JSON content/). */
export type GameCatalogWithCheats = import("@sw/shared").GameCatalog & {
  cheats?: { grantResources?: boolean };
};

export interface GameState {
  serverTime: number;
  user: {
    username: string;
    factionId: string;
    isAdmin?: boolean;
  };
  planet: {
    id: number;
    name: string;
    arm: number;
    system: number;
    position: number;
    planetTypeId: string;
    diameterKm: number;
    temperatureMin: number;
    temperatureMax: number;
    resources: { metal: number; minerals: number; vespene: number };
  };
  buildings: { building_id: string; level: number }[];
  research: { research_id: string; level: number }[];
  researchQueue: {
    id: number;
    research_id: string;
    target_level: number;
    started_at: number;
    finishes_at: number;
  } | null;
  buildQueue: {
    id: number;
    building_id: string;
    target_level: number;
    started_at: number;
    finishes_at: number;
  }[];
  units: { unit_id: string; quantity: number }[];
  defense: { defense_id: string; quantity: number }[];
  fleetMissions: FleetMissionState[];
  orbitIntruders: OrbitIntruderState[];
  battleReports: BattleReportState[];
}

export interface BattleReportState {
  id: number;
  missionId: number | null;
  intruderId: string | null;
  location: {
    arm: number;
    system: number;
    position: number;
    orbit: "low" | "medium" | "high";
  };
  defenderName: string;
  winner: "attacker" | "defender" | "draw";
  attackerStart: { unitId: string; name: string; quantity: number }[];
  defenderStart: { unitId: string; name: string; quantity: number }[];
  attackerSurvivors: { unitId: string; name: string; quantity: number }[];
  defenderSurvivors: { unitId: string; name: string; quantity: number }[];
  rounds: {
    round: number;
    attackerShips: number;
    defenderShips: number;
    attackerDamage: number;
    defenderDamage: number;
    attackerDestroyed: number;
    defenderDestroyed: number;
  }[];
  createdAt: number;
}

export interface OrbitIntruderState {
  id: string;
  name: string;
  intruderKind: "pirate_bot" | "player";
  arm: number;
  system: number;
  position: number;
  orbit: "low" | "medium" | "high";
  units: Record<string, number>;
  unitDetails: { unitId: string; name: string; quantity: number }[];
  totalShips: number;
}

export interface FleetMissionState {
  id: number;
  origin: {
    arm: number;
    system: number;
    position: number;
    planetId: number;
  };
  target: {
    arm: number;
    system: number;
    position: number;
    orbit: "low" | "medium" | "high";
  };
  missionType: "hold" | "attack";
  status: "outbound" | "holding" | "returning";
  units: Record<string, number>;
  totalShips: number;
  speedPct: number;
  holdSeconds: number;
  launchedAt: number;
  arrivesAt: number;
  holdUntil: number | null;
}

export interface GalaxySlot {
  position: number;
  kind: "star" | "planet";
  label: string;
  systemAddress: string;
  ownerUsername?: string;
  planetName?: string;
  planetTypeId?: string;
  diameterKm?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  isYours?: boolean;
  isEmpty?: boolean;
  orbitIntruders?: {
    id: string;
    name: string;
    intruderKind: string;
    orbit: "low" | "medium" | "high";
    totalShips: number;
    units: Record<string, number>;
  }[];
}

export interface GalaxySystemResponse {
  arm: number;
  system: number;
  slots: GalaxySlot[];
}

export interface GalaxySectorResponse {
  arm: number;
  centerSystem: number;
  systems: GalaxySystemResponse[];
}
