import { generateApp } from "../server/ai.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { prompt, currentHtml = "" } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "A prompt is required."
      });
    }

    if (prompt.length > 12000) {
      return res.status(400).json({
        error: "Prompt is too long."
      });
    }

    const result = await generateApp({
      prompt: prompt.trim(),
      currentHtml:
        typeof currentHtml === "string" ? currentHtml : ""
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("BuildPro generation error:", error);

    return res.status(500).json({
      error: error?.message || "Generation failed."
    });
  }
}
