import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { generateApp } from "./ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "../public")));

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, currentHtml } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "A prompt is required." });
    }

    if (prompt.length > 12000) {
      return res.status(400).json({ error: "Prompt is too long." });
    }

    const result = await generateApp({
      prompt: prompt.trim(),
      currentHtml: typeof currentHtml === "string" ? currentHtml : ""
    });

    res.json(result);
  } catch (error) {
    console.error("Generation error:", error);
    res.status(500).json({
      error: error?.message || "Generation failed."
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: process.env.OPENAI_MODEL || "gpt-5.6" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`BuildPro AI running at http://localhost:${PORT}`);
});
