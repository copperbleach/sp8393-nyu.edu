import React from 'react';
import { ElementType } from '../types';
import { getShapeStyle } from '../utils';

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

export default InstanceCounter;
