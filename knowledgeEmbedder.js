import { OpenAI } from "openai";
import {
  fetchAndParseGithubFiles, // gives a list of github file urls + types
  getKnowledgeSourcesFromGithub, // downloads and parses file content into a big string
} from "./githubFileLoader.js";
import { hasFileChanged } from "./core/fileHashCache.js";
import { saveVectorChunk, loadAllVectors, findSimilarChunks } from "./db.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

let embeddedChunks = []; // stores: [{ string chunk, vector }]

// splits into 500 token chunks
function splitIntoChunks(text, maxTokens = 500) {
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

// check for changes in vectors
export async function loadAndEmbedKnowledge() {
  embeddedChunks = await loadAllVectors(); // prev vectors from db

  console.log(`📦 Loaded ${embeddedChunks.length} chunks from PostgreSQL`);

  // GitHub fetch for new/updated files
  const sources = await getKnowledgeSourcesFromGithub(); // links for download
  const files = await fetchAndParseGithubFiles(sources); // parsed contents

  let totalChunks = 0;

  for (let fileText of files) {
    fileText = fileText.trim();
    const nameMatch = fileText.match(/^\[(.*?)\]/);
    const name = nameMatch?.[1]?.trim() || "unknown_file";
    const content = fileText.slice(nameMatch[0].length).trim();

    if (!(await hasFileChanged(name, content))) {
      console.log(`⚪ Skipped unchanged file: ${name}`); // if no changed in file
      continue;
    }

    const chunks = splitIntoChunks(content);

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

      await saveVectorChunk(name, labeledChunk, vector); // saves to db
    }
    totalChunks += chunks.length;
  }

  // LOG
  console.log("📚 Embedded", embeddedChunks.length, "total chunks.");
  if (totalChunks === 0) {
    console.log("✅ All files are up to date — no re-embedding needed.");
  } else {
    console.log(`📥 Total re-embedded chunks: ${totalChunks}`);
  }

  return true;
}

// finds similar chunks of info to message
export async function getRelevantChunksForMessage(message, topK = 4) {
  const res = await openai.embeddings.create({
    input: message,
    model: "text-embedding-3-small",
  });

  const messageVector = res.data[0].embedding;
  const topChunks = await findSimilarChunks(messageVector, topK);

  console.log("📊 SQL Similarity Match Summary");
  console.log("🔍 User Question:", message);
  console.log("📦 Top Matches:");

  topChunks.forEach((c, i) => {
    const preview = c.chunk.slice(0, 200).replace(/\n+/g, " ").trim();
    const filename = c.chunk.match(/^\[(.*?)\]/)?.[1] || "unknown_file";
    console.log(`#${i + 1}  [score: ${c.score.toFixed(4)}]  (${filename})`);
    console.log("📄 Preview:", preview);
  });

  global.lastUsedChunks = topChunks;
  return topChunks.map((c) => c.chunk);
}
