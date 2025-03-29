import crypto from "crypto";

const fileHashCache = new Map(); // key: filename, value: hash

export function getFileHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function hasFileChanged(filename, content) {
  const newHash = getFileHash(content);
  const oldHash = fileHashCache.get(filename);

  const isChanged = newHash !== oldHash;
  if (isChanged) fileHashCache.set(filename, newHash);

  return isChanged;
}

export function resetFileHashCache() {
  fileHashCache.clear();
}
