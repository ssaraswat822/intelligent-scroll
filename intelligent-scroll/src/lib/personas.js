export const PERSONAS = {
  academic: {
    label: "Academic",
    emoji: "🎓",
    verified: true,
    style: "formal, cites studies and papers, precise terminology",
    names: ["Dr. Elena Voss", "Prof. James Chen", "Dr. Amara Obi", "Prof. Lena Ström", "Dr. R. Kapoor", "Dr. Nadia Haddad"],
  },
  casual: {
    label: "Casual",
    emoji: "💬",
    verified: false,
    style: "relaxed, conversational, slang and everyday language",
    names: ["jordan", "sammyy", "nate", "mika", "riley b", "toastcrumb"],
  },
  skeptic: {
    label: "Skeptic",
    emoji: "🤔",
    verified: false,
    style: "questioning, plays devil's advocate, asks for evidence",
    names: ["DoubtfulDave", "QuestionMark", "SkepticalSam", "ProofPlease", "ActuallyTho"],
  },
  enthusiast: {
    label: "Enthusiast",
    emoji: "🔥",
    verified: false,
    style: "excited, passionate, shares fun facts and connections",
    names: ["HYPED_Hannah", "omgscience", "NerdAlert", "CuriousCat", "wowfacts"],
  },
  historian: {
    label: "Historian",
    emoji: "📜",
    verified: true,
    style: "gives historical context, dates and timelines",
    names: ["HistoryHank", "PastTense", "ChroniclerK", "ArchiveAnna", "TimelineT"],
  },
  techie: {
    label: "Techie",
    emoji: "💻",
    verified: false,
    style: "technical, analytical, data-driven",
    names: ["dev_null", "0xcaffeine", "bitwise_bob", "kernel_panic", "sudo_sarah"],
  },
  journalist: {
    label: "Journalist",
    emoji: "📰",
    verified: true,
    style: "reports the story, quotes sources, explains why it matters",
    names: ["Maya Okonkwo", "Tom Reyes", "Priya Nair", "Anders Holm", "Cara Whitfield"],
  },
  contrarian: {
    label: "Contrarian",
    emoji: "🧨",
    verified: false,
    style: "argues the unpopular side, picks fights with the consensus",
    names: ["hotTakeHarold", "againstTheGrain", "no_consensus", "devilsadvocate", "unpopular_op"],
  },
};

export const PERSONA_KEYS = Object.keys(PERSONAS);

export const DEFAULT_PERSONAS = ["academic", "casual", "enthusiast", "skeptic", "journalist"];

export const AVATAR_COLORS = [
  "#1d9bf0", "#7856ff", "#00ba7c", "#f91880", "#ff7a00",
  "#ffd400", "#e0245e", "#17bf63", "#794bc4", "#5b7083",
];
