const messageHistory = [];
const MAX_HISTORY = 5;

export function addToMessageHistory(role, name, content) {
  messageHistory.push({ role, name, content });
  if (messageHistory.length > MAX_HISTORY) {
    messageHistory.shift();
  }
}

export function getFormattedHistory() {
  return messageHistory.map((msg) => ({
    role: msg.role,
    name: msg.name,
    content: msg.content,
  }));
}

export function resetHistory() {
  messageHistory.length = 0;
}
