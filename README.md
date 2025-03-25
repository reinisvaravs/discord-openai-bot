# 🤖 Discord + OpenAI Knowledge Bot

![Node.js](https://img.shields.io/badge/Node.js-22.x-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Bot Type](https://img.shields.io/badge/Powered_by-GPT_3.5-orange)
![Status](https://img.shields.io/badge/status-live-success)

This is a custom-built Discord bot powered by OpenAI's GPT-3.5-Turbo. It responds to user messages using:

- Dynamic knowledge loaded from files (locally or from a GitHub repo)
- Recent conversation context (in-memory message history)

---

## 🚀 Features

✅ Supports multiple file formats:

- `.txt`, `.json`, `.csv`, `.md`, `.html`, `.htm`, `.yaml`, `.yml`
- `.pdf`, `.docx`, `.xlsx`

✅ Remote knowledge loading:

- Automatically fetches files from a GitHub repository
- Refreshes knowledge every 10 minutes

✅ Context memory:

- Remembers last 100 user messages (stored in memory)
- Uses message history in every GPT prompt

✅ Admin Commands:

- `!bot off` / `!bot on` — disable or enable bot replies
- `!refresh` — instantly re-fetch knowledge from GitHub

✅ Deployment ready for:

- Render.com (with UptimeRobot wake-up ping)

---

## 📁 Folder Structure

```
📦 gpt-bot
├── data/                  # Optional local files (if not using GitHub)
├── fetchKnowledge.js      # Fetch and parse knowledge files from GitHub
├── loadData.js            # (Legacy) Previously used for local loading
├── server.js              # Main Discord + OpenAI bot logic
├── package.json           # Dependencies and scripts
```

---

## 🌐 GitHub Repo Integration

This bot fetches all supported files from:

```
https://github.com/reinisvaravs/discord-bot-test-info
```

- Files are at the root of the repo
- Must have supported file extensions
- GitHub token is required to increase API rate limits

---

## 🛠️ Setup

### 1. Clone the repo

```bash
git clone https://github.com/reinisvaravs/discord-openai-bot.git
cd discord-openai-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env`

```env
DISCORD_TOKEN=your_discord_bot_token
OPENAI_API_KEY=your_openai_api_key
GITHUB_TOKEN=your_github_pat (optional, but recommended)
```

### 4. Start the bot

```bash
npm start
```

---

## 📦 Dependencies

- `discord.js` — Discord bot SDK
- `openai` — OpenAI API
- `node-fetch` — GitHub API + file downloads
- `mammoth` — .docx parser
- `pdfjs-dist` — .pdf parser (v5)
- `xlsx` — .xlsx parser

---

## 📌 Notes

- Only one bot is supported per server
- Bot does not persist memory across restarts (uses in-memory array)
- No slash commands yet (prefix commands only)

---

## 🧠 Author

**Reinis Roberts Vāravs**  
Built from scratch with love, memory, and GPT logic.
