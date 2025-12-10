import React from 'react';

interface DayNightIndicatorProps {
    dayCount: number;
    isDay: boolean;
}

const DayNightIndicator: React.FC<DayNightIndicatorProps> = ({ dayCount, isDay }) => {
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

export default DayNightIndicator;
