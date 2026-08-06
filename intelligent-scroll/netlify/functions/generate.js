import { generate, NoProviderError } from "../../shared/ai.js";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const reply = (statusCode, payload) => ({
  statusCode,
  headers: HEADERS,
  body: JSON.stringify(payload),
});

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: HEADERS, body: "" };
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "Invalid JSON body" });
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return reply(400, { error: "prompt is required" });
  }

  try {
    const { text, provider } = await generate({
      prompt: body.prompt,
      maxTokens: body.maxTokens,
      env: process.env,
      // Netlify's synchronous function limit is 10s; leave room to respond.
      timeoutMs: 8500,
    });
    return reply(200, { text, provider });
  } catch (err) {
    // A missing key is a capability answer, not a failure: 200 keeps it out of
    // the browser console while the client switches to demo mode.
    if (err instanceof NoProviderError || err.code === "NO_PROVIDER") {
      return reply(200, { error: err.message, code: "NO_PROVIDER" });
    }
    console.error("generate failed:", err);
    return reply(502, { error: err.message || "Generation failed" });
  }
}
