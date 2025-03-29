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
import { hasAllowedRoleFromMessage } from "../core/permissions.js";
import { sendTypingAnimation } from "../core/typing.js";

const IGNORE_PREFIX = "!";

export async function onMessageCreate({
  message,
  client,
  openai,
  safeMode,
  toggleBotRef,
  combinedInfoCacheRef,
  allowedChannelIdRef,
}) {
  if (message.author.bot) return;

  if (
    allowedChannelIdRef.value !== message.channelId &&
    !message.mentions.users.has(client.user.id)
  )
    return;

  const wasAdminCommand = await handleAdminCommands(
    message,
    combinedInfoCacheRef,
    async () => {
      const sources = await getKnowledgeSourcesFromGithub();
      return await fetchAndParseGithubFiles(sources);
    },
    toggleBotRef,
    allowedChannelIdRef,
    hasAllowedRoleFromMessage,
    client,
    safeMode
  );

  if (wasAdminCommand || !toggleBotRef.value) return;

  const infoWasHandled = await handleInfoCommands(
    message,
    global.lastUsedChunks
  );
  if (infoWasHandled || !toggleBotRef.value) return;

  if (!message.content.startsWith(IGNORE_PREFIX)) {
    addToMessageHistory("user", message.author.username, message.content);
  }

  if (message.content.startsWith(IGNORE_PREFIX)) return;

  sendTypingAnimation(message);
  const sendTypingInterval = setInterval(() => {
    if (message.channel && toggleBotRef.value) {
      sendTypingAnimation(message);
    }
  }, 9000);

  const relevantChunks = await getRelevantChunksForMessage(message.content);
  const systemPrompt = buildSystemPrompt(relevantChunks);

  const conversation = [
    { role: "system", content: systemPrompt },
    ...getFormattedHistory(),
  ];

  const response = await fetchOpenAIResponse(openai, conversation);
  clearInterval(sendTypingInterval);

  if (!response) {
    message.reply(
      "I'm having some trouble with OpenAI API. Try again in a moment."
    );
    return;
  }

  let responseMessage = response.choices[0].message.content;
  responseMessage = responseMessage
    .split("\n")
    .filter((line, index) => !line.startsWith("WALL-E:") || index === 0)
    .join("\n");

  if (responseMessage.startsWith("WALL-E:")) {
    responseMessage = responseMessage.replace(/^WALL-E:\s*/, "");
  }

  const chunkSizeLimit = 2000;
  if (responseMessage.length <= chunkSizeLimit) {
    await message.reply(responseMessage);
    addToMessageHistory("assistant", "WALL-E", responseMessage);
  } else {
    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
      const chunk = responseMessage.substring(i, i + chunkSizeLimit);
      await message.reply(chunk);
      addToMessageHistory("assistant", "WALL-E", chunk);
      await new Promise((res) => setTimeout(res, 1500));
    }
  }
}
