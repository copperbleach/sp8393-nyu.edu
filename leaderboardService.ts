import { LeaderboardEntry } from './types';

interface DreamloEntry {
    name: string;
    score: string;
    seconds: string;
    text: string;
    date: string;
}

/**
 * Fetches the top 10 leaderboard scores via the backend proxy.
 */
export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    try {
        const response = await fetch('/api/getLeaderboard');
        if (!response.ok) {
            throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const entries: DreamloEntry[] = data.dreamlo?.leaderboard?.entry || [];

        // Map to our LeaderboardEntry type and take the top 10
        return entries.slice(0, 10).map((entry, index) => ({
            id: `${entry.name}-${entry.date}-${index}`, // Create a unique ID
            username: entry.name,
            score: parseInt(entry.score, 10),
        }));

    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        throw error; // Re-throw the error to be handled by the UI component
    }
};

/**
 * Submits a new score via the backend proxy.
 */
export const submitScore = async (name: string, score: number): Promise<{ success: true }> => {
    try {
        const response = await fetch('/api/submitScore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, score }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to submit score: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error submitting score:", error);
        throw error; // Re-throw the error to be handled by the UI component
    }
};