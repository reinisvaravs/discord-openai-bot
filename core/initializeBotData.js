import { loadAndEmbedKnowledge } from "../knowledgeEmbedder.js";
import { getChannelId } from "../db.js";

export async function initializeBotData(client, safeMode) {
  const success = await loadAndEmbedKnowledge();
  console.log("✅ Initial knowledge embedding complete.");

  if (success) {
    const channelId = await getChannelId(`${safeMode}_channel_id`);
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      channel.send("WALL-E is now online. 🤖");
    }
  }

  setInterval(async () => {
    await loadAndEmbedKnowledge();
    console.log("🔄 Knowledge re-embedded from GitHub.");
  }, 10 * 60 * 1000);
}
