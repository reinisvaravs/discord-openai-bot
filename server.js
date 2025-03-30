import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "discord.js";
import { OpenAI } from "openai";

import { getChannelId } from "./db.js";
import { onMessageCreate } from "./events/onMessageCreate.js";
import { initializeBotData } from "./core/initializeBotData.js";
import { createRemoteRouter } from "./routes/remoteRouter.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment mode
const safeMode = process.env.RENDER ? "prod" : "dev";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://discord-openai-bot-0vmd.onrender.com",
      "https://reinisvaravs.com",
    ],
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Initialize Discord client
const client = new Client({
  intents: ["Guilds", "GuildMembers", "GuildMessages", "MessageContent"],
});

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Ready event
client.on("ready", () => {
  console.log("✅ WALL-E is online");
});

// Prepare shared refs
let combinedInfoCache = [];
const toggleBotRef = { value: true };
const allowedChannelIdRef = {
  value: await getChannelId(`${safeMode}_channel_id`),
};

// Handle incoming Discord messages
client.on("messageCreate", (message) => {
  onMessageCreate({
    message,
    client,
    openai,
    safeMode,
    toggleBotRef,
    combinedInfoCacheRef: { value: combinedInfoCache },
    allowedChannelIdRef,
  });
});

// Start the server
app.listen(PORT, async () => {
  console.log(`[port: ${PORT}]`);
  await initializeBotData(client, safeMode);
});

// Remote HTTP control route
app.use("/send-remote", createRemoteRouter(client));

// Login to Discord
client.login(process.env.TOKEN);
