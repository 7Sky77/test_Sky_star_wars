export interface GameState {
  serverTime: number;
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
}

export interface CatalogBuilding {
  id: string;
  name: string;
  maxLevel: number;
}

export interface Catalog {
  world: {
    minArm: number;
    maxArm: number;
    minSystem: number;
    maxSystem: number;
    starSlot: 0;
    maxPlanetSlot: number;
  };
  resources: { id: string; name: string; color?: string }[];
  factions: { id: string; displayName: string }[];
  buildings: CatalogBuilding[];
  units: { id: string; name: string }[];
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
