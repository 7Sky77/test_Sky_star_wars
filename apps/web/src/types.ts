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
}

export interface GalaxySlot {
  position: number;
  kind: "star" | "planet";
  label: string;
  ownerUsername?: string;
  planetName?: string;
  planetTypeId?: string;
  diameterKm?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  isYours?: boolean;
  isEmpty?: boolean;
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
