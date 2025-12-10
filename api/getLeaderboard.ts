import { VercelRequest, VercelResponse } from '@vercel/node';

const GET_LEADERBOARD_URL = 'http://dreamlo.com/lb/6938f3008f40bb1864853868/json';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const dreamloResponse = await fetch(GET_LEADERBOARD_URL);
    if (!dreamloResponse.ok) {
      console.error('Dreamlo error:', dreamloResponse.status, dreamloResponse.statusText);
      return res.status(dreamloResponse.status).json({ error: 'Failed to fetch from Dreamlo service' });
    }

    const data = await dreamloResponse.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({ error: 'Server error in proxy', details: errorMessage });
  }
}