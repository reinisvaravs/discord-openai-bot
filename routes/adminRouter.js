import express from "express";
import { getFormattedHistory, resetHistory } from "../core/messageMemory.js";
import pool from "../db.js";

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

router.get("/logs", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, model, tokens, created_at
       FROM user_logs
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json({ success: true, logs: result.rows });
  } catch (err) {
    console.error("Error fetching usage logs:", err);
    res.status(500).json({ success: false, message: "Failed to fetch logs" });
  }
});

export default router;
