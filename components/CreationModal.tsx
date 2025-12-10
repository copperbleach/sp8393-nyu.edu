import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ElementType, CreatureBehavior, PlantBehavior, SpecialAbility, SpecialType } from '../types';
import { shapeList, getShapeStyle } from '../utils';
import { DEFAULT_SPECIAL_ABILITIES, behaviorTooltips, keyLabelMap } from '../config';
import CustomCheckbox from './CustomCheckbox';
import BehaviorRulesTooltip from './BehaviorRulesTooltip';

interface CreationModalProps {
    allElementTypes: string[];
    onSave: (data: any) => void;
    onCancel: () => void;
    getConstrainedValue: (key: string, value: number, behavior: any) => number;
    getApiKey: () => string | null;
}

const CreationModal: React.FC<CreationModalProps> = ({ allElementTypes, onSave, onCancel, getConstrainedValue, getApiKey }) => {
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
        const behavior = type === ElementType.PLANT ? plantBehavior : { ...creatureBehavior, eats, specials: specials.filter(s => s.enabled) };
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

export default CreationModal;
