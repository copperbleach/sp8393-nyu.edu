// FIX: The original file was an incomplete snippet. It has been replaced with a full Vercel serverless function implementation.
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let { username, score, ecosystemDNA } = req.body;

    if (!username || typeof score === 'undefined' || !ecosystemDNA) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // 如果 ecosystemDNA 是字符串 → 自动转成对象
    if (typeof ecosystemDNA === "string") {
      try {
        ecosystemDNA = JSON.parse(ecosystemDNA);
      } catch (e) {
        return res.status(400).json({ error: "Invalid ecosystemDNA JSON" });
      }
    }

    const { data, error } = await supabase.from("leaderboard").insert({
      username,
      score,
      ecosystemDNA
    });

    if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ success: true, data });
}
