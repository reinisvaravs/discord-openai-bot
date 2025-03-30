import express from "express";
import rateLimit from "express-rate-limit";

export function createRemoteRouter(client) {
  const router = express.Router();

  // 5/min limit
  const remoteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
  }); 

  // root /send-remote
  router.post("/", remoteLimiter, express.json(), async (req, res) => {
    console.log("[remote message sent]");
    const { message, channelId, password } = req.body;

    if (password !== process.env.REMOTE_PASSWORD) {
      return res.status(401).json({ error: "❌ Invalid password." });
    }

    if (!message || !channelId) {
      return res.status(400).send("❌ Missing message or channelId.");
    }

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return res.status(400).send("❌ Invalid channel");
      }

      await channel.send(`[remote]\n**${message}**`);
      res.send("✅ Message sent");
    } catch (err) {
      console.error("❌ Failed to send:", err);
      res.status(500).send("❌ Server error");
    }
  });

  return router;
}
