import assert from "node:assert/strict";
import test from "node:test";
import { buildFeedPrompt, LENSES, lensesForBatch } from "../src/lib/prompt.js";
import { generateOfflineBatch } from "../src/lib/offline.js";
import { formatAge, formatCount, signaturesFor } from "../src/lib/util.js";

const PERSONAS = ["academic", "casual", "skeptic"];

test("lens rotation gives each batch distinct angles", () => {
  const first = lensesForBatch(0);
  const second = lensesForBatch(1);
  assert.equal(new Set(first).size, first.length, "no repeats within a batch");
  assert.equal(
    first.filter((lens) => second.includes(lens)).length,
    0,
    "consecutive batches share no angle"
  );
});

test("lens rotation covers the whole list before repeating", () => {
  const seen = new Set();
  for (let batch = 0; batch < LENSES.length / 3; batch++) {
    lensesForBatch(batch).forEach((lens) => seen.add(lens));
  }
  assert.equal(seen.size, LENSES.length);
});

test("feed prompt carries the personas, the count and the ground already covered", () => {
  const prompt = buildFeedPrompt({
    topic: "Bioluminescence",
    personas: PERSONAS,
    count: 6,
    batchIndex: 2,
    avoid: ["Fireflies use luciferase", "Anglerfish host symbiotic bacteria"],
  });

  assert.match(prompt, /Bioluminescence/);
  assert.match(prompt, /EXACTLY 6 posts/);
  assert.match(prompt, /Fireflies use luciferase/);
  assert.match(prompt, /Anglerfish host symbiotic bacteria/);
  for (const persona of PERSONAS) assert.match(prompt, new RegExp(`"${persona}"`));
});

test("feed prompt omits the avoid block on the first batch", () => {
  const prompt = buildFeedPrompt({ topic: "Mycology", personas: PERSONAS, batchIndex: 0 });
  assert.doesNotMatch(prompt, /ALREADY POSTED/);
});

test("depth changes the requested tone", () => {
  const casual = buildFeedPrompt({ topic: "x", personas: PERSONAS, eduLevel: 1 });
  const expert = buildFeedPrompt({ topic: "x", personas: PERSONAS, eduLevel: 10 });
  assert.match(casual, /Extremely casual/);
  assert.match(expert, /Expert level/);
});

test("demo batches are well formed", () => {
  const posts = generateOfflineBatch({
    topic: "Bioluminescence",
    context: "Bioluminescence is light produced by living organisms. It is common in marine life.",
    personas: PERSONAS,
    count: 6,
    batchIndex: 0,
  });

  assert.equal(posts.length, 6);
  for (const post of posts) {
    assert.ok(post.content.length > 20, "content is substantial");
    assert.ok(PERSONAS.includes(post.persona), "persona is one of the active ones");
    assert.ok(post.followUp.length > 10, "has a follow-up question");
    assert.ok(Array.isArray(post.replies));
  }
});

const uniqueAcrossBatches = (context, batches) => {
  const seen = new Set();
  for (let batch = 0; batch < batches; batch++) {
    for (const post of generateOfflineBatch({
      topic: "Bioluminescence",
      context,
      personas: PERSONAS,
      count: 6,
      batchIndex: batch,
    })) {
      seen.add(signaturesFor(post.content)[0]);
    }
  }
  return seen.size;
};

const ARTICLE = [
  "Bioluminescence is the production and emission of light by living organisms.",
  "Ostracod crustaceans release luminous puffs that hang in the water column.",
  "Bacterial luminescence is regulated by quorum sensing across a population.",
  "Vibrio fischeri colonises the light organ of the Hawaiian bobtail squid.",
  "Some sharks possess photophores arranged along the flank in dense rows.",
  "Luminous millipedes in California appear to advertise a cyanide defence.",
  "Photinus fireflies flash in species specific temporal patterns during courtship.",
  "Predatory Photuris females mimic those patterns to lure and eat the males.",
  "Railroad worms display red head lanterns alongside green lateral lights.",
  "Bomber worms release luminous bodies that detach from their appendages.",
  "Quantum yields for firefly luminescence approach an unusually efficient value.",
  "Aequorin binds calcium and became a standard indicator in cell physiology.",
  "It is a form of chemiluminescence, where chemical energy converts into photons.",
  "Fireflies rely on the enzyme luciferase acting upon a substrate called luciferin.",
  "Marine environments contain the overwhelming majority of luminous species known.",
  "Anglerfish cultivate colonies of symbiotic bacteria inside a modified dorsal spine.",
  "Dinoflagellates create the glowing waves sometimes described as milky seas.",
  "Deep sea shrimp expel luminous clouds to confuse an approaching predator.",
  "Counter illumination lets midwater fish erase their silhouette from below.",
  "Green fluorescent protein was isolated from the crystal jellyfish Aequorea victoria.",
  "Researchers now use luminous reporters to track gene expression inside living tissue.",
  "Fungi such as the ghost mushroom glow continuously rather than in pulses.",
  "New Zealand glowworm larvae dangle sticky threads beneath their luminous bodies.",
].join(" ");

test("demo batches never repeat themselves when an article is available", () => {
  const unique = uniqueAcrossBatches(ARTICLE, 12);
  assert.equal(unique, 72, `expected 72 distinct posts, got ${unique}`);
});

test("demo batches stay distinct even with no article to draw on", () => {
  const unique = uniqueAcrossBatches("", 12);
  assert.equal(unique, 72, `expected 72 distinct posts, got ${unique}`);
});

test("demo material runs out honestly rather than looping quietly", () => {
  // The engine drops repeats, so what matters is that the runway is long and
  // that exhaustion is reached rather than the same posts recirculating.
  const unique = uniqueAcrossBatches("", 24);
  assert.ok(unique >= 90, `expected a long runway, got ${unique} unique`);
  assert.ok(unique < 144, "template material is finite, so this should plateau");
});

test("posts sharing a template lead-in are not treated as duplicates", () => {
  const a = signaturesFor(
    "From the reference literature on Bioluminescence: fireflies rely on the enzyme luciferase."
  );
  const b = signaturesFor(
    "From the reference literature on Bioluminescence: anglerfish cultivate symbiotic bacteria."
  );
  assert.equal(a.filter((sig) => b.includes(sig)).length, 0);
});

test("signatures catch the same fact reworded", () => {
  const [, wordsA] = signaturesFor("Fireflies produce light using the enzyme luciferase.");
  const [, wordsB] = signaturesFor("Using the enzyme luciferase, fireflies produce light!");
  assert.equal(wordsA, wordsB);
});

test("signatures keep genuinely different posts apart", () => {
  const a = signaturesFor("Fireflies produce light using luciferase.");
  const b = signaturesFor("Anglerfish rely on symbiotic bacteria in their lure.");
  assert.equal(a.filter((sig) => b.includes(sig)).length, 0);
});

test("post ages increase down the feed and stay readable", () => {
  assert.equal(formatAge(0.4), "now");
  assert.equal(formatAge(45), "45m");
  assert.equal(formatAge(60 * 5), "5h");
  assert.equal(formatAge(60 * 24 * 3), "3d");
  assert.equal(formatAge(60 * 24 * 90), "3mo");
  assert.match(formatAge(60 * 24 * 800), /y$/);
});

test("counts are abbreviated like a social feed", () => {
  assert.equal(formatCount(942), "942");
  assert.equal(formatCount(1200), "1.2K");
  assert.equal(formatCount(34500), "35K");
  assert.equal(formatCount(1250000), "1.3M");
});
