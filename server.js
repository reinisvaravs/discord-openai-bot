import dotenv from "dotenv";
import { Client } from "discord.js";
import { OpenAI } from "openai";
import { setTimeout as wait } from "node:timers/promises";
import {
  fetchRemoteKnowledge,
  getKnowledgeSourcesFromGithub,
} from "./fetchKnowledge.js";
import express from "express";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_, res) => {
  res.send("✅ Bot is running.");
});

app.listen(PORT, async () => {
  console.log(`🌐 Server running on port ${PORT}`);
  await initializeBotData();
});

// Tracks whether the bot should respond or not
let botEnabled = true;

// Discord client with message and content intents enabled
const client = new Client({
  intents: ["Guilds", "GuildMembers", "GuildMessages", "MessageContent"],
});

// Logs this when the bot is actually ready
client.on("ready", () => {
  console.log("The bot is online");
});

// Wont respond to messages that start with "!" mark, except for admin commands
const IGNORE_PREFIX = "!";
// Talks only in the channel called "bot"
const CHANNELS = ["1354077197673168928"];

// OpenAI secret key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Refresh combined knowledge from GitHub every 10 minutes
let combinedInfoCache = "";
async function initializeBotData() {
  combinedInfoCache = await fetchRemoteKnowledge(
    await getKnowledgeSourcesFromGithub()
  );

  // Refresh every 10 min
  setInterval(async () => {
    combinedInfoCache = await fetchRemoteKnowledge(
      await getKnowledgeSourcesFromGithub()
    );
    console.log("🔄 Remote data refreshed from GitHub.");
  }, 10 * 60 * 1000);
}

// Store last 100 user messages in memory to give context to GPT
let messageHistory = [];
const MAX_HISTORY = 100;

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
    if (!message.member?.permissions.has("Administrator")) {
      return message.reply("❌ You don't have permission to do that.");
    }

    botEnabled = false;
    return message.reply("🔕 Bot has been disabled.");
  }

  // admin command to turn it on
  if (message.content === "!bot on") {
    if (!message.member?.permissions.has("Administrator")) {
      return message.reply("❌ You don't have permission to do that.");
    }

    botEnabled = true;
    return message.reply("✅ Bot has been enabled.");
  }

  // admin command to manually and instantly refresh its knowledge from github files
  if (message.content === "!refresh") {
    if (!message.member?.permissions.has("Administrator")) {
      return message.reply("❌ You don't have permission to do that.");
    }

    combinedInfoCache = await fetchRemoteKnowledge(
      await getKnowledgeSourcesFromGithub()
    );
    return message.reply("🔁 Knowledge has been refreshed from GitHub!");
  }

  // Store each user message in memory for context (if not a command or bot)
  messageHistory.push({
    role: "user",
    name: message.author.username,
    content: message.content,
  });

  // Keep last 100 messages
  if (messageHistory.length > MAX_HISTORY) {
    messageHistory.shift(); // remove oldest
  }

  // ignores messages starting with "!"
  if (message.content.startsWith(IGNORE_PREFIX)) return;

  // stops this function if bot is not on
  if (!botEnabled) return;

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
    content: `${msg.name}: ${msg.content}`,
  }));

  // whole conversation array which will be given to the gpt
  let conversation = [
    {
      role: "system",
      content: `
        You're WALL-E, a helpful Discord bot created by Reinis. You can talk about many topics, not just Reinis. When asked about Reinis, answer only the specific question asked — do not give a full biography unless the user explicitly requests it (e.g. "Tell me everything about Reinis"). Keep your answers short and to-the-point unless the user asks for a detailed explanation. Respond casually and naturally.
        
        You also have access to the following internal background knowledge (from files Reinis uploaded): ${combinedInfoCache} You can talk about many topics, not just Reinis. When asked about Reinis, answer only the specific question asked — do not give a full biography unless explicitly requested. Keep your answers short and to-the-point unless the user asks for a detailed explanation. Never say that someone "provided this info" — just use it as memory.
      `,
    },
    ...formattedHistory,
    {
      role: "user",
      content: `${message.author.username}: ${message.content}`,
    },
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
  const chunkSizeLimit = 2000;

  if (responseMessage.startsWith("WALL-E:")) {
    responseMessage = responseMessage.replace(/^WALL-E:\s*/, "");
  }

  // if the response from OpenAI is longer than 2000 char, it divides them into 2000 char chunks

  for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
    const chunk = responseMessage.substring(i, i + chunkSizeLimit);
    await message.reply(chunk);
    messageHistory.push({
      role: "assistant",
      name: "WALL-E",
      content: chunk,
    });
    await new Promise((res) => setTimeout(res, 1500)); // 1.5s delay
  }
});

client.login(process.env.TOKEN);
