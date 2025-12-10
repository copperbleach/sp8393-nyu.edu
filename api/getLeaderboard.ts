import type { VercelRequest, VercelResponse } from '@vercel/node';

const PUBLIC_CODE = "6938f3008f40bb1864853868";
const GET_LEADERBOARD_URL = `http://dreamlo.com/lb/${PUBLIC_CODE}/json`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const response = await fetch(GET_LEADERBOARD_URL);
    const text = await response.text();

    if (!response.ok) {
      console.error("Dreamlo error:", response.status, text);
      return res.status(500).json({ error: "Failed to fetch leaderboard", details: text });
    }

    return res.status(200).send(text); // Dreamlo sometimes breaks JSON.parse, return raw text
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
}