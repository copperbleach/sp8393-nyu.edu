import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let { username, score, ecosystemDNA } = req.body;

  if (!username || score === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (typeof ecosystemDNA === 'string') {
    try {
      ecosystemDNA = JSON.parse(ecosystemDNA);
    } catch {
      return res.status(400).json({ error: 'Invalid ecosystemDNA JSON' });
    }
  }

  const { error } = await supabase.from('leaderboard').insert({
    username,
    score,
    ecosystemDNA
  });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
