# 🤖 WALL-E — Discord AI Knowledge Assistant

![Node.js](https://img.shields.io/badge/Node.js-22.x-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Powered by](https://img.shields.io/badge/Powered_by-GPT_3.5-orange)
![Status](https://img.shields.io/badge/status-live-success)

WALL-E is an intelligent Discord bot built with Node.js and OpenAI. It answers questions using embedded knowledge from structured documents stored in a GitHub repository. The bot is designed to coach OnlyFans creators using internal training content managed by a company called **Wunder**.

Built for maintainability, transparency, and flexibility.

---

<img src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWtqa3lxbGIyeTJjZTNvMDF0MmszaDdzcWNpNjV1a3B5N2R3ajBtMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/iGJNOadhvBMuk/giphy.gif" width="500" alt="WALL-E in real life">

---

## 📚 Table of Contents

- [Features](#-features)
- [File Structure](#-file-structure)
- [GitHub Integration](#-github-integration)
- [Getting Started](#-getting-started)
- [How Knowledge Embedding Works](#-how-knowledge-embedding-works)
- [Testing](#-testing)
- [Upcoming Features](#-upcoming-features)
- [Built With](#-built-with)
- [Author](#-author)
- [License](#-license)

---

## 🚀 Features

- ✅ **Multiformat Knowledge Embedding**  
  Supports `.txt`, `.md`, `.docx`, `.pdf`, `.xlsx`, `.json`, `.html`, `.htm` `.csv`, `.yaml`, and `.yml`.

- ✅ **Contextual GPT Responses**  
  Uses both user message history and vector-matched content chunks to generate high-quality answers.

- ✅ **GitHub Knowledge Source**

  - Automatically fetches & embeds knowledge from a public GitHub repo
  - Supports periodic auto-refresh and manual `!refresh`

- ✅ **Auto-Embedding Optimization**

  - Automatically re-embeds only files that changed (SHA256 hash check)
  - Persistent embedding storage with PostgreSQL + pgvector

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

- ✅ **Web API Access**  
  `/send-remote` endpoint lets you send messages to Discord via HTTP (with rate limiting + password)

---

## 📂 File Structure

```
📁 gpt-bot/
├── core/
│   ├── initializeBotData.js        # Startup embedding + auto-refresh
│   ├── messageMemory.js            # In-memory chat context tracking
│   ├── fetchOpenAIResponse.js      # Retry-safe OpenAI call
│   ├── buildSystemPrompt.js        # Prompt builder from context chunks
│   ├── permissions.js              # Role checker
│   ├── typing.js                   # Typing animation util
├── commands/
│   ├── adminCommands.js            # !bot off, !refresh, etc.
│   ├── infoCommands.js             # !source, !files
├── events/
│   └── onMessageCreate.js          # Main message handler
├── githubFileLoader.js             # GitHub file fetching + parsing
├── knowledgeEmbedder.js            # Embedding, pgvector storage, matching
├── db.js                           # PostgreSQL connection + vector logic
├── server.js                       # Express + Discord init
├── index.html                      # Web UI for remote send
├── .env                            # Environment variables (do not commit this)
├── .env.example                    # Template for env variables
├── package.json
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
- Computes SHA256 hash of each file to detect changes
- Skips unchanged files by checking their SHA256 hash
- Embeds changed chunks using `text-embedding-3-small`
- Stores results in a PostgreSQL table with `pgvector`
- Top 4 matched chunks are retrieved using vector similarity for GPT replies

---

## 🧪 Testing

- Run `!refresh` in Discord to force a full re-embed
- Check logs to see whether a file was re-embedded or skipped due to no changes
- Use `!source` and `!files` to see what content was used

---

## 🧭 Upcoming Features

🟡 Change model with admin command. Store model name in a database.

---

## 🧰 Built With

- [discord.js](https://discord.js.org/)
- [OpenAI SDK](https://www.npmjs.com/package/openai)
- [pg](https://node-postgres.com/)
- [pgvector](https://github.com/pgvector/pgvector-node)
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
🔗 [GitHub](https://github.com/reinisvaravs)

---

## 📜 License

This project is MIT licensed.
