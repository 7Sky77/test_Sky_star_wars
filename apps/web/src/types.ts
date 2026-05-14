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
  };
  planet: {
    id: number;
    name: string;
    arm: number;
    system: number;
    position: number;
    resources: { metal: number; crystal: number; deuterium: number };
  };
  buildings: { building_id: string; level: number }[];
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

export interface GalaxySystemResponse {
  arm: number;
  system: number;
  slots: {
    position: number;
    kind: "star" | "planet";
    label: string;
    ownerUsername?: string;
    planetName?: string;
    isYours?: boolean;
  }[];
}
