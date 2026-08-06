const tryParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Walks the text and pulls out every complete top-level `{...}` block. A
 * truncated response still yields all the objects that did finish, which is
 * what keeps the feed moving when the model runs out of tokens mid-array.
 */
const scanObjects = (text) => {
  const found = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const parsed = tryParse(text.slice(start, i + 1));
        if (parsed && typeof parsed === "object") found.push(parsed);
        start = -1;
      }
      if (depth < 0) depth = 0;
    }
  }

  return found;
};

const stripWrappers = (text) =>
  String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "")
    .trim();

/** Best-effort extraction of an array of objects from a model response. */
export const parseObjectArray = (text) => {
  if (!text) return [];
  const clean = stripWrappers(text);

  const open = clean.indexOf("[");
  if (open !== -1) {
    const close = clean.lastIndexOf("]");
    if (close > open) {
      const direct = tryParse(clean.slice(open, close + 1));
      if (Array.isArray(direct)) return direct.filter((item) => item && typeof item === "object");
    }
    return scanObjects(clean.slice(open));
  }

  return scanObjects(clean);
};
