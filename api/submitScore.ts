export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { username, score, ecosystemDNA } = body;

  if (!username || score === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
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
