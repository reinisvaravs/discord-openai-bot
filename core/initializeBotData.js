import { loadAndEmbedKnowledge } from "../knowledgeEmbedder.js";
import { getChannelId } from "../db.js";

export async function initializeBotData(client, safeMode) {
  const success = await loadAndEmbedKnowledge();

  if (success) {
    const channelId = await getChannelId(`${safeMode}_channel_id`);
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      channel.send("WALL-E is now online. 🤖");
    }
  }

  let githubCheckCounter = 0

  // check knowledge for changes
  setInterval(async () => {
    githubCheckCounter += 1
    await loadAndEmbedKnowledge();
    console.log(`[github check #${githubCheckCounter}]`);
  }, 10 * 60 * 1000); // 10min interval
}
