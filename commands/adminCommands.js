import pool, { setConfigValue, getConfigValue } from "../db.js";
import { loadAndEmbedKnowledge } from "../knowledgeEmbedder.js";
import { resetHistory } from "../core/messageMemory.js";
import { hasAllowedRole } from "../core/permissions.js";

export async function handleAdminCommands(
  message,
  toggleBotRef,
  allowedChannelIdRef,
  client,
  safeMode
) {
  const content = message.content.trim();

  if (content.startsWith("!set model ")) {
    if (!hasAllowedRole(message)) return;

    const model = content.split("!set model ")[1].trim();

    // optionally validate against a known list of OpenAI models
    const allowedModels = ["gpt-3.5-turbo", "gpt-4o"];
    if (!allowedModels.includes(model)) {
      return message.reply(
        "⚠️ Invalid model. Choose one of: " + allowedModels.join(", ")
      );
    }

    await setConfigValue("gpt_model", model);
    message.reply(`✅ Model updated to **${model}**`);
    return true;
  }

  // reset another user's memory by userId
  if (message.content.startsWith("!reset ")) {
    if (!(await hasAllowedRole(message))) {
      await message.reply(
        "❌ You do not have permission to reset other users."
      );
      return true;
    }

    const userId = message.content.split(" ")[1]?.trim();

    if (!userId || !/^\d+$/.test(userId)) {
      await message.reply(
        "⚠️ Please provide a valid numeric user ID. Example:\n`!reset 123456789012345678`"
      );
      return true;
    }

    await resetHistory(userId);

    try {
      const user = await message.guild.members.fetch(userId);
      const username = user.user.username;
      await message.reply(`✅ Reset memory for **${username}** (${userId})`);
    } catch (err) {
      console.warn("⚠️ Couldn't resolve user from ID:", userId);
      await message.reply(
        `✅ Reset memory for user ID: \`${userId}\`\n⚠️ (Username not found — they might have left the server)`
      );
    }

    return true;
  }

  // turns bot off
  if (content === "!bot off") {
    if (!hasAllowedRole(message)) return;
    toggleBotRef.value = false;
    message.reply("🛑 WALL-E is now silent.");
    return true;
  }

  // turns bot on
  if (content === "!bot on") {
    if (!hasAllowedRole(message)) return;
    toggleBotRef.value = true;
    message.reply("✅ WALL-E is back online.");
    return true;
  }

  // manual knowledge refresh
  if (content === "!refresh") {
    if (!hasAllowedRole(message)) return;

    console.log("Checking for updated GitHub files...");

    loadAndEmbedKnowledge()
      .then(() => {
        message.reply("🔁 Knowledge refreshed.");
      })
      .catch((err) => {
        console.error("❌ Error during refresh:", err);
        message.reply("❌ Something went wrong while refreshing knowledge.");
      });

    return true;
  }

  // moves bot to a diff channel
  if (content.startsWith("!change channel to")) {
    if (!hasAllowedRole(message)) {
      return message.reply(
        "❌ You need the `Owner` or `Admin` role to use this command."
      );
    }

    const parts = content.split(" ");
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
        `UPDATE bot_config SET value = $1 WHERE key = '${safeMode}_channel_id'`,
        [newChannelId]
      );
      message.reply(`✅ Bot has moved to <#${newChannelId}>`);
    } catch (err) {
      console.error("❌ Failed to update channel ID:", err);
      return message.reply(
        `❌ Something went wrong while changing the channel for ${safeMode} mode.`
      );
    }

    allowedChannelIdRef.value = newChannelId;

    // Fetch the new channel
    const newChannel = await client.channels.fetch(newChannelId);

    // If it's a text-based channel, send a message
    if (newChannel?.isTextBased()) {
      await newChannel.send("🤖 WALL-E has been moved to this channel!");
    }
    return true;
  }
  return false;
}
