import { getRelevantChunksForMessage } from "../knowledgeEmbedder.js";
import { handleAdminCommands } from "../commands/adminCommands.js";
import { handleInfoCommands } from "../commands/infoCommands.js";
import {
  fetchAndParseGithubFiles,
  getKnowledgeSourcesFromGithub,
} from "../githubFileLoader.js";
import { buildSystemPrompt } from "../ai/buildSystemPrompt.js";
import { fetchOpenAIResponse } from "../ai/fetchOpenAIResponse.js";
import {
  addToMessageHistory,
  getFormattedHistory,
} from "../core/messageMemory.js";
import { hasAllowedRole } from "../core/permissions.js";
import { sendTypingAnimation } from "../core/typing.js";
import { getConfigValue, logUserTokenUsage } from "../db.js";

const IGNORE_PREFIX = "!";

export async function onMessageCreate({
  message,
  client,
  openai,
  safeMode,
  toggleBotRef,
  combinedInfoCacheRef, // for !refresh later
  allowedChannelIdRef,
}) {
  if (message.author.bot) return;

  // stop if not in the bot channel
  if (allowedChannelIdRef.value !== message.channelId) return;

  // exec admin command
  const wasAdminCommand = await handleAdminCommands(
    message,
    combinedInfoCacheRef, // for !refresh
    async () => {
      const sources = await getKnowledgeSourcesFromGithub(); // returns {url: download_url, type, name: file_name}
      return await fetchAndParseGithubFiles(sources); // returns allTextChunks
    },
    toggleBotRef, // on/off switch
    allowedChannelIdRef, // channel check
    hasAllowedRole, // permissions check
    client,
    safeMode
  );

  // stop if admin command
  if (wasAdminCommand || !toggleBotRef.value) return;

  // exec info command
  const infoWasHandled = await handleInfoCommands(
    message,
    global.lastUsedChunks
  );

  // stop if info command
  if (infoWasHandled || !toggleBotRef.value) return;

  // save to history
  if (!message.content.startsWith(IGNORE_PREFIX)) {
    addToMessageHistory(
      message.author.id, // userId (used as memory key)
      "user",
      message.author.username,
      message.content
    );
  }

  // typing animation cycle
  sendTypingAnimation(message);
  const sendTypingInterval = setInterval(() => {
    if (message.channel && toggleBotRef.value) {
      sendTypingAnimation(message);
    }
  }, 9000);

  // gets top 8 relevant chunks of info
  // Dynamically choose how many file chunks to include based on message length
  const msgLength = message.content.trim().length;

  let topK = 2;
  if (msgLength > 150) topK = 4;
  if (msgLength > 300) topK = 6;
  if (msgLength > 500) topK = 8;

  console.log(`📊 Message length: ${msgLength}, using topK: ${topK} chunks`);

  const relevantChunks = await getRelevantChunksForMessage(
    message.content,
    topK
  );
  // initial system prompt + the 8 relevant chunks of info
  const systemPrompt = buildSystemPrompt(relevantChunks);

  // system prompt + history
  const conversation = [
    { role: "system", content: systemPrompt },
    ...(await getFormattedHistory(message.author.id)), // must be async cuz it talks to db
  ];

  // fetches openAI response
  const selectedModel = (await getConfigValue("gpt_model")) || "gpt-3.5-turbo"; // default is cheapest
  const response = await fetchOpenAIResponse(
    openai,
    conversation,
    selectedModel
  );

  // Log tokens used (if available)
  if (response?.usage?.total_tokens) {
    await logUserTokenUsage(
      message.author.id,
      selectedModel,
      response.usage.total_tokens
    );
  }

  clearInterval(sendTypingInterval); // not typing after response

  if (!response) {
    message.reply(
      "I'm having some trouble with OpenAI API. Try again in a moment."
    );
    return;
  }

  let responseMessage = response.choices[0].message.content;
  responseMessage = responseMessage
    .split("\n")
    .filter((line, index) => !line.startsWith("WALL-E:") || index === 0) // removes all lines that start with "WALL-E:" except the 1st one
    .join("\n");

  // removes "WALL-E:" from response
  if (responseMessage.startsWith("WALL-E:")) {
    responseMessage = responseMessage.replace(/^WALL-E:\s*/, "");
  }

  const chunkSizeLimit = 2000;
  // if below 2000 char, sends the message
  if (responseMessage.length <= chunkSizeLimit) {
    await message.reply(responseMessage);
    addToMessageHistory(
      message.author.id, // user ID to track separate histories
      "assistant",
      "WALL-E",
      responseMessage // bot's reply
    );
  }
  // if over 2000 char, splits the message into parts and sends multiple messages
  else {
    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
      const chunk = responseMessage.substring(i, i + chunkSizeLimit);
      await message.reply(chunk);
      addToMessageHistory("assistant", "WALL-E", chunk);
      await new Promise((res) => setTimeout(res, 1500)); // delay 1.5s between sending each message part
    }
  }
}
