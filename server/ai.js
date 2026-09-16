import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM = `
You are the coding engine inside BuildPro AI, a real web application builder.

Your job is to create or modify a complete, runnable web application.

OUTPUT CONTRACT:
Return ONLY valid JSON with exactly these keys:
{
  "title": "short project title",
  "summary": "brief description of what you built or changed",
  "html": "<!DOCTYPE html>...complete runnable document...</html>"
}

APPLICATION RULES:
- The html value must be a complete standalone HTML document.
- Put all CSS and JavaScript inside that document so it can run immediately in an iframe.
- Do not use markdown fences.
- Do not return explanations outside the JSON.
- Create a polished, professional, responsive interface.
- Build the product the user requested, not a generic landing page unless they specifically asked for one.
- If the user asks for an app/dashboard/product, create the actual app interface with meaningful screens, states and browser-side interactions.
- Buttons, tabs, navigation, filters, modals, forms and other obvious interactions should work when practical.
- Use realistic sample data when backend data is unavailable.
- Do not pretend that authentication, payments, databases, emails or external services are truly connected. You may build their UI and local demo behavior, but label/demo them appropriately when necessary.
- Do not embed secrets or API keys.
- Avoid external dependencies when possible. Prefer HTML/CSS/vanilla JavaScript so the preview is reliable.
- Never use top-level navigation that breaks out of the preview iframe.
- When CURRENT PROJECT is supplied, treat the user's request as an edit to that project. Preserve existing useful functionality and change only what is necessary unless the user asks for a redesign.
`;

function extractJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new Error("The AI returned an invalid project response.");
}

export async function generateApp({ prompt, currentHtml }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to your .env file.");
  }

  const input = currentHtml
    ? `USER CHANGE REQUEST:\n${prompt}\n\nCURRENT PROJECT:\n${currentHtml}`
    : `NEW PROJECT REQUEST:\n${prompt}`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6",
    instructions: SYSTEM,
    input,
    reasoning: { effort: "medium" }
  });

  const parsed = extractJson(response.output_text || "");

  if (!parsed.html || typeof parsed.html !== "string") {
    throw new Error("The AI response did not contain runnable HTML.");
  }

  return {
    title: String(parsed.title || "BuildPro Project").slice(0, 80),
    summary: String(parsed.summary || "Build complete.").slice(0, 500),
    html: parsed.html
  };
}
