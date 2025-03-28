# 🤖 WALL-E — Discord AI Knowledge Assistant

![Node.js](https://img.shields.io/badge/Node.js-22.x-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Powered by](https://img.shields.io/badge/Powered_by-GPT_3.5-orange)
![Status](https://img.shields.io/badge/status-live-success)

WALL-E is an intelligent Discord bot built with Node.js and OpenAI. It answers questions using embedded knowledge from structured documents stored in a GitHub repository. The bot is designed to coach OnlyFans creators using internal training content managed by a company called **Wunder**.

Built for maintainability, transparency, and flexibility.

---

<img src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWtqa3lxbGIyeTJjZTNvMDF0MmszaDdzcWNpNjV1a3B5N2R3ajBtMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/iGJNOadhvBMuk/giphy.gif" width="500" alt="WALL-E Discord Bot Demo">

---

## 📚 Table of Contents

- [Features](#-features)
- [File Structure](#-file-structure)
- [GitHub Integration](#-github-integration)
- [Getting Started](#-getting-started)
- [How Knowledge Embedding Works](#-how-knowledge-embedding-works)
- [Testing](#-testing)
- [Built With](#-built-with)
- [Author](#-author)
- [License](#-license)

---

## 🚀 Features

- ✅ **Multiformat Knowledge Embedding**  
  Supports `.txt`, `.md`, `.docx`, `.pdf`, `.xlsx`, `.json`, `.html`, `.csv`, and `.yaml`.

- ✅ **Contextual GPT Responses**  
  Uses both user message history and vector-matched content chunks to generate high-quality answers.

- ✅ **GitHub Knowledge Source**

  - Automatically fetches & embeds knowledge from a public GitHub repo
  - Supports periodic auto-refresh and manual `!refresh`

- ✅ **Memory**

  - Keeps up to 5 recent messages in memory for context
  - Does not store long-term history (stateless between restarts)

- ✅ **Admin Controls (prefix-based)**

  - `!bot on` / `!bot off` — toggle response mode
  - `!refresh` — manually re-embed knowledge from GitHub
  - `!source` — show which embedded chunks were used in the last GPT answer
  - `!files` — show filenames used in the last GPT reply
  - `!change channel to <channelId>` — move WALL-E to a new channel

- ✅ **Custom Personality (System Prompt)**

  - Conversational tone
  - Does not act like a model or support bot
  - Follows strict coaching role rules
  - Supports edgy humor, sarcasm, and relaxed chat
  - 🛠️ System prompt is defined inside `server.js`

---

## 📂 File Structure

```
📁 gpt-bot/
├── db.js                    # PostgreSQL connection + channel config
├── githubFileLoader.js     # GitHub file fetching + parsing
├── knowledgeEmbedder.js    # Embedding, vector storage, similarity matching
├── server.js               # Discord + OpenAI + Express core logic
├── index.html              # Simple web frontend for remote message sending
├── package.json
├── .env                    # ⚠️ Do not commit this file!
```

---

## 🌐 GitHub Integration

Knowledge is dynamically loaded from:

```
https://github.com/reinisvaravs/discord-bot-test-info
```

- Files must be at root
- Only supported file types are processed
- Uses `GITHUB_TOKEN` to increase API limits (recommended)

---

## 🛠️ Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/reinisvaravs/discord-openai-bot.git
cd discord-openai-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env` file

```env
DISCORD_TOKEN=your_discord_token
OPENAI_KEY=your_openai_key
GITHUB_TOKEN=your_github_token
DATABASE_URL=postgres://username:password@host:port/db
REMOTE_PASSWORD=your_custom_remote_password
```

> ⚠️ **Important:** Do not commit `.env` to GitHub. Add it to `.gitignore`.

### 4. Start the bot

```bash
npm start
```

---

## 🧠 How Knowledge Embedding Works

- At startup, WALL-E fetches all files from GitHub
- Parses and chunks each file (≈ 500 tokens per chunk)
- Embeds each chunk using `text-embedding-3-small`
- On every message, embeds the message and compares it to all known chunks using cosine similarity
- Top 4 chunks are fed into the GPT system prompt

---

## 🧪 Testing

- Run `!refresh` in Discord to force a fresh embed from GitHub
- Use `!source` to view which files/chunks were referenced
- Check console logs for full vector similarity scores + previews

---

## 🧰 Built With

- [discord.js](https://discord.js.org/)
- [OpenAI SDK](https://www.npmjs.com/package/openai)
- [pg](https://node-postgres.com/)
- [mammoth](https://github.com/mwilliamson/mammoth.js)
- [pdfjs-dist](https://github.com/mozilla/pdf.js)
- [xlsx](https://www.npmjs.com/package/xlsx)
- [express](https://expressjs.com/)
- [dotenv](https://www.npmjs.com/package/dotenv)

---

## 🧠 Author

**Reinis Roberts Vāravs**  
Latvia 🇱🇻 | Full-stack Developer  
🌐 [Portfolio site](https://reinisvaravs.com)

---

## 📜 License

This project is MIT licensed.
