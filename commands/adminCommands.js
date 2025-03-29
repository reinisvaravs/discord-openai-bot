import pool from "../db.js";
import { resetFileHashCache } from "../core/fileHashCache.js";

export async function handleAdminCommands(
  message,
  combinedInfoCacheRef,
  refreshFn,
  toggleBotRef,
  allowedChannelIdRef,
  hasAllowedRole,
  client,
  safeMode
) {
  const content = message.content.trim();

  // turns bot off
  if (content === "!bot off") {
    if (!hasAllowedRole(message)) return;
    toggleBotRef.value = false;
    message.reply("🛑 WALL-E is now silent.");
    return true;
  }

  // turns bot on
  else if (content === "!bot on") {
    if (!hasAllowedRole(message)) return;
    toggleBotRef.value = true;
    message.reply("✅ WALL-E is back online.");
  }

  // manual knowledge refresh
  else if (content === "!refresh") {
    if (!hasAllowedRole(message)) return;

    resetFileHashCache(); // Clear previous hashes

    refreshFn().then((newCache) => {
      combinedInfoCacheRef.value = newCache;
      message.reply("🔁 Knowledge refreshed from GitHub (full re-embed).");
    });
  }

  // moves bot to a diff channel
  else if (content.startsWith("!change channel to")) {
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
