export class NoProviderError extends Error {
  constructor(message = "No AI provider configured") {
    super(message);
    this.name = "NoProviderError";
  }
}

const REQUEST_TIMEOUT_MS = 45000;

export const callAI = async (prompt, maxTokens = 4000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, maxTokens }),
      signal: controller.signal,
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      /* non-JSON error page */
    }

    if (data.code === "NO_PROVIDER" || res.status === 501) {
      throw new NoProviderError(data.error);
    }
    if (!res.ok) {
      throw new Error(data.error || `Generation failed (HTTP ${res.status})`);
    }
    return data.text || "";
  } finally {
    clearTimeout(timer);
  }
};

const WIKI_REST = "https://en.wikipedia.org/api/rest_v1/page/summary";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

const fetchSummary = async (title) => {
  const res = await fetch(`${WIKI_REST}/${encodeURIComponent(title)}?redirect=true`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.extract || data.type === "disambiguation") return null;
  return {
    title: data.title,
    extract: data.extract,
    thumbnail: data.thumbnail?.source || null,
    url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
  };
};

const searchTitle = async (query) => {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "1",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`${WIKI_API}?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.query?.search?.[0]?.title || null;
};

/** Longer plain-text body, used to ground generation and to feed demo mode. */
const fetchFullExtract = async (title) => {
  const params = new URLSearchParams({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    exsectionformat: "plain",
    redirects: "1",
    titles: title,
    format: "json",
    origin: "*",
  });
  const res = await fetch(`${WIKI_API}?${params}`);
  if (!res.ok) return "";
  const data = await res.json();
  const pages = data.query?.pages || {};
  const page = Object.values(pages)[0];
  return (page?.extract || "").replace(/\n{2,}/g, "\n").slice(0, 6000);
};

/** Follow-up chips are questions, not article titles — skip the direct lookup. */
const looksLikeSentence = (text) => /\?$/.test(text.trim()) || text.trim().split(/\s+/).length > 6;

/** Wikipedia context for a topic. Returns null when nothing usable is found. */
export const fetchTopicContext = async (topic) => {
  try {
    let summary = looksLikeSentence(topic) ? null : await fetchSummary(topic);
    if (!summary) {
      const title = await searchTitle(topic);
      if (title) summary = await fetchSummary(title);
    }
    if (!summary) return null;

    const body = await fetchFullExtract(summary.title).catch(() => "");
    return { ...summary, body: body || summary.extract };
  } catch {
    return null;
  }
};
