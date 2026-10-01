require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const { saveQuery, getHistory, getStats } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// ── Serve static frontend ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── Gemini client ────────────────────────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const CROP_CONTEXT = {
  maize: {
    en: "maize (corn) — major staple in Rwanda, typically planted at the start of Season A (September–October) or Season B (February–March)",
    rw: "ibigori (maize) — ikigori gikurwa cyane mu Rwanda, bihinwa mu gisezoni A (Nzeri–Ukwakira) cyangwa B (Gashyantare–Werurwe)",
  },
  beans: {
    en: "beans — Rwanda's second staple crop, planted in both Season A and B, very sensitive to waterlogging",
    rw: "ibishyimbo — igihingwa cy'ingenzi cya kabiri mu Rwanda, bihinwa mu gisezoni A na B, binanira cyane iyo amazi arenga",
  },
  coffee: {
    en: "coffee (Arabica) — major export crop in Rwanda, grown on hillsides at 1400–2000 m elevation, harvested October–January",
    rw: "ikawa (Arabica) — igihingwa cy'ingenzi cy'expoteri mu Rwanda, gitera ku misozi hagati ya 1400–2000 m, gitumburwa Ukwakira–Mutarama",
  },
  potatoes: {
    en: "Irish potatoes — key food security crop in Rwanda highlands (Musanze, Nyamagabe), planted in Season B and C",
    rw: "ibirayi — igihingwa cy'ingenzi cy'iperereza mu misozi miremire y'u Rwanda (Musanze, Nyamagabe), bihinwa mu gisezoni B na C",
  },
};

function buildSystemPrompt(language, crop) {
  const isKiny = language === "kinyarwanda";
  const cropInfo = CROP_CONTEXT[crop]?.[isKiny ? "rw" : "en"] || crop;

  if (isKiny) {
    return `Uri umufasha w'ubuhinzi w'inzobere mu Rwanda witwara ibibazo by'abahinzi.
Witwa "AI Farm Assistant."

Igihingwa cyifashishwa ubu: ${cropInfo}.

Ngwa:
- Subiza GUSA mu Kinyarwanda.
- Tanga inama z'ibikorwa bisabwa, zifitanye isano n'ibibazo by'ubuhinzi mu Rwanda.
- Vuga ibyiciro by'ibihe byo guhinga, udukoko dufatwa, imvura, umbutso, n'uburyo bwo kwita ku mahinga.
- Subiza mu magambo yoroheje kandi afashije abahinzi b'inzobere mu Rwanda.
- Ama-ariveti: igenwa ry'ibihe mu Rwanda ni Season A (Nzeri–Mutarama), Season B (Gashyantare–Kamena), Season C (Nyakanga–Kanama).
- Ntukongere amagambo adakenewe; subiza ku kibazo nyacyo.`;
  }

  return `You are an expert agricultural assistant specifically for Rwanda named "AI Farm Assistant."

Current crop context: ${cropInfo}.

Rules:
- Reply ONLY in English.
- Give practical, actionable advice relevant to Rwandan farming conditions (climate zones, soils, markets).
- Cover planting windows, common pests/diseases, rainfall dependency, fertilizer use, and basic crop care as relevant.
- Rwanda seasons: Season A (Sep–Jan), Season B (Feb–Jun), Season C (Jul–Aug).
- Keep answers concise but complete. No generic global advice — be Rwanda-specific.
- Address the farmer's exact question directly.`;
}

// ── Gemini with retry on 503 ─────────────────────────────────────────────────
async function generateWithRetry(params, maxRetries = 2) {
  let delay = 1500;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      const msg = JSON.stringify(err?.message || err || "");
      const is503 = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand");
      const is429 = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");

      if ((is503 || is429) && attempt < maxRetries) {
        console.log(`Gemini attempt ${attempt} throttled, retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}
app.post("/ask", async (req, res) => {
  const { question, language = "english", crop = "maize" } = req.body;

  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: "Question is required." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
  }

  try {
    const response = await generateWithRetry({
      model: "gemini-3.5-flash-lite",
      contents: question.trim(),
      config: {
        systemInstruction: buildSystemPrompt(language, crop),
      },
    });
    const answer = response.text;

    await saveQuery({ question: question.trim(), language, crop, answer });

    return res.json({ answer });
  } catch (err) {
    const msg = JSON.stringify(err?.message || err || "");
    const isThrottled = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand") || msg.includes("429");
    console.error("Gemini error:", msg);
    return res.status(502).json({
      error: isThrottled
        ? "The AI is busy right now (free tier limit). Please wait 30 seconds and try again."
        : "Failed to get a response from the AI. Please try again.",
    });
  }
});

// ── GET /history ─────────────────────────────────────────────────────────────
app.get("/history", async (req, res) => {
  try {
    res.json(await getHistory());
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: "Could not retrieve history." });
  }
});

// ── GET /stats ────────────────────────────────────────────────────────────────
app.get("/stats", async (req, res) => {
  try {
    res.json(await getStats());
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Could not retrieve stats." });
  }
});

// ── Catch-all → serve frontend ───────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Farm Assistant running on http://localhost:${PORT}`);
});
