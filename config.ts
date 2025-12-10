import { ElementType, PlantBehavior, CreatureBehavior, WorldEvent, SpecialAbility } from './types';

// --- New Special Abilities Constant ---
export const DEFAULT_SPECIAL_ABILITIES: SpecialAbility[] = [
    { type: 'TOXIC_GAS', name: 'Toxic Gas', description: 'Releases a deadly gas cloud that kills nearby elements.', enabled: false, duration: 3000, cooldown: 15000 },
    { type: 'TELEPORTATION', name: 'Teleportation', description: 'Instantly teleports to a random location.', enabled: false, duration: 500, cooldown: 25000 },
    { type: 'HIBERNATION', name: 'Hibernation', description: 'Enters a deep sleep, stopping hunger but remaining vulnerable.', enabled: false, duration: 45000, cooldown: 30000 },
    { type: 'SPIKE', name: 'Spike', description: 'Grows defensive spikes, preventing predators from eating it.', enabled: false, duration: 5000, cooldown: 5000 },
];

// --- Constants ---
export const DEATH_DURATION = 10000; // 10 seconds
export const DAY_DURATION = 30000; // 30 seconds
export const NIGHT_DURATION = 30000; // 30 seconds
export const FULL_DAY_DURATION = DAY_DURATION + NIGHT_DURATION;
export const MAX_TOTAL_ELEMENTS = 9;
export const BABY_ORPHAN_SURVIVAL_TIME = 30000; // 30 seconds
export const PRECONFIGURED_API_KEY = process.env.API_KEY;

// --- Initial Configurations ---
export const initialBehaviorConfig: Record<string, PlantBehavior | CreatureBehavior> = {
  'GreenDot': {
    growth: 15000, range: 30, density: 5, dayActive: true, nightActive: false, lifespan: 120000,
  },
  'Fafa': {
    eatingCooldown: 10000, starvationTime: 30000, reproductionCooldown: 60000, maturationTime: 30000,
    minOffspring: 1, maxOffspring: 3, speed: 20, dayActive: true, nightActive: false, eats: ['GreenDot'], lifespan: 1800000, specials: []
  },
  'Keke': {
    eatingCooldown: 30000, starvationTime: 60000, reproductionCooldown: 90000, maturationTime: 60000,
    minOffspring: 1, maxOffspring: 1, speed: 25, dayActive: false, nightActive: true, eats: ['Fafa'], lifespan: 3600000, specials: []
  }
};

export const initialAppearanceConfig: Record<string, { size: number, color: string, shape: string, type: ElementType }> = {
    'GreenDot': { size: 10, color: '#879464', shape: 'Shape2', type: ElementType.PLANT },
    'Fafa': { size: 36, color: 'white', shape: 'Shape2', type: ElementType.CREATURE },
    'Keke': { size: 50, color: '#6B7280', shape: 'Shape5', type: ElementType.CREATURE },
};

export const predefinedEvents: WorldEvent[] = [
  {
    name: 'Nurturing Rain',
    description: 'Accelerate plant growth by 10s.',
    duration: 30,
    effect: 'PLANT_GROWTH_BOOST',
    visualOverlayColor: 'rgba(173, 216, 230, 0.3)'
  },
  {
    name: 'Ominous Light',
    description: 'Awaken all creatures.',
    duration: 45,
    effect: 'ALL_CREATURES_ACTIVE',
    visualOverlayColor: 'rgba(57, 255, 20, 0.5)'
  },
  {
    name: 'Drought',
    description: 'Kills 80% of plants.',
    duration: 10,
    effect: 'PLANT_CULL',
    visualOverlayColor: 'rgba(150, 75, 0, 0.3)'
  },
];

export const behaviorTooltips: Record<string, string> = {
    'active': 'The active time of this element',
    'speed': 'The speed of this creature',
    'lifespan': 'The time of the existence of this element',
    'eatingCooldown': 'The time it takes for this creature to be hungry',
    'starvationTime': 'The time it takes to starve this creature',
    'reproductionCooldown': 'The time it takes for this creature to mate and reproduce',
    'offspring': 'The minimum and maximum numbers of offspring per reproduction',
    'maturationTime': 'The time it takes for this creature to be an adult',
    'growth': 'The time it takes for this plant to grow another plant',
    'range': 'The range of growth of this plant',
    'density': 'The maximum number of the same plant growing within range',
    'duration': 'How long the special ability effect lasts.',
    'cooldown': 'Time before the special ability can be used again.',
};

export const keyLabelMap: Record<string, string> = {
    'speed': 'Speed',
    'lifespan': 'Lifespan',
    'eatingCooldown': 'Hunger',
    'starvationTime': 'Starvation',
    'reproductionCooldown': 'Reproduction',
    'maturationTime': 'Maturation',
    'growth': 'Growth',
    'range': 'Range',
    'density': 'Density',
    'duration': 'Duration',
    'cooldown': 'Cooldown',
};