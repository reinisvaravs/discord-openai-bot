import express from "express";

export function statusRouter(sharedData) {
  const router = express.Router();

  // root /status
  router.get("/", async (req, res) => {
    res.json({
      status: "online",
      mode: sharedData.safeMode,
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      channelId: sharedData.allowedChannelIdRef.value,
    });
  });

  return router;
}
