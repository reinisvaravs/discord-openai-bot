import express from "express";
import { getFormattedHistory, resetHistory } from "../core/messageMemory.js";

const router = express.Router();

router.get("/memory/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const memory = await getFormattedHistory(userId);
    res.json({ success: true, memory });
  } catch (err) {
    console.error("Failed to get memory for user:", userId, err);
    res.status(500).json({ success: false, message: "Error loading memory" });
  }
});

router.post("/memory/:userId/reset", async (req, res) => {
  const { userId } = req.params;

  try {
    await resetHistory(userId);
    res.json({ success: true, message: `Memory reset for user ${userId}` });
  } catch (err) {
    console.error("Error resetting memory for user:", userId, err);
    res
      .status(500)
      .json({ success: false, message: "Failed to reset memory." });
  }
});

export default router;
