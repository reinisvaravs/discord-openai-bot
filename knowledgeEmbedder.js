import { OpenAI } from "openai";
import {
  fetchAndParseGithubFiles, // gives a list of github file urls + types
  getKnowledgeSourcesFromGithub, // downloads and parses file content into a big string
} from "./githubFileLoader.js";
import { hasFileChanged } from "./core/fileHashCache.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

let embeddedChunks = []; // stores: [{ string chunk, vector }]

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

function cosineSimilarity(vec1, vec2) {
  const dot = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
  const mag1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
  const mag2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
  return dot / (mag1 * mag2);
}
// Example:
// 1.0 = exactly the same meaning
// 0.9 = very similar
// 0.1 = totally unrelated

export async function loadAndEmbedKnowledge() {
  const sources = await getKnowledgeSourcesFromGithub(); // 1. Get list of files
  const files = await fetchAndParseGithubFiles(sources);

  embeddedChunks = []; // reset

  for (let fileText of files) {
    fileText = fileText.trim();
    const nameMatch = fileText.match(/^\[(.*?)\]/);
    const name = nameMatch?.[1]?.trim() || "unknown_file";
    const content = fileText.slice(nameMatch[0].length).trim();

    if (!hasFileChanged(name, content)) {
      console.log(`⚪ Skipped unchanged file: ${name}`);
      continue;
    }

    const chunks = splitIntoChunks(content);

    for (const chunk of chunks) {
      const labeledChunk = `[${name}]\n${chunk}`;

      const res = await openai.embeddings.create({
        input: labeledChunk,
        model: "text-embedding-3-small",
      });

      embeddedChunks.push({
        chunk: labeledChunk,
        vector: res.data[0].embedding,
      });
    }
  }

  // LOGS =>
  const totalTextLength = files.reduce((sum, file) => sum + file.length, 0);
  console.log("📥 Combined GitHub text length:", totalTextLength);

  const totalChunks = files.reduce((sum, fileText) => {
    return sum + splitIntoChunks(fileText).length;
  }, 0);
  console.log("📦 Total chunks to embed:", totalChunks);

  console.log(`📚 Embedded ${embeddedChunks.length} chunks.`);
  // <= LOGS

  return true;
}

export async function getRelevantChunksForMessage(message, topK = 4) {
  const res = await openai.embeddings.create({
    input: message,
    model: "text-embedding-3-small",
  });
  const messageVector = res.data[0].embedding;

  const scored = embeddedChunks.map(({ chunk, vector }) => ({
    chunk,
    score: cosineSimilarity(messageVector, vector),
  }));

  scored.sort((a, b) => b.score - a.score);

  console.log("📊 Similarity Match Summary");
  console.log("🔍 User Question:", message);
  console.log(`📦 Embedded chunks available: ${embeddedChunks.length}`);

  scored.slice(0, topK).forEach((item, i) => {
    const preview = item.chunk.slice(0, 200).replace(/\n+/g, " ").trim();
    const filename = item.chunk.match(/^\[(.*?)\]/)?.[1] || "unknown_file";

    console.log(
      `\n#${i + 1}  [score: ${item.score.toFixed(4)}]  (${filename})`
    );
    console.log("📄 Preview:", preview);
  });

  const topResults = scored.slice(0, topK);
  global.lastUsedChunks = topResults; // Save full objects with chunk + score
  return topResults.map((x) => x.chunk); // Still return only text chunks for GPT
}
