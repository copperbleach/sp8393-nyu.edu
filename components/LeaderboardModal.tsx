
import React from 'react';

interface LeaderboardModalProps {
    dayCount: number;
    onClose: () => void;
}

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ dayCount, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 flex flex-col justify-center items-center z-50 p-4 font-sans animate-fade-in-down">
            <h1 className="text-6xl font-extrabold text-red-500 mb-4 tracking-wider" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
                EXTINCTION
            </h1>
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm relative flex justify-center items-center h-48">
                <h2 className="text-3xl font-bold text-gray-800 text-center">
                    DAYS SURVIVED: {dayCount}
                </h2>
            </div>
            <button onClick={onClose} className="mt-8 bg-white/80 rounded-full p-2 shadow-lg hover:bg-white transition-transform transform hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    );
};

export default LeaderboardModal;
