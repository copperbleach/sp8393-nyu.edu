export enum ElementType {
  PLANT,
  CREATURE,
}

// These are now strings to allow for custom user-created types.
export type PlantType = string;
export type CreatureType = string;

// --- Behavior Interfaces ---
export interface PlantBehavior {
  growth: number; // ms
  range: number; // pixels
  density: number;
  dayActive: boolean;
  nightActive: boolean;
  lifespan: number; // ms
}

export interface CreatureBehavior {
  eatingCooldown: number; // ms
  starvationTime: number; // ms
  reproductionCooldown: number; // ms
  maturationTime: number; // ms
  maxOffspring: number;
  minOffspring: number;
  speed: number;
  dayActive: boolean;
  nightActive: boolean;
  eats: string[]; // Array of PlantType or CreatureType strings
  lifespan: number; // ms
}

// --- Base Element ---
interface BaseElement {
  id: string;
  elementType: ElementType;
  x: number;
  y: number;
  size: number;
  birthTimestamp: number;
}

// --- Concrete Element Interfaces ---
export interface Plant extends BaseElement {
  elementType: ElementType.PLANT;
  plantType: PlantType;
  lastGrowthTimestamp: number;
}

export interface Creature extends BaseElement {
  elementType: ElementType.CREATURE;
  creatureType: CreatureType;
  lastAteTimestamp: number;
  lastReproducedTimestamp: number;
  isBaby: boolean;
  isDead: boolean;
  deathTimestamp?: number;
  parentId?: string;
  targetId?: string; // ID of the element being pursued
  vx: number; // velocity x
  vy: number; // velocity y
  orphanTimestamp?: number;
}

export type EcosystemElement = Plant | Creature;