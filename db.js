import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function getChannelId(type) {
  const result = await pool.query(
    `SELECT value FROM bot_config WHERE key = '${type}'`
  );
  return result.rows[0]?.value;
}

export async function saveVectorChunk(fileName, chunk, embedding) {
  const vectorString = `[${embedding.join(",")}]`; // Converts JS array to PostgreSQL vector string
  await pool.query(
    `INSERT INTO vectors (file_name, chunk, embedding)
     VALUES ($1, $2, $3::vector)`,
    [fileName, chunk, vectorString]
  );
}

export async function loadAllVectors() {
  const result = await pool.query(
    "SELECT file_name, chunk, embedding FROM vectors"
  );
  return result.rows.map((row) => ({
    chunk: `[${row.file_name}]\n${row.chunk}`,
    vector: row.embedding,
  }));
}

export async function findSimilarChunks(messageEmbedding, topN = 4) {
  const vectorString = `[${messageEmbedding.join(",")}]`; // PostgreSQL vector format

  const result = await pool.query(
    `
    SELECT file_name, chunk, embedding <#> $1 AS score
    FROM vectors
    ORDER BY embedding <#> $1
    LIMIT $2
    `,
    [vectorString, topN]
  );

  return result.rows;
}

export async function getStoredFileHash(filename) {
  const result = await pool.query(
    `SELECT hash FROM file_hashes WHERE file_name = $1`,
    [filename]
  );
  return result.rows[0]?.hash || null;
}

export async function storeFileHash(filename, hash) {
  await pool.query(
    `
    INSERT INTO file_hashes (file_name, hash)
    VALUES ($1, $2)
    ON CONFLICT (file_name) DO UPDATE SET hash = EXCLUDED.hash
    `,
    [filename, hash]
  );
}

export default pool;
