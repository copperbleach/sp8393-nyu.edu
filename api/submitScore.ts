import { VercelRequest, VercelResponse } from '@vercel/node';

const SUBMIT_URL_BASE = 'http://dreamlo.com/lb/2S04HWTVtkiu_E05_TeUEQnqBFW-EtPU6EA2aal5dprQ';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { name, score } = req.body;

    if (!name || typeof score === 'undefined') {
        return res.status(400).json({ error: 'Missing required fields: name and score' });
    }
    
    try {
        const encodedName = encodeURIComponent(name);
        const url = `${SUBMIT_URL_BASE}/add/${encodedName}/${score}`;

        const dreamloResponse = await fetch(url);

        if (!dreamloResponse.ok) {
            const errorBody = await dreamloResponse.text();
            console.error('Dreamlo submission error:', dreamloResponse.status, errorBody);
            return res.status(dreamloResponse.status).json({ error: 'Failed to submit score to Dreamlo service', details: errorBody });
        }
        
        return res.status(201).json({ success: true });

    } catch (error) {
        console.error('Proxy submission error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return res.status(500).json({ error: 'Server error in proxy', details: errorMessage });
    }
}