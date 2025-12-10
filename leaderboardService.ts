import { LeaderboardEntry } from './types';

interface DreamloEntry {
    name: string;
    score: string;
    seconds: string;
    text: string;
    date: string;
}

const GET_LEADERBOARD_URL = '/api/getLeaderboard';
const SUBMIT_SCORE_URL = '/api/submitScore';

/**
 * Fetches the top 10 leaderboard scores via the application's API proxy.
 * This avoids browser mixed-content errors and keeps API keys secure.
 */
export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    try {
        const response = await fetch(GET_LEADERBOARD_URL);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch leaderboard from API. Status:', response.status, 'Body:', errorText);
            throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
        }
        
        // The API proxy returns the raw text from Dreamlo.
        const rawText = await response.text();
        const data = JSON.parse(rawText);

        const entryData = data.dreamlo?.leaderboard?.entry;
        const entries: DreamloEntry[] = entryData ? (Array.isArray(entryData) ? entryData : [entryData]) : [];

        return entries.slice(0, 10).map((entry, index) => ({
            id: `${entry.name}-${entry.date}-${index}`,
            username: entry.name,
            score: parseInt(entry.score, 10),
        }));

    } catch (error) {
        console.error("Error processing leaderboard data from API:", error);
        throw error;
    }
};

/**
 * Submits a new score via the application's API proxy.
 */
export const submitScore = async (name: string, score: number): Promise<{ success: true }> => {
    try {
        const response = await fetch(SUBMIT_SCORE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: name.trim(), score }),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error('Failed to submit score via API. Status:', response.status, 'Body:', errorBody);
            throw new Error(`Failed to submit score: ${errorBody.error || response.statusText}`);
        }
        
        await response.json();
        return { success: true };

    } catch (error) {
        console.error("Error submitting score via API:", error);
        throw error;
    }
};