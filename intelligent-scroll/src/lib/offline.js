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
  {
    name: "vocabulary",
    probe: (t) => `Which word in ${t} causes the most confusion by meaning two different things?`,
    take: (t) =>
      `A surprising share of arguments about ${t} are two people using one word for two concepts and never noticing.`,
    beats: (t) => [
      `The terminology of ${t} deserves an audit.`,
      `Several terms were coined before the thing they describe was understood, and they have been quietly misleading students ever since.`,
      `Renaming is politically impossible, so everyone just learns the exceptions.`,
    ],
  },
  {
    name: "teaching",
    probe: (t) => `What's the best order to learn ${t} in, and why isn't it the usual one?`,
    take: (t) =>
      `The standard curriculum for ${t} is ordered by historical accident, not by what builds understanding fastest.`,
    beats: (t) => [
      `On how ${t} gets taught.`,
      `Introductions tend to start with whatever was discovered first, which is rarely the most intuitive entry point.`,
      `The people who understand it best usually came in sideways, from a problem they actually cared about.`,
    ],
  },
  {
    name: "outsiders",
    probe: (t) => `Which amateur or outsider contribution to ${t} turned out to matter most?`,
    take: (t) =>
      `${t} has a long record of outsiders being right early and being credited late, if at all.`,
    beats: (t) => [
      `The amateur tradition in ${t}.`,
      `For long stretches the serious work happened outside institutions, funded by curiosity and stubbornness.`,
      `Professionalisation raised the floor and, arguably, lowered the ceiling on how strange an idea is allowed to be.`,
    ],
  },
  {
    name: "instruments",
    probe: (t) => `Which single instrument or technique unlocked the most progress in ${t}?`,
    take: (t) =>
      `Progress in ${t} tracks instrumentation far more closely than it tracks theory. Build a better detector and the questions rewrite themselves.`,
    beats: (t) => [
      `The tools behind ${t}.`,
      `Almost every step change here follows a new way of seeing or measuring, not a new way of thinking.`,
      `Which means the interesting bottleneck is usually engineering wearing a lab coat.`,
    ],
  },
  {
    name: "geography",
    probe: (t) => `Why did ${t} develop where it did rather than somewhere else?`,
    take: (t) =>
      `The geography of ${t} is not an accident of genius. It follows trade routes, patronage, and who happened to have a surplus.`,
    beats: (t) => [
      `Where ${t} came from, literally.`,
      `Ideas cluster around money, safety, and the freedom to be wrong in public for a few years.`,
      `Move those three things and the map redraws within a generation.`,
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
  (t) => `the gap between the popular version of ${t} and the working version is enormous`,
  (t) => `three tabs deep on ${t} and I have more questions than I started with. correct outcome tbh`,
  (t) => `${t} is proof that "obvious in hindsight" is doing a lot of heavy lifting`,
  (t) => `nobody warns you that ${t} is mostly arguing about definitions`,
  (t) => `started reading about ${t} to settle a bet. the bet is now much worse`,
  (t) => `the more confident someone sounds about ${t}, the less I trust the summary`,
  (t) => `${t} has at least four separate stories inside it and they keep getting merged`,
  (t) => `honestly ${t} should come with a warning about how deep the footnotes go`,
  (t) => `unpopular: the interesting bit of ${t} is the part everyone calls a technicality`,
  (t) => `${t} keeps turning out to be a measurement problem in a costume`,
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
  (t) => `What's the strongest counterargument to the standard view of ${t}?`,
  (t) => `Who are the people currently doing the most interesting work on ${t}?`,
  (t, angle) => `How did the ${angle} of ${t} get settled — or is it still open?`,
  (t) => `What would you need to believe for ${t} to be completely wrong?`,
  (t) => `Where does ${t} touch everyday life without anyone noticing?`,
  (t) => `Which field borrowed the most from ${t}?`,
  (t) => `What did people believe about ${t} a century ago?`,
  (t) => `What's the best worked example to learn ${t} from?`,
  (t) => `Where does the funding for ${t} actually come from?`,
  (t) => `What breaks first when you push ${t} to its limits?`,
  (t) => `Which popular explanation of ${t} should be retired?`,
  (t) => `What would settle the biggest open argument in ${t}?`,
];

const splitSentences = (text) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 45);

const VOICES = {
  academic: [
    (s, t) => `From the reference literature on ${t}: ${s}`,
    (s) => `Stating the established position first, since the replies always skip it: ${s}`,
    (s, t) => `The standard characterisation of ${t} runs: ${s}\n\nEverything interesting happens at the edges of that sentence.`,
  ],
  journalist: [
    (s) => `Worth restating plainly, because coverage keeps garbling it — ${lower(s)}`,
    (s, t) => `The one-paragraph version of ${t} that most articles never manage: ${s}`,
    (s) => `Filed under things that sound made up but aren't: ${s}`,
  ],
  historian: [
    (s) => `Context people skip: ${s}`,
    (s, t) => `Before the modern framing of ${t} took hold, this was the working description: ${s}`,
    (s) => `For the record, and it matters later: ${s}`,
  ],
  techie: [
    (s) => `Baseline definition before anyone argues in the replies: ${s}`,
    (s) => `Spec sheet version: ${s}`,
    (s, t) => `If you're implementing anything near ${t}, start here: ${s}`,
  ],
  skeptic: [
    (s) => `The claim, stated as neutrally as I can manage: ${s}\n\nNow — what is the evidence actually resting on?`,
    (s) => `Read this carefully and notice how much of it is definition rather than finding: ${s}`,
    (s) => `Fine, but load-bearing question: ${s}\n\nWho measured that, and how?`,
  ],
  contrarian: [
    (s, t) => `Everyone quotes this line about ${t} — ${s} — and then reasons from it like it's the whole picture.`,
    (s) => `This gets repeated constantly: ${s}\n\nIt's true and it's also doing a lot of quiet work.`,
    (s, t) => `The consensus on ${t} compresses to: ${s} Which is exactly why it gets misapplied.`,
  ],
  enthusiast: [
    (s) => `TIL properly: ${s}\n\nAnd that's the boring version.`,
    (s) => `Okay this one is genuinely great: ${s}`,
    (s, t) => `Reading about ${t} and had to stop at this: ${s}`,
  ],
  casual: [
    (s) => `so apparently: ${s}`,
    (s) => `found this and it reordered my brain a little: ${s}`,
    (s) => `wait i did not know this: ${s}`,
  ],
};

const lower = (s) => `${s.charAt(0).toLowerCase()}${s.slice(1)}`;

const personaVoice = (persona, sentence, topic, variant = 0) => {
  const options = VOICES[persona] || VOICES.casual;
  return options[variant % options.length](sentence, topic);
};

const pickPersona = (personas, preferred) =>
  personas.includes(preferred) ? preferred : randomChoice(personas);

/**
 * Every distinct thing this generator can say about a topic, in a fixed order,
 * so successive batches can walk the list instead of drawing at random and
 * colliding. One post consumes exactly one item.
 */
const materialFor = (topic) => {
  const items = [];
  ANGLES.forEach((angle, index) => {
    const beats = angle.beats(topic);
    items.push({ kind: "take", text: angle.take(topic), angle });
    items.push({ kind: "question", text: angle.probe(topic), angle });
    items.push({ kind: "explainer", text: beats.join("\n\n"), angle });
    items.push({ kind: "fact", text: beats[1], angle });
    items.push({ kind: "data", text: beats[2], angle });
    items.push({ kind: "take", text: SHORT_REACTIONS[index % SHORT_REACTIONS.length](topic), angle });
  });
  return items;
};

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

const personaForKind = (kind, personas) => {
  switch (kind) {
    case "question":
      return pickPersona(personas, "skeptic");
    case "take":
      return pickPersona(personas, "contrarian");
    case "explainer":
      return pickPersona(personas, "journalist");
    case "til":
      return pickPersona(personas, "enthusiast");
    case "fact":
      return pickPersona(personas, "academic");
    default:
      return randomChoice(personas);
  }
};

// Roughly a third of each batch is built from the reference article when one is
// available, so the timeline keeps some real substance in it.
const SENTENCE_SHARE = 3;

/**
 * Produces one batch. Both the article sentences and the template material are
 * walked with cursors derived from `batchIndex`, so a batch consumes new
 * material rather than re-drawing what earlier batches already used.
 */
export const generateOfflineBatch = ({ topic, context = "", personas, count = 6, batchIndex = 0 }) => {
  const sentences = splitSentences(context);
  const material = materialFor(topic);
  const posts = [];

  const sentenceQuota = sentences.length ? Math.max(1, Math.round(count / SENTENCE_SHARE)) : 0;
  let sentenceCursor = batchIndex * sentenceQuota;
  let materialCursor = batchIndex * (count - sentenceQuota);

  for (let i = 0; i < count; i++) {
    const useSentence = sentenceQuota > 0 && i % SENTENCE_SHARE === 0 && posts.length < count;
    let kind;
    let content;
    let angle;

    if (useSentence) {
      const cursor = batchIndex * count + i;
      kind = i === 0 ? "til" : "fact";
      angle = ANGLES[cursor % ANGLES.length];
    } else {
      const item = material[materialCursor++ % material.length];
      kind = item.kind;
      angle = item.angle;
      content = item.text;
    }

    const persona = personaForKind(kind, personas);
    if (useSentence) {
      const sentence = sentences[sentenceCursor++ % sentences.length];
      content = personaVoice(persona, sentence, topic, batchIndex * count + i);
    }

    posts.push({
      persona,
      kind,
      content,
      replies: i % 2 === 0 ? buildReplies(topic, angle, randomInt(2, 4)) : [],
      followUp: FOLLOW_UPS[(batchIndex * count + i) % FOLLOW_UPS.length](topic, angle.name),
    });
  }

  return posts;
};

export const generateOfflineReplies = ({ topic, count = 4 }) =>
  shuffle(REPLY_TEMPLATES)
    .slice(0, count)
    .map((template) => ({ content: template(topic, "this") }));
