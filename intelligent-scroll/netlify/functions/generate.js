// Netlify serverless function — proxies AI requests so the API key stays secret.
// Supports Groq (default, fastest) or Anthropic Claude.
//
// Environment variables (set in Netlify dashboard → Site settings → Environment variables):
//   GROQ_API_KEY   — your Groq API key (https://console.groq.com)
//   --- OR ---
//   ANTHROPIC_API_KEY — your Anthropic API key (if you prefer Claude)
//   AI_PROVIDER       — "groq" (default) or "anthropic"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

async function callGroq(prompt, maxTokens) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen/qwen3-32b",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
      top_p: 0.8,
      reasoning_effort: "none",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Groq API error");
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(prompt, maxTokens) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Anthropic API error");
  return data.content?.map((b) => b.text || "").join("") || "";
}

export async function handler(event) {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { prompt, maxTokens = 4000 } = JSON.parse(event.body);
    if (!prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "prompt is required" }) };
    }

    const provider = (process.env.AI_PROVIDER || "groq").toLowerCase();
    let text;

    if (provider === "anthropic") {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
      text = await callAnthropic(prompt, maxTokens);
    } else {
      if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
      text = await callGroq(prompt, maxTokens);
    }

    // Strip any <think>...</think> tags that Qwen3 may emit
    text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    console.error("Generate function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Internal server error" }),
    };
  }
}
