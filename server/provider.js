const MODELS = { image: "black-forest-labs/flux-schnell", video: "minimax/video-01" };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runGeneration({ type, prompt, aspectRatio }, options = {}) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured.");
  const fetcher = options.fetcher || fetch;
  const input = type === "image"
    ? { prompt, aspect_ratio: aspectRatio, num_outputs: 1, output_format: "webp" }
    : { prompt, aspect_ratio: aspectRatio === "9:16" ? "9:16" : "16:9" };
  let response = await fetcher(`https://api.replicate.com/v1/models/${MODELS[type]}/predictions`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60" }, body: JSON.stringify({ input })
  });
  let prediction = await response.json();
  if (!response.ok) throw new Error(prediction.detail || prediction.error || "Provider rejected the request.");
  for (let i = 0; ["starting", "processing"].includes(prediction.status) && i < 80; i++) {
    await (options.delay || delay)(2500);
    response = await fetcher(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    prediction = await response.json();
  }
  if (prediction.status !== "succeeded") throw new Error(prediction.error || "Provider generation timed out or failed.");
  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (typeof output !== "string" || !output.startsWith("http")) throw new Error("Provider returned no media URL.");
  return output;
}
