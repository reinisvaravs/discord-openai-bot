
export async function handleInfoCommands(message, lastUsedChunks) {
  const content = message.content.trim();

  if (content === "!files") {
    if (!lastUsedChunks || lastUsedChunks.length === 0) {
      return message.reply("ℹ️ No files were used yet.");
    }

    const filenames = lastUsedChunks
      .map((entry) => entry.chunk.match(/^\[(.*?)\]/)?.[1])
      .filter(Boolean);

    const uniqueFilenames = [...new Set(filenames)];

    return message.reply(
      `📁 Most recent knowledge sources:\n` +
        uniqueFilenames.map((name) => `• ${name}`).join("\n")
    );
  }

  if (content === "!source") {
    if (!lastUsedChunks || lastUsedChunks.length === 0) {
      return message.reply("ℹ️ No chunks were used yet.");
    }

    for (const [i, result] of lastUsedChunks.entries()) {
      const preview = result.chunk.slice(0, 1000).replace(/\n+/g, " ").trim();
      const filename = result.chunk.match(/^\[(.*?)\]/)?.[1] || "unknown_file";
      const score = result.score.toFixed(4);

      await message.reply(
        `🔍 #${i + 1} from **${filename}** (score: ${score}):\n${preview}`
      );
    }
  }
}
