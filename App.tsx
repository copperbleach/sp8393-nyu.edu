
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EcosystemElement, ElementType, Plant, Creature, PlantBehavior, CreatureBehavior, PlantType, CreatureType } from './types';

// --- Constants ---
const DEATH_DURATION = 10000; // 10 seconds
const DAY_DURATION = 30000; // 30 seconds
const NIGHT_DURATION = 30000; // 30 seconds
const FULL_DAY_DURATION = DAY_DURATION + NIGHT_DURATION;
const MAX_CUSTOM_ELEMENTS = 6;
const BABY_ORPHAN_SURVIVAL_TIME = 30000; // 30 seconds

// --- Helper Functions ---
const getRandomNumber = (min: number, max: number) => Math.random() * (max - min) + min;
const distance = (el1: {x:number, y:number}, el2: {x:number, y:number}) => Math.sqrt(Math.pow(el1.x - el2.x, 2) + Math.pow(el1.y - el2.y, 2));
const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

// --- Shape Definitions ---
const shapeList = ['Shape1', 'Shape2', 'Shape3', 'Shape4', 'Shape5', 'Shape6', 'Shape7', 'Shape8', 'Shape9', 'Shape10'];

const getShapeStyle = (shape: string): React.CSSProperties => {
    switch (shape) {
        // Row 1 from image
        case 'Shape1': return { clipPath: 'inset(25% 0% round 50px)' }; // Horizontal capsule
        case 'Shape2': return { borderRadius: '50%' }; // Circle
        case 'Shape3': return { transform: 'scale(0.9)' }; // Square, slightly smaller
        case 'Shape4': return { clipPath: 'polygon(50% 10%, 0% 90%, 100% 90%)' }; // Triangle W:H 5:4
        case 'Shape5': return { clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }; // Pentagon
        // Row 2 from image
        case 'Shape6': return { clipPath: 'inset(0% 25% round 50px)' }; // Vertical capsule
        case 'Shape7': return { clipPath: 'url(#shape7-clip)' }; // Snowman
        case 'Shape8': return { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }; // Diamond
        case 'Shape9': return { clipPath: 'polygon(10% 0%, 90% 50%, 10% 100%)' }; // Right pointing triangle W:H 4:5
        case 'Shape10': return { clipPath: 'url(#shape10-clip)' }; // Flower
        default: return { borderRadius: '50%' };
    }
};

// --- Initial Configurations ---
const initialBehaviorConfig: Record<string, PlantBehavior | CreatureBehavior> = {
  'GreenDot': {
    growth: 15000, range: 30, density: 5, dayActive: true, nightActive: false, lifespan: 120000,
  },
  'Fafa': {
    eatingCooldown: 10000, starvationTime: 60000, reproductionCooldown: 60000, maturationTime: 30000,
    minOffspring: 1, maxOffspring: 3, speed: 20, dayActive: true, nightActive: false, eats: ['GreenDot'], lifespan: 1800000,
  },
  'Keke': {
    eatingCooldown: 30000, starvationTime: 90000, reproductionCooldown: 60000, maturationTime: 60000,
    minOffspring: 1, maxOffspring: 1, speed: 25, dayActive: false, nightActive: true, eats: ['Fafa'], lifespan: 3600000,
  }
};

const initialAppearanceConfig: Record<string, { size: number, color: string, shape: string, type: ElementType }> = {
    'GreenDot': { size: 10, color: '#879464', shape: 'Shape2', type: ElementType.PLANT },
    'Fafa': { size: 36, color: 'white', shape: 'Shape2', type: ElementType.CREATURE },
    'Keke': { size: 50, color: '#6B7280', shape: 'Shape5', type: ElementType.CREATURE },
};

const behaviorTooltips: Record<string, string> = {
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
    'density': 'The maximum number of the same plant growing within range'
};

const keyLabelMap: Record<string, string> = {
    'speed': 'Speed',
    'lifespan': 'Lifespan',
    'eatingCooldown': 'Hunger',
    'starvationTime': 'Starvation',
    'reproductionCooldown': 'Reproduction',
    'maturationTime': 'Maturation',
    'growth': 'Growth',
    'range': 'Range',
    'density': 'Density'
};

const DayNightIndicator = ({ isDay, dayCount, worldTime }: { isDay: boolean, dayCount: number, worldTime: number }) => {
  const rotation = (worldTime % FULL_DAY_DURATION) / FULL_DAY_DURATION * 360;
  return (
    <div 
      className="absolute right-4 z-30 pointer-events-none flex flex-col items-center"
      style={{ bottom: '-37px' }}
    >
      <div 
        className={`font-bold text-xl mb-2 transition-colors duration-500 ${isDay ? 'text-black' : 'text-white'}`}
      >
        Day {dayCount}
      </div>
      <div style={{ transform: `rotate(${rotation}deg)` }}>
        <img src="TimeOrb.png" alt="Time Orb" width="74" height="74" />
      </div>
    </div>
  );
};

const CustomCheckbox = ({ checked, onChange, id, children }: { checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; id: string; children: React.ReactNode }) => (
    <label htmlFor={id} className="flex items-center cursor-pointer">
        <input 
            type="checkbox" 
            id={id} 
            checked={checked} 
            onChange={onChange}
            className="absolute opacity-0 w-0 h-0"
        />
        <span className={`w-5 h-5 border rounded-sm flex items-center justify-center mr-1.5 transition-colors ${checked ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-400'}`}>
            {checked && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </span>
        {children}
    </label>
);


const App: React.FC = () => {
  const [elements, setElements] = useState<EcosystemElement[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);
  const [initialCounts, setInitialCounts] = useState<Record<string, number>>({ 'GreenDot': 20, 'Fafa': 5, 'Keke': 2 });
  const [behaviorConfig, setBehaviorConfig] = useState<Record<string, PlantBehavior | CreatureBehavior>>(initialBehaviorConfig);
  const [appearanceConfig, setAppearanceConfig] = useState(initialAppearanceConfig);
  const [dayCount, setDayCount] = useState(1);
  const [isDay, setIsDay] = useState(true);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [worldTime, setWorldTime] = useState(0);
  const [copiedTypeName, setCopiedTypeName] = useState<string | null>(null);
  const [copiedConfig, setCopiedConfig] = useState<string | null>(null);

  
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(0);
  const lastUpdateTime = useRef<number>(0);
  const worldTimeRef = useRef(0);
  
  useEffect(() => {
    if (copiedTypeName) {
      const timer = setTimeout(() => {
        setCopiedTypeName(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedTypeName]);


  const playBabyBornSound = useCallback(() => {
    const sound = new Audio('Bob.wav');
    sound.play().catch(error => {
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        console.error("Error playing sound:", error);
      }
    });
  }, []);

  const createPlant = useCallback((plantType: PlantType, x: number, y: number, isInitial: boolean = false): Plant => {
    const appearance = appearanceConfig[plantType];
    const behavior = behaviorConfig[plantType] as PlantBehavior;
    return {
      id: crypto.randomUUID(),
      elementType: ElementType.PLANT,
      plantType,
      x, y,
      size: appearance.size,
      birthTimestamp: performance.now(),
      lastGrowthTimestamp: isInitial ? performance.now() - getRandomNumber(0, behavior.growth) : performance.now(),
    };
  }, [appearanceConfig, behaviorConfig]);

  const createCreature = useCallback((creatureType: CreatureType, x: number, y: number, isBaby: boolean = false, parentId?: string): Creature => {
    const now = performance.now();
    const appearance = appearanceConfig[creatureType];
    const behavior = behaviorConfig[creatureType] as CreatureBehavior;
    return {
      id: crypto.randomUUID(),
      elementType: ElementType.CREATURE,
      creatureType,
      x, y,
      size: isBaby ? appearance.size / 2 : appearance.size,
      lastAteTimestamp: now, lastReproducedTimestamp: now, birthTimestamp: now,
      isBaby, isDead: false, parentId,
      vx: getRandomNumber(-1, 1), vy: getRandomNumber(-1, 1),
    };
  }, [appearanceConfig, behaviorConfig]);

  const gameLoop = useCallback(() => {
    const now = performance.now();
    if (lastUpdateTime.current === 0) { lastUpdateTime.current = now; animationFrameId.current = requestAnimationFrame(gameLoop); return; }
    const deltaTime = (now - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = now;

    worldTimeRef.current += deltaTime * 1000;
    setWorldTime(worldTimeRef.current);
    const newDayCount = Math.floor(worldTimeRef.current / FULL_DAY_DURATION) + 1;
    const newIsDay = (worldTimeRef.current % FULL_DAY_DURATION) < DAY_DURATION;

    setDayCount(current => newDayCount !== current ? newDayCount : current);
    setIsDay(current => newIsDay !== current ? newIsDay : current);

    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) { animationFrameId.current = requestAnimationFrame(gameLoop); return; }
    
    setElements(prevElements => {
      const elementsToAdd: EcosystemElement[] = [];
      const idsToRemove = new Set<string>();
      const elementMap: Map<string, EcosystemElement> = new Map(prevElements.map(el => [el.id, el]));

      for (const element of prevElements) {
        if (idsToRemove.has(element.id)) continue;
        let updatedElement = { ...element };

        if (element.elementType === ElementType.PLANT) {
          const plant = { ...updatedElement } as Plant;
          const behavior = behaviorConfig[plant.plantType] as PlantBehavior;
          
          if (now - plant.birthTimestamp > behavior.lifespan) {
            idsToRemove.add(plant.id);
            continue;
          }

          const isActive = (newIsDay && behavior.dayActive) || (!newIsDay && behavior.nightActive);

          if (isActive && now - plant.lastGrowthTimestamp > behavior.growth) {
            const nearbyPlants = prevElements.filter(e => e.elementType === ElementType.PLANT && distance(plant, e) < behavior.range);
            if (nearbyPlants.length < behavior.density) {
              const angle = Math.random() * 2 * Math.PI;
              const newX = plant.x + Math.cos(angle) * getRandomNumber(plant.size, behavior.range);
              const newY = plant.y + Math.sin(angle) * getRandomNumber(plant.size, behavior.range);
              elementsToAdd.push(createPlant(plant.plantType,
                Math.max(0, Math.min(bounds.width - plant.size, newX)), 
                Math.max(0, Math.min(bounds.height - plant.size, newY))
              ));
              plant.lastGrowthTimestamp = now;
            }
          }
          updatedElement = plant;
        } else if (element.elementType === ElementType.CREATURE) {
          let creature = { ...updatedElement } as Creature;
          const behavior = behaviorConfig[creature.creatureType] as CreatureBehavior;
          const appearance = appearanceConfig[creature.creatureType];

          if (creature.isDead && creature.deathTimestamp && now - creature.deathTimestamp > DEATH_DURATION) {
             idsToRemove.add(creature.id);
             continue;
          }
          
          if (!creature.isDead) {
              if (now - creature.birthTimestamp > behavior.lifespan) {
                  creature = {...creature, isDead: true, deathTimestamp: now, vx: 0, vy: 0};
              } else if (!creature.isBaby && now - creature.lastAteTimestamp > behavior.starvationTime) {
                  creature = {...creature, isDead: true, deathTimestamp: now, vx: 0, vy: 0};
              } else if (creature.isBaby) {
                  const parent = creature.parentId ? elementMap.get(creature.parentId) : null;
                  if (!parent) {
                      if (!creature.orphanTimestamp) {
                          creature = {...creature, orphanTimestamp: now, parentId: undefined};
                      } else if (now - creature.orphanTimestamp > BABY_ORPHAN_SURVIVAL_TIME) {
                          creature = {...creature, isDead: true, deathTimestamp: now, vx: 0, vy: 0};
                      }
                  }
              }
          }

          if (!creature.isDead) {
            const isActive = (newIsDay && behavior.dayActive) || (!newIsDay && behavior.nightActive);
            if (isActive) {
              if (creature.isBaby && now - creature.birthTimestamp > behavior.maturationTime) {
                creature = {...creature, isBaby: false, size: appearance.size, parentId: undefined, targetId: undefined, lastAteTimestamp: now, orphanTimestamp: undefined };
              }

              const isHungry = now - creature.lastAteTimestamp > behavior.eatingCooldown;
              const isReadyToMate = !creature.isBaby && now - creature.lastReproducedTimestamp > behavior.reproductionCooldown;

              if (creature.targetId && (!elementMap.has(creature.targetId) || idsToRemove.has(creature.targetId))) {
                creature.targetId = undefined;
              }
              
              if (!creature.isBaby) {
                if (isHungry) {
                  let nearestFood: EcosystemElement | null = null; let minDistance = Infinity;
                  const foodFilter = (other: EcosystemElement) => {
                    if (idsToRemove.has(other.id)) return false;
                    const diet = (behaviorConfig[creature.creatureType] as CreatureBehavior).eats;
                    if (other.elementType === ElementType.PLANT) return diet.includes(other.plantType);
                    if (other.elementType === ElementType.CREATURE) return !(other as Creature).isDead && diet.includes((other as Creature).creatureType);
                    return false;
                  };
                  for (const other of prevElements) {
                    if (foodFilter(other)) {
                      const d = distance(creature, other);
                      if (d < minDistance) { minDistance = d; nearestFood = other; }
                    }
                  }
                  if (nearestFood) creature.targetId = nearestFood.id;
                } 
                else if (isReadyToMate) {
                  let nearestMate: Creature | null = null; let minDistance = Infinity;
                  for (const other of prevElements) {
                    if (other.id !== creature.id && other.elementType === ElementType.CREATURE) {
                      const potentialMate = other as Creature;
                      if (potentialMate.creatureType === creature.creatureType && !potentialMate.isBaby && !potentialMate.isDead) {
                        const d = distance(creature, other);
                        if (d < minDistance) { minDistance = d; nearestMate = potentialMate; }
                      }
                    }
                  }
                  if (nearestMate) creature.targetId = nearestMate.id;
                }
              }

              let desiredVX = creature.vx; let desiredVY = creature.vy;
              const target = creature.targetId ? elementMap.get(creature.targetId) : null;
              
              if (creature.isBaby && creature.parentId) {
                const parent = elementMap.get(creature.parentId);
                if (parent && distance(creature, parent) > parent.size * 1.5) {
                  const angle = Math.atan2(parent.y - creature.y, parent.x - creature.x);
                  desiredVX = Math.cos(angle); desiredVY = Math.sin(angle);
                } else if (parent) { 
                  desiredVX = 0; desiredVY = 0; 
                }
              } 
              else if (target) {
                const d = distance(creature, target);
                const interactionDistance = (creature.size + target.size) / 2.5;

                if (d < interactionDistance) {
                   if (isHungry) { idsToRemove.add(target.id); creature = {...creature, lastAteTimestamp: now, targetId: undefined}; } 
                   else if (isReadyToMate && target.elementType === ElementType.CREATURE) {
                      const mate = target as Creature;
                      const mateBehavior = behaviorConfig[mate.creatureType] as CreatureBehavior;
                      if (now - mate.lastReproducedTimestamp > mateBehavior.reproductionCooldown) {
                        const offspringCount = Math.floor(getRandomNumber(behavior.minOffspring, behavior.maxOffspring + 1));
                        if (offspringCount > 0) playBabyBornSound();
                        for (let i = 0; i < offspringCount; i++) {
                          elementsToAdd.push(createCreature(creature.creatureType, creature.x, creature.y, true, creature.id));
                        }
                        creature.lastReproducedTimestamp = now;
                        const originalMate = elementMap.get(mate.id) as Creature;
                        if (originalMate) elementMap.set(mate.id, {...originalMate, lastReproducedTimestamp: now});
                        creature.targetId = undefined;
                      }
                   }
                } 
                else {
                  const angle = Math.atan2(target.y - creature.y, target.x - creature.x);
                  desiredVX = Math.cos(angle); desiredVY = Math.sin(angle);
                }
              }
              else {
                if (Math.random() < 0.02) {
                    const wanderAngle = Math.atan2(creature.vy, creature.vx) + getRandomNumber(-0.8, 0.8);
                    desiredVX = Math.cos(wanderAngle); desiredVY = Math.sin(wanderAngle);
                }
              }
              
              creature.vx = lerp(creature.vx, desiredVX, 0.1);
              creature.vy = lerp(creature.vy, desiredVY, 0.1);
              
              const magnitude = Math.sqrt(creature.vx * creature.vx + creature.vy * creature.vy);
              if (magnitude > 1e-6) { creature.vx /= magnitude; creature.vy /= magnitude; }
              else if (desiredVX === 0 && desiredVY === 0) { creature.vx = lerp(creature.vx, 0, 0.1); creature.vy = lerp(creature.vy, 0, 0.1); }
            } else {
              creature.vx = lerp(creature.vx, 0, 0.1); creature.vy = lerp(creature.vy, 0, 0.1);
            }
            
            creature.x += creature.vx * behavior.speed * deltaTime;
            creature.y += creature.vy * behavior.speed * deltaTime;

            if (creature.x < 0) { creature.x = 0; creature.vx *= -1; }
            if (creature.x > bounds.width - creature.size) { creature.x = bounds.width - creature.size; creature.vx *= -1; }
            if (creature.y < 0) { creature.y = 0; creature.vy *= -1; }
            if (creature.y > bounds.height - creature.size) { creature.y = bounds.height - creature.size; creature.vy *= -1; }
          }
          updatedElement = creature;
        }

        const currentVersionOnMap = elementMap.get(updatedElement.id);
        if (currentVersionOnMap?.elementType === ElementType.CREATURE && updatedElement.elementType === ElementType.CREATURE && (currentVersionOnMap as Creature).lastReproducedTimestamp > (updatedElement as Creature).lastReproducedTimestamp) {
          (updatedElement as Creature).lastReproducedTimestamp = (currentVersionOnMap as Creature).lastReproducedTimestamp;
        }
        elementMap.set(updatedElement.id, updatedElement);
      }

      return [...Array.from(elementMap.values()).filter(el => !idsToRemove.has(el.id)), ...elementsToAdd];
    });
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [createCreature, createPlant, playBabyBornSound, behaviorConfig, appearanceConfig]);

  const handleReboot = () => {
    cancelAnimationFrame(animationFrameId.current);
    worldTimeRef.current = 0; 
    setWorldTime(0);
    setDayCount(1); 
    setIsDay(true);
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const initialElements: EcosystemElement[] = [];
      Object.entries(initialCounts).forEach(([typeName, count]) => {
        const appearance = appearanceConfig[typeName];
        if (!appearance) return; // Skip if type was deleted
        for (let i = 0; i < count; i++) {
          const x = getRandomNumber(0, width - appearance.size);
          const y = getRandomNumber(0, height - appearance.size);
          if (appearance.type === ElementType.PLANT) {
            initialElements.push(createPlant(typeName, x, y, true));
          } else {
            initialElements.push(createCreature(typeName, x, y));
          }
        }
      });
      setElements(initialElements);
      lastUpdateTime.current = performance.now();
      animationFrameId.current = requestAnimationFrame(gameLoop);
    }
  };
  
  const handleCountChange = (type: string, value: string) => {
    const num = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(num)) return;
    const clampedValue = Math.max(0, Math.min(99, num));
    setInitialCounts(prev => ({ ...prev, [type]: clampedValue }));
  };
  
  const getConstrainedBehaviorValue = (key: string, value: number, behavior: CreatureBehavior | PlantBehavior | Omit<CreatureBehavior, 'eats'>): number => {
      const creatureBehavior = behavior as CreatureBehavior;
      let finalValue = value;

      let minBound = -Infinity;
      let maxBound = Infinity;

      switch(key) {
          case 'speed':
              minBound = 1;
              maxBound = 99;
              break;
          case 'lifespan':
              minBound = 30;
              maxBound = 999;
              if (creatureBehavior.starvationTime) {
                  minBound = Math.max(minBound, (creatureBehavior.starvationTime / 1000) + 0.001);
              }
              if (creatureBehavior.reproductionCooldown) {
                  minBound = Math.max(minBound, (creatureBehavior.reproductionCooldown / 1000) + 0.001);
              }
              if (creatureBehavior.maturationTime) {
                  minBound = Math.max(minBound, (creatureBehavior.maturationTime / 1000) + 0.001);
              }
              break;
          case 'eatingCooldown': // Hunger
              minBound = 5;
              maxBound = 99;
              if (creatureBehavior.starvationTime) {
                  maxBound = Math.min(maxBound, (creatureBehavior.starvationTime / 1000) - 0.001);
              }
              break;
          case 'starvationTime': // Starvation
              minBound = 30;
              maxBound = 999;
              if (creatureBehavior.lifespan) {
                  maxBound = Math.min(maxBound, (creatureBehavior.lifespan / 1000) - 0.001);
              }
              if (creatureBehavior.eatingCooldown) {
                  minBound = Math.max(minBound, (creatureBehavior.eatingCooldown / 1000) + 0.001);
              }
              break;
          case 'reproductionCooldown': // Reproduction
              minBound = 5;
              maxBound = 999;
              if (creatureBehavior.lifespan) {
                  maxBound = Math.min(maxBound, (creatureBehavior.lifespan / 1000) - 0.001);
              }
              break;
           case 'maturationTime':
              minBound = 0;
              maxBound = 999;
              if (creatureBehavior.lifespan) {
                  maxBound = Math.min(maxBound, (creatureBehavior.lifespan / 1000) - 0.001);
              }
              break;
          default:
              minBound = 0;
              break;
      }
      
      finalValue = Math.max(minBound, Math.min(maxBound, value));
      
      return parseFloat(finalValue.toPrecision(10));
  }


  const handleBehaviorChange = (typeName: string, key: string, value: string | boolean) => {
      setBehaviorConfig(prev => {
          const newConfig = { ...prev };
          const behavior = { ...newConfig[typeName] };
          if (!behavior) return prev;

          if (typeof value === 'boolean') {
              (behavior as any)[key] = value;
          } else {
              if (key === 'minOffspring' || key === 'maxOffspring') {
                  const creatureBehavior = behavior as CreatureBehavior;
                  let numValue = parseInt(value, 10);
                  if (isNaN(numValue)) return prev;

                  if (key === 'minOffspring') {
                      numValue = Math.max(0, Math.min(numValue, creatureBehavior.maxOffspring));
                  } else { // maxOffspring
                      numValue = Math.max(creatureBehavior.minOffspring, Math.min(numValue, 9));
                  }
                  (behavior as any)[key] = numValue;
              } else {
                  let numValue = parseFloat(value);
                  if (isNaN(numValue)) return prev;
                  numValue = getConstrainedBehaviorValue(key, numValue, behavior);
                  const isTimeValue = key.toLowerCase().includes('time') || key.toLowerCase().includes('cooldown') || key.toLowerCase().includes('lifespan') || key === 'growth';
                  (behavior as any)[key] = isTimeValue ? Math.round(numValue * 1000) : numValue;
              }
          }
          
          newConfig[typeName] = behavior;
          return newConfig;
      });
  };
  
    const handleDietChange = (typeName: string, eatenType: string, isChecked: boolean) => {
        setBehaviorConfig(prev => {
            const newConfig = { ...prev };
            const behavior = { ...newConfig[typeName] } as CreatureBehavior;
            if (!behavior || !behavior.eats) return prev;

            const newEats = isChecked
                ? [...behavior.eats, eatenType]
                : behavior.eats.filter(food => food !== eatenType);
            
            newConfig[typeName] = { ...behavior, eats: newEats };
            return newConfig;
        });
    };


  const handleCreateNewElement = (newElement: { name: string, appearance: any, behavior: any, type: ElementType }) => {
    const { name, appearance, behavior, type } = newElement;
    const newTypeName = name.replace(/\s+/g, '');

    if (behaviorConfig[newTypeName] || appearanceConfig[newTypeName]) {
        alert("An element with this name already exists.");
        return;
    }

    setAppearanceConfig(prev => ({ ...prev, [newTypeName]: { ...appearance, type } }));
    setBehaviorConfig(prev => ({ ...prev, [newTypeName]: behavior }));
    setInitialCounts(prev => ({ ...prev, [newTypeName]: 5 }));
    setShowCreationModal(false);
  };
  
  const handleDuplicate = (typeName: string) => {
    const configToCopy = {
      name: typeName,
      appearance: appearanceConfig[typeName],
      behavior: behaviorConfig[typeName],
    };
    setCopiedConfig(JSON.stringify(configToCopy, null, 2));
    setCopiedTypeName(typeName);
  };
  
  const handleDelete = (typeName: string) => {
      if (window.confirm(`Are you sure you want to delete "${typeName}"? This cannot be undone.`)) {
          setSelectedInfo(null);
          setAppearanceConfig(prev => {
              const newState = { ...prev };
              delete newState[typeName];
              return newState;
          });
          setBehaviorConfig(prev => {
              const newState = { ...prev };
              delete newState[typeName];
              // Clean up 'eats' arrays in other creatures
              for (const key in newState) {
                  const behavior = newState[key] as Partial<CreatureBehavior>;
                  if (behavior.eats) {
                      behavior.eats = behavior.eats.filter(food => food !== typeName);
                  }
              }
              return newState;
          });
          setInitialCounts(prev => {
              const newState = { ...prev };
              delete newState[typeName];
              return newState;
          });
      }
  };


  useEffect(() => {
    const timeoutId = setTimeout(handleReboot, 100);
    return () => { clearTimeout(timeoutId); cancelAnimationFrame(animationFrameId.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderInfoPopup = () => {
    if (!selectedInfo) return null;
    const typeName = selectedInfo;
    const appearance = appearanceConfig[typeName];
    const behavior = behaviorConfig[typeName];
    if (!appearance || !behavior) return null;

    const isCreature = appearance.type === ElementType.CREATURE;
    const creatureBehavior = isCreature ? behavior as CreatureBehavior : null;
    const plantBehavior = !isCreature ? behavior as PlantBehavior : null;

    const renderNumericField = (key: string, value: number, unit?: string) => {
      const isTimeValue = key.toLowerCase().includes('time') || key.toLowerCase().includes('cooldown') || key.toLowerCase().includes('lifespan') || key === 'growth';
      const displayValue = isTimeValue ? value / 1000 : value;
      const step = key.toLowerCase().includes('lifespan') ? 50 : (isTimeValue ? 5 : 1);
      
      return (
        <div key={key} className="flex justify-between items-center" title={behaviorTooltips[key]}>
          <label htmlFor={`${typeName}-${key}`} className="text-gray-800">{keyLabelMap[key]}:</label>
          <div className="flex items-center justify-end" style={{ width: '130px' }}>
            <input 
              type="number" 
              id={`${typeName}-${key}`} 
              value={displayValue} 
              step={step} 
              onChange={(e) => handleBehaviorChange(typeName, key, e.target.value)} 
              className="w-20 bg-gray-100 text-gray-800 text-right rounded focus:outline-none focus:ring-2 focus:ring-blue-400 px-2 py-0.5" 
            />
            <span className="ml-2 w-6 text-left text-gray-500">{unit}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="absolute top-4 left-44 bg-white text-gray-800 p-6 rounded-lg shadow-xl w-80 z-40 border border-gray-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start">
            <div className="space-y-2">
                <p><strong>Name:</strong> <span className="text-gray-600">{typeName}</span></p>
                <p><strong>Type:</strong> <span className="text-gray-600">{ElementType[appearance.type]}</span></p>
            </div>
            <div className="flex space-x-2">
                <button
                    onClick={() => handleDuplicate(typeName)}
                    className="p-2 rounded-md hover:bg-gray-200 text-gray-600 transition-colors"
                    title="Duplicate Element Config"
                >
                  {copiedTypeName === typeName ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  )}
                </button>
                <button
                    onClick={() => handleDelete(typeName)}
                    className="p-2 rounded-md hover:bg-red-100 text-gray-600 hover:text-red-600 transition-colors"
                    title="Delete Element"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>
        <h4 className="font-bold mt-4 mb-2 border-b border-gray-200 pb-2">Behavior</h4>
        <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center" title={behaviorTooltips['active']}>
                <label className="text-gray-800">Active:</label>
                <div className="flex items-center justify-end" style={{ width: '130px' }}>
                    <div className="flex items-center space-x-2">
                        <CustomCheckbox id={`${typeName}-dayActive`} checked={behavior.dayActive} onChange={(e) => handleBehaviorChange(typeName, 'dayActive', e.target.checked)}>
                           <span className="text-lg">☀</span>
                        </CustomCheckbox>
                         <CustomCheckbox id={`${typeName}-nightActive`} checked={behavior.nightActive} onChange={(e) => handleBehaviorChange(typeName, 'nightActive', e.target.checked)}>
                           <span className="text-lg">☾</span>
                        </CustomCheckbox>
                    </div>
                    <span className="ml-2 w-6" /> {/* Spacer for alignment */}
                </div>
            </div>
            {isCreature && creatureBehavior && (
                <>
                    {renderNumericField('speed', creatureBehavior.speed)}
                    {renderNumericField('lifespan', creatureBehavior.lifespan, 's')}
                    {renderNumericField('eatingCooldown', creatureBehavior.eatingCooldown, 's')}
                    {renderNumericField('starvationTime', creatureBehavior.starvationTime, 's')}
                    {renderNumericField('reproductionCooldown', creatureBehavior.reproductionCooldown, 's')}
                    <div className="flex justify-between items-center" title={behaviorTooltips['offspring']}>
                        <label className="text-gray-800">Offspring:</label>
                        <div className="flex items-center justify-end" style={{ width: '130px' }}>
                            <div className="flex items-center bg-gray-100 rounded focus-within:ring-2 focus-within:ring-blue-400 w-20 justify-center py-0.5">
                                <input type="number" value={creatureBehavior.minOffspring} onChange={(e) => handleBehaviorChange(typeName, 'minOffspring', e.target.value)} className="w-8 bg-transparent text-gray-800 text-right focus:outline-none" />
                                <span className="text-gray-500 mx-px">~</span>
                                <input type="number" value={creatureBehavior.maxOffspring} onChange={(e) => handleBehaviorChange(typeName, 'maxOffspring', e.target.value)} className="w-8 bg-transparent text-gray-800 text-left focus:outline-none" />
                            </div>
                            <span className="ml-2 w-6 text-left text-gray-500"></span>
                        </div>
                    </div>
                    {renderNumericField('maturationTime', creatureBehavior.maturationTime, 's')}
                </>
            )}
            {!isCreature && plantBehavior && (
                <>
                  {renderNumericField('lifespan', plantBehavior.lifespan, 's')}
                  {renderNumericField('growth', plantBehavior.growth, 's')}
                  {renderNumericField('range', plantBehavior.range)}
                  {renderNumericField('density', plantBehavior.density)}
                </>
            )}
        </div>
        {isCreature && creatureBehavior && (
            <>
                <h4 className="font-bold mt-4 mb-2 border-b border-gray-200 pb-2">Diet</h4>
                <div className="grid grid-cols-2 gap-2 text-sm max-h-24 overflow-y-auto pr-2">
                    {Object.keys(appearanceConfig).map(eatenTypeName => (
                        <div key={eatenTypeName}>
                            <label className="flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={creatureBehavior.eats.includes(eatenTypeName)} 
                                    onChange={(e) => handleDietChange(typeName, eatenTypeName, e.target.checked)} 
                                    className="mr-2 h-4 w-4 rounded text-blue-500 focus:ring-blue-400 border-gray-300"
                                />
                                {eatenTypeName}
                            </label>
                        </div>
                    ))}
                </div>
            </>
        )}
      </div>
    );
  };
  
  const customElementCount = Object.keys(appearanceConfig).length - Object.keys(initialAppearanceConfig).length;

  return (
    <div className="flex w-screen h-screen text-gray-800" style={{backgroundColor: '#EBEBEB'}}>
       <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
            <clipPath id="shape7-clip" clipPathUnits="objectBoundingBox">
                <circle cx="0.5" cy="0.7" r="0.3" />
                <circle cx="0.5" cy="0.3" r="0.2" />
            </clipPath>
            <clipPath id="shape10-clip" clipPathUnits="objectBoundingBox">
                <circle cx="0.5" cy="0.5" r="0.25" />
                <circle cx="0.5" cy="0.25" r="0.25" />
                <circle cx="0.738" cy="0.423" r="0.25" />
                <circle cx="0.647" cy="0.702" r="0.25" />
                <circle cx="0.353" cy="0.702" r="0.25" />
                <circle cx="0.262" cy="0.423" r="0.25" />
            </clipPath>
        </defs>
      </svg>
      <div className="w-40 flex-shrink-0 bg-[#CCCCCC] p-4 flex flex-col">
        <div className="flex-grow">
          <div className="space-y-6 pt-6">
            {Object.keys(appearanceConfig).map(typeName => {
                const appearance = appearanceConfig[typeName];
                const shapeStyle = getShapeStyle(appearance.shape);
                return (
                    <div className="flex items-center" key={typeName}>
                        <input type="number" min="0" max="99" value={initialCounts[typeName] || 0} onChange={(e) => handleCountChange(typeName, e.target.value)} onClick={(e) => e.stopPropagation()} className="w-14 bg-gray-100 text-gray-800 text-center rounded focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                        <div className="flex-1 flex justify-center">
                            <div onClick={() => setSelectedInfo(prev => prev === typeName ? null : typeName)} className="cursor-pointer" title={`${typeName} Info`}>
                                <div className="relative flex justify-center items-center" style={{ width: appearance.size, height: appearance.size }}>
                                    <div className="absolute w-full h-full" style={{ backgroundColor: appearance.color, ...shapeStyle }} />
                                    {appearance.type === ElementType.CREATURE && (
                                        <div className="absolute w-full h-full flex justify-center items-center">
                                          <div style={{ display: 'flex', gap: `${appearance.size / 8}px`, transform: 'translateX(20%)' }}>
                                              <div className="bg-black rounded-full" style={{ width: `${appearance.size / 5}px`, height: `${appearance.size / 5}px` }} />
                                              <div className="bg-black rounded-full" style={{ width: `${appearance.size / 5}px`, height: `${appearance.size / 5}px` }} />
                                          </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
            {customElementCount < MAX_CUSTOM_ELEMENTS && (
                <div className="flex justify-center pt-4">
                    <button onClick={() => setShowCreationModal(true)} className="flex items-center justify-center w-12 h-12 border-2 border-dashed border-gray-400 rounded-full text-gray-400 hover:border-gray-600 hover:text-gray-600 transition-colors" title="Create New Element">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                </div>
            )}
          </div>
        </div>
        <button onClick={handleReboot} className="w-full bg-[#FF6666] hover:bg-[#E55A5A] text-white font-bold py-2 px-4 rounded transition-colors">Reboot</button>
      </div>
      
      <div ref={containerRef} className="flex-grow h-full overflow-hidden relative" onClick={() => setSelectedInfo(null)}>
        {!isDay && <div className="absolute inset-0 bg-black opacity-50 z-20 pointer-events-none" />}
        {elements.map(element => {
          const typeName = element.elementType === ElementType.PLANT ? (element as Plant).plantType : (element as Creature).creatureType;
          const appearance = appearanceConfig[typeName];
          if (!appearance) return null;
          const shapeStyle = getShapeStyle(appearance.shape);

          if (element.elementType === ElementType.PLANT) {
            return <div key={element.id} className="absolute z-10" style={{ width: `${element.size}px`, height: `${element.size}px`, transform: `translate(${element.x}px, ${element.y}px)`, backgroundColor: appearance.color, ...shapeStyle }} />;
          } else {
            const creature = element as Creature;
            const behavior = behaviorConfig[creature.creatureType] as CreatureBehavior;
            const eyeSize = creature.size / 5;
            const eyeSpacing = creature.size / 8;
            const isSleeping = !creature.isDead && !((isDay && behavior?.dayActive) || (!isDay && behavior?.nightActive));
            const eyeStyle: React.CSSProperties = { width: `${eyeSize}px`, height: `${isSleeping ? eyeSize / 3 : eyeSize}px`, backgroundColor: creature.isDead ? 'rgba(0, 0, 0, 0.5)' : 'black' };
            const isFlipped = creature.vx < 0;

            return (
              <div key={element.id} className="absolute z-10" style={{ width: `${element.size}px`, height: `${element.size}px`, transform: `translate(${element.x}px, ${element.y}px)` }}>
                <div className="relative w-full h-full" style={{ transform: isFlipped ? 'scaleX(-1)' : 'none' }}>
                    <div 
                        className="absolute w-full h-full" 
                        style={{
                            backgroundColor: appearance.color,
                            ...shapeStyle,
                        }} 
                    />
                    <div className="absolute w-full h-full flex justify-center items-center">
                        <div style={{ transform: `translateX(20%)`, display: 'flex', gap: `${eyeSpacing}px`, alignItems: 'center' }}>
                            <div className={`${isSleeping ? '' : 'rounded-full'}`} style={eyeStyle} />
                            <div className={`${isSleeping ? '' : 'rounded-full'}`} style={eyeStyle} />
                        </div>
                    </div>
                </div>
              </div>
            );
          }
        })}
        <DayNightIndicator isDay={isDay} dayCount={dayCount} worldTime={worldTime} />
      </div>
      
      {selectedInfo && renderInfoPopup()}
      {showCreationModal && <CreationModal allElementTypes={Object.keys(appearanceConfig)} onSave={handleCreateNewElement} onCancel={() => setShowCreationModal(false)} copiedConfig={copiedConfig} getConstrainedValue={getConstrainedBehaviorValue} />}
    </div>
  );
};

const CreationModal = ({ allElementTypes, onSave, onCancel, copiedConfig, getConstrainedValue }: { allElementTypes: string[], onSave: (data: any) => void, onCancel: () => void, copiedConfig: string | null, getConstrainedValue: Function }) => {
    const [name, setName] = useState('');
    const [size, setSize] = useState(30);
    const [color, setColor] = useState('#aabbcc');
    const [shape, setShape] = useState('Shape2');
    const [type, setType] = useState<ElementType>(ElementType.CREATURE);
    const [isNameEditing, setIsNameEditing] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Behavior states
    const [plantBehavior, setPlantBehavior] = useState<PlantBehavior>({
        growth: 10000, range: 40, density: 5, dayActive: true, nightActive: false, lifespan: 120000,
    });
    const [creatureBehavior, setCreatureBehavior] = useState<Omit<CreatureBehavior, 'eats'>>({
        eatingCooldown: 15000, starvationTime: 75000, reproductionCooldown: 45000, maturationTime: 45000,
        minOffspring: 1, maxOffspring: 2, speed: 18, dayActive: true, nightActive: false, lifespan: 600000,
    });
    const [eats, setEats] = useState<string[]>([]);
    
    useEffect(() => {
        const randomNames = ['Baba', 'Poupou', 'Mumu', 'Lo', 'Pipi', 'Zuzu', 'Koko', 'Dodo', 'Nini', 'Riri', 'Bop', 'Yaya', 'Mimi', 'Ma'];
        const sizes = [10, 20, 30, 40, 50];
        
        setName(randomNames[Math.floor(Math.random() * randomNames.length)]);
        setSize(sizes[Math.floor(Math.random() * sizes.length)]);
        setColor('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'));
        setShape(shapeList[Math.floor(Math.random() * shapeList.length)]);
    }, []);

    useEffect(() => {
        if (isNameEditing) {
            nameInputRef.current?.focus();
            nameInputRef.current?.select();
        }
    }, [isNameEditing]);

    const handleSave = () => {
        if (!name.trim()) { alert("Please enter a name."); return; }
        const behavior = type === ElementType.PLANT ? plantBehavior : { ...creatureBehavior, eats };
        onSave({ name, appearance: { size, color, shape }, type, behavior });
    };

    const handleBehaviorChange = (behaviorType: 'plant' | 'creature', key: string, value: string | boolean) => {
        const setter = behaviorType === 'plant' ? setPlantBehavior : setCreatureBehavior;
        const currentBehavior = behaviorType === 'plant' ? plantBehavior : creatureBehavior;

        setter(prev => {
            const newBehavior = { ...prev };
            if (typeof value === 'boolean') {
                (newBehavior as any)[key] = value;
            } else {
                if (key === 'minOffspring' || key === 'maxOffspring') {
                    let numValue = parseInt(value, 10);
                    if (isNaN(numValue)) return prev;

                    if (key === 'minOffspring') {
                        numValue = Math.max(0, Math.min(numValue, (prev as any).maxOffspring));
                    } else { // maxOffspring
                        numValue = Math.max((prev as any).minOffspring, Math.min(numValue, 9));
                    }
                    (newBehavior as any)[key] = numValue;
                } else {
                    let numValue = parseFloat(value);
                    if (isNaN(numValue)) return prev;

                    numValue = getConstrainedValue(key, numValue, currentBehavior);
                    
                    const isTimeValue = key.toLowerCase().includes('time') || key.toLowerCase().includes('cooldown') || key.toLowerCase().includes('lifespan') || key === 'growth';
                    (newBehavior as any)[key] = isTimeValue ? Math.round(numValue * 1000) : numValue;
                }
            }
            return newBehavior as any;
        });
    }
    
    const handleEatsChange = (eatenType: string) => {
        setEats(prev => prev.includes(eatenType) ? prev.filter(t => t !== eatenType) : [...prev, eatenType]);
    }

    const handlePaste = () => {
        if (!copiedConfig) {
            alert("Nothing has been copied yet. Use the duplicate button on an element's info panel first.");
            return;
        }
        try {
            const data = JSON.parse(copiedConfig);

            if (!data.appearance || !data.behavior || !data.name) {
                alert("Invalid configuration format.");
                return;
            }

            const { name, appearance, behavior } = data;
            const { size, color, shape, type } = appearance;
            const behaviorData = behavior;

            setName(name);
            setSize(size);
            setColor(color);
            setShape(shape);
            setType(type);

            if (type === ElementType.PLANT) {
                setPlantBehavior(behaviorData);
            } else if (type === ElementType.CREATURE) {
                const { eats, ...restOfBehavior } = behaviorData;
                setCreatureBehavior(restOfBehavior);
                setEats(eats || []);
            }
        } catch (error) {
            alert("Failed to parse copied data.");
            console.error("Paste error:", error);
        }
    };

    const renderNumericField = (behaviorType: 'plant' | 'creature', key: string, value: number, unit?: string) => {
      const isTimeValue = key.toLowerCase().includes('time') || key.toLowerCase().includes('cooldown') || key.toLowerCase().includes('lifespan') || key === 'growth';
      const displayValue = isTimeValue ? value / 1000 : value;
      const step = key.toLowerCase().includes('lifespan') ? 50 : (isTimeValue ? 5 : 1);
      
      return (
        <div className="flex justify-between items-center" title={behaviorTooltips[key]}>
          <label htmlFor={`create-${key}`} className="text-gray-800">{keyLabelMap[key]}:</label>
          <div className="flex items-center justify-end" style={{ width: '130px' }}>
            <input 
              type="number" 
              id={`create-${key}`} 
              value={displayValue} 
              step={step} 
              onChange={(e) => handleBehaviorChange(behaviorType, key, e.target.value)} 
              className="w-20 bg-gray-100 text-gray-800 text-right rounded focus:outline-none focus:ring-2 focus:ring-blue-400 px-2 py-0.5" 
            />
            <span className="ml-2 w-6 text-left text-gray-500">{unit}</span>
          </div>
        </div>
      );
    }

    return (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onCancel}>
            <div className="bg-white p-8 rounded-lg shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={handlePaste}
                    disabled={!copiedConfig}
                    className="absolute top-4 right-4 p-2 rounded-md hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={copiedConfig ? "Paste Config" : "Copy an element's config first"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" fill="none" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2" />
                        <path fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 12h8a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-8a2 2 0 012-2z" />
                    </svg>
                </button>
                
                <div className="mb-4 flex flex-col items-center space-y-4 pt-8">
                    <input
                        ref={nameInputRef}
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onDoubleClick={() => setIsNameEditing(true)}
                        onBlur={() => setIsNameEditing(false)}
                        onKeyDown={(e) => { if (e.key === 'Enter') nameInputRef.current?.blur(); }}
                        readOnly={!isNameEditing}
                        className={`bg-transparent text-2xl font-bold text-center w-4/5 pb-1 border-b border-gray-400 focus:outline-none focus:ring-0 focus:border-blue-500 transition-colors ${isNameEditing ? 'cursor-text' : 'cursor-default'}`}
                        title="Double-click to edit name"
                    />
                    <div className="w-24 h-24 relative flex justify-center items-center">
                        <div 
                            className="relative"
                            style={{
                                width: `${size}px`,
                                height: `${size}px`,
                            }}
                        >
                           <div 
                                className="absolute w-full h-full"
                                style={{
                                  backgroundColor: color,
                                  ...getShapeStyle(shape),
                                }}
                           />
                            {type === ElementType.CREATURE && (
                                <div className="absolute w-full h-full flex justify-center items-center">
                                    <div style={{ transform: 'translateX(20%)', display: 'flex', gap: `${size / 8}px`, alignItems: 'center' }}>
                                        <div className="bg-black rounded-full" style={{ width: `${size / 5}px`, height: `${size / 5}px` }} />
                                        <div className="bg-black rounded-full" style={{ width: `${size / 5}px`, height: `${size / 5}px` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                     <div className="flex items-center space-x-6">
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="elementType" value={ElementType.CREATURE} checked={type === ElementType.CREATURE} onChange={e => setType(parseInt(e.target.value, 10))} className="form-radio mr-2" />
                            Creature
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="elementType" value={ElementType.PLANT} checked={type === ElementType.PLANT} onChange={e => setType(parseInt(e.target.value, 10))} className="form-radio mr-2" />
                            Plant
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {/* --- Column 1: Appearance & Type --- */}
                    <div className="space-y-4">
                        <h3 className="font-bold border-b pb-2">Appearance</h3>
                        <div>
                            <label className="block">Size</label>
                            <select value={size} onChange={e => setSize(parseInt(e.target.value, 10))} className="w-full p-2 border rounded bg-white">
                                <option value="10">10px</option><option value="20">20px</option><option value="30">30px</option><option value="40">40px</option><option value="50">50px</option>
                            </select>
                        </div>
                        <div><label className="block">Color</label><input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-10 p-1 border rounded"/></div>
                        <div>
                            <label className="block">Shape</label>
                            <div className="grid grid-cols-5 gap-2 mt-2">
                                {shapeList.map(shapeName => (
                                    <div 
                                        key={shapeName}
                                        onClick={() => setShape(shapeName)}
                                        className={`w-12 h-12 cursor-pointer flex items-center justify-center ${shape === shapeName ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-300'} rounded`}
                                    >
                                        <div 
                                            className="w-8 h-8 bg-gray-400"
                                            style={getShapeStyle(shapeName)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* --- Column 2: Behavior --- */}
                    <div className="space-y-2 text-sm">
                       <h3 className="font-bold border-b pb-2 mb-2">Behavior</h3>
                       {type === ElementType.PLANT && (
                        <div className="space-y-2">
                           <div className="flex justify-between items-center" title={behaviorTooltips['active']}>
                              <label>Active:</label>
                              <div className="flex items-center justify-end" style={{ width: '130px' }}>
                                  <div className="flex items-center space-x-2">
                                     <CustomCheckbox id="create-plant-dayActive" checked={plantBehavior.dayActive} onChange={e => handleBehaviorChange('plant', 'dayActive', e.target.checked)}>
                                       <span className="text-lg">☀</span>
                                     </CustomCheckbox>
                                     <CustomCheckbox id="create-plant-nightActive" checked={plantBehavior.nightActive} onChange={e => handleBehaviorChange('plant', 'nightActive', e.target.checked)}>
                                       <span className="text-lg">☾</span>
                                     </CustomCheckbox>
                                  </div>
                                  <span className="ml-2 w-6" />
                              </div>
                           </div>
                           {renderNumericField('plant', 'lifespan', plantBehavior.lifespan, 's')}
                           {renderNumericField('plant', 'growth', plantBehavior.growth, 's')}
                           {renderNumericField('plant', 'range', plantBehavior.range)}
                           {renderNumericField('plant', 'density', plantBehavior.density)}
                        </div>
                       )}
                       {type === ElementType.CREATURE && (
                        <div className="space-y-2">
                           <div className="flex justify-between items-center" title={behaviorTooltips['active']}>
                              <label>Active:</label>
                              <div className="flex items-center justify-end" style={{ width: '130px' }}>
                                  <div className="flex items-center space-x-2">
                                    <CustomCheckbox id="create-creature-dayActive" checked={creatureBehavior.dayActive} onChange={e => handleBehaviorChange('creature', 'dayActive', e.target.checked)}>
                                      <span className="text-lg">☀</span>
                                    </CustomCheckbox>
                                    <CustomCheckbox id="create-creature-nightActive" checked={creatureBehavior.nightActive} onChange={e => handleBehaviorChange('creature', 'nightActive', e.target.checked)}>
                                      <span className="text-lg">☾</span>
                                    </CustomCheckbox>
                                  </div>
                                  <span className="ml-2 w-6" />
                              </div>
                           </div>
                           {renderNumericField('creature', 'speed', creatureBehavior.speed)}
                           {renderNumericField('creature', 'lifespan', creatureBehavior.lifespan, 's')}
                           {renderNumericField('creature', 'eatingCooldown', creatureBehavior.eatingCooldown, 's')}
                           {renderNumericField('creature', 'starvationTime', creatureBehavior.starvationTime, 's')}
                           {renderNumericField('creature', 'reproductionCooldown', creatureBehavior.reproductionCooldown, 's')}
                           <div className="flex justify-between items-center" title={behaviorTooltips['offspring']}>
                               <label className="text-gray-800">Offspring:</label>
                               <div className="flex items-center justify-end" style={{ width: '130px' }}>
                                   <div className="flex items-center bg-gray-100 rounded focus-within:ring-2 focus-within:ring-blue-400 w-20 justify-center py-0.5">
                                       <input type="number" value={creatureBehavior.minOffspring} onChange={e => handleBehaviorChange('creature', 'minOffspring', e.target.value)} className="w-8 bg-transparent text-gray-800 text-right focus:outline-none" />
                                       <span className="text-gray-500 mx-px">~</span>
                                       <input type="number" value={creatureBehavior.maxOffspring} onChange={e => handleBehaviorChange('creature', 'maxOffspring', e.target.value)} className="w-8 bg-transparent text-gray-800 text-left focus:outline-none" />
                                   </div>
                                   <span className="ml-2 w-6 text-left text-gray-500"></span>
                               </div>
                           </div>
                           {renderNumericField('creature', 'maturationTime', creatureBehavior.maturationTime, 's')}
                           
                           <h3 className="font-bold border-b pb-2 pt-4">Diet</h3>
                           <div className="grid grid-cols-2 gap-2">
                              {allElementTypes.map(typeName => (
                                   <div key={typeName}><label className="flex items-center"><input type="checkbox" checked={eats.includes(typeName)} onChange={() => handleEatsChange(typeName)} className="mr-2"/>{typeName}</label></div>
                              ))}
                           </div>
                        </div>
                       )}
                    </div>
                </div>

                <div className="flex justify-center mt-8">
                    <button onClick={handleSave} className="w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-transform transform hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default App;