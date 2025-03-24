import dotenv from "dotenv";
import { Client } from "discord.js";
import { OpenAI } from "openai";
import { setTimeout as wait } from "node:timers/promises";
import { readFileSync } from "fs";

dotenv.config();

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

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith(IGNORE_PREFIX)) return;
  if (
    !CHANNELS.includes(message.channelId) &&
    !message.mentions.users.has(client.user.id)
  )
    return;

  await message.channel.sendTyping();

  const sendTypingInterval = setInterval(() => {
    if (message.channel) message.channel.sendTyping().catch(() => {});
  }, 9000); // 9s delay

  let conversation = [];
  const infoFromFile = readFileSync("./info.txt", "utf8");

  const companyData = JSON.parse(readFileSync("./info.json", "utf8"));
  const formattedCompanyInfo = `
    Company: ${companyData.company}
    Founder: ${companyData.founder}
    Founded: ${companyData.founded}
    Mission: ${companyData.mission}
    Core Values: ${companyData.values.join(", ")}
    Contact Email: ${companyData.contact.email}
    Location: ${companyData.contact.location}
  `;

  conversation.push({
    role: "system",
    content: `Your name is WALL-E, a Discord bot. Respond in a friendly and casual manner - as a friend.`,
  });

  conversation.push({
    role: "user",
    content: `Here is some important information:\n${infoFromFile}`,
  });

  conversation.push({
    role: "user",
    content: `Here is internal company info you always know:\n${formattedCompanyInfo}`,
  });

  let prevMessages = await message.channel.messages.fetch({ limit: 10 });
  prevMessages.reverse();

  prevMessages.forEach((msg) => {
    if (msg.author.bot && msg.author.id !== client.user.id) return;
    if (msg.content.startsWith(IGNORE_PREFIX)) return;

    const username = msg.author.username
      .replace(/\s+/g, "_")
      .replace(/[^\w\s]/gi, "");

    if (msg.author.id === client.user.id) {
      conversation.push({
        role: "assistant",
        name: username,
        content: msg.content,
      });
      return;
    }

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
