// Stores conversation history separately for each user by their Discord user ID
const messageHistories = new Map(); // userId -> array of { role, name, content }

const MAX_HISTORY = 20; // maximum messages to remember per user

// Adds a message to a specific user's history
export function addToMessageHistory(userId, role, name, content) {
  if (!messageHistories.has(userId)) {
    messageHistories.set(userId, []);
  }

  const history = messageHistories.get(userId);
  history.push({ role, name, content });

  // Remove the oldest message if we exceed the max history limit
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
}

// Returns the formatted message history for a specific user
export function getFormattedHistory(userId) {
  return (messageHistories.get(userId) || []).map((msg) => ({
    role: msg.role,
    name: msg.name,
    content: msg.content,
  }));
}

// Clears all memory for a given user (e.g. for "!reset" command)
export function resetHistory(userId) {
  messageHistories.delete(userId);
}
