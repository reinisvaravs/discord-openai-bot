import dotenv from "dotenv";
import { Client } from "discord.js";
import { OpenAI } from "openai";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteKnowledge, knowledgeSources } from "./fetchKnowledge.js";
import express from "express";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_, res) => {
  res.send("✅ Bot is running.");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

let botEnabled = true;

const client = new Client({
  intents: ["Guilds", "GuildMembers", "GuildMessages", "MessageContent"],
});

client.on("ready", () => {
  console.log("The bot is online");
});

const IGNORE_PREFIX = "!";
const CHANNELS = ["1353724696214110280"];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

let combinedInfoCache = await fetchRemoteKnowledge(knowledgeSources);

// Auto-refresh information every 10 minutes from github "reinisvaravs/discord-bot-test-info"
setInterval(async () => {
  combinedInfoCache = await fetchRemoteKnowledge(knowledgeSources);
  console.log("🔄 Remote data refreshed from GitHub.");
}, 10 * 60 * 1000);

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (
    !CHANNELS.includes(message.channelId) &&
    !message.mentions.users.has(client.user.id)
  )
    return;

  if (message.content === "!bot off") {
    if (!message.member?.permissions.has("Administrator")) {
      return message.reply("❌ You don't have permission to do that.");
    }

    botEnabled = false;
    return message.reply("🔕 Bot has been disabled.");
  }

  if (message.content === "!bot on") {
    if (!message.member?.permissions.has("Administrator")) {
      return message.reply("❌ You don't have permission to do that.");
    }

    botEnabled = true;
    return message.reply("✅ Bot has been enabled.");
  }

  if (message.content.startsWith(IGNORE_PREFIX)) return;

  if (!botEnabled) return;

  await message.channel.sendTyping();

  let sendTypingInterval;
  if (botEnabled) {
    sendTypingInterval = setInterval(() => {
      if (message.channel) message.channel.sendTyping().catch(() => {});
    }, 9000);
  }

  let conversation = [];

  conversation.push({
    role: "system",
    content: `Your name is WALL-E, a Discord bot. Respond in a friendly and casual manner - as a friend. I like responses that are short and sweet and to the point.`,
  });

  conversation.push({
    role: "user",
    content: `Here is internal info:\n${combinedInfoCache}`,
  });

  let prevMessages = await message.channel.messages.fetch({ limit: 10 }); // uses last 10 messages for context
  prevMessages.reverse();

  prevMessages.forEach((msg) => {
    if (msg.author.bot) return;
    if (msg.content.startsWith(IGNORE_PREFIX)) return;

    const username = msg.author.username
      .replace(/\s+/g, "_")
      .replace(/[^\w\s]/gi, "");

    if (msg.author.id === client.user.id) return;

    conversation.push({
      role: "user",
      name: username,
      content: msg.content,
    });
  });

  async function fetchOpenAIResponse(messages) {
    let retries = 2; // how many times to retry
    let delay = 5000; // 5 seconds

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        return await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
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
  const response = await fetchOpenAIResponse(conversation);

  clearInterval(sendTypingInterval);

  if (!response) {
    message.reply(
      "Im having some trouble with OpenAI API. Try again in a momemt."
    );
    return;
  }

  const responseMessage = response.choices[0].message.content;
  const chunkSizeLimit = 2000;

  for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
    const chunk = responseMessage.substring(i, i + chunkSizeLimit);
    await message.reply(chunk);
    await new Promise((res) => setTimeout(res, 1500)); // 1.5s delay
  }
});

client.login(process.env.TOKEN);
