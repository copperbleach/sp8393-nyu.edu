import React from 'react';

// --- Helper Functions ---
export const getRandomNumber = (min: number, max: number) => Math.random() * (max - min) + min;
export const distance = (el1: {x:number, y:number}, el2: {x:number, y:number}) => Math.sqrt(Math.pow(el1.x - el2.x, 2) + Math.pow(el1.y - el2.y, 2));
export const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

// --- Shape Definitions ---
export const shapeList = ['Shape1', 'Shape2', 'Shape3', 'Shape4', 'Shape5', 'Shape6', 'Shape7', 'Shape8', 'Shape9', 'Shape10'];

export const getShapeStyle = (shape: string): React.CSSProperties => {
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
