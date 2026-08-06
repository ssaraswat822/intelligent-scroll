export const generateId = () => Math.random().toString(36).slice(2, 11);

export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Posts further down the feed are older, so a long scroll reads like walking
 * back through a timeline. Growth is geometric to keep the numbers plausible
 * across hundreds of posts.
 */
export const ageForIndex = (index) => Math.round(1.5 * Math.pow(1.19, index) + index * 2.5);

export const formatAge = (minutes) => {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 31) return `${Math.round(days)}d`;
  const months = days / 30.4;
  if (months < 12) return `${Math.round(months)}mo`;
  return `${(months / 12).toFixed(months < 24 ? 1 : 0)}y`;
};

export const formatCount = (n) => {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n < 1000000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
  "of", "to", "in", "on", "at", "for", "with", "that", "this", "it", "its", "as",
  "by", "from", "not", "you", "your", "we", "they", "their", "has", "have", "had",
]);

const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Two signatures per post: the normalised text (verbatim repeats) and a bag of
 * its longest words (the same fact reworded). Length is a cheap proxy for how
 * distinctive a word is, which matters because posts often share a lead-in —
 * keying on the opening characters would merge posts that only look alike.
 */
export const signaturesFor = (text) => {
  const norm = normalize(text);
  if (!norm) return [];

  const distinctive = [
    ...new Set(norm.split(" ").filter((w) => w.length > 3 && !STOP_WORDS.has(w))),
  ]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .slice(0, 10)
    .sort()
    .join("-");

  return distinctive ? [norm, distinctive] : [norm];
};

/** A short label for a post, used to tell the model what ground is already covered. */
export const angleFor = (text) => {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > 110 ? `${clean.slice(0, 110)}…` : clean;
};
