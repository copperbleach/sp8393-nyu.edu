import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ElementType } from '../types';

interface BehaviorRulesTooltipProps {
    elementType: ElementType;
}

const BehaviorRulesTooltip: React.FC<BehaviorRulesTooltipProps> = ({ elementType }) => {
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

    const creatureRules = `1 ≤ Speed ≤ 99\n30 ≤ Lifespan ≤ 3600\n5 ≤ Hunger ≤ 180\n10 ≤ Starvation ≤ 180\n5 ≤ Reproduction ≤ 1200\n\n---\n\nHunger < Starvation\nStarvation < Lifespan\nReproduction < Lifespan\nMaturation < Lifespan`;
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

export default BehaviorRulesTooltip;