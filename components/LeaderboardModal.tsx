import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LeaderboardEntry } from '../types';
import { getLeaderboard, submitScore } from '../leaderboardService';

interface LeaderboardModalProps {
    dayCount: number;
    onClose: () => void;
    onTryEcosystem: (dna: string) => void;
}


const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ dayCount, onClose }) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userName, setUserName] = useState('');
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [userEntry, setUserEntry] = useState<{ name: string; score: number } | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoading(true);
            try {
                const data = await getLeaderboard();
                setLeaderboard(data);
            } catch (error) {
                console.error("Failed to fetch leaderboard", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    useEffect(() => {
        if (!isLoading && !hasSubmitted && nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, [isLoading, hasSubmitted]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userName.trim()) return;

        const finalUserName = userName.trim().toUpperCase();
        const savedConfig = localStorage.getItem('webEcosystemSimulator_lastConfig');
        if (!savedConfig) {
            alert("Could not find ecosystem DNA to submit.");
            return;
        }

        const ecosystemDNAObject = JSON.parse(savedConfig);

        setIsSubmitting(true);
        try {
            await submitScore(finalUserName, dayCount, ecosystemDNAObject);
            setUserEntry({ name: finalUserName, score: dayCount });
            setHasSubmitted(true);

            const newData = await getLeaderboard();
            setLeaderboard(newData);
        } catch (error) {
            console.error("Failed to submit score", error);
            alert("Failed to submit score. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isUserInTop10 = useMemo(() => {
        if (!userEntry) return false;
        return leaderboard.some(e => e.username === userEntry.name && e.score === userEntry.score);
    }, [leaderboard, userEntry]);

    return (
        <div className="fixed inset-0 bg-black/60 flex flex-col justify-center items-center z-50 p-4 font-sans animate-fade-in-down">
            <h1
                className="text-6xl font-extrabold text-red-500 mb-4 tracking-wider"
                style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}
            >
                EXTINCTION
            </h1>

            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm relative">
                <h2 className="text-3xl font-bold text-gray-800 text-center mb-6">
                    DAYS SURVIVED: {dayCount}
                </h2>

                {isLoading && (
                    <div className="flex justify-center items-center h-64">
                        <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
                    </div>
                )}

                {!isLoading && (
                    <ul className="space-y-3 text-lg font-medium text-gray-700">
                        {leaderboard.map((entry, index) => (
                            <li key={entry.id} className="flex items-center">
                                <span className="w-8 text-right mr-3 opacity-60">{index + 1}</span>
                                <span className="flex-grow truncate uppercase tracking-wider">
                                    {entry.username}
                                </span>
                                <span className="font-semibold ml-2 w-10 text-left">{entry.score}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {hasSubmitted && userEntry && !isUserInTop10 && (
                    <>
                        <div className="border-t-2 border-dashed border-gray-300 my-4"></div>
                        <ul className="text-lg font-medium text-gray-700">
                            <li className="flex items-center">
                                <span className="w-8 text-right mr-3 opacity-60">-</span>
                                <span className="flex-grow truncate uppercase tracking-wider">
                                    {userEntry.name}
                                </span>
                                <span className="font-semibold ml-4">{userEntry.score}</span>
                            </li>
                        </ul>
                    </>
                )}

                {!hasSubmitted && !isLoading && (
                    <form onSubmit={handleSubmit} className="mt-6 flex items-center space-x-2">
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            maxLength={10}
                            placeholder="YOUR NAME"
                            className="flex-grow px-3 py-2 border-2 border-gray-300 rounded-lg
                              focus:outline-none focus:border-blue-500 transition uppercase tracking-wider text-center"
                        />
                        <button
                            type="submit"
                            className="flex-shrink-0 p-2 text-gray-600 hover:text-green-500 transition-colors
                              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center 
                              w-[44px] h-[44px]"
                            disabled={!userName.trim() || isSubmitting}
                        >
                            {isSubmitting ? (
                                <div className="w-6 h-6 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    </form>
                )}
            </div>

            <button
                onClick={onClose}
                className="mt-8 bg-white/80 rounded-full p-2 shadow-lg hover:bg-white 
                transition-transform transform hover:scale-110"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

export default LeaderboardModal;
