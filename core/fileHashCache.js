import crypto from "crypto";
import { getStoredFileHash, storeFileHash } from "../db.js";

export function getFileHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function hasFileChanged(filename, content) {
  const newHash = getFileHash(content);
  const oldHash = await getStoredFileHash(filename);

  const isChanged = newHash !== oldHash;
  if (isChanged) await storeFileHash(filename, newHash);

  return isChanged;
}
