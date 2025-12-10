let { username, score, ecosystemDNA } = body;

// 如果 ecosystemDNA 是字符串 → 自动转成对象
if (typeof ecosystemDNA === "string") {
  try {
    ecosystemDNA = JSON.parse(ecosystemDNA);
  } catch (e) {
    return res.status(400).json({ error: "Invalid ecosystemDNA JSON" });
  }
}

const { error } = await supabase.from("leaderboard").insert({
  username,
  score,
  ecosystemDNA
});
