import type { VercelRequest, VercelResponse } from '@vercel/node';

//
// PRIVATE CODE → 用来添加分数
//
const PRIVATE_CODE = "2S04HWTVtkiu_E05_TeUEQnqBFW-EtPU6EA2aal5dprQ";
const SUBMIT_URL_BASE = `http://dreamlo.com/lb/${PRIVATE_CODE}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { name, score } = req.body || {};

  if (!name || typeof score !== "number") {
    return res.status(400).json({ error: "Missing required fields: name and score" });
  }

  try {
    const encodedName = encodeURIComponent(name.trim());
    const dreamloUrl = `${SUBMIT_URL_BASE}/add/${encodedName}/${score}`;

    console.log("Submitting to Dreamlo:", dreamloUrl);

    const response = await fetch(dreamloUrl);
    const resultText = await response.text();

    if (!response.ok) {
      console.error("Dreamlo error:", resultText);
      return res.status(500).json({
        error: "Dreamlo rejected the submission",
        details: resultText
      });
    }

    return res.status(201).json({ success: true, result: resultText });

  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message
    });
  }
}