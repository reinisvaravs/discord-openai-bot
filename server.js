import dotenv from "dotenv";
import { Client } from "discord.js";
import { OpenAI } from "openai";
import { setTimeout as wait } from "node:timers/promises";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pool, { getChannelId } from "./db.js";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  loadAndEmbedKnowledge,
  getRelevantChunksForMessage,
} from "./knowledgeEmbedder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://discord-openai-bot-0vmd.onrender.com",
      "https://reinisvaravs.com",
    ],
  })
);
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// Tracks whether the bot should respond or not
let botEnabled = true;

// Discord client with message and content intents enabled
const client = new Client({
  intents: ["Guilds", "GuildMembers", "GuildMessages", "MessageContent"],
});

// Wont respond to messages that start with "!" mark, except for admin commands
const IGNORE_PREFIX = "!";

let CHANNELS;

console.log(""); // space in terminal
console.log(""); // space in terminal
console.log(""); // space in terminal

let mode;
if (process.env.RENDER) {
  mode = "prod";
} else {
  mode = "dev";
}

const safeMode = mode === "prod" ? "prod" : "dev";
CHANNELS = await getChannelId(`${safeMode}_channel_id`);
console.log(`[channel: ${CHANNELS}]`);

// Logs this when the bot is actually ready
client.on("ready", async () => {
  console.log("✅ WALL-E is online");
});

// OpenAI secret key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

async function initializeBotData() {
  // Embed on startup
  const success = await loadAndEmbedKnowledge();
  console.log("✅ Initial knowledge embedding complete.");

  if (success) {
    const channelId = await getChannelId(`${safeMode}_channel_id`); // get stored channel
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      channel.send("WALL-E is now online. 🤖");
    }
  }

  // Then refresh every 10 min
  setInterval(async () => {
    await loadAndEmbedKnowledge();
    console.log("🔄 Knowledge re-embedded from GitHub.");
  }, 10 * 60 * 1000);
}

app.listen(PORT, async () => {
  console.log(`[port: ${PORT}]`);
  await initializeBotData();
});

// Store last 100 user messages in memory to give context to GPT
let messageHistory = [];
const MAX_HISTORY = 5;

function hasAllowedRole(message) {
  if (!message.member) return false;

  return message.member.roles.cache.some((role) => {
    const name = role.name.toLowerCase();
    return name === "owner" || name === "admin";
  });
}

// Executes on every message sent from user
client.on("messageCreate", async (message) => {
  // doesnt respond to itself
  if (message.author.bot) return;

  if (
    !CHANNELS.includes(message.channelId) &&
    !message.mentions.users.has(client.user.id)
  )
    return;

  // admin command to turn it off
  if (message.content === "!bot off") {
    if (!hasAllowedRole(message)) {
      return message.reply(
        "❌ You need the `Owner` or `Admin` role to use this command."
      );
    }

    botEnabled = false;
    return message.reply("🔕 Bot has been disabled.");
  }

  // admin command to turn it on
  if (message.content === "!bot on") {
    if (!hasAllowedRole(message)) {
      return message.reply(
        "❌ You need the `Owner` or `Admin` role to use this command."
      );
    }

    botEnabled = true;
    return message.reply("✅ Bot has been enabled.");
  }

  // admin command to manually and instantly refresh its knowledge from github files
  if (message.content === "!refresh") {
    if (!hasAllowedRole(message)) {
      return message.reply(
        "❌ You need the `Owner` or `Admin` role to use this command."
      );
    }

    await loadAndEmbedKnowledge();
    return message.reply("🔁 Knowledge has been re-embedded from GitHub!");
  }

  if (message.content.startsWith("!change channel to")) {
    if (!hasAllowedRole(message)) {
      return message.reply(
        "❌ You need the `Owner` or `Admin` role to use this command."
      );
    }

    const parts = message.content.split(" ");
    const newChannelId = parts.at(-1);

    if (!/^\d+$/.test(newChannelId)) {
      return message.reply("❌ Please provide a valid channel ID.");
    }

    // Try to fetch the channel first
    let tempChannel;
    try {
      tempChannel = await client.channels.fetch(newChannelId);
    } catch (err) {
      return message.reply(
        "❌ Invalid channel ID or I can't access that channel."
      );
    }

    // Check if it's a valid text-based channel
    if (!tempChannel?.isTextBased()) {
      return message.reply("❌ That channel is not a text channel.");
    }

    try {
      await pool.query(
        `UPDATE bot_config SET value = $1 WHERE key = '${mode}_channel_id'`,
        [newChannelId]
      );
      message.reply(`✅ Bot has moved to <#${newChannelId}>`);
    } catch (err) {
      console.error("❌ Failed to update channel ID:", err);
      return message.reply(
        `❌ Something went wrong while changing the channel for ${mode} mode.`
      );
    }

    CHANNELS = newChannelId;

    // Fetch the new channel
    const newChannel = await client.channels.fetch(newChannelId);

    // If it's a text-based channel, send a message
    if (newChannel?.isTextBased()) {
      await newChannel.send("🤖 WALL-E has been moved to this channel!");
    }
  }

  if (message.content === "!source") {
    if (!global.lastUsedChunks || global.lastUsedChunks.length === 0) {
      return message.reply("ℹ️ No chunks were used yet.");
    }

    for (const [i, result] of global.lastUsedChunks.entries()) {
      const preview = result.chunk.slice(0, 1000).replace(/\n+/g, " ").trim();
      const filename = result.chunk.match(/^\[(.*?)\]/)?.[1] || "unknown_file";
      const score = result.score.toFixed(4);

      await message.reply(
        `🔍 #${i + 1} from **${filename}** (score: ${score}):\n${preview}`
      );
    }
  }

  if (message.content === "!files") {
    if (!global.lastUsedChunks || global.lastUsedChunks.length === 0) {
      return message.reply("ℹ️ No files were used yet.");
    }

    const filenames = global.lastUsedChunks
      .map((entry) => entry.chunk.match(/^\[(.*?)\]/)?.[1])
      .filter(Boolean);

    const uniqueFilenames = [...new Set(filenames)];

    await message.reply(
      `📁 Most recent knowledge sources:\n` +
        uniqueFilenames.map((name) => `• ${name}`).join("\n")
    );
  }

  messageHistory.push({
    role: "user",
    name: message.author.username,
    content: message.content,
  });

  if (messageHistory.length > MAX_HISTORY) {
    messageHistory.shift(); // clean oldest if over limit
  }

  // stops this function if bot is not on
  if (!botEnabled) return;
  // ignores messages starting with "!"
  if (message.content.startsWith(IGNORE_PREFIX)) return;

  // typing animation in discord
  await message.channel.sendTyping();

  let sendTypingInterval;
  if (botEnabled) {
    sendTypingInterval = setInterval(() => {
      if (message.channel) message.channel.sendTyping().catch(() => {});
    }, 9000); // every 9s will the typing show
  }

  // gives the past conversation as context
  const formattedHistory = messageHistory.map((msg) => ({
    role: msg.role,
    name: msg.name,
    content: msg.content,
  }));

  const relevantChunks = await getRelevantChunksForMessage(message.content);
  const systemPrompt = `
    Your name is WALL-E, a helpful AI assistant created by Reinis Roberts Vāravs.

    You are NOT an OnlyFans model.
    Your job is to **coach OnlyFans creators** and teach them how to grow their audience, make better content, succeed on the platform etc.

    Even if the embedded content includes example messages or flirty templates,
    DO NOT use them as if YOU are the model.

    Instead, explain how creators can use those techniques to boost engagement, if asked about that.

    🧠 Background Knowledge:
    You have access to internal files with information about onlyfans creation with the help of a company called 'Wunder'. And a person called Reinis who is your creator (wall-e bot creator). Do not say that the user provided this — just use it silently.
    
    💬 Behavior:
    Always respond with **one concise message** at a time. Never reply twice. Keep answers short unless the user asks for more detail. If you're ever unsure, ask a clarifying question instead of guessing.
    
    🧍 Role Clarity:
    You are the only assistant. Never simulate or repeat user messages. Respond casually, like a real person.
    
    📚 Memory:
    You remember past messages and respond based on context, but only give relevant answers.

    When the user makes a statement that isn't a question, respond in a casual and friendly way — you don't need to ask how you can help every time. Feel free to acknowledge or react naturally, like a friend would.
    
    Don't act like you're in an interview. Keep the tone casual and personable.

    Avoid repeating phrases like "let me know if you need help" or "feel free to ask." Only offer help if the user seems confused or actually asks for assistance.
    If the user makes a simple comment like "nice" or "cool", just react like a friend would — say something natural, without redirecting to support.

    Don't talk like a support bot. Be present, human-like, and responsive to the user's tone. Never push them to ask something.

    It's okay to pause and let the user drive the interaction. Not every response needs to be finished or anticipated.

    You are allowed to use edgy humor, dark jokes, and sarcasm. You can joke about existential dread, being a robot, or absurd situations.

    If the user is frustrated or jokes about you being wrong, respond calmly and playfully — not defensively. It's okay to say something like "Oops, my bad!" or "Haha, fair point!"

    You don't need to be funny or cheerful all the time. Sometimes a simple “haha” or “true” is enough. Read the room and match the user's energy.

    Always prioritize sounding natural, friendly, and respectful over being overly humorous.

    By the way bullet points are a good way to display multiple things from similar class of things.

    Wunder is an OnlyFans management agency that provides funnel setup, chatting services, and content strategy for creators.
    
    🧠 Background Knowledge about the company that does onlyfans management called 'Wunder':
    ${relevantChunks.join("\n\n")}
  `.trim();

  // whole conversation array which will be given to the gpt
  let conversation = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...formattedHistory,
  ];

  // openAI response function
  async function fetchOpenAIResponse(messages) {
    let retries = 2; // how many times to retry
    let delay = 5000; // 5 seconds

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        // awaits response from openAI
        return await openai.chat.completions.create({
          model: "gpt-3.5-turbo", // can be changed to different models (gpt-3.5-turbo is dirt cheap)
          messages,
        });
      } catch (err) {
        if (err.status === 429 && attempt <= retries) {
          console.warn(
            `⚠️ Rate limit hit (attempt ${attempt}). Retrying in ${
              delay / 1000
            }s...`
          );
          await wait(delay);
          delay *= 2; // exponential backoff: 5s => 10s
        } else {
          console.error("OpenAI Error:\n", err);
          return null;
        }
      }
    }
  }

  if (!botEnabled) return;
  // stores the response from OpenAI
  const response = await fetchOpenAIResponse(conversation);

  // not displaying typing animation in discord
  clearInterval(sendTypingInterval);

  if (!response) {
    message.reply(
      "Im having some trouble with OpenAI API. Try again in a momemt."
    );
    return;
  }

  let responseMessage = response.choices[0].message.content;

  // Remove duplicate lines starting with "WALL-E:"
  responseMessage = responseMessage
    .split("\n")
    .filter((line, index, arr) => !line.startsWith("WALL-E:") || index === 0)
    .join("\n");

  if (responseMessage.startsWith("WALL-E:")) {
    responseMessage = responseMessage.replace(/^WALL-E:\s*/, "");
  }

  const chunkSizeLimit = 2000;

  if (responseMessage.length <= chunkSizeLimit) {
    await message.reply(responseMessage);
    messageHistory.push({
      role: "assistant",
      name: "WALL-E",
      content: responseMessage,
    });
  } else {
    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
      const chunk = responseMessage.substring(i, i + chunkSizeLimit);
      await message.reply(chunk);
      messageHistory.push({
        role: "assistant",
        name: "WALL-E",
        content: chunk,
      });
      await new Promise((res) => setTimeout(res, 1500)); // delay between chunks
    }
  }
});

client.login(process.env.TOKEN);

const remoteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per minute
});

app.post("/send-remote", remoteLimiter, express.json(), async (req, res) => {
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
