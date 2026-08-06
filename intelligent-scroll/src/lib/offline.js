import { randomChoice, randomInt, shuffle } from "./util.js";

/**
 * Demo generator used when no AI provider is configured.
 *
 * It never invents statistics. Factual sentences come from the Wikipedia
 * extract that was already fetched for the topic; everything else is framing,
 * questions and argument, which is honest without a model behind it.
 */

const ANGLES = [
  {
    name: "origins",
    probe: (t) => `Who actually got to ${t} first, and did they know what they had?`,
    take: (t) =>
      `The tidy origin story of ${t} is mostly a retelling artifact. Somebody has to be named in the textbook, so one person gets credited for what was really a decade of people circling the same idea.`,
    beats: (t) => [
      `The chronology of ${t} is worth untangling.`,
      `Almost every "first" here has a messier claimant a few years earlier, working with worse tools and less funding.`,
      `What changed was rarely a flash of insight. It was usually that measurement got cheap enough for the idea to be testable.`,
    ],
  },
  {
    name: "misconceptions",
    probe: (t) => `What's the single most common thing people get wrong about ${t}?`,
    take: (t) =>
      `Half of what circulates about ${t} is a simplification someone made for a classroom, escaped into the wild, and hardened into fact. The simplification isn't the problem. Forgetting it was one is.`,
    beats: (t) => [
      `A warning about reading anything on ${t}.`,
      `The popular version and the working version diverged a long time ago, and the popular version is stickier because it's easier to say.`,
      `If an explanation of this has no caveats at all, that's usually the tell.`,
    ],
  },
  {
    name: "mechanism",
    probe: (t) => `Can anyone explain the actual mechanism behind ${t} without hand-waving?`,
    take: (t) =>
      `Knowing that ${t} happens and knowing why it happens are completely different skills, and a startling number of confident explanations only clear the first bar.`,
    beats: (t) => [
      `Trying to be precise about how ${t} works.`,
      `Descriptions of the behaviour are everywhere. Descriptions of the causal chain are much rarer, and they're the part that lets you predict anything new.`,
      `The useful question is never "what happens" — it's "what would have to be false for this not to happen".`,
    ],
  },
  {
    name: "scale",
    probe: (t) => `Does anyone have a genuinely good intuition pump for the scale involved in ${t}?`,
    take: (t) =>
      `Nobody has real intuition for the numbers in ${t}. We have analogies for them, which is a different thing, and the analogies quietly do most of the reasoning for us.`,
    beats: (t) => [
      `On the difficulty of picturing ${t}.`,
      `Human intuition is calibrated for a narrow band of sizes, speeds and durations, and this subject spends most of its time outside that band.`,
      `Which is why the comparisons are load-bearing. Pick a bad one and every conclusion downstream tilts.`,
    ],
  },
  {
    name: "openquestions",
    probe: (t) => `What's still genuinely unresolved in ${t} — not settled-but-unpopular, actually open?`,
    take: (t) =>
      `The most interesting parts of ${t} are the ones where careful people still disagree. Popular coverage skips them because uncertainty doesn't summarise well.`,
    beats: (t) => [
      `The honest state of ${t}.`,
      `There is a confident consensus core, a contested middle, and a frontier where the answer is "we don't know yet, and here's why it's hard".`,
      `Most public argument happens in the middle band while treating itself as the core.`,
    ],
  },
  {
    name: "applications",
    probe: (t) => `Where is ${t} quietly load-bearing in something people use every day?`,
    take: (t) =>
      `${t} stopped being interesting to the public at roughly the moment it started actually working, which is the usual fate of anything that becomes infrastructure.`,
    beats: (t) => [
      `The applied side of ${t} is underrated.`,
      `Once something works reliably it disappears into a stack somewhere and nobody writes about it again.`,
      `That invisibility is the strongest signal a field has matured, and it's terrible for its funding.`,
    ],
  },
  {
    name: "failures",
    probe: (t) => `What's the most instructive failure in the history of ${t}?`,
    take: (t) =>
      `You learn more from the attempts that went badly in ${t} than the ones that worked. Success has one explanation and everyone believes it. Failure has several and they're all informative.`,
    beats: (t) => [
      `A case for studying the failures in ${t}.`,
      `Working examples tell you a path exists. Broken ones tell you where the constraints actually are.`,
      `Almost every safeguard in this area is a scar. It exists because something specific went wrong once.`,
    ],
  },
  {
    name: "measurement",
    probe: (t) => `How do we know what we claim to know about ${t}?`,
    take: (t) =>
      `Most disagreements about ${t} are really disagreements about measurement wearing a costume. Settle how it's measured and the argument frequently evaporates.`,
    beats: (t) => [
      `The epistemics of ${t}.`,
      `Every claim here rests on an instrument, a proxy, or a model, and each of those has a range where it's trustworthy and a range where it isn't.`,
      `"How would we detect being wrong about this" is a more productive question than any object-level debate.`,
    ],
  },
  {
    name: "adjacent",
    probe: (t) => `What field borrowed the most from ${t} without ever crediting it?`,
    take: (t) =>
      `The best ideas in ${t} were imported from somewhere unrelated by someone who didn't know the local conventions well enough to be intimidated by them.`,
    beats: (t) => [
      `On cross-pollination in ${t}.`,
      `Breakthroughs cluster around people with a foot in two fields, because the tools are transferable long before the vocabulary is.`,
      `The cost is a decade of two communities solving the same problem under different names.`,
    ],
  },
  {
    name: "future",
    probe: (t) => `What plausibly changes in ${t} over the next decade, and what definitely won't?`,
    take: (t) =>
      `Predictions about ${t} fail in a predictable direction: they overestimate what changes in two years and badly underestimate what changes in twenty.`,
    beats: (t) => [
      `Forecasting ${t}, carefully.`,
      `The bottleneck is rarely the headline idea. It's tooling, cost curves, and whether anyone can be paid to do the boring middle part.`,
      `Watch what gets cheap. That predicts more than any roadmap.`,
    ],
  },
];

const SHORT_REACTIONS = [
  (t) => `ok the ${t} rabbit hole got me again. it's 2am.`,
  (t) => `${t} is one of those things that gets stranger the more you read, not less.`,
  (t) => `genuinely cannot believe ${t} isn't taught properly in school`,
  (t) => `every time I think I understand ${t} I find another layer underneath`,
  (t) => `${t} explained badly is boring. ${t} explained well is unreasonably good.`,
  (t) => `whoever decided the standard intro to ${t} should start with the hardest part: why`,
];

const REPLY_TEMPLATES = [
  (t, angle) => `This is the part that never gets explained properly. The ${angle} angle on ${t} is where it actually gets interesting.`,
  () => `Source? Not being difficult, I want to read the primary thing rather than someone's summary of it.`,
  (t) => `Partly agree, but this skips the cases where it doesn't hold, and those are pretty common in ${t}.`,
  () => `I was taught the opposite of this and now I have to go re-check my notes. Thanks, I guess.`,
  (t) => `Following because I've been trying to explain ${t} to a very stubborn 9 year old and losing.`,
  () => `Strong claim, thin evidence. What would change your mind here?`,
  (t) => `The framing matters more than people think. Half the confusion about ${t} is people answering different questions.`,
  () => `Right, but that's the textbook version. Anyone who's worked on this will tell you it's messier.`,
  (t) => `Saving this. Best thing on ${t} I've read on this timeline in months.`,
  () => `Counterpoint: this is true on average and misleading in every specific case.`,
];

const FOLLOW_UPS = [
  (t, angle) => `What's the strongest counterargument to the standard view of ${t}?`,
  (t) => `Who are the people currently doing the most interesting work on ${t}?`,
  (t, angle) => `How did the ${angle} of ${t} get settled — or is it still open?`,
  (t) => `What would you need to believe for ${t} to be completely wrong?`,
  (t) => `Where does ${t} touch everyday life without anyone noticing?`,
];

const splitSentences = (text) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 45);

const personaVoice = (persona, sentence, topic) => {
  switch (persona) {
    case "academic":
      return `From the reference literature on ${topic}: ${sentence}`;
    case "journalist":
      return `Worth restating plainly, because coverage keeps garbling it — ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
    case "historian":
      return `Context people skip: ${sentence}`;
    case "techie":
      return `Baseline definition before anyone argues in the replies: ${sentence}`;
    case "skeptic":
      return `The claim, stated as neutrally as I can manage: ${sentence}\n\nNow, what's the evidence actually resting on?`;
    case "contrarian":
      return `Everyone quotes this line about ${topic} — ${sentence} — and then reasons from it like it's the whole picture.`;
    case "enthusiast":
      return `TIL properly: ${sentence}\n\nAnd that's the boring version.`;
    default:
      return `so apparently: ${sentence}`;
  }
};

const pickPersona = (personas, preferred) =>
  personas.includes(preferred) ? preferred : randomChoice(personas);

const buildReplies = (topic, angle, count) =>
  shuffle(REPLY_TEMPLATES)
    .slice(0, count)
    .map((template) => ({ content: template(topic, angle.name) }));

export const generateOfflineDeepDive = ({ topic, context = "", postContent = "" }) => {
  const sentences = splitSentences(context);
  const angle = randomChoice(ANGLES);
  const start = sentences.length ? Math.abs(postContent.length) % sentences.length : 0;
  const evidence = sentences.length
    ? `From the reference article: ${[0, 1, 2]
        .map((i) => sentences[(start + i) % sentences.length])
        .filter(Boolean)
        .join(" ")}`
    : `There is no reference article loaded for ${topic}, so treat the framing above as a starting point rather than a source.`;

  return [
    angle.beats(topic).join("\n\n"),
    evidence,
    "This is demo content. No AI provider is configured, so the framing is template-generated and the factual sentences come straight from Wikipedia. Set GROQ_API_KEY to get a model-written deep dive here instead.",
  ].join("\n\n");
};

/**
 * Produces one batch. `batchIndex` walks the angle list and the sentence pool
 * so successive batches keep drifting into new material.
 */
export const generateOfflineBatch = ({ topic, context = "", personas, count = 7, batchIndex = 0 }) => {
  const sentences = splitSentences(context);
  const angles = [0, 1, 2].map((i) => ANGLES[(batchIndex * 3 + i) % ANGLES.length]);
  const posts = [];

  for (let i = 0; i < count; i++) {
    const angle = angles[i % angles.length];
    const sentence = sentences.length ? sentences[(batchIndex * count + i) % sentences.length] : null;
    const slot = i % 7;
    let kind = "take";
    let content;

    if (slot === 0) {
      kind = "til";
      content = sentence
        ? personaVoice(pickPersona(personas, "enthusiast"), sentence, topic)
        : `${topic} is one of those subjects where the first honest step is admitting how much of it is contested.`;
    } else if (slot === 1) {
      kind = "take";
      content = angle.take(topic);
    } else if (slot === 2) {
      kind = "question";
      content = angle.probe(topic);
    } else if (slot === 3) {
      kind = "fact";
      content = sentence
        ? personaVoice(pickPersona(personas, "academic"), sentence, topic)
        : angle.beats(topic).slice(0, 2).join(" ");
    } else if (slot === 4) {
      kind = "explainer";
      content = angle.beats(topic).join("\n\n");
    } else if (slot === 5) {
      kind = "take";
      content = randomChoice(SHORT_REACTIONS)(topic);
    } else {
      kind = "data";
      content = sentence
        ? `${angle.probe(topic)}\n\nStarting point, from the reference material: ${sentence}`
        : angle.probe(topic);
    }

    const persona =
      kind === "question"
        ? pickPersona(personas, "skeptic")
        : kind === "take"
        ? pickPersona(personas, "contrarian")
        : kind === "explainer"
        ? pickPersona(personas, "journalist")
        : randomChoice(personas);

    posts.push({
      persona,
      kind,
      content,
      replies: i % 2 === 0 ? buildReplies(topic, angle, randomInt(2, 4)) : [],
      followUp: randomChoice(FOLLOW_UPS)(topic, angle.name),
    });
  }

  return posts;
};

export const generateOfflineReplies = ({ topic, count = 4 }) =>
  shuffle(REPLY_TEMPLATES)
    .slice(0, count)
    .map((template) => ({ content: template(topic, "this") }));
