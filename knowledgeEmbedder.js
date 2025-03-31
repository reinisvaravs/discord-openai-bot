import { OpenAI } from "openai";
import {
  fetchAndParseGithubFiles, // gives a list of github file urls + types
  getKnowledgeSourcesFromGithub, // downloads and parses file content into a big string
} from "./githubFileLoader.js";
import { hasFileChanged } from "./core/fileHashCache.js";
import {
  saveVectorChunk,
  loadAllVectors,
  findSimilarChunks,
  deleteVectorChunk,
  getAllStoredFileNames,
  deleteFileHash,
} from "./db.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

let embeddedChunks = []; // stores: [{ string chunk, vector }]
// splits into 250 token chunks
function splitIntoChunks(text, maxTokens = 150) {
  const sentences = text.split(/\.\s+/); // splits on periods followed by space
  const chunks = [];
  let current = "";

  for (let sentence of sentences) {
    if ((current + sentence).length > maxTokens * 4) {
      chunks.push(current);
      current = sentence;
    } else {
      current += sentence + ". ";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// deletes files from db that are not in the github repo
async function checkDeleted(files) {
  // returns array of strings of file names in github repo
  const currentGitHubFiles = files
    .map((f) => {
      const nameMatch = f.match(/\[(.*?)\]/); // a capture group, returns e.g. ["[guide.md]", "guide.md"]
      return nameMatch?.[1]?.trim(); // return only the string file name e.g. "guide.md"
    })
    .filter(Boolean); // removes falsy values (e.g. undefined)

  // returns array of strings of file names in neondb
  const dbFiles = await getAllStoredFileNames();

  const deletedFiles = dbFiles.filter(
    (file) => !currentGitHubFiles.includes(file)
  ); // selects files to delete

  // deletes selected files
  for (const deleted of deletedFiles) {
    await deleteVectorChunk(deleted);
    await deleteFileHash(deleted);
    console.log(`🗑️ Deleted all chunks for removed file: ${deleted}`);
  }
}

// check for changes in vectors
export async function loadAndEmbedKnowledge() {
  embeddedChunks = await loadAllVectors(); // prev vectors from db
  // console.log(`📦 Chunks in database: ${embeddedChunks.length}`);

  // GitHub fetch for new/updated files
  const sources = await getKnowledgeSourcesFromGithub(); // links for download
  const files = await fetchAndParseGithubFiles(sources); // parsed all contents of a file

  try {
    await checkDeleted(files); // deletes files from db that are not in the github repo
  } catch (error) {
    console.error("❌ Error in checkDeleted():", error);
  }

  let totalChunks = 0; // total re-embedded chunks

  for (let fileText of files) {
    fileText = fileText.trim();
    const nameMatch = fileText.match(/^\[(.*?)\]/);
    const name = nameMatch?.[1]?.trim() || "unknown_file";
    const content = fileText.slice(nameMatch[0].length).trim();

    if (!(await hasFileChanged(name, content))) {
      // console.log(`[Skipped: ${name}]`); // if no changed in file
      continue; // stops the current iteration, moves on to next
    }

    const chunks = splitIntoChunks(content);
    await deleteVectorChunk(name); // deletes all chunks of a changed file

    for (const chunk of chunks) {
      const labeledChunk = `[${name}]\n${chunk}`;

      const res = await openai.embeddings.create({
        input: labeledChunk,
        model: "text-embedding-3-small",
      });

      const vector = res.data[0].embedding;

      embeddedChunks.push({
        chunk: labeledChunk,
        vector,
      });

      await saveVectorChunk(name, labeledChunk, vector); // saves the chunks to db
    }
    totalChunks += chunks.length;
  }

  // LOGS
  if (totalChunks === 0) {
    console.log("✅ All files are up to date — no re-embedding needed.");
  } else {
    console.log(`📥 Total re-embedded chunks: ${totalChunks}`);
  }

  // if true, from initializeBotData(), "WALL-E is now online. 🤖" is sent to bot channel
  return true;
}

// finds similar chunks of info to message
export async function getRelevantChunksForMessage(message, topK = 13) {
  const res = await openai.embeddings.create({
    input: message,
    model: "text-embedding-3-small",
  });

  const messageVector = res.data[0].embedding;
  const topChunks = await findSimilarChunks(messageVector, topK);
  // these are sent to openAI as prompt

  global.lastUsedChunks = topChunks;
  return topChunks.map((c) => c.chunk);
}
