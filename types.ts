
export enum ElementType {
  PLANT,
  CREATURE,
}

// These are now strings to allow for custom user-created types.
export type PlantType = string;
export type CreatureType = string;

// --- New Special Ability System ---
export type SpecialType = string;

export interface SpecialAbility {
  type: SpecialType;
  name: string;
  description: string;
  enabled: boolean;
  duration: number; // ms
  cooldown: number; // ms
}

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
  specials?: SpecialAbility[];
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
  color?: string; // Optional: for mutation like albinism
  eyeColor?: string; // Optional: for mutation like albinism
  isCyclops?: boolean; // Optional: for cyclops mutation
  lastSpecialUsed?: Partial<Record<SpecialType, number>>;
  hibernationEndTime?: number;
  spikeEndTime?: number;
}

export type EcosystemElement = Plant | Creature;

// --- Event Interfaces ---
export type EventEffect =
  | 'PLANT_GROWTH_BOOST'
  | 'ALL_CREATURES_ACTIVE'
  | 'PLANT_CULL'
  | 'CREATURE_SPEED_BOOST'
  | 'PLANT_SIZE_PULSE'
  | 'REPRODUCTION_BOOST';

export interface WorldEvent {
  name: string;
  description: string;
  duration: number; // in SECONDS
  effect: EventEffect;
  visualOverlayColor?: string; // e.g., 'rgba(255, 0, 0, 0.3)'
}

export interface ActiveEvent extends WorldEvent {
  id: string;
  startTime: number;
}

// --- Visual Effects for Specials ---
export interface ActiveEffect {
    id: string;
    type: SpecialType;
    x: number;
    y: number;
    size: number;
    startTime: number;
    duration: number;
    // For teleportation
    endX?: number; 
    endY?: number;
    creatureId?: string;
}