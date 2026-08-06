import { PERSONAS } from "./personas.js";
import { shuffle } from "./util.js";

/**
 * Each batch of an endless feed is asked to look at the topic through a
 * different lens. Without this, batch three onwards drifts back to the same
 * handful of headline facts.
 */
export const LENSES = [
  "origins and the first discovery or invention, with dates",
  "the specific people who shaped it, named, with what each contributed",
  "surprising quantities: scale, size, speed, cost, counts",
  "widespread misconceptions and what the reality actually is",
  "open questions and things experts still argue about",
  "how it actually works, mechanism by mechanism",
  "practical real-world applications happening right now",
  "famous failures, accidents, and what they taught us",
  "the money: economics, funding, incentives, who profits",
  "cultural impact: art, film, literature, language it changed",
  "unexpected connections to a completely different field",
  "ethical dilemmas and where reasonable people disagree",
  "what it looked like 100 years ago versus today",
  "the weirdest edge cases and outliers",
  "regional and cultural differences around the world",
  "what the next decade plausibly looks like",
  "the measurement problem: how we know what we know about it",
  "the underrated or overlooked part that specialists care about",
  "beginner mistakes and how experts think differently",
  "adjacent rabbit holes worth falling into",
];

const KIND_MENU = `
- "fact": one concrete, checkable fact with a number, date, or name
- "take": an opinion or hot take someone would argue about
- "question": a genuine question posed to the timeline
- "explainer": a short thread-style breakdown of a concept (use \\n\\n between beats)
- "til": a "TIL"/story-shaped post about something the poster just learned
- "data": a comparison or statistic framed for impact
`.trim();

export const eduToneFor = (level) => {
  if (level <= 2)
    return `TONE: Extremely casual, like group chat or TikTok comments. Slang, lowercase, ALL CAPS for emphasis, big reactions. Most posts under two sentences. Fun over rigour.`;
  if (level <= 4)
    return `TONE: Casual but informative, like a good Reddit thread. Mix jokes with real facts, use pop-culture comparisons, one or two specific facts per post, stay approachable.`;
  if (level <= 6)
    return `TONE: Balanced and engaging, like a strong explainer video or magazine feature. Every post teaches something specific — real numbers, dates, named researchers. Clear analogies.`;
  if (level <= 8)
    return `TONE: Highly educational and analytical, like a seminar or a journal summary. Cite named studies and researchers, use correct technical terms and explain them, discuss mechanism and causation, reference live debates.`;
  return `TONE: Expert level, like a peer-review discussion. Precise terminology, specific papers and methods, limitations and edge cases, quantitative detail. Assume foundational knowledge and spend real time on what is still unknown.`;
};

/** Rotate through lenses so consecutive batches cannot cover the same ground. */
export const lensesForBatch = (batchIndex, count = 3) => {
  const offset = (batchIndex * count) % LENSES.length;
  const picked = [];
  for (let i = 0; i < count; i++) picked.push(LENSES[(offset + i) % LENSES.length]);
  return shuffle(picked);
};

export const buildFeedPrompt = ({
  topic,
  context = "",
  eduLevel = 7,
  personas,
  count = 7,
  batchIndex = 0,
  avoid = [],
}) => {
  const personaLines = personas
    .map((key) => `- "${key}" — ${PERSONAS[key].label}: ${PERSONAS[key].style}`)
    .join("\n");
  const lenses = lensesForBatch(batchIndex);
  const avoidBlock = avoid.length
    ? `\nALREADY POSTED IN THIS FEED — do not repeat these points, facts, or framings:\n${avoid
        .map((a) => `- ${a}`)
        .join("\n")}\n`
    : "";

  return `You are writing a social media timeline about "${topic}".
${context ? `\nReference material:\n${context}\n` : ""}
${eduToneFor(eduLevel)}

Write from these accounts, and only these:
${personaLines}

This batch must focus on genuinely new territory. Cover these angles:
${lenses.map((l) => `- ${l}`).join("\n")}
${avoidBlock}
Return EXACTLY ${count} posts as a JSON array. Each element:
{
  "persona": one of ${JSON.stringify(personas)},
  "kind": one of ["fact","take","question","explainer","til","data"],
  "content": the post text,
  "replies": array of 0-4 objects {"persona", "content"} — real conversation, not applause,
  "followUp": a short, curiosity-provoking question that could become its own feed
}

Post kinds available:
${KIND_MENU}

Composition rules:
- Vary length hard: 2 posts under 120 characters, 3 posts of 150-350 characters, 2 posts of 350-700 characters using \\n\\n between paragraphs.
- At least 3 posts must carry replies, and those replies should disagree, add nuance, or ask something — a small argument is better than agreement.
- No hashtags. No emoji spam. No "thread 🧵" preambles. No engagement bait like "read this".
- Every post covers a different aspect. Never restate another post's fact.
- If you are not certain of a number or date, hedge with "roughly" or "around" instead of inventing precision.
- Replies should sound like different people, including one who is a bit wrong.

Respond with the JSON array only. No markdown fences, no commentary.`;
};

export const buildDeepDivePrompt = ({ topic, postContent, context = "", eduLevel = 7 }) => `
A post on a timeline about "${topic}" reads:

"${postContent}"

Write the long version: 3 or 4 paragraphs, 700-1100 characters total, expanding exactly this point.
${context ? `\nReference material you may draw on:\n${context.slice(0, 2500)}\n` : ""}
${eduToneFor(eduLevel)}

Requirements:
- Open with the specific claim, then explain the mechanism or history behind it.
- Include concrete detail: dates, names, quantities, places. Hedge with "roughly" rather than inventing precision.
- Spend one paragraph on what is contested, uncertain, or commonly misunderstood.
- No headings, no bullet points, no hashtags, no sign-off.

Return the prose only, paragraphs separated by a blank line.`.trim();

export const buildReplyPrompt = ({ postContent, topic, personas, count = 4 }) => {
  const personaLines = personas
    .map((key) => `"${key}" (${PERSONAS[key].style})`)
    .join(", ");

  return `Someone posted this on a timeline about "${topic || "this subject"}":

"${postContent}"

Write ${count} replies as a JSON array: [{"persona": one of [${personaLines}], "content": "..."}]

Rules:
- 40-220 characters each.
- Mix: one adds a specific fact, one pushes back, one asks a follow-up question, one is funny or offhand.
- Reply to what the post actually says. No generic praise.
- No hashtags.

Respond with the JSON array only.`;
};
