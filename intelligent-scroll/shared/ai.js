/**
 * Provider-agnostic text generation, shared by the Netlify function and the
 * Vite dev middleware so `npm run dev` and production behave identically.
 */

export class NoProviderError extends Error {
  constructor() {
    super(
      "No AI provider configured. Set GROQ_API_KEY (recommended), ANTHROPIC_API_KEY or OPENAI_API_KEY."
    );
    this.name = "NoProviderError";
    this.code = "NO_PROVIDER";
  }
}

const PROVIDERS = {
  groq: {
    key: "GROQ_API_KEY",
    model: "llama-3.3-70b-versatile",
    url: "https://api.groq.com/openai/v1/chat/completions",
    style: "openai",
  },
  openai: {
    key: "OPENAI_API_KEY",
    model: "gpt-4o-mini",
    url: "https://api.openai.com/v1/chat/completions",
    style: "openai",
  },
  anthropic: {
    key: "ANTHROPIC_API_KEY",
    model: "claude-3-5-haiku-latest",
    url: "https://api.anthropic.com/v1/messages",
    style: "anthropic",
  },
};

/** The provider to use: AI_PROVIDER if set and keyed, otherwise the first key present. */
export const resolveProvider = (env = {}) => {
  const requested = (env.AI_PROVIDER || "").toLowerCase();
  if (requested && PROVIDERS[requested] && env[PROVIDERS[requested].key]) return requested;
  return Object.keys(PROVIDERS).find((name) => env[PROVIDERS[name].key]) || null;
};

const modelFor = (name, env) =>
  env[`${name.toUpperCase()}_MODEL`] || env.AI_MODEL || PROVIDERS[name].model;

const parseError = (data, status) =>
  data?.error?.message || data?.error || data?.message || `Upstream error (HTTP ${status})`;

const requestOpenAiStyle = async ({ url, apiKey, model, prompt, maxTokens, signal }) => {
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.85,
      top_p: 0.9,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(parseError(data, res.status));
  return data.choices?.[0]?.message?.content || "";
};

const requestAnthropic = async ({ url, apiKey, model, prompt, maxTokens, signal }) => {
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.9,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(parseError(data, res.status));
  return (data.content || []).map((block) => block.text || "").join("");
};

/** Reasoning-model scratchpads occasionally leak through; drop them. */
const stripThinking = (text) =>
  String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim();

export const generate = async ({ prompt, maxTokens = 4000, env = {}, timeoutMs = 9000 }) => {
  const name = resolveProvider(env);
  if (!name) throw new NoProviderError();

  const provider = PROVIDERS[name];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const request = provider.style === "anthropic" ? requestAnthropic : requestOpenAiStyle;

  try {
    const text = await request({
      url: provider.url,
      apiKey: env[provider.key],
      model: modelFor(name, env),
      prompt,
      maxTokens: Math.min(Math.max(Number(maxTokens) || 4000, 256), 8000),
      signal: controller.signal,
    });
    return { text: stripThinking(text), provider: name };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`${name} did not respond within ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};
