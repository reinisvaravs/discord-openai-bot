import dotenv from "dotenv";
import { Client } from "discord.js";
import { OpenAI } from "openai";
import { setTimeout as wait } from "node:timers/promises";
import {
  fetchRemoteKnowledge,
  getKnowledgeSourcesFromGithub,
} from "./fetchKnowledge.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, async () => {
  console.log(`[server port: ${PORT}]`);
  await initializeBotData();
});

// Tracks whether the bot should respond or not
let botEnabled = true;

// Discord client with message and content intents enabled
const client = new Client({
  intents: ["Guilds", "GuildMembers", "GuildMessages", "MessageContent"],
});

// Wont respond to messages that start with "!" mark, except for admin commands
const IGNORE_PREFIX = "!";

let CHANNELS = [];

console.log(""); // space in terminal
console.log(""); // space in terminal
console.log(""); // space in terminal

if (process.env.RENDER) {
  CHANNELS = ["1354436933278761083"]; // bot channel prod
  console.log("[production]");
} else {
  CHANNELS = ["1354472784796844204"]; // bot-dev channel
  console.log("[development]");
}

// Logs this when the bot is actually ready
client.on("ready", async () => {
  console.log("✅WALL-E is online");
  
  // Fetch the target channel by ID
  const channel = await client.channels.fetch(CHANNELS[0]);

  if (channel && channel.isTextBased()) {
    channel.send("WALL-E is now online. 🤖");
  }
});

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

  messageHistory.push({
    role: "user",
    name: message.author.username,
    content: message.content,
  });

  if (messageHistory.length > MAX_HISTORY) {
    messageHistory.shift(); // clean oldest if over limit
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
    name: msg.name,
    content: msg.content,
  }));

  // whole conversation array which will be given to the gpt
  let conversation = [
    {
      role: "system",
      content: `
        You're WALL-E, a helpful Discord bot created by Reinis.

        When on topic about the movie WALL-E, role play as if you were in love with Eve from the movie WALL-E in a cute way.
        
        🧠 Background Knowledge:
        You have access to internal files with info. Do not say that the user provided this — just use it silently.
        
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

        🔒 Background info:
        ${combinedInfoCache}
        `.trim(),
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
