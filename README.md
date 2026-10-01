# AI Farm Assistant

A web app that lets farmers ask agricultural questions in English or Kinyarwanda and get practical advice powered by Google Gemini. Built specifically for Rwanda — answers cover planting seasons, pest control, fertilizer use, and crop care for maize, beans, coffee, and potatoes.

---

## What it does

- Farmers type a question, pick a crop and language, and get a direct answer
- Supports English and Kinyarwanda
- Covers Rwanda's three growing seasons (A, B, C)
- Saves every question to a local database
- Shows usage charts (queries by crop and by language)

---

## Tech stack

- **Backend:** Node.js + Express
- **AI:** Google Gemini API (`gemini-3.5-flash-lite`)
- **Database:** SQLite via `sql.js` (no native compilation needed)
- **Frontend:** Plain HTML + Tailwind CSS (CDN) + Chart.js

---

## Project structure

```
├── server.js        # Express server and Gemini API integration
├── db.js            # Database helpers (save, history, stats)
├── public/
│   └── index.html   # Frontend (chat UI, charts)
├── package.json
├── .env.example     # Environment variable template
├── render.yaml      # Render.com deploy config
└── railway.toml     # Railway.app deploy config
```

---

## Running locally

**Requirements:** Node.js 18+ and a free Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey)

```bash
# Install dependencies
npm install

# Copy the env template and fill in your key
cp .env.example .env
```

Open `.env` and set your key:

```
GEMINI_API_KEY=your_key_here
PORT=3000
```

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying

### Render

1. Push the repo to GitHub
2. Create a new Web Service on [render.com](https://render.com) and connect the repo
3. Add `GEMINI_API_KEY` in the Environment settings
4. Deploy — `render.yaml` handles the rest

### Railway

1. Push the repo to GitHub
2. Create a new project on [railway.app](https://railway.app) from the GitHub repo
3. Add `GEMINI_API_KEY` as an environment variable
4. Railway injects `PORT` automatically

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key |
| `PORT` | No | Port to run the server on (default 3000) |
| `DB_PATH` | No | Path to the SQLite database file (default `./farm.db`) |

---

## License

MIT
