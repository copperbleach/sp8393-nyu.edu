import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { GoogleGenAI, Type } from '@google/genai';
import { EcosystemElement, ElementType, Plant, Creature, PlantBehavior, CreatureBehavior, PlantType, CreatureType, WorldEvent, ActiveEvent, SpecialAbility, SpecialType, ActiveEffect } from './types';


// --- New Special Abilities Constant ---
const DEFAULT_SPECIAL_ABILITIES: SpecialAbility[] = [
    { type: 'TOXIC_GAS', name: 'Toxic Gas', description: 'Releases a deadly gas cloud that kills nearby elements.', enabled: false, duration: 3000, cooldown: 15000 },
    { type: 'TELEPORTATION', name: 'Teleportation', description: 'Instantly teleports to a random location.', enabled: false, duration: 500, cooldown: 25000 },
    { type: 'HIBERNATION', name: 'Hibernation', description: 'Enters a deep sleep, stopping hunger but remaining vulnerable.', enabled: false, duration: 45000, cooldown: 30000 },
    { type: 'SPIKE', name: 'Spike', description: 'Grows defensive spikes, preventing predators from eating it.', enabled: false, duration: 5000, cooldown: 5000 },
];

// --- Constants ---
const DEATH_DURATION = 10000; // 10 seconds
const DAY_DURATION = 30000; // 30 seconds
const NIGHT_DURATION = 30000; // 30 seconds
const FULL_DAY_DURATION = DAY_DURATION + NIGHT_DURATION;
const MAX_TOTAL_ELEMENTS = 9;
const BABY_ORPHAN_SURVIVAL_TIME = 30000; // 30 seconds
const PRECONFIGURED_API_KEY = process.env.API_KEY;

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
    minOffspring: 1, maxOffspring: 3, speed: 20, dayActive: true, nightActive: false, eats: ['GreenDot'], lifespan: 1800000, specials: []
  },
  'Keke': {
    eatingCooldown: 30000, starvationTime: 90000, reproductionCooldown: 90000, maturationTime: 60000,
    minOffspring: 1, maxOffspring: 1, speed: 25, dayActive: false, nightActive: true, eats: ['Fafa'], lifespan: 3600000, specials: []
  }
};

const initialAppearanceConfig: Record<string, { size: number, color: string, shape: string, type: ElementType }> = {
    'GreenDot': { size: 10, color: '#879464', shape: 'Shape2', type: ElementType.PLANT },
    'Fafa': { size: 36, color: 'white', shape: 'Shape2', type: ElementType.CREATURE },
    'Keke': { size: 50, color: '#6B7280', shape: 'Shape5', type: ElementType.CREATURE },
};

const predefinedEvents: WorldEvent[] = [
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
    'density': 'The maximum number of the same plant growing within range',
    'duration': 'How long the special ability effect lasts.',
    'cooldown': 'Time before the special ability can be used again.',
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
    'density': 'Density',
    'duration': 'Duration',
    'cooldown': 'Cooldown',
};

const BehaviorRulesTooltip = ({ elementType }: { elementType: ElementType }) => {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleMouseEnter = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPos({ top: rect.top, left: rect.right + 8 });
        }
        setShow(true);
    };

    const creatureRules = `1 ≤ Speed ≤ 99\n30 ≤ Lifespan ≤ 3600\n5 ≤ Hunger ≤ 180\n30 ≤ Starvation ≤ 180\n5 ≤ Reproduction ≤ 1200\n\n---\n\nHunger < Starvation\nStarvation < Lifespan\nReproduction < Lifespan\nMaturation < Lifespan`;
    const plantRules = `1 ≤ Lifespan ≤ 3600\n5 ≤ Growth ≤ 360\n10 ≤ Range ≤ 60\n1 ≤ Density ≤ 10`;

    const rulesText = elementType === ElementType.PLANT ? plantRules : creatureRules;

    return (
        <div className="relative flex items-center">
            <button
                ref={buttonRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShow(false)}
                className="w-5 h-5 bg-gray-300 text-white rounded-full flex items-center justify-center text-sm font-light hover:bg-gray-400 transition-colors"
                aria-label="Show behavior rules"
            >
                ?
            </button>
            {show && createPortal(
                <div 
                    className="p-3 bg-gray-800 text-white text-xs rounded-md shadow-lg w-max whitespace-pre-wrap font-normal"
                    style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 100 }}
                >
                    {rulesText}
                </div>,
                document.body
            )}
        </div>
    );
};


// --- New Components ---
interface ExtinctionSummaryProps {
    dayCount: number;
    setTextIOProps: React.Dispatch<React.SetStateAction<{open: boolean; title: string; initialValue: string; mode: 'read' | 'write'; onSave?: ((val: string) => void) | undefined;}>>;
    onClose: () => void;
}

const ExtinctionSummary: React.FC<ExtinctionSummaryProps> = ({ dayCount, setTextIOProps, onClose }) => {
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopy = () => {
        const savedConfig = localStorage.getItem('webEcosystemSimulator_lastConfig');
        if (savedConfig) {
            navigator.clipboard.writeText(savedConfig).then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            }).catch(() => {
                setTextIOProps({
                    open: true,
                    title: "Copy Ecosystem DNA",
                    initialValue: savedConfig,
                    mode: 'write',
                });
            });
        } else {
            alert("No saved ecosystem found to copy.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl text-center flex flex-col items-center space-y-4 w-64 animate-fade-in-down relative">
                <button onClick={onClose} className="absolute top-2 right-3 text-gray-500 hover:text-gray-800 text-2xl font-bold leading-none" aria-label="Close">
                    &times;
                </button>
                <h3 className="font-bold text-xl text-gray-800">Your Record: {dayCount} Days</h3>
                <button 
                    onClick={handleCopy}
                    className={`px-4 py-2 rounded text-white transition-colors w-full ${copySuccess ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                    {copySuccess ? "Copied!" : "Copy Ecosystem"}
                </button>
            </div>
        </div>
    );
};

const EventNotification: React.FC<{ event: ActiveEvent }> = ({ event }) => {
  const [timeLeft, setTimeLeft] = useState(Math.ceil(event.duration));

  useEffect(() => {
    const update = () => {
      const elapsed = (performance.now() - event.startTime) / 1000;
      const remaining = Math.ceil(event.duration - elapsed);
      setTimeLeft(Math.max(0, remaining));
    };

    update();
    const intervalId = setInterval(update, 500);
    return () => clearInterval(intervalId);
  }, [event.id, event.startTime, event.duration]);

  if (timeLeft <= 0) return null;

  return (
    <div className="bg-white bg-opacity-90 backdrop-blur-sm p-4 rounded-lg shadow-lg text-center border border-gray-200 mb-2 w-64 animate-fade-in-down">
      <h3 className="font-bold text-lg text-gray-800">{event.name}</h3>
      <p className="text-sm text-gray-600">{event.description}</p>
      <p className="text-xl font-bold text-blue-500 mt-2">{timeLeft}s</p>
    </div>
  );
};

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  id: string;
  children: React.ReactNode;
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ checked, onChange, id, children }) => (
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

const DayNightIndicator = ({ dayCount, isDay }: { dayCount: number, isDay: boolean }) => {
    const iconSrc = isDay 
        ? "https://raw.githubusercontent.com/copperbleach/sp8393-nyu.edu/refs/heads/main/Assets/Sun.png"
        : "https://raw.githubusercontent.com/copperbleach/sp8393-nyu.edu/refs/heads/main/Assets/Moon.png";
    
    return (
        <div className="flex items-center space-x-3 mb-6 flex-shrink-0">
            <img src={iconSrc} alt={isDay ? "Sun icon" : "Moon icon"} className="w-10 h-10" />
            <span className="font-bold text-xl text-gray-700">Day {dayCount}</span>
        </div>
    );
};

const RainOverlay = React.memo(() => {
  const drops = useMemo(() => Array.from({ length: 60 }).map((_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 0.8 + Math.random() * 0.4
  })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {drops.map((drop, i) => (
        <div
          key={i}
          className="absolute bg-blue-300"
          style={{
            left: `${drop.left}%`,
            top: '-50px',
            width: '2px',
            height: '50px',
            opacity: 0.6,
            animation: `rain-fall ${drop.duration}s linear infinite`,
            animationDelay: `-${drop.delay}s`
          }}
        />
      ))}
    </div>
  );
});

const TextIOModal = ({ title, initialValue, onSave, onClose, mode }: { title: string, initialValue: string, onSave?: (val: string) => void, onClose: () => void, mode: 'read' | 'write' }) => {
    const [value, setValue] = useState(initialValue);
    const [copySuccess, setCopySuccess] = useState(false);
  
    const handleCopy = () => {
      navigator.clipboard.writeText(value).then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
      });
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]" onClick={onClose}>
        <div className="bg-white p-6 rounded-lg shadow-xl w-[500px] flex flex-col space-y-4" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-lg">{title}</h3>
          <textarea
              className="w-full h-64 p-2 border border-gray-300 rounded font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={value}
              onChange={e => mode === 'read' && setValue(e.target.value)}
              readOnly={mode === 'write'}
              placeholder={mode === 'read' ? "Paste JSON here..." : ""}
          />
          <div className="flex justify-end space-x-2">
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Close</button>
              {mode === 'write' ? (
                  <button onClick={handleCopy} className={`px-4 py-2 rounded text-white ${copySuccess ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}`}>
                      {copySuccess ? "Copied!" : "Copy to Clipboard"}
                  </button>
              ) : (
                  <button onClick={() => onSave && onSave(value)} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded">
                      Import
                  </button>
              )}
          </div>
        </div>
      </div>
    );
  };

interface ApiKeyModalProps {
  onSave: (key: string) => void;
  onClose: () => void;
}
  
const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave, onClose }) => {
  const [key, setKey] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (key.trim()) {
      onSave(key.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]" onClick={onClose}>
      <div className="bg-white p-6 rounded-lg shadow-xl w-96 flex flex-col space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg">Add Google Gemini API Key</h3>
        <p className="text-sm text-gray-600">Your key is stored only in your browser and is required for AI features.</p>
        <div className="flex items-center space-x-2">
          <input 
            ref={inputRef}
            type="password"
            className="flex-grow p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your API key..."
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button 
            onClick={handleSave} 
            className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center justify-center aspect-square"
            title="Accept"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

interface InstanceCounterProps {
    counts: Record<string, number>;
    appearanceConfig: Record<string, { size: number; color: string; shape: string; type: ElementType }>;
}

const InstanceCounter: React.FC<InstanceCounterProps> = ({ counts, appearanceConfig }) => {
    return (
        <div className="fixed top-4 right-4 z-40 flex flex-col items-end space-y-1">
            {Object.keys(appearanceConfig).map((typeName) => {
                const count = counts[typeName] || 0;
                const appearance = appearanceConfig[typeName];
                if (!appearance) return null;

                const shapeStyle = getShapeStyle(appearance.shape);
                const iconSize = 16;

                return (
                    <div key={typeName} className="flex items-center justify-end space-x-2">
                        <span className="font-light text-black text-right min-w-[1.5rem]">{count}</span>
                        <div 
                            title={typeName}
                            className="relative flex justify-center items-center" 
                            style={{ width: iconSize, height: iconSize }}
                        >
                            <div className="absolute w-full h-full" style={{ backgroundColor: appearance.color, ...shapeStyle }} />
                            {appearance.type === ElementType.CREATURE && (
                                <div className="absolute w-full h-full flex justify-center items-center">
                                  <div style={{ 
                                      display: 'flex', 
                                      gap: `${Math.max(1, iconSize / 8)}px`, 
                                      transform: 'translateX(20%)' 
                                  }}>
                                      <div className="bg-black rounded-full" style={{ width: `${Math.max(1, iconSize / 5)}px`, height: `${Math.max(1, iconSize / 5)}px` }} />
                                      <div className="bg-black rounded-full" style={{ width: `${Math.max(1, iconSize / 5)}px`, height: `${Math.max(1, iconSize / 5)}px` }} />
                                  </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};


interface MutationConfig {
  albinismChance: number; // in percent, e.g., 0.001 for 0.001%
  cyclopsChance: number;  // in percent, e.g., 0.01 for 0.01%
}

const App: React.FC = () => {
  const [elements, setElements] = useState<EcosystemElement[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);
  const [initialCounts, setInitialCounts] = useState<Record<string, number>>({ 'GreenDot': 20, 'Fafa': 5, 'Keke': 2 });
  const [behaviorConfig, setBehaviorConfig] = useState<Record<string, PlantBehavior | CreatureBehavior>>(initialBehaviorConfig);
  const [simBehaviorConfig, setSimBehaviorConfig] = useState<Record<string, PlantBehavior | CreatureBehavior>>(initialBehaviorConfig);
  const simBehaviorConfigRef = useRef(initialBehaviorConfig);
  const [appearanceConfig, setAppearanceConfig] = useState(initialAppearanceConfig);
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

  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(0);
  const lastUpdateTime = useRef<number>(0);
  const worldTimeRef = useRef(0);
  
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

  const playBabyBornSound = useCallback(() => {
    const sound = new Audio('https://github.com/copperbleach/sp8393-nyu.edu/raw/refs/heads/main/Assets/Bob.wav');
    sound.play().catch(error => {
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        console.error("Error playing sound:", error);
      }
    });
  }, []);

  const createPlant = useCallback((plantType: PlantType, x: number, y: number, isInitial: boolean = false): Plant => {
    const appearance = appearanceConfig[plantType];
    const behavior = simBehaviorConfigRef.current[plantType] as PlantBehavior;
    return {
      id: crypto.randomUUID(),
      elementType: ElementType.PLANT,
      plantType,
      x, y,
      size: appearance.size,
      birthTimestamp: performance.now(),
      lastGrowthTimestamp: isInitial ? performance.now() - getRandomNumber(0, behavior.growth) : performance.now(),
    };
  }, [appearanceConfig]);

  const createCreature = useCallback((creatureType: CreatureType, x: number, y: number, isBaby: boolean = false, parentId?: string): Creature => {
    const now = performance.now();
    const appearance = appearanceConfig[creatureType];
    const behavior = simBehaviorConfigRef.current[creatureType] as CreatureBehavior;

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
  }, [appearanceConfig, mutationConfig]);

  const gameLoop = useCallback(() => {
    if (!isSimRunning) {
        cancelAnimationFrame(animationFrameId.current);
        return;
    }
    const now = performance.now();
    if (lastUpdateTime.current === 0) { lastUpdateTime.current = now; animationFrameId.current = requestAnimationFrame(gameLoop); return; }
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
    if (!bounds) { animationFrameId.current = requestAnimationFrame(gameLoop); return; }
    
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
          
          if (now - plant.birthTimestamp > behavior.lifespan) {
            idsToRemove.add(plant.id);
            continue;
          }

          if (eventEffect === 'PLANT_SIZE_PULSE') {
            const baseSize = appearanceConfig[plant.plantType].size;
            plant.size = baseSize + Math.sin(now / 200) * (baseSize * 0.25);
          } else {
             plant.size = appearanceConfig[plant.plantType].size;
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
          const behavior = { ...simBehaviorConfigRef.current[creature.creatureType] } as CreatureBehavior;
          const appearance = appearanceConfig[creature.creatureType];
          
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
              } else if (!isHibernating && !creature.isBaby && now - creature.lastAteTimestamp > behavior.starvationTime) {
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
            const isActive = !isHibernating && (eventEffect === 'ALL_CREATURES_ACTIVE' || (newIsDay && behavior.dayActive) || (!newIsDay && behavior.nightActive));

            if (isActive && behavior.specials) {
              for (const special of behavior.specials) {
                if (!special.enabled) continue;
                const lastUsed = creature.lastSpecialUsed?.[special.type] || 0;
                if (now - lastUsed > special.cooldown && Math.random() < 0.005) {
                    creature.lastSpecialUsed = { ...creature.lastSpecialUsed, [special.type]: now };
                    if (special.type === 'TOXIC_GAS') {
                        setActiveEffects(prev => [...prev, { id: crypto.randomUUID(), type: 'TOXIC_GAS', x: creature.x, y: creature.y, size: creature.size * 2, startTime: now, duration: special.duration }]);
                        const radius = creature.size; // reduced radius
                        prevElements.forEach(other => {
                            if (other.id !== creature.id && distance(creature, other) < radius) {
                                if (other.elementType === ElementType.CREATURE) {
                                    const otherCreature = elementMap.get(other.id) as Creature;
                                    if(otherCreature && !otherCreature.isDead) {
                                        elementMap.set(other.id, {...otherCreature, isDead: true, deathTimestamp: now, vx: 0, vy: 0});
                                    }
                                } else {
                                    idsToRemove.add(other.id);
                                }
                            }
                        });
                    } else if (special.type === 'TELEPORTATION') {
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
                  // FIX: Restructured foodFilter to be type-safe by checking elementType before accessing properties.
                  const foodFilter = (other: EcosystemElement) => {
                    if (idsToRemove.has(other.id)) return false;
                    
                    const diet = (simBehaviorConfigRef.current[creature.creatureType] as CreatureBehavior).eats;

                    if (other.elementType === ElementType.PLANT) {
                        return diet.includes(other.plantType);
                    } else if (other.elementType === ElementType.CREATURE) {
                        if (other.spikeEndTime && now < other.spikeEndTime) return false;
                        return !other.isDead && diet.includes(other.creatureType);
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
                      } else {
                        creature.targetId = undefined;
                      }
                   } 
                   else if (isReadyToMate && target.elementType === ElementType.CREATURE) {
                      const mate = target as Creature;
                      const mateBehavior = simBehaviorConfigRef.current[mate.creatureType] as CreatureBehavior;
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

      const nextElements = [...Array.from(elementMap.values()).filter(el => !idsToRemove.has(el.id)), ...elementsToAdd];
      const livingCreatures = nextElements.filter(el => el.elementType === ElementType.CREATURE && !(el as Creature).isDead);
      
      if (hadCreaturesInitially && livingCreatures.length === 0 && prevElements.some(el => el.elementType === ElementType.CREATURE && !(el as Creature).isDead)) {
        setLastRunDayCount(newDayCount);
        setIsSimRunning(false);
        setShowExtinctionSummary(true);
      }
      
      return nextElements;
    });
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [createCreature, createPlant, playBabyBornSound, appearanceConfig, isSimRunning, hadCreaturesInitially]);

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
            initialElements.push(createPlant(typeName, x, y, true));
          } else {
            initialElements.push(createCreature(typeName, x, y));
          }
        }
      });
      setHadCreaturesInitially(hasCreatures);
      setElements(initialElements);
      lastUpdateTime.current = performance.now();
      animationFrameId.current = requestAnimationFrame(gameLoop);
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
              minBound = 30; maxBound = 180;
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

    const handleBehaviorSpecialChange = (typeName: string, specialType: SpecialType, key: 'enabled' | 'duration' | 'cooldown', value: boolean | string) => {
        setBehaviorConfig(prev => {
            const newConfig = { ...prev };
            const behavior = { ...newConfig[typeName] } as CreatureBehavior;
            if (!behavior) return prev;

            let specials = behavior.specials ? behavior.specials.map(s => ({...s})) : [];
            let specialIndex = specials.findIndex(s => s.type === specialType);

            if (specialIndex === -1) {
                // Should not happen with the new specials list, but as a fallback
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
      const specialsListString = DEFAULT_SPECIAL_ABILITIES.map(s => `- ${s.name} (${s.type}): ${s.description}`).join('\n');
      const prompt = `You are an AI assistant for a web-based ecosystem simulator. Your task is to invent a complete, balanced ecosystem with exactly 6 unique elements (a mix of plants and creatures).

The ecosystem should form a stable food web. For example, include producers (plants), primary consumers (herbivores), and secondary/tertiary consumers (carnivores/omnivores). The available shapes are 'Shape1', 'Shape2', 'Shape3', 'Shape4', 'Shape5', 'Shape6', 'Shape7', 'Shape8', 'Shape9', and 'Shape10'. Please assign a varied selection of these shapes to the 6 elements.

Additionally, you can assign special abilities to creatures. Here is the list of available specials:
${specialsListString}

Rules for specials:
- A maximum of two creatures in the ecosystem can have a special ability.
- Each of those creatures can have only one special.
- Plants cannot have specials.
- For a creature with a special, add a "specials" property to its "behavior" object. This should be an array containing a single special ability object, copied exactly from the list provided. The "enabled" property for the special should be set to true.

Ensure all configuration values are within reasonable bounds and compatible with the simulator's logic (e.g., starvationTime > eatingCooldown, lifespan > maturationTime).

Return your response as a single JSON object containing one root key: "ecosystem". The value of "ecosystem" should be an array of exactly 6 element objects. Do not include any other text or markdown.

Here is an example structure for the response, including a creature with a special:
\`\`\`json
{
  "ecosystem": [
    {
      "name": "SunPetal",
      "appearance": { "size": 15, "color": "#F9D423", "shape": "Shape10", "type": "0" },
      "behavior": { "growth": 12000, "range": 35, "density": 4, "dayActive": true, "nightActive": false, "lifespan": 150000 },
      "initialCount": 25
    },
    {
      "name": "Glimmerwing",
      "appearance": { "size": 30, "color": "#A0D2EB", "shape": "Shape2", "type": "1" },
      "behavior": { 
        "eatingCooldown": 12000, "starvationTime": 60000, "reproductionCooldown": 50000, "maturationTime": 25000, "minOffspring": 1, "maxOffspring": 3, 
        "speed": 22, "dayActive": true, "nightActive": false, "eats": ["SunPetal"], "lifespan": 240000,
        "specials": [{ "type": "TELEPORTATION", "name": "Teleportation", "description": "Instantly teleports to a random location.", "enabled": true, "duration": 500, "cooldown": 25000 }]
      },
      "initialCount": 6
    }
  ]
}
\`\`\`
Remember for the 'type' property: "0" is for PLANT and "1" is for CREATURE (it must be a string). Generate exactly 6 total elements. For a plant's behavior, only include 'growth', 'range', 'density', 'dayActive', 'nightActive', and 'lifespan'. For a creature's behavior, only include 'eatingCooldown', 'starvationTime', 'reproductionCooldown', 'maturationTime', 'minOffspring', 'maxOffspring', 'speed', 'dayActive', 'nightActive', 'eats', 'lifespan', and 'specials'.`;

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
                      description: "Visual properties of the element.",
                      properties: {
                        size: { type: Type.INTEGER, description: "Size of the element in pixels." },
                        color: { type: Type.STRING, description: "Hex color code for the element." },
                        shape: { type: Type.STRING, description: "Shape identifier for the element.", enum: ['Shape1', 'Shape2', 'Shape3', 'Shape4', 'Shape5', 'Shape6', 'Shape7', 'Shape8', 'Shape9', 'Shape10'] },
                        type: { type: Type.STRING, enum: ['0', '1'], description: "Type of the element: '0' for Plant, '1' for Creature." },
                      },
                      required: ['size', 'color', 'shape', 'type']
                    },
                    behavior: {
                      type: Type.OBJECT,
                      description: 'Defines the behavior. Only include properties relevant to the element type.',
                      properties: {
                        growth: { type: Type.INTEGER, description: 'Time in ms for a plant to grow a new one. (Plant only)' },
                        range: { type: Type.INTEGER, description: 'Range in pixels for new plant growth. (Plant only)' },
                        density: { type: Type.INTEGER, description: 'Max number of same plants in range. (Plant only)' },
                        eatingCooldown: { type: Type.INTEGER, description: 'Time in ms until a creature gets hungry. (Creature only)' },
                        starvationTime: { type: Type.INTEGER, description: 'Time in ms until a creature starves. Must be > eatingCooldown. (Creature only)' },
                        reproductionCooldown: { type: Type.INTEGER, description: 'Time in ms until a creature can reproduce again. (Creature only)' },
                        maturationTime: { type: Type.INTEGER, description: 'Time in ms for a baby creature to become an adult. (Creature only)' },
                        minOffspring: { type: Type.INTEGER, description: 'Minimum number of offspring per reproduction. (Creature only)' },
                        maxOffspring: { type: Type.INTEGER, description: 'Maximum number of offspring per reproduction. (Creature only)' },
                        speed: { type: Type.INTEGER, description: 'Movement speed of the creature. (Creature only)' },
                        eats: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of element names this creature eats. (Creature only)' },
                        dayActive: { type: Type.BOOLEAN, description: 'Is the element active during the day?' },
                        nightActive: { type: Type.BOOLEAN, description: 'Is the element active during the night?' },
                        lifespan: { type: Type.INTEGER, description: 'Total lifespan of the element in ms.' },
                        specials: {
                            type: Type.ARRAY,
                            description: 'An array containing at most one special ability for this creature. (Creature only, optional)',
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                type: { type: Type.STRING, description: 'The type of the special ability.' },
                                name: { type: Type.STRING, description: 'The name of the special ability.' },
                                description: { type: Type.STRING, description: 'A description of the special ability.' },
                                enabled: { type: Type.BOOLEAN, description: 'Whether the special is enabled. Should be true if assigned.' },
                                duration: { type: Type.INTEGER, description: 'The duration of the special ability in milliseconds.' },
                                cooldown: { type: Type.INTEGER, description: 'The cooldown of the special ability in milliseconds.' }
                              },
                              required: ['type', 'name', 'description', 'enabled', 'duration', 'cooldown']
                            }
                        }
                      },
                      required: ['dayActive', 'nightActive', 'lifespan']
                    },
                    initialCount: { type: Type.INTEGER, description: "Initial number of this element to spawn." }
                  },
                  required: ['name', 'appearance', 'behavior', 'initialCount']
                }
              }
            },
            required: ['ecosystem']
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("AI response was empty.");
      }
      
      let newEcosystemData;
      try {
        newEcosystemData = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse JSON response from AI. Raw response:", responseText);
        throw new Error(`Failed to parse JSON from AI. The response might be an error message. See console for raw response. Original error: ${e}`);
      }

      const ecosystemArray = newEcosystemData.ecosystem;
      if (Array.isArray(ecosystemArray) && ecosystemArray.length > 0) {
          const newAppearanceConfig: Record<string, any> = {};
          const newBehaviorConfig: Record<string, any> = {};
          const newInitialCounts: Record<string, any> = {};

          for (const element of ecosystemArray) {
              const { name, appearance, behavior, initialCount } = element;
              
              // FIX: Create a new object for appearance config to avoid mutation side-effects.
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

          setSelectedInfo(null);
          setElements([]);
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
    
    const renderSpecial = (special: SpecialAbility) => {
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
    for (const typeName of Object.keys(appearanceConfig)) {
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
  }, [elements, appearanceConfig]);

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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12H4a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2" /><path d="M10 16H8a2 2 0 0 1 -2 -2V8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2" /><rect x="10" y="10" width="10" height="10" rx="2" /></svg>
                 </button>
                 <button onClick={handleGlobalPaste} className="flex-1 bg-white hover:bg-gray-100 text-gray-700 py-2 rounded flex justify-center items-center transition-colors border border-gray-200" title="Paste Configuration">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12H4a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2" /><path d="M10 16H8a2 2 0 0 1 -2 -2V8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2" /><rect x="10" y="10" width="10" height="10" rx="2" fill="currentColor" /></svg>
                 </button>
            </div>
            <button onClick={handleReboot} className="w-full bg-[#FF6666] hover:bg-[#E55A5A] text-white font-bold py-2 px-4 rounded transition-colors">Reboot</button>
        </div>
      </div>
      
      <div ref={containerRef} className="flex-grow h-full overflow-hidden relative" onClick={() => setSelectedInfo(null)}>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
          {activeEvent && <EventNotification key={activeEvent.id} event={activeEvent} />}
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
          const appearance = appearanceConfig[typeName];
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
      
      <InstanceCounter counts={instanceCounts} appearanceConfig={appearanceConfig} />

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
      {showExtinctionSummary && <ExtinctionSummary dayCount={lastRunDayCount} setTextIOProps={setTextIOProps} onClose={() => setShowExtinctionSummary(false)} />}
    </div>
  );
};

const CreationModal = ({ allElementTypes, onSave, onCancel, getConstrainedValue, getApiKey }: { allElementTypes: string[], onSave: (data: any) => void, onCancel: () => void, getConstrainedValue: (key: string, value: number, behavior: CreatureBehavior | PlantBehavior | Omit<CreatureBehavior, 'eats'>) => number, getApiKey: () => string | null }) => {
    const [name, setName] = useState('');
    const [size, setSize] = useState(30);
    const [color, setColor] = useState('#aabbcc');
    const [shape, setShape] = useState('Shape2');
    const [type, setType] = useState<ElementType>(ElementType.CREATURE);
    const [isNameEditing, setIsNameEditing] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [showPasteInput, setShowPasteInput] = useState(false);
    const [pasteInputValue, setPasteInputValue] = useState("");
    const [plantBehavior, setPlantBehavior] = useState<PlantBehavior>({ growth: 10000, range: 40, density: 5, dayActive: true, nightActive: false, lifespan: 120000 });
    const [creatureBehavior, setCreatureBehavior] = useState<Omit<CreatureBehavior, 'eats' | 'specials'>>({ eatingCooldown: 15000, starvationTime: 75000, reproductionCooldown: 80000, maturationTime: 45000, minOffspring: 1, maxOffspring: 2, speed: 18, dayActive: true, nightActive: false, lifespan: 600000 });
    const [eats, setEats] = useState<string[]>([]);
    const [specials, setSpecials] = useState<SpecialAbility[]>(() =>
        DEFAULT_SPECIAL_ABILITIES.map(s => ({ ...s, enabled: false }))
    );
    const [isGeneratingSpecial, setIsGeneratingSpecial] = useState(false);
    
    useEffect(() => {
        const randomNames = ['Baba', 'Poupou', 'Mumu', 'Lo', 'Pipi', 'Zuzu', 'Koko', 'Dodo', 'Nini', 'Riri', 'Bop', 'Yaya', 'Mimi', 'Ma'];
        const sizes = [10, 20, 30, 40, 50];
        setName(randomNames[Math.floor(Math.random() * randomNames.length)]);
        setSize(sizes[Math.floor(Math.random() * sizes.length)]);
        setColor('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'));
        setShape(shapeList[Math.floor(Math.random() * shapeList.length)]);
    }, []);

    useEffect(() => { if (isNameEditing) { nameInputRef.current?.focus(); nameInputRef.current?.select(); } }, [isNameEditing]);

    const handleGenerateAISpecial = useCallback(async () => {
        const apiKey = getApiKey();
        if (!apiKey) return;

        setIsGeneratingSpecial(true);
        try {
            const ai = new GoogleGenAI({ apiKey });
            const existingSpecialsString = specials.map(s => `- ${s.name}: ${s.description}`).join('\n');

            const prompt = `You are an AI assistant for a web-based ecosystem simulator. Your task is to invent a new, unique special ability for a creature.
    
            Here are the existing special abilities. Do not create one that is too similar to these:
            ${existingSpecialsString}
    
            Now, create a new, unique special ability. Follow these rules:
            1. It must have a creative 'name' (2-3 words).
            2. It must have a brief 'description' of its gameplay function.
            3. Its 'duration' must be a number in seconds (e.g., between 3 and 60).
            4. Its 'cooldown' must be a number in seconds (e.g., between 5 and 120).
            5. The ability should be balanced and not overly powerful.
    
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
                            cooldown: { type: Type.INTEGER },
                        },
                        required: ['name', 'description', 'duration', 'cooldown'],
                    },
                },
            });

            const responseText = response.text;
            if (!responseText) throw new Error("AI response was empty.");
            
            const specialJson = JSON.parse(responseText);
            const newSpecial: SpecialAbility = {
                type: specialJson.name.toUpperCase().replace(/\s+/g, '_'),
                name: specialJson.name,
                description: specialJson.description,
                enabled: false,
                duration: specialJson.duration * 1000,
                cooldown: specialJson.cooldown * 1000,
            };

            if (specials.some(s => s.type === newSpecial.type)) {
                newSpecial.type = `${newSpecial.type}_${Date.now()}`;
            }

            setSpecials(prev => [...prev, newSpecial]);

        } catch (error) {
            console.error("Error generating AI special:", error);
            alert("Failed to generate an AI special. Please check the console.");
        } finally {
            setIsGeneratingSpecial(false);
        }
    }, [getApiKey, specials]);

    const handleSave = () => {
        if (!name.trim()) { alert("Please enter a name."); return; }
        const behavior = type === ElementType.PLANT ? plantBehavior : { ...creatureBehavior, eats, specials };
        onSave({ name, appearance: { size, color, shape }, type, behavior });
    };

    const handleBehaviorChange = (behaviorType: 'plant' | 'creature', key: string, value: string | boolean) => {
        const setter = behaviorType === 'plant' ? setPlantBehavior : setCreatureBehavior;
        const currentBehavior = behaviorType === 'plant' ? plantBehavior : creatureBehavior;

        setter(prev => {
            const newBehavior = { ...prev };
            if (typeof value === 'boolean') { (newBehavior as any)[key] = value; }
            else {
                if (key === 'minOffspring' || key === 'maxOffspring') {
                    let numValue = parseInt(value, 10);
                    if (isNaN(numValue)) return prev;
                    if (key === 'minOffspring') numValue = Math.max(0, Math.min(numValue, (prev as any).maxOffspring));
                    else numValue = Math.max((prev as any).minOffspring, Math.min(numValue, 9));
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
    
    const handleEatsChange = (eatenType: string) => { setEats(prev => prev.includes(eatenType) ? prev.filter(t => t !== eatenType) : [...prev, eatenType]); }

    const handleSpecialChange = (specialType: SpecialType, key: 'enabled' | 'duration' | 'cooldown', value: boolean | string) => {
        setSpecials(prev => {
            const newSpecials = [...prev];
            const index = newSpecials.findIndex(s => s.type === specialType);
            if (index === -1) return prev;

            const updatedSpecial = { ...newSpecials[index] };
            if (key === 'enabled' && typeof value === 'boolean') {
                updatedSpecial.enabled = value;
            } else if ((key === 'duration' || key === 'cooldown') && typeof value === 'string') {
                const num = parseFloat(value);
                if (!isNaN(num)) {
                    updatedSpecial[key] = Math.round(num * 1000);
                }
            }
            newSpecials[index] = updatedSpecial;
            return newSpecials;
        });
    };

    const processPasteData = (json: string) => {
        try {
            const data = JSON.parse(json);
            if (!data.appearance || !data.behavior || !data.name) { alert("Invalid configuration format."); return; }
            const { name, appearance, behavior } = data;
            const { size, color, shape, type } = appearance;
            setName(name); setSize(size); setColor(color); setShape(shape); setType(type);
            if (type === ElementType.PLANT) { setPlantBehavior(behavior); }
            else if (type === ElementType.CREATURE) { const { eats, specials: pastedSpecials, ...rest } = behavior; setCreatureBehavior(rest); setEats(eats || []); if (pastedSpecials) setSpecials(pastedSpecials); }
            setShowPasteInput(false);
        } catch (error) { alert("Failed to parse copied data."); console.error("Paste error:", error); }
    };

    const handlePaste = async () => {
        try { const text = await navigator.clipboard.readText(); if (text) { processPasteData(text); return; } }
        catch (e) { /* ignore */ }
        setShowPasteInput(true);
    };

    const renderNumericField = (behaviorType: 'plant' | 'creature', key: string, value: number, unit?: string, handler?: (k: string, v: string) => void) => {
      const isTimeValue = key.toLowerCase().includes('time') || key.toLowerCase().includes('cooldown') || key.toLowerCase().includes('lifespan') || key === 'growth' || key.toLowerCase().includes('duration');
      const displayValue = isTimeValue ? value / 1000 : value;
      const step = key.toLowerCase().includes('lifespan') ? 50 : (isTimeValue ? 0.5 : 1);
      
      return (
        <div className="flex justify-between items-center" title={behaviorTooltips[key]}>
          <label htmlFor={`create-${key}`} className="text-gray-800 capitalize">{keyLabelMap[key] || key.replace(/_/g, ' ')}:</label>
          <div className="flex items-center justify-end" style={{ width: '130px' }}>
            <input type="number" id={`create-${key}`} value={displayValue} step={step} onChange={(e) => handler ? handler(key, e.target.value) : handleBehaviorChange(behaviorType, key, e.target.value)} className="w-20 bg-gray-100 text-gray-800 text-right rounded focus:outline-none focus:ring-2 focus:ring-blue-400 px-2 py-0.5"/>
            <span className="ml-2 w-6 text-left text-gray-500">{unit}</span>
          </div>
        </div>
      );
    }
    
    const renderSpecialCreator = (special: SpecialAbility) => (
        <div className="p-2 border-t border-gray-200" key={special.type}>
            <CustomCheckbox
                id={`create-${special.type}-enabled`}
                checked={special.enabled}
                onChange={e => handleSpecialChange(special.type, 'enabled', e.target.checked)}
            >
                <span className="font-medium">{special.name}</span>
            </CustomCheckbox>
            {special.enabled && (
                <div className="pl-6 pt-2 space-y-2">
                    <p className="text-xs text-gray-500 italic" title={special.description}>{special.description}</p>
                    {renderNumericField('creature', 'duration', special.duration, 's', (k, v) => handleSpecialChange(special.type, 'duration', v))}
                    {renderNumericField('creature', 'cooldown', special.cooldown, 's', (k, v) => handleSpecialChange(special.type, 'cooldown', v))}
                </div>
            )}
        </div>
    );

    return (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onCancel}>
            <div className="bg-white p-8 rounded-lg shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
                <button onClick={handlePaste} className="absolute top-4 right-4 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition-colors flex items-center space-x-2 text-sm font-medium" title="Import DNA">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span>Import DNA</span>
                </button>

                {showPasteInput && (
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
                        <label className="block text-sm font-bold mb-2 text-gray-700">Paste DNA Code:</label>
                        <textarea className="w-full h-24 p-2 border border-gray-300 rounded mb-2 font-mono text-xs focus:ring-2 focus:ring-blue-400 outline-none" placeholder='{"name": "...", "appearance": {...}, ...}' value={pasteInputValue} onChange={e => setPasteInputValue(e.target.value)} />
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowPasteInput(false)} className="px-3 py-1 text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
                            <button onClick={() => processPasteData(pasteInputValue)} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">Load</button>
                        </div>
                    </div>
                )}
                
                <div className="mb-4 flex flex-col items-center space-y-4 pt-8">
                    <input ref={nameInputRef} type="text" value={name} onChange={e => setName(e.target.value)} onDoubleClick={() => setIsNameEditing(true)} onBlur={() => setIsNameEditing(false)} onKeyDown={(e) => { if (e.key === 'Enter') nameInputRef.current?.blur(); }} readOnly={!isNameEditing} className={`bg-transparent text-2xl font-bold text-center w-4/5 pb-1 border-b border-gray-400 focus:outline-none focus:ring-0 focus:border-blue-500 transition-colors ${isNameEditing ? 'cursor-text' : 'cursor-default'}`} title="Double-click to edit name"/>
                    <div className="w-24 h-24 relative flex justify-center items-center">
                        <div className="relative" style={{ width: `${size}px`, height: `${size}px` }}>
                           <div className="absolute w-full h-full" style={{ backgroundColor: color, ...getShapeStyle(shape) }}/>
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
                        <label className="flex items-center cursor-pointer"> <input type="radio" name="elementType" value={ElementType.CREATURE} checked={type === ElementType.CREATURE} onChange={e => setType(parseInt(e.target.value, 10))} className="form-radio mr-2" /> Creature </label>
                        <label className="flex items-center cursor-pointer"> <input type="radio" name="elementType" value={ElementType.PLANT} checked={type === ElementType.PLANT} onChange={e => setType(parseInt(e.target.value, 10))} className="form-radio mr-2" /> Plant </label>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div className="space-y-4">
                        <h3 className="font-bold border-b pb-2">Appearance</h3>
                        <div><label className="block">Size</label><select value={size} onChange={e => setSize(parseInt(e.target.value, 10))} className="w-full p-2 border rounded bg-white"><option value="10">10px</option><option value="20">20px</option><option value="30">30px</option><option value="40">40px</option><option value="50">50px</option></select></div>
                        <div><label className="block">Color</label><input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-10 p-1 border rounded"/></div>
                        <div>
                            <label className="block">Shape</label>
                            <div className="grid grid-cols-5 gap-2 mt-2">
                                {shapeList.map(shapeName => (
                                    <div key={shapeName} onClick={() => setShape(shapeName)} className={`w-12 h-12 cursor-pointer flex items-center justify-center ${shape === shapeName ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-300'} rounded`}>
                                        <div className="w-8 h-8 bg-gray-400" style={getShapeStyle(shapeName)}/>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 text-sm">
                       <h3 className="font-bold border-b pb-2 mb-2 flex justify-between items-center">
                          <span>Behavior</span>
                          <BehaviorRulesTooltip elementType={type} />
                       </h3>
                       {type === ElementType.PLANT && (
                        <div className="space-y-2">
                           <div className="flex justify-between items-center" title={behaviorTooltips['active']}>
                              <label>Active:</label>
                              <div className="flex items-center justify-end" style={{ width: '130px' }}>
                                  <div className="flex items-center space-x-2">
                                     <CustomCheckbox id="create-plant-dayActive" checked={plantBehavior.dayActive} onChange={e => handleBehaviorChange('plant', 'dayActive', e.target.checked)}> <span className="text-lg">☀</span> </CustomCheckbox>
                                     <CustomCheckbox id="create-plant-nightActive" checked={plantBehavior.nightActive} onChange={e => handleBehaviorChange('plant', 'nightActive', e.target.checked)}> <span className="text-lg">☾</span> </CustomCheckbox>
                                  </div> <span className="ml-2 w-6" />
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
                                    <CustomCheckbox id="create-creature-dayActive" checked={creatureBehavior.dayActive} onChange={e => handleBehaviorChange('creature', 'dayActive', e.target.checked)}> <span className="text-lg">☀</span> </CustomCheckbox>
                                    <CustomCheckbox id="create-creature-nightActive" checked={creatureBehavior.nightActive} onChange={e => handleBehaviorChange('creature', 'nightActive', e.target.checked)}> <span className="text-lg">☾</span> </CustomCheckbox>
                                  </div> <span className="ml-2 w-6" />
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
                                   </div> <span className="ml-2 w-6 text-left text-gray-500"></span>
                               </div>
                           </div>
                           {renderNumericField('creature', 'maturationTime', creatureBehavior.maturationTime, 's')}
                           
                           <h3 className="font-bold border-b pb-2 pt-4">Diet</h3>
                           <div className="grid grid-cols-2 gap-2">
                              {allElementTypes.map(typeName => (
                                   <div key={typeName}><label className="flex items-center"><input type="checkbox" checked={eats.includes(typeName)} onChange={() => handleEatsChange(typeName)} className="mr-2"/>{typeName}</label></div>
                              ))}
                           </div>
                           
                            <h3 className="font-bold border-b pb-2 pt-4">Specials</h3>
                            {specials.map(special => renderSpecialCreator(special))}
                            <div className="pt-2">
                                <button onClick={handleGenerateAISpecial} disabled={isGeneratingSpecial} className="w-full p-2 bg-purple-50 hover:bg-purple-100 rounded flex items-center justify-center space-x-2 transition-colors border border-purple-200 text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isGeneratingSpecial ? (
                                        <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <img src="https://raw.githubusercontent.com/copperbleach/sp8393-nyu.edu/refs/heads/main/Assets/Robot.png" alt="AI Generate" className="h-5 w-5" />
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        </>
                                    )}
                                </button>
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