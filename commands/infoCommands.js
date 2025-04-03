import { resetHistory } from "../core/messageMemory.js";

export async function handleInfoCommands(message, lastUsedChunks) {
  const content = message.content.trim();

  // Show the current GPT model in use
  if (content === "!model") {
    const model = (await getConfigValue("gpt_model")) || "gpt-3.5-turbo";
    await message.reply(`🤖 Currently using model: \`${model}\``);
    return true;
  }

  // Check if user wants to reset their own memory
  if (message.content.trim() === "!reset") {
    await resetHistory(message.author.id); // remove user's history from db
    message.reply("🧠 Your conversation history has been reset.");
    return true;
  }

  // gets relevant files for the request (not the response)
  if (content === "!files") {
    if (!lastUsedChunks || lastUsedChunks.length === 0) {
      return message.reply("ℹ️ No files were used yet.");
    }

    const filteredFileRefs = lastUsedChunks.filter((c) => c.score <= -0.4);

    if (filteredFileRefs.length === 0) {
      return message.reply(
        "⚠️ No highly relevant sources found (score ≤ 4.0 🔴)."
      );
    }

    const filenames = filteredFileRefs
      .map((entry) => entry.chunk.match(/^\[(.*?)\]/)?.[1])
      .filter(Boolean);

    const uniqueFilenames = [...new Set(filenames)];

    message.reply(
      `📁 Most recent knowledge sources:\n` +
        uniqueFilenames.map((name) => `• ${name}`).join("\n")
    );
    return true;
  }

  // gets relevant sources for the request (not the response)
  if (content === "!source") {
    if (!lastUsedChunks || lastUsedChunks.length === 0) {
      return message.reply("ℹ️ No chunks were used yet.");
    }

    const filteredChunks = lastUsedChunks.filter((c) => c.score <= -0.4);

    if (filteredChunks.length === 0) {
      return message.reply(
        "⚠️ No highly relevant sources found (score ≤ 4.0 🔴)."
      );
    }

    for (const [i, result] of filteredChunks.slice(0, 4).entries()) {
      const preview =
        result.chunk
          .trimStart()
          .replace(/^\[[^\]]+\]\s*/, "")
          .replace(/\n+/g, " ")
          .slice(0, 1000) + (result.chunk.length > 1000 ? "..." : "");

      const filename = result.chunk.match(/^\[(.*?)\]/)?.[1] || "unknown_file";
      const normalizedScore = (Math.abs(result.score) * 10).toFixed(1);

      let emoji = "🟢";
      if (normalizedScore < 6.0) emoji = "🟡";
      if (normalizedScore < 4.0) emoji = "🔴";

      await message.reply(
        `🔍 #${
          i + 1
        } from **${filename}** (relevance: ${emoji} ${normalizedScore}/10):\n${preview}`
      );
    }
    return true;
  }
}
