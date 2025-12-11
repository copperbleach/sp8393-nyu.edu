import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { EcosystemElement, ElementType, Plant, Creature, PlantBehavior, CreatureBehavior, PlantType, CreatureType, WorldEvent, ActiveEvent, ActiveEffect, LeaderboardEntry } from './types';
import { getLeaderboard, submitScore } from './leaderboardService';
import { getRandomNumber, distance, lerp, getShapeStyle } from './utils';
import {
    initialBehaviorConfig,
    initialAppearanceConfig,
    predefinedEvents,
    DEATH_DURATION,
    FULL_DAY_DURATION,
    DAY_DURATION,
    BABY_ORPHAN_SURVIVAL_TIME,
    MAX_TOTAL_ELEMENTS,
    PRECONFIGURED_API_KEY,
    behaviorTooltips,
    keyLabelMap
} from './config';

import LeaderboardModal from './components/LeaderboardModal';
import EventNotification from './components/EventNotification';
import CustomCheckbox from './components/CustomCheckbox';
import DayNightIndicator from './components/DayNightIndicator';
import RainOverlay from './components/RainOverlay';
import TextIOModal from './components/TextIOModal';
import ApiKeyModal from './components/ApiKeyModal';
import InstanceCounter from './components/InstanceCounter';
import BehaviorRulesTooltip from './components/BehaviorRulesTooltip';
import CreationModal from './components/CreationModal';


interface MutationConfig {
  albinismChance: number; // in percent, e.g., 0.001 for 0.001%
  cyclopsChance: number;  // in percent, e.g., 0.01 for 0.01%
}

const soundUrls = {
    babyBorn: 'https://cdn.jsdelivr.net/gh/copperbleach/sp8393-nyu.edu@main/Assets/Bob.wav',
    extinction: 'https://cdn.jsdelivr.net/gh/copperbleach/sp8393-nyu.edu@main/Assets/Bell.mp3',
    death: 'https://cdn.jsdelivr.net/gh/copperbleach/sp8393-nyu.edu@main/Assets/Fart.mp3',
    toxicGas: 'https://cdn.jsdelivr.net/gh/copperbleach/sp8393-nyu.edu@main/Assets/Spray.wav',
    teleport: 'https://cdn.jsdelivr.net/gh/copperbleach/sp8393-nyu.edu@main/Assets/Teleport.mp3',
    munch: 'https://cdn.jsdelivr.net/gh/copperbleach/sp8393-nyu.edu@main/Assets/Munch.wav',
};

const App: React.FC = () => {
  const [elements, setElements] = useState<EcosystemElement[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);
  const [initialCounts, setInitialCounts] = useState<Record<string, number>>({ 'GreenDot': 20, 'Fafa': 5, 'Keke': 2 });
  
  const [behaviorConfig, setBehaviorConfig] = useState<Record<string, PlantBehavior | CreatureBehavior>>(initialBehaviorConfig);
  const [simBehaviorConfig, setSimBehaviorConfig] = useState<Record<string, PlantBehavior | CreatureBehavior>>(initialBehaviorConfig);
  const simBehaviorConfigRef = useRef(initialBehaviorConfig);
  
  const [appearanceConfig, setAppearanceConfig] = useState(initialAppearanceConfig);
  const [simAppearanceConfig, setSimAppearanceConfig] = useState(initialAppearanceConfig);
  const simAppearanceConfigRef = useRef(initialAppearanceConfig);

  const [dayCount, setDayCount] = useState(1);
  const [isDay, setIsDay] = useState(true);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [worldTime, setWorldTime] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);
  const activeEventRef = useRef<ActiveEvent | null>(null);
  
  const [aiGeneratedEvents, setAIGeneratedEvents] = useState<WorldEvent[]>([]);
  const [isGeneratingEvent, setIsGeneratingEvent] = useState(false);
  const [isGeneratingEcosystem, setIsGeneratingEcosystem] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);

  const [mutationConfig, setMutationConfig] = useState<MutationConfig>({
    albinismChance: 0.001,
    cyclopsChance: 0.01,
  });

  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);

  const [textIOProps, setTextIOProps] = useState<{open: boolean, title: string, initialValue: string, mode: 'read' | 'write', onSave?: (val: string) => void}>({
    open: false, title: '', initialValue: '', mode: 'read'
  });
  
  const [isSimRunning, setIsSimRunning] = useState(true);
  const [showExtinctionSummary, setShowExtinctionSummary] = useState(false);
  const [lastRunDayCount, setLastRunDayCount] = useState(1);
  const [hadCreaturesInitially, setHadCreaturesInitially] = useState(false);
  const extinctionEventTriggeredRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(0);
  const lastUpdateTime = useRef<number>(0);
  const worldTimeRef = useRef(0);
  const gameLoopRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    activeEventRef.current = activeEvent;
  }, [activeEvent]);

  const getApiKey = useCallback(() => {
    const key = userApiKey || PRECONFIGURED_API_KEY;
    if (!key) {
        setShowApiModal(true);
        return null;
    }
    return key;
  }, [userApiKey]);

  const audioCache = useMemo(() => {
    const audioElements: { [key: string]: HTMLAudioElement } = {};
    for (const key in soundUrls) {
        audioElements[key] = new Audio(soundUrls[key as keyof typeof soundUrls]);
        audioElements[key].load(); // Pre-load the audio
    }
    return audioElements;
  }, []);

  const playSound = useCallback((sound: HTMLAudioElement) => {
    sound.currentTime = 0; // Rewind to start
    sound.play().catch(error => {
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        console.error("Error playing sound:", error);
      }
    });
  }, []);

  const playBabyBornSound = useCallback(() => playSound(audioCache.babyBorn), [playSound, audioCache]);
  const playExtinctionSound = useCallback(() => playSound(audioCache.extinction), [playSound, audioCache]);
  const playDeathSound = useCallback(() => playSound(audioCache.death), [playSound, audioCache]);
  const playToxicGasSound = useCallback(() => playSound(audioCache.toxicGas), [playSound, audioCache]);
  const playTeleportSound = useCallback(() => playSound(audioCache.teleport), [playSound, audioCache]);
  const playMunchSound = useCallback(() => playSound(audioCache.munch), [playSound, audioCache]);

  useEffect(() => {
    if (showExtinctionSummary) {
      playExtinctionSound();
    }
  }, [showExtinctionSummary, playExtinctionSound]);

  const createPlant = useCallback((plantType: PlantType, x: number, y: number, isInitial: boolean = false): Plant | null => {
    const appearance = simAppearanceConfigRef.current[plantType];
    const behavior = simBehaviorConfigRef.current[plantType] as PlantBehavior;
    
    if (!appearance || !behavior) return null;

    return {
      id: crypto.randomUUID(),
      elementType: ElementType.PLANT,
      plantType,
      x, y,
      size: appearance.size,
      birthTimestamp: performance.now(),
      lastGrowthTimestamp: isInitial ? performance.now() - getRandomNumber(0, behavior.growth) : performance.now(),
    };
  }, []);

  const createCreature = useCallback((creatureType: CreatureType, x: number, y: number, isBaby: boolean = false, parentId?: string): Creature | null => {
    const now = performance.now();
    const appearance = simAppearanceConfigRef.current[creatureType];
    const behavior = simBehaviorConfigRef.current[creatureType] as CreatureBehavior;

    if (!appearance || !behavior) return null;

    let creatureColor: string | undefined;
    let creatureEyeColor: string | undefined;
    let creatureIsCyclops: boolean = false;

    if (isBaby) {
      if (Math.random() * 100 < Number(mutationConfig.albinismChance)) {
        creatureColor = 'white';
        creatureEyeColor = 'red';
      }
      if (Math.random() * 100 < Number(mutationConfig.cyclopsChance)) {
        creatureIsCyclops = true;
      }
    }

    return {
      id: crypto.randomUUID(),
      elementType: ElementType.CREATURE,
      creatureType,
      x, y,
      size: isBaby ? appearance.size / 2 : appearance.size,
      lastAteTimestamp: now, lastReproducedTimestamp: now, birthTimestamp: now,
      isBaby, isDead: false, parentId,
      vx: getRandomNumber(-1, 1), vy: getRandomNumber(-1, 1),
      color: creatureColor,
      eyeColor: creatureEyeColor,
      isCyclops: creatureIsCyclops,
      lastSpecialUsed: {},
    };
  }, [mutationConfig]);

  const processGlobalPaste = (text: string) => {
    try {
        const config = JSON.parse(text);
        if (config.initialCounts && config.appearanceConfig && config.behaviorConfig) {
            setInitialCounts(config.initialCounts as Record<string, number>);
            setAppearanceConfig(config.appearanceConfig as typeof initialAppearanceConfig);
            setBehaviorConfig(config.behaviorConfig as Record<string, PlantBehavior | CreatureBehavior>);
            if (config.mutationConfig) {
              setMutationConfig(config.mutationConfig as MutationConfig);
            }
            alert("Configuration imported! Click Reboot to apply.");
        } else {
            alert("Invalid configuration format.");
        }
    } catch (err) {
        console.error("Failed to parse pasted config: ", err);
        alert("Invalid JSON");
    }
  };

  const gameLoop = useCallback(() => {
    if (!isSimRunning) {
        cancelAnimationFrame(animationFrameId.current);
        return;
    }
    const now = performance.now();
    if (lastUpdateTime.current === 0) { lastUpdateTime.current = now; animationFrameId.current = requestAnimationFrame(() => gameLoopRef.current?.()); return; }
    const deltaTime = (now - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = now;
    
    if (activeEventRef.current && (now - activeEventRef.current.startTime) >= activeEventRef.current.duration * 1000) {
      setActiveEvent(null);
    }
    
    setActiveEffects(prev => prev.filter(effect => now - effect.startTime < effect.duration));

    worldTimeRef.current += deltaTime * 1000;
    setWorldTime(worldTimeRef.current);
    const newDayCount = Math.floor(worldTimeRef.current / FULL_DAY_DURATION) + 1;
    const newIsDay = (worldTimeRef.current % FULL_DAY_DURATION) < DAY_DURATION;

    setDayCount(current => newDayCount !== current ? newDayCount : current);
    setIsDay(current => newIsDay !== current ? newIsDay : current);

    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) { animationFrameId.current = requestAnimationFrame(() => gameLoopRef.current?.()); return; }
    
    setElements(prevElements => {
      const elementsToAdd: EcosystemElement[] = [];
      const idsToRemove = new Set<string>();
      const elementMap: Map<string, EcosystemElement> = new Map(prevElements.map(el => [el.id, el]));
      
      const eventEffect = activeEventRef.current?.effect;

      for (const element of prevElements) {
        if (idsToRemove.has(element.id)) continue;
        let updatedElement = { ...element };

        if (element.elementType === ElementType.PLANT) {
          const plant = { ...updatedElement } as Plant;
          const behavior = simBehaviorConfigRef.current[plant.plantType] as PlantBehavior;
          const appearance = simAppearanceConfigRef.current[plant.plantType];
          
          if (!behavior || !appearance) {
              idsToRemove.add(plant.id);
              continue;
          }

          if (now - plant.birthTimestamp > behavior.lifespan) {
            idsToRemove.add(plant.id);
            continue;
          }

          if (eventEffect === 'PLANT_SIZE_PULSE') {
            const baseSize = appearance.size;
            plant.size = baseSize + Math.sin(now / 200) * (baseSize * 0.25);
          } else {
             plant.size = appearance.size;
          }

          const isActive = (newIsDay && behavior.dayActive) || (!newIsDay && behavior.nightActive);

          if (isActive && now - plant.lastGrowthTimestamp > behavior.growth) {
            const nearbyPlants = prevElements.filter(e => e.elementType === ElementType.PLANT && distance(plant, e) < behavior.range);
            if (nearbyPlants.length < behavior.density) {
              const angle = Math.random() * 2 * Math.PI;
              const newX = plant.x + Math.cos(angle) * getRandomNumber(plant.size, behavior.range);
              const newY = plant.y + Math.sin(angle) * getRandomNumber(plant.size, behavior.range);
              
              const newPlant = createPlant(plant.plantType,
                Math.max(0, Math.min(bounds.width - plant.size, newX)), 
                Math.max(0, Math.min(bounds.height - plant.size, newY))
              );
              if (newPlant) {
                elementsToAdd.push(newPlant);
                plant.lastGrowthTimestamp = now;
              }
            }
          }
          updatedElement = plant;
        } else if (element.elementType === ElementType.CREATURE) {
          let creature = { ...updatedElement } as Creature;
          const behavior = simBehaviorConfigRef.current[creature.creatureType] as CreatureBehavior; // Cast to specific
          const appearance = simAppearanceConfigRef.current[creature.creatureType];
          
          if (!behavior || !appearance) {
              idsToRemove.add(creature.id);
              continue;
          }
          
          const isHibernating = creature.hibernationEndTime && now < creature.hibernationEndTime;
          const hasSpikes = creature.spikeEndTime && now < creature.spikeEndTime;

          if (eventEffect === 'CREATURE_SPEED_BOOST') behavior.speed *= 2;
          if (eventEffect === 'REPRODUCTION_BOOST') behavior.reproductionCooldown *= 0.5;

          if (creature.isDead && creature.deathTimestamp && now - creature.deathTimestamp > DEATH_DURATION) {
             idsToRemove.add(creature.id);
             continue;
          }
          
          if (!creature.isDead) {
              if (now - creature.birthTimestamp > behavior.lifespan) {
                  creature = {...creature, isDead: true, deathTimestamp: now, vx: 0, vy: 0};
                  playDeathSound();
              } else if (!isHibernating && !creature.isBaby && now - creature.lastAteTimestamp > behavior.starvationTime) {
                  creature = {...creature, isDead: true, deathTimestamp: now, vx: 0, vy: 0};
                  playDeathSound();
              } else if (creature.isBaby) {
                  const parent = creature.parentId ? elementMap.get(creature.parentId) : null;
                  if (!parent) {
                      if (!creature.orphanTimestamp) {
                          creature = {...creature, orphanTimestamp: now, parentId: undefined};
                      } else if (now - creature.orphanTimestamp > BABY_ORPHAN_SURVIVAL_TIME) {
                          creature = {...creature, isDead: true, deathTimestamp: now, vx: 0, vy: 0};
                          playDeathSound();
                      }
                  }
              }
          }

          if (!creature.isDead) {
            const isActive = !isHibernating && (eventEffect === 'ALL_CREATURES_ACTIVE' || (newIsDay && behavior.dayActive) || (!newIsDay && behavior.nightActive));

            if (isActive && behavior.specials) {
              for (const special of behavior.specials) {
                if (!special.enabled) continue;
                const lastUsed = creature.lastSpecialUsed?.[special.type] || 0;
                if (now - lastUsed > special.cooldown && Math.random() < 0.005) {
                    creature.lastSpecialUsed = { ...creature.lastSpecialUsed, [special.type]: now };
                    if (special.type === 'TOXIC_GAS') {
                        playToxicGasSound();
                        setActiveEffects(prev => [...prev, { id: crypto.randomUUID(), type: 'TOXIC_GAS', x: creature.x, y: creature.y, size: creature.size * 2, startTime: now, duration: special.duration }]);
                        const radius = creature.size; // reduced radius
                        prevElements.forEach(other => {
                            if (other.id !== creature.id && distance(creature, other) < radius) {
                                if (other.elementType === ElementType.CREATURE) {
                                    const otherCreature = elementMap.get(other.id) as Creature;
                                    if(otherCreature && !otherCreature.isDead) {
                                        elementMap.set(other.id, {...otherCreature, isDead: true, deathTimestamp: now, vx: 0, vy: 0});
                                        playDeathSound();
                                    }
                                } else {
                                    idsToRemove.add(other.id);
                                }
                            }
                        });
                    } else if (special.type === 'TELEPORTATION') {
                        playTeleportSound();
                        const newX = getRandomNumber(0, bounds.width - creature.size);
                        const newY = getRandomNumber(0, bounds.height - creature.size);
                        setActiveEffects(prev => [...prev, { id: crypto.randomUUID(), type: 'TELEPORTATION', x: creature.x, y: creature.y, endX: newX, endY: newY, size: creature.size, startTime: now, duration: special.duration, creatureId: creature.id }]);
                        creature.x = newX;
                        creature.y = newY;
                        creature.vx = getRandomNumber(-1, 1);
                        creature.vy = getRandomNumber(-1, 1);
                    } else if (special.type === 'HIBERNATION') {
                        creature.hibernationEndTime = now + special.duration;
                    } else if (special.type === 'SPIKE') {
                        creature.spikeEndTime = now + special.duration;
                    }
                }
              }
            }

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
                    
                    const diet = (simBehaviorConfigRef.current[creature.creatureType] as CreatureBehavior).eats;
                    if (!diet) return false; // Safety check

                    if (other.elementType === ElementType.PLANT) {
                        return diet.includes(other.plantType);
                    } else if (other.elementType === ElementType.CREATURE) {
                        if ((other as Creature).spikeEndTime && now < (other as Creature).spikeEndTime) return false;
                        return !(other as Creature).isDead && diet.includes(other.creatureType);
                    }
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
                   if (isHungry) { 
                      const targetCreature = target as Creature;
                      const canEat = !(targetCreature.spikeEndTime && now < targetCreature.spikeEndTime);
                      if (canEat) {
                        idsToRemove.add(target.id); creature = {...creature, lastAteTimestamp: now, targetId: undefined}; 
                        playMunchSound();
                      } else {
                        creature.targetId = undefined;
                      }
                   } 
                   else if (isReadyToMate && target.elementType === ElementType.CREATURE) {
                      const mate = target as Creature;
                      const mateBehavior = simBehaviorConfigRef.current[mate.creatureType] as CreatureBehavior;
                      if (mateBehavior && now - mate.lastReproducedTimestamp > mateBehavior.reproductionCooldown) {
                        const offspringCount = Math.floor(getRandomNumber(behavior.minOffspring, behavior.maxOffspring + 1));
                        if (offspringCount > 0) playBabyBornSound();
                        for (let i = 0; i < offspringCount; i++) {
                          const newborn = createCreature(creature.creatureType, creature.x, creature.y, true, creature.id);
                          if (newborn) elementsToAdd.push(newborn);
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

      const nextElements = [...Array.from(elementMap.values()).filter(el => !idsToRemove.has(el.id)), ...elementsToAdd];
      const livingCreatures = nextElements.filter(el => el.elementType === ElementType.CREATURE && !(el as Creature).isDead);
      
      if (hadCreaturesInitially && livingCreatures.length === 0 && !extinctionEventTriggeredRef.current) {
        extinctionEventTriggeredRef.current = true;
        setLastRunDayCount(newDayCount);
        setIsSimRunning(false);
        setShowExtinctionSummary(true);
      }
      
      return nextElements;
    });
    animationFrameId.current = requestAnimationFrame(() => gameLoopRef.current?.());
  }, [createCreature, createPlant, playBabyBornSound, isSimRunning, hadCreaturesInitially, playDeathSound, playToxicGasSound, playTeleportSound, playMunchSound]);

  useEffect(() => {
    gameLoopRef.current = gameLoop;
  }, [gameLoop]);

  const handleReboot = () => {
    const configToSave = {
        initialCounts,
        appearanceConfig,
        behaviorConfig,
        mutationConfig,
    };
    localStorage.setItem('webEcosystemSimulator_lastConfig', JSON.stringify(configToSave, null, 2));

    setSimBehaviorConfig(behaviorConfig);
    simBehaviorConfigRef.current = behaviorConfig;
    
    setSimAppearanceConfig(appearanceConfig);
    simAppearanceConfigRef.current = appearanceConfig;

    extinctionEventTriggeredRef.current = false;
    setIsSimRunning(true);
    setShowExtinctionSummary(false);

    cancelAnimationFrame(animationFrameId.current);
    worldTimeRef.current = 0; 
    setWorldTime(0);
    setDayCount(1); 
    setIsDay(true);
    setActiveEvent(null);
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const initialElements: EcosystemElement[] = [];
      let hasCreatures = false;
      Object.entries(initialCounts).forEach(([typeName, count]) => {
        const appearance = appearanceConfig[typeName];
        if (!appearance || count === 0) return;
        if (appearance.type === ElementType.CREATURE) {
            hasCreatures = true;
        }
        for (let i = 0; i < count; i++) {
          const x = getRandomNumber(0, width - appearance.size);
          const y = getRandomNumber(0, height - appearance.size);
          if (appearance.type === ElementType.PLANT) {
            const p = createPlant(typeName, x, y, true);
            if (p) initialElements.push(p);
          } else {
            const c = createCreature(typeName, x, y);
            if (c) initialElements.push(c);
          }
        }
      });
      setHadCreaturesInitially(hasCreatures);
      setElements(initialElements);
      lastUpdateTime.current = performance.now();
      animationFrameId.current = requestAnimationFrame(() => gameLoopRef.current?.());
    }
  };

  const handleGlobalCopy = () => {
    const config = {
        initialCounts,
        appearanceConfig,
        behaviorConfig,
        mutationConfig,
    };
    const json = JSON.stringify(config, null, 2);

    navigator.clipboard.writeText(json)
        .then(() => alert("Ecosystem DNA copied to clipboard!"))
        .catch(() => {
            setTextIOProps({
                open: true,
                title: "Copy Ecosystem DNA",
                initialValue: json,
                mode: 'write'
            });
        });
  };

  const handleGlobalPaste = async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            processGlobalPaste(text);
            return;
        }
    } catch (err) { /* Fail silently, open modal */ }
    
    setTextIOProps({
        open: true,
        title: "Paste Ecosystem DNA",
        initialValue: "",
        mode: 'read',
        onSave: (text) => {
            processGlobalPaste(text);
            setTextIOProps(prev => ({...prev, open: false}));
        }
    });
  };

  const handleExportEvents = () => {
    if (!activeEvent) {
        alert("No active event to export.");
        return;
    }
    const now = performance.now();
    const elapsed = (now - activeEvent.startTime) / 1000;
    const remainingDuration = Math.max(0, activeEvent.duration - elapsed);
    
    const exportableEvent = {
        ...activeEvent,
        remainingDuration,
        startTime: undefined,
        id: undefined
    };
    
    const json = JSON.stringify([exportableEvent], null, 2);

    navigator.clipboard.writeText(json)
        .then(() => alert("Active event copied to clipboard!"))
        .catch(() => {
            setTextIOProps({
                open: true,
                title: "Copy Active Event",
                initialValue: json,
                mode: 'write'
            });
        });
  };

  const processImportedEvents = (text: string) => {
    try {
      const importedData = JSON.parse(text);
      const eventsToImport = Array.isArray(importedData) ? importedData : [importedData];

      if (eventsToImport.length === 0) {
          alert("No events found in the imported data.");
          return;
      }
      
      const newEvents: WorldEvent[] = [];
      for (const eventData of eventsToImport) {
          if (eventData.name && eventData.description && typeof eventData.duration === 'number' && eventData.effect) {
              const newEvent: WorldEvent = {
                  name: eventData.name,
                  description: eventData.description,
                  duration: eventData.duration,
                  effect: eventData.effect,
                  visualOverlayColor: eventData.visualOverlayColor,
              };
              newEvents.push(newEvent);
          } else {
              console.warn("Skipping invalid event object during import:", eventData);
          }
      }

      if (newEvents.length > 0) {
          setAIGeneratedEvents(prev => [...prev, ...newEvents]);
          alert(`${newEvents.length} event(s) imported successfully and added to the debug list!`);
      } else {
          alert("Could not find any valid events to import in the provided data.");
      }
    } catch (err) {
      console.error("Failed to parse event data: ", err);
      alert("Invalid JSON or event data format.");
    }
  };


  const handleImportEvents = async () => {
      try {
          const text = await navigator.clipboard.readText();
          if (text) {
              processImportedEvents(text);
              return;
          }
      } catch (err) { /* Fail silently, open modal */ }

      setTextIOProps({
          open: true,
          title: "Import Event(s) to List",
          initialValue: "",
          mode: 'read',
          onSave: (text) => {
              processImportedEvents(text);
              setTextIOProps(prev => ({...prev, open: false}));
          }
      });
  };
  
  const handleCountChange = (type: string, value: string) => {
    const num = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(num)) return;
    const clampedValue = Math.max(0, Math.min(99, num));
    setInitialCounts(prev => ({ ...prev, [type]: clampedValue }));
  };
  
  const getConstrainedBehaviorValue = (key: string, value: number, behavior: CreatureBehavior | PlantBehavior | Omit<CreatureBehavior, 'eats'>): number => {
      const isCreature = 'speed' in behavior;
      const creatureBehavior = isCreature ? (behavior as CreatureBehavior) : null;
      let finalValue = value;

      let minBound = -Infinity;
      let maxBound = Infinity;

      switch(key) {
          case 'speed': minBound = 1; maxBound = 99; break;
          case 'lifespan':
              if (creatureBehavior) {
                  minBound = 30; maxBound = 3600;
                  minBound = Math.max(minBound, (creatureBehavior.starvationTime / 1000) + 0.001, (creatureBehavior.reproductionCooldown / 1000) + 0.001, (creatureBehavior.maturationTime / 1000) + 0.001);
              } else { // Is a plant
                  minBound = 1; maxBound = 3600;
              }
              break;
          case 'growth':
              if (!isCreature) { minBound = 5; maxBound = 360; }
              break;
          case 'range':
              if (!isCreature) { minBound = 10; maxBound = 60; }
              break;
          case 'density':
              if (!isCreature) { minBound = 1; maxBound = 10; }
              break;
          case 'eatingCooldown':
              minBound = 5; maxBound = 180;
              if (creatureBehavior) maxBound = Math.min(maxBound, (creatureBehavior.starvationTime / 1000) - 0.001);
              break;
          case 'starvationTime':
              minBound = 10; maxBound = 180;
              if (creatureBehavior) {
                  maxBound = Math.min(maxBound, (creatureBehavior.lifespan / 1000) - 0.001);
                  minBound = Math.max(minBound, (creatureBehavior.eatingCooldown / 1000) + 0.001);
              }
              break;
          case 'reproductionCooldown':
              minBound = 5; maxBound = 1200;
              if (creatureBehavior) {
                  maxBound = Math.min(maxBound, (creatureBehavior.lifespan / 1000) - 0.001);
              }
              break;
           case 'maturationTime':
              minBound = 0; maxBound = 2400;
              if (creatureBehavior) maxBound = Math.min(maxBound, (creatureBehavior.lifespan / 1000) - 0.001);
              break;
          default: minBound = 0; break;
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

                  if (key === 'minOffspring') numValue = Math.max(0, Math.min(numValue, creatureBehavior.maxOffspring));
                  else numValue = Math.max(creatureBehavior.minOffspring, Math.min(numValue, 9));
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

    const handleBehaviorSpecialChange = (typeName: string, specialType: string, key: 'enabled' | 'duration' | 'cooldown', value: boolean | string) => {
        setBehaviorConfig(prev => {
            const newConfig = { ...prev };
            const behavior = { ...newConfig[typeName] } as CreatureBehavior;
            if (!behavior) return prev;

            let specials = behavior.specials ? behavior.specials.map(s => ({...s})) : [];
            let specialIndex = specials.findIndex(s => s.type === specialType);

            if (specialIndex === -1) {
                return prev;
            }
            
            let updatedSpecial = { ...specials[specialIndex] };

            if (key === 'enabled' && typeof value === 'boolean') {
                updatedSpecial.enabled = value;
            } else if ((key === 'duration' || key === 'cooldown') && typeof value === 'string') {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    updatedSpecial[key] = Math.round(numValue * 1000); // Store as ms
                }
            }

            specials[specialIndex] = updatedSpecial;
            newConfig[typeName] = { ...behavior, specials };
            return newConfig;
        });
    };
  
  const handleDietChange = (typeName: string, eatenType: string, isChecked: boolean) => {
      setBehaviorConfig(prev => {
          const newConfig = { ...prev };
          const behavior = { ...newConfig[typeName] } as CreatureBehavior;
          if (!behavior || !behavior.eats) return prev;
          const newEats = isChecked ? [...behavior.eats, eatenType] : behavior.eats.filter(food => food !== eatenType);
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
  
  const handleCopyElementDNA = (typeName: string) => {
    const configToCopy = {
      name: typeName,
      appearance: appearanceConfig[typeName],
      behavior: behaviorConfig[typeName],
    };
    const json = JSON.stringify(configToCopy, null, 2);
    
    navigator.clipboard.writeText(json).then(() => {
        alert("Element DNA copied to clipboard!");
    }).catch(() => {
        setTextIOProps({
            open: true,
            title: `Copy DNA: ${typeName}`,
            initialValue: json,
            mode: 'write'
        });
    });
  };
  
  const handleDelete = (typeName: string) => {
      if (window.confirm(`Are you sure you want to delete "${typeName}"? This cannot be undone.`)) {
          setSelectedInfo(null);
          setAppearanceConfig(prev => { const newState = { ...prev }; delete newState[typeName]; return newState; });
          setBehaviorConfig(prev => {
              const newState = { ...prev };
              delete newState[typeName];
              Object.keys(newState).forEach(key => {
                  const behavior = newState[key] as CreatureBehavior;
                  if ((behavior as any).eats?.includes(typeName)) {
                      newState[key] = { ...behavior, eats: (behavior as any).eats.filter((food: string) => food !== typeName) };
                  }
              });
              return newState;
          });
          setInitialCounts(prev => { const newState = { ...prev }; delete newState[typeName]; return newState; });
      }
  };

  const triggerEvent = useCallback((eventToTrigger: WorldEvent) => {
    if (activeEventRef.current) return;

    setActiveEvent({
      ...eventToTrigger,
      id: crypto.randomUUID(),
      startTime: performance.now(),
    });

    if (eventToTrigger.effect === 'PLANT_GROWTH_BOOST') {
      setElements(prev => prev.map(el => el.elementType === ElementType.PLANT ? { ...el, lastGrowthTimestamp: el.lastGrowthTimestamp - 10000 } as Plant : el));
    } else if (eventToTrigger.effect === 'PLANT_CULL') {
      setElements(prev => {
          const creatures = prev.filter(e => e.elementType === ElementType.CREATURE);
          const plants = prev.filter(e => e.elementType === ElementType.PLANT);
          const survivedPlants = plants.filter(() => Math.random() < 0.2);
          return [...creatures, ...survivedPlants];
      });
    }
  }, []);
  
  const handleGenerateAIEvent = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) return;

    setIsGeneratingEvent(true);
    try {
        const ai = new GoogleGenAI({ apiKey });

        const allCurrentEvents = [...predefinedEvents, ...aiGeneratedEvents];
        const existingEventsString = allCurrentEvents.length > 0
            ? `Here is a list of existing events in JSON format. Do not create an event that is the same or too similar to these:\n${JSON.stringify(allCurrentEvents, null, 2)}`
            : "There are currently no predefined events.";

        const prompt = `You are an AI assistant for a web-based ecosystem simulator. Your task is to invent a new world event that is unique and different from existing ones.

        ${existingEventsString}

        Now, create a new, unique event. Follow these rules:
        1. The event must have a creative Title (name) and a brief Description.
        2. The event's duration must be a number between 15 and 75 seconds.
        3. The event must not kill all creatures or all plants. It should be balanced.
        4. The event must have an 'effect' chosen from this list: 'CREATURE_SPEED_BOOST', 'PLANT_SIZE_PULSE', 'REPRODUCTION_BOOST', 'PLANT_GROWTH_BOOST', 'ALL_CREATURES_ACTIVE', 'PLANT_CULL'.
        5. The event must have a 'visualOverlayColor' as an RGBA string.

        Return your response as a single JSON object. Do not include any other text or markdown.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                        duration: { type: Type.INTEGER },
                        effect: { type: Type.STRING, enum: ['CREATURE_SPEED_BOOST', 'PLANT_SIZE_PULSE', 'REPRODUCTION_BOOST', 'PLANT_GROWTH_BOOST', 'ALL_CREATURES_ACTIVE', 'PLANT_CULL'] },
                        visualOverlayColor: { type: Type.STRING },
                    },
                    required: ['name', 'description', 'duration', 'effect', 'visualOverlayColor'],
                },
            },
        });

        const responseText = response.text;
        if (!responseText) {
            throw new Error("AI response was empty.");
        }
        const eventJson = JSON.parse(responseText);
        
        if (eventJson.name && eventJson.description && eventJson.duration) {
            setAIGeneratedEvents(prev => [...prev, eventJson]);
        } else {
            throw new Error("Invalid event format from AI.");
        }
    } catch (error) {
        console.error("Error generating AI event:", error);
        alert("Failed to generate an AI event. Please check the console for details.");
    } finally {
        setIsGeneratingEvent(false);
    }
  }, [getApiKey, aiGeneratedEvents]);

    const handleGenerateAIEcosystem = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) return;
    
    setIsGeneratingEcosystem(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const referenceExample = [
        {
          "name": "Sunpetal",
          "initialCount": 30,
          "appearance": { "size": 15, "color": "#9FE2BF", "shape": "Shape1", "type": "0" },
          "behavior": { "dayActive": true, "nightActive": false, "lifespan": 120000, "growth": 10000, "range": 40, "density": 5 }
        },
        {
           "name": "LeafHopper",
           "initialCount": 10,
           "appearance": { "size": 25, "color": "#B5C87E", "shape": "Shape2", "type": "1" },
           "behavior": { "dayActive": true, "nightActive": false, "lifespan": 180000, "eatingCooldown": 10000, "starvationTime": 50000, "reproductionCooldown": 40000, "maturationTime": 20000, "minOffspring": 1, "maxOffspring": 3, "speed": 20, "eats": ["Sunpetal"] }
        },
        {
            "name": "ApexStalker",
            "initialCount": 4,
            "appearance": { "size": 45, "color": "#FF6B6B", "shape": "Shape5", "type": "1" },
            "behavior": { "dayActive": true, "nightActive": true, "lifespan": 300000, "eatingCooldown": 25000, "starvationTime": 120000, "reproductionCooldown": 90000, "maturationTime": 45000, "minOffspring": 1, "maxOffspring": 2, "speed": 30, "eats": ["LeafHopper"], "specials": [{ "type": "TELEPORTATION", "name": "Blink", "description": "Teleports.", "enabled": true, "duration": 500, "cooldown": 30000 }] }
        }
      ];

      const prompt = `You are an AI assistant for a web-based ecosystem simulator. Your task is to invent a complete, balanced ecosystem with exactly 6 unique elements (a mix of plants and creatures).

The ecosystem must form a stable food web:
- Plants produce food.
- Herbivores eat plants.
- Carnivores/omnivores eat other creatures.

You must assign each element a shape from the available set: 'Shape1' through 'Shape10'. Use a varied selection across the 6 elements.

====================================================================
### RULES FOR PLANTS
For any element with "type": "0":
- 1 ≤ Lifespan ≤ 3600 seconds
- 5 ≤ Growth ≤ 360 seconds
- 10 ≤ Range ≤ 60
- 1 ≤ Density ≤ 10

Convert all durations to MILLISECONDS.

AI-generated plant **starting population** MUST be between **10 and 30**.

====================================================================
### RULES FOR CREATURES
For any element with "type": "1":
- 1 ≤ Speed ≤ 99
- 30 ≤ Lifespan ≤ 3600 seconds
- 5 ≤ Hunger ≤ 180 seconds
- 10 ≤ Starvation ≤ 180 seconds
- 5 ≤ Reproduction ≤ 1200 seconds
- Offspring count must be a small range (e.g., "1~3")
- Maturation < Lifespan
- Hunger < Starvation < Lifespan
- Reproduction < Lifespan

Convert all durations to MILLISECONDS.

AI-generated creature **starting population** MUST be between **2 and 10**.

====================================================================
### SPECIAL ABILITIES
You may assign **special abilities to at most two creatures**.
Allowed special types (ONLY):
- 'TOXIC_GAS'
- 'TELEPORTATION'
- 'HIBERNATION'
- 'SPIKE'

If a creature has a special ability:
Add to its "behavior" object:
"specials": [
  {
    "type": "<SPECIAL_NAME>",
    "enabled": true,
    "duration": <milliseconds>,
    "cooldown": <milliseconds>
  }
]

Duration and cooldown values must follow reasonable ranges, inspired by the reference example.

====================================================================
### TIME UNITS
ALL timing values (lifespan, growth, hunger, cooldowns, etc.) MUST be in MILLISECONDS.
Example: 30 seconds = 30000.

====================================================================
### OUTPUT FORMAT REQUIREMENTS
Return a single JSON object with one root key:
{
  "ecosystem": [ ...6 elements... ]
}

Do NOT include any other text or markdown.

For the 'type' property:
- "0" = PLANT
- "1" = CREATURE
(The type MUST be a string.)

====================================================================
### REFERENCE EXAMPLE (subset)
${JSON.stringify(referenceExample)}

Ensure all configuration values are within reasonable bounds similar to the reference example.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ecosystem: {
                type: Type.ARRAY,
                description: "An array of 6 unique elements representing a balanced ecosystem.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Unique name for the element." },
                    appearance: {
                      type: Type.OBJECT,
                      properties: {
                        size: { type: Type.INTEGER },
                        color: { type: Type.STRING },
                        shape: { type: Type.STRING, enum: ['Shape1', 'Shape2', 'Shape3', 'Shape4', 'Shape5', 'Shape6', 'Shape7', 'Shape8', 'Shape9', 'Shape10'] },
                        type: { type: Type.STRING, enum: ['0', '1'] },
                      },
                      required: ['size', 'color', 'shape', 'type']
                    },
                    behavior: {
                      type: Type.OBJECT,
                      properties: {
                        growth: { type: Type.INTEGER },
                        range: { type: Type.INTEGER },
                        density: { type: Type.INTEGER },
                        eatingCooldown: { type: Type.INTEGER },
                        starvationTime: { type: Type.INTEGER },
                        reproductionCooldown: { type: Type.INTEGER },
                        maturationTime: { type: Type.INTEGER },
                        minOffspring: { type: Type.INTEGER },
                        maxOffspring: { type: Type.INTEGER },
                        speed: { type: Type.INTEGER },
                        eats: { type: Type.ARRAY, items: { type: Type.STRING } },
                        dayActive: { type: Type.BOOLEAN },
                        nightActive: { type: Type.BOOLEAN },
                        lifespan: { type: Type.INTEGER },
                        specials: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              type: { type: Type.STRING, enum: ['TOXIC_GAS', 'TELEPORTATION', 'HIBERNATION', 'SPIKE'] },
                              name: { type: Type.STRING },
                              description: { type: Type.STRING },
                              enabled: { type: Type.BOOLEAN },
                              duration: { type: Type.INTEGER },
                              cooldown: { type: Type.INTEGER },
                            },
                            required: ['type', 'name', 'enabled', 'duration', 'cooldown'],
                          }
                        }
                      },
                      required: ['dayActive', 'nightActive', 'lifespan']
                    },
                    initialCount: { type: Type.INTEGER }
                  },
                  required: ['name', 'appearance', 'behavior', 'initialCount']
                }
              }
            },
            required: ['ecosystem']
          },
        },
      });

    // Gemini SDK returns JSON here when using responseSchema
    const responseText =
      response.outputText ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";
    
    if (!responseText) {
      console.error("Raw Gemini response:", response);
      throw new Error("AI response was empty or unrecognized format.");
    }

      
      let newEcosystemData;
      try {
        newEcosystemData = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse JSON response from AI. Raw response:", responseText);
        throw new Error(`Failed to parse JSON from AI. See console. Original error: ${e}`);
      }

      const ecosystemArray = newEcosystemData.ecosystem;
      if (Array.isArray(ecosystemArray) && ecosystemArray.length > 0) {
          const newAppearanceConfig: Record<string, any> = {};
          const newBehaviorConfig: Record<string, any> = {};
          const newInitialCounts: Record<string, any> = {};

          for (const element of ecosystemArray) {
              const { name, appearance, behavior, initialCount } = element;
              
              const newAppearance = {
                ...appearance,
                type: parseInt(appearance.type, 10),
              };

              const finalBehavior: any = {
                dayActive: behavior.dayActive,
                nightActive: behavior.nightActive,
                lifespan: behavior.lifespan,
              };

              if (newAppearance.type === ElementType.PLANT) {
                  finalBehavior.growth = behavior.growth;
                  finalBehavior.range = behavior.range;
                  finalBehavior.density = behavior.density;
              } else { 
                  finalBehavior.eatingCooldown = behavior.eatingCooldown;
                  finalBehavior.starvationTime = behavior.starvationTime;
                  finalBehavior.reproductionCooldown = behavior.reproductionCooldown;
                  finalBehavior.maturationTime = behavior.maturationTime;
                  finalBehavior.minOffspring = behavior.minOffspring;
                  finalBehavior.maxOffspring = behavior.maxOffspring;
                  finalBehavior.speed = behavior.speed;
                  finalBehavior.eats = behavior.eats || [];
                  finalBehavior.specials = behavior.specials || [];
              }
              
              newAppearanceConfig[name] = newAppearance;
              newBehaviorConfig[name] = finalBehavior;
              newInitialCounts[name] = initialCount;
          }

          setAppearanceConfig(newAppearanceConfig);
          setBehaviorConfig(newBehaviorConfig);
          setInitialCounts(newInitialCounts);
          alert("New ecosystem generated! Click Reboot to begin.");
      } else {
          throw new Error("Invalid ecosystem format from AI: expected an 'ecosystem' array.");
      }
    } catch (error) {
      console.error("Error generating AI ecosystem:", error);
      alert("Failed to generate an AI ecosystem. Please check the console for details.");
    } finally {
      setIsGeneratingEcosystem(false);
    }
  }, [getApiKey]);


  const handleClearEvents = () => {
    setActiveEvent(null);
  };

  const handleMutationChanceChange = (key: keyof MutationConfig, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setMutationConfig(prev => ({ ...prev, [key]: num }));
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

    const renderNumericField = (key: string, value: number, unit?: string, handler?: (k: string, v: string) => void) => {
      const isTimeValue = key.toLowerCase().includes('time') || key.toLowerCase().includes('cooldown') || key.toLowerCase().includes('lifespan') || key === 'growth' || key.toLowerCase().includes('duration');
      const displayValue = isTimeValue ? value / 1000 : value;
      const step = key.toLowerCase().includes('lifespan') ? 50 : (isTimeValue ? 0.5 : 1);
      
      const changeHandler = handler ?? ((k, v) => handleBehaviorChange(typeName, k, v));

      return (
        <div key={key} className="flex justify-between items-center" title={behaviorTooltips[key]}>
          <label htmlFor={`${typeName}-${key}`} className="text-gray-800 capitalize">{keyLabelMap[key] || key.replace(/_/g, ' ')}:</label>
          <div className="flex items-center justify-end" style={{ width: '130px' }}>
            <input type="number" id={`${typeName}-${key}`} value={displayValue} step={step} onChange={e => changeHandler(key, e.target.value)} className="w-20 bg-gray-100 text-gray-800 text-right rounded focus:outline-none focus:ring-2 focus:ring-blue-400 px-2 py-0.5"/>
            <span className="ml-2 w-6 text-left text-gray-500">{unit}</span>
          </div>
        </div>
      );
    }
    
    const renderSpecial = (special: any) => { // Using any because it might not be a full SpecialAbility yet if coming from older config
        if (!creatureBehavior) return null;
        const isEnabled = special?.enabled ?? false;

        return (
            <div key={special.type} className="p-2 border-t border-gray-200">
                <CustomCheckbox
                    id={`${typeName}-${special.type}-enabled`}
                    checked={isEnabled}
                    onChange={e => handleBehaviorSpecialChange(typeName, special.type, 'enabled', e.target.checked)}
                >
                    <span className="font-medium">{special.name}</span>
                </CustomCheckbox>
                {isEnabled && (
                    <div className="pl-6 pt-2 space-y-2">
                        {renderNumericField('duration', special.duration, 's', (k, v) => handleBehaviorSpecialChange(typeName, special.type, 'duration', v))}
                        {renderNumericField('cooldown', special.cooldown, 's', (k, v) => handleBehaviorSpecialChange(typeName, special.type, 'cooldown', v))}
                    </div>
                )}
            </div>
        );
    };

    return (
      <div className="absolute top-4 left-44 bg-white text-gray-800 p-6 rounded-lg shadow-xl w-80 z-40 border border-gray-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start flex-shrink-0">
            <div className="space-y-2">
                <p><strong>Name:</strong> <span className="text-gray-600">{typeName}</span></p>
                <p><strong>Type:</strong> <span className="text-gray-600">{ElementType[appearance.type]}</span></p>
            </div>
            <div className="flex space-x-2">
                <button onClick={() => handleCopyElementDNA(typeName)} className="p-2 rounded-md hover:bg-gray-200 text-gray-600 transition-colors" title="Copy DNA">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
                <button onClick={() => handleDelete(typeName)} className="p-2 rounded-md hover:bg-red-100 text-gray-600 hover:text-red-600 transition-colors" title="Delete Element">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>
        <div className="overflow-y-auto min-h-0 pr-2">
            <h4 className="font-bold mt-4 mb-2 border-b border-gray-200 pb-2 flex justify-between items-center">
              <span>Behavior</span>
              <BehaviorRulesTooltip elementType={appearance.type} />
            </h4>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center" title={behaviorTooltips['active']}>
                    <label className="text-gray-800">Active:</label>
                    <div className="flex items-center justify-end" style={{ width: '130px' }}>
                        <div className="flex items-center space-x-2">
                            <CustomCheckbox id={`${typeName}-dayActive`} checked={behavior.dayActive} onChange={(e) => handleBehaviorChange(typeName, 'dayActive', e.target.checked)}> <span className="text-lg">☀</span> </CustomCheckbox>
                            <CustomCheckbox id={`${typeName}-nightActive`} checked={behavior.nightActive} onChange={(e) => handleBehaviorChange(typeName, 'nightActive', e.target.checked)}> <span className="text-lg">☾</span> </CustomCheckbox>
                        </div>
                        <span className="ml-2 w-6" />
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
                                    <input type="checkbox" checked={creatureBehavior.eats.includes(eatenTypeName)} onChange={(e) => handleDietChange(typeName, eatenTypeName, e.target.checked)} className="mr-2 h-4 w-4 rounded text-blue-500 focus:ring-blue-400 border-gray-300"/>
                                    {eatenTypeName}
                                </label>
                            </div>
                        ))}
                    </div>
                    <h4 className="font-bold mt-4 mb-2 border-b border-gray-200 pb-2">Specials</h4>
                    <div className="text-sm">
                        {creatureBehavior.specials?.map(special => renderSpecial(special))}
                    </div>
                </>
            )}
        </div>
      </div>
    );
  };
  
  const totalElementCount = Object.keys(appearanceConfig).length;
  const now = performance.now();

  const instanceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const typeName of Object.keys(simAppearanceConfig)) {
        counts[typeName] = 0;
    }

    for (const element of elements) {
        if (element.elementType === ElementType.CREATURE && (element as Creature).isDead) {
            continue;
        }
        const typeName = element.elementType === ElementType.PLANT ? (element as Plant).plantType : (element as Creature).creatureType;
        if (counts[typeName] !== undefined) {
            counts[typeName]++;
        }
    }
    return counts;
  }, [elements, simAppearanceConfig]);

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
        <DayNightIndicator dayCount={dayCount} isDay={isDay} />
        <div className="flex-grow overflow-y-auto min-h-0">
          <div className="space-y-6 pt-2 pb-4">
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
            {totalElementCount < MAX_TOTAL_ELEMENTS && (
                <div className="flex justify-center pt-4">
                    <button onClick={() => setShowCreationModal(true)} className="flex items-center justify-center w-12 h-12 border-2 border-dashed border-gray-400 rounded-full text-gray-400 hover:border-gray-600 hover:text-gray-600 transition-colors" title="Create New Element">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                </div>
            )}
          </div>
        </div>
        <div className="space-y-2 flex-shrink-0 pt-2 border-t border-gray-400/50">
            <button 
                onClick={() => setShowApiModal(true)}
                className="w-full bg-white hover:bg-gray-100 text-gray-700 font-bold py-2 px-4 rounded transition-colors border border-gray-200"
                title="Add your Google Gemini API Key"
            >
                Add API
            </button>
            <button 
                onClick={handleGenerateAIEcosystem} 
                disabled={isGeneratingEcosystem}
                className="w-full bg-white hover:bg-gray-100 text-gray-700 py-2 rounded flex justify-center items-center transition-colors border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                title="Generate Ecosystem with AI"
            >
                {isGeneratingEcosystem ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <img src="https://raw.githubusercontent.com/copperbleach/sp8393-nyu.edu/refs/heads/main/Assets/Robot.png" alt="AI Generate" className="h-5 w-5" />
                )}
            </button>
            <div className="flex space-x-2">
                 <button onClick={handleGlobalCopy} className="flex-1 bg-white hover:bg-gray-100 text-gray-700 py-2 rounded flex justify-center items-center transition-colors border border-gray-200" title="Copy All Configuration">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12H4a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2" /><path d="M10 16H8a2 2 0 0 1 -2 -2V8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2" /><rect x="10" y="10" width="10" height="10" rx="2" /></svg>
                 </button>
                 <button onClick={handleGlobalPaste} className="flex-1 bg-white hover:bg-gray-100 text-gray-700 py-2 rounded flex justify-center items-center transition-colors border border-gray-200" title="Paste Configuration">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12H4a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2" /><path d="M10 16H8a2 2 0 0 1 -2 -2V8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2" /><rect x="10" y="10" width="10" height="10" rx="2" fill="currentColor" /></svg>
                 </button>
            </div>
            <button onClick={handleReboot} className="w-full bg-[#FF6666] hover:bg-[#E55A5A] text-white font-bold py-2 px-4 rounded transition-colors">Reboot</button>
        </div>
      </div>
      
      <div ref={containerRef} className="flex-grow h-full overflow-hidden relative" onClick={() => setSelectedInfo(null)}>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
          {activeEvent && <EventNotification key={activeEvent.id} event={activeEvent} worldTime={performance.now()} />}
        </div>
        
        {activeEvent?.visualOverlayColor && <div className="absolute inset-0 z-20 pointer-events-none" style={{ backgroundColor: activeEvent.visualOverlayColor }} />}
        {!activeEvent && !isDay && <div className="absolute inset-0 bg-black opacity-50 z-20 pointer-events-none" />}
        {activeEvent?.effect === 'PLANT_GROWTH_BOOST' && <RainOverlay />}

        {activeEffects.map(effect => {
            if (effect.type === 'TOXIC_GAS') {
                const bubbleStyles: React.CSSProperties[] = [
                    { top: '15%', left: '15%', width: '50%', height: '50%', animationDelay: '0s' },
                    { top: '15%', left: '45%', width: '40%', height: '40%', animationDelay: '0.1s' },
                    { top: '45%', left: '15%', width: '40%', height: '40%', animationDelay: '0.2s' },
                    { top: '40%', left: '40%', width: '50%', height: '50%', animationDelay: '0.05s' },
                ];
                return (
                    <div key={effect.id} className="absolute pointer-events-none" style={{ left: effect.x, top: effect.y, width: effect.size, height: effect.size, transform: 'translate(-50%, -50%)', zIndex: 40 }}>
                        {bubbleStyles.map((style, i) => (
                            <div key={i} className="absolute rounded-full bg-yellow-300" style={{
                                ...style,
                                animation: `toxic-gas-animation ${effect.duration / 1000}s ease-out forwards`,
                            }} />
                        ))}
                    </div>
                )
            }
            if (effect.type === 'TELEPORTATION') {
                const progress = (now - effect.startTime) / effect.duration;
                let opacity = 0;
                let x = effect.x;
                let y = effect.y;

                if (progress < 0.5) { 
                    opacity = 1 - (progress * 2);
                } else { 
                    opacity = (progress - 0.5) * 2;
                    x = effect.endX!;
                    y = effect.endY!;
                }
                
                return (
                    <div key={effect.id} className="absolute rounded-full bg-white pointer-events-none" style={{
                        left: x,
                        top: y,
                        width: effect.size * 1.2,
                        height: effect.size * 1.2,
                        opacity,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 40,
                        transition: 'opacity 0.1s linear'
                    }}/>
                );
            }
            return null;
        })}

        {elements.filter(el => !activeEffects.some(eff => eff.type === 'TELEPORTATION' && eff.creatureId === el.id)).map(element => {
          const typeName = element.elementType === ElementType.PLANT ? (element as Plant).plantType : (element as Creature).creatureType;
          const appearance = simAppearanceConfig[typeName];
          if (!appearance) return null;
          const shapeStyle = getShapeStyle(appearance.shape);

          if (element.elementType === ElementType.PLANT) {
            return <div key={element.id} className="absolute z-10" style={{ width: `${element.size}px`, height: `${element.size}px`, transform: `translate(${element.x}px, ${element.y}px)`, backgroundColor: appearance.color, ...shapeStyle, transition: 'width 0.2s, height 0.2s' }} />;
          } else {
            const creature = element as Creature;
            const behavior = simBehaviorConfig[creature.creatureType] as CreatureBehavior;
            const eyeSize = creature.size / 5;
            const eyeSpacing = creature.size / 8;
            
            const isHibernating = creature.hibernationEndTime && now < creature.hibernationEndTime;
            const hasSpikes = creature.spikeEndTime && now < creature.spikeEndTime;
            const isActive = !isHibernating && (activeEvent?.effect === 'ALL_CREATURES_ACTIVE' || (isDay && behavior?.dayActive) || (!isDay && behavior?.nightActive));
            const isSleeping = !creature.isDead && !isActive;
            
            const eyeStyle: React.CSSProperties = { 
                width: `${eyeSize}px`, 
                height: `${isSleeping ? eyeSize / 3 : eyeSize}px`, 
                backgroundColor: creature.isDead ? 'rgba(0, 0, 0, 0.5)' : (creature.eyeColor || 'black') 
            };
            const isFlipped = creature.vx < 0;

            return (
              <div key={element.id} className="absolute z-10" style={{ width: `${element.size}px`, height: `${element.size}px`, transform: `translate(${element.x}px, ${element.y}px)` }}>
                <div className="relative w-full h-full" style={{ transform: isFlipped ? 'scaleX(-1)' : 'none' }}>
                    <div className="absolute w-full h-full" style={{ backgroundColor: creature.color || appearance.color, ...shapeStyle }} />
                    <div className="absolute w-full h-full flex justify-center items-center">
                        {creature.isCyclops ? ( <div className={`${isSleeping ? '' : 'rounded-full'}`} style={eyeStyle} /> ) : (
                            <div style={{ transform: `translateX(20%)`, display: 'flex', gap: `${eyeSpacing}px`, alignItems: 'center' }}>
                                <div className={`${isSleeping ? '' : 'rounded-full'}`} style={eyeStyle} />
                                <div className={`${isSleeping ? '' : 'rounded-full'}`} style={eyeStyle} />
                            </div>
                        )}
                    </div>
                     {hasSpikes && (
                        <>
                            {[0, 72, 144, 216, 288].map(angle => (
                                <div key={angle} className="absolute w-0 h-0"
                                    style={{
                                        top: '50%', left: '50%', transformOrigin: '0 0',
                                        transform: `rotate(${angle}deg) translate(${creature.size / 2.5}px, -${creature.size / 8}px)`,
                                        borderLeft: `${creature.size / 8}px solid transparent`,
                                        borderRight: `${creature.size / 8}px solid transparent`,
                                        borderBottom: `${creature.size / 4}px solid #A0522D`,
                                    }}
                                />
                            ))}
                        </>
                    )}
                </div>
              </div>
            );
          }
        })}
      </div>
      
      <InstanceCounter counts={instanceCounts} appearanceConfig={simAppearanceConfig} />

      <button onClick={() => setShowDebug(prev => !prev)} className="fixed bottom-4 right-4 bg-white p-3 rounded-full shadow-lg hover:bg-gray-100 z-50 border border-gray-300 transition-transform hover:scale-105" title="Debug Tools">
         <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
      </button>

      {showDebug && (
        <div className="fixed bottom-20 right-4 bg-white rounded-lg shadow-2xl border border-gray-200 w-72 z-50 flex flex-col" style={{ maxHeight: '70vh' }}>
           <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-bold text-gray-700 flex justify-between items-center flex-shrink-0">
              <span>Debug Tools</span>
              <button onClick={() => setShowDebug(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
           </div>
           <div className="p-2 space-y-1 overflow-y-auto">
              <button onClick={handleGenerateAIEvent} disabled={isGeneratingEvent} className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded flex items-center space-x-3 transition-colors border border-purple-200 disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="text-lg">✨</span>
                  <div>
                      <div className="font-bold text-gray-800 text-sm">Add AI Event</div>
                      <div className="text-xs text-gray-500">{isGeneratingEvent ? 'Generating...' : 'Create a new random event.'}</div>
                  </div>
              </button>
              {[...predefinedEvents, ...aiGeneratedEvents].map((event, index) => (
                <button key={index} onClick={() => triggerEvent(event)} className="w-full text-left p-3 hover:bg-blue-50 rounded flex items-start space-x-3 transition-colors border border-transparent hover:border-blue-200">
                    <div>
                        <div className="font-bold text-gray-800 text-sm">{event.name}</div>
                        <div className="text-xs text-gray-500">{event.description}</div>
                        <div className="text-xs text-blue-500 mt-1 font-medium">Duration: {event.duration}s</div>
                    </div>
                </button>
              ))}

              <button onClick={handleClearEvents} className="w-full text-left p-3 hover:bg-red-50 rounded flex items-start space-x-3 transition-colors border border-transparent hover:border-red-200">
                  <div>
                      <div className="font-bold text-gray-800 text-sm">Clear Event</div>
                      <div className="text-xs text-gray-500">Stop the active event immediately.</div>
                  </div>
              </button>
              
              <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 font-bold text-gray-700 mt-2">
                Event I/O
              </div>
              <div className="p-2 flex space-x-2">
                <button onClick={handleExportEvents} className="flex-1 text-sm p-2 bg-white hover:bg-gray-100 text-gray-700 rounded flex items-center justify-center space-x-2 transition-colors border border-gray-200" title="Export Active Events">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                   <span>Export</span>
                </button>
                <button onClick={handleImportEvents} className="flex-1 text-sm p-2 bg-white hover:bg-gray-100 text-gray-700 rounded flex items-center justify-center space-x-2 transition-colors border border-gray-200" title="Import Event(s) to List">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   <span>Import</span>
                </button>
              </div>

              <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 font-bold text-gray-700 mt-2"> Mutations </div>
              <div className="p-2 space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="albinism-chance" className="text-sm text-gray-800">Albinism Chance:</label>
                  <div className="flex items-center">
                    <input type="number" id="albinism-chance" value={mutationConfig.albinismChance} onChange={(e) => handleMutationChanceChange('albinismChance', e.target.value)} step="0.0001" min="0" className="w-20 bg-gray-100 text-gray-800 text-right rounded focus:outline-none focus:ring-2 focus:ring-blue-400 px-2 py-0.5"/>
                    <span className="ml-2 text-gray-500">%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <label htmlFor="cyclops-chance" className="text-sm text-gray-800">Cyclops Chance:</label>
                  <div className="flex items-center">
                    <input type="number" id="cyclops-chance" value={mutationConfig.cyclopsChance} onChange={(e) => handleMutationChanceChange('cyclopsChance', e.target.value)} step="0.001" min="0" className="w-20 bg-gray-100 text-gray-800 text-right rounded focus:outline-none focus:ring-2 focus:ring-blue-400 px-2 py-0.5"/>
                    <span className="ml-2 text-gray-500">%</span>
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {selectedInfo && renderInfoPopup()}
      {showCreationModal && <CreationModal allElementTypes={Object.keys(appearanceConfig)} onSave={handleCreateNewElement} onCancel={() => setShowCreationModal(false)} getConstrainedValue={getConstrainedBehaviorValue} getApiKey={getApiKey} />}
      {textIOProps.open && ( <TextIOModal title={textIOProps.title} initialValue={textIOProps.initialValue} mode={textIOProps.mode} onSave={textIOProps.onSave} onClose={() => setTextIOProps(prev => ({ ...prev, open: false }))}/> )}
      {showApiModal && ( <ApiKeyModal onSave={(key) => { setUserApiKey(key); setShowApiModal(false); }} onClose={() => setShowApiModal(false)} /> )}
      {showExtinctionSummary && <LeaderboardModal dayCount={lastRunDayCount} onClose={() => setShowExtinctionSummary(false)} onTryEcosystem={() => {}} />}
    </div>
  );
};

export default App;
