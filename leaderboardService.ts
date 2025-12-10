import { LeaderboardEntry } from './types';

const GET_LEADERBOARD_URL = 'https://ecosystemsimulator.vercel.app/api/getLeaderboard';
const SUBMIT_SCORE_URL = 'https://ecosystemsimulator.vercel.app/api/submitScore';

/**
 * Fetches the top 10 leaderboard scores from the backend.
 */
export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    try {
        const response = await fetch(GET_LEADERBOARD_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // The backend might wrap the array, so we check for a 'leaderboard' property or use the data directly.
        return data.leaderboard || data;
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        throw error; // Re-throw the error to be handled by the UI component
    }
};

/**
 * Submits a new score to the backend.
 */
export const submitScore = async (name: string, score: number, ecosystemDNA: string): Promise<{ success: true }> => {
    try {
        const response = await fetch(SUBMIT_SCORE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: name,
                score: score,
                ecosystemDNA: ecosystemDNA,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to submit score: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        return { success: true };
    } catch (error) {
        console.error("Error submitting score:", error);
        throw error; // Re-throw the error to be handled by the UI component
    }
};
