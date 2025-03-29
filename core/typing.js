export function sendTypingAnimation(message) {
  if (!message?.channel?.sendTyping) return;

  message.channel.sendTyping().catch(() => {
    console.warn("⚠️ Failed to send typing animation.");
  });
}
