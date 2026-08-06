import { useCallback, useRef, useState } from "react";
import { callAI, fetchTopicContext, NoProviderError } from "../lib/api.js";
import { buildDeepDivePrompt, buildFeedPrompt, buildReplyPrompt } from "../lib/prompt.js";
import { parseObjectArray } from "../lib/parse.js";
import {
  generateOfflineBatch,
  generateOfflineDeepDive,
  generateOfflineReplies,
} from "../lib/offline.js";
import { AVATAR_COLORS, PERSONAS } from "../lib/personas.js";
import {
  ageForIndex,
  angleFor,
  formatAge,
  generateId,
  randomChoice,
  randomInt,
  signaturesFor,
} from "../lib/util.js";

const BATCH_SIZE = 6;
const BUFFER_TARGET = BATCH_SIZE * 2;
const MAX_AVOID = 18;
const MAX_FAILURES = 3;
const VALID_KINDS = new Set(["fact", "take", "question", "explainer", "til", "data"]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const colorFor = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const makeUser = (personaKey) => {
  const persona = PERSONAS[personaKey] || PERSONAS.casual;
  const name = randomChoice(persona.names);
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  const suffix = Math.random() < 0.45 ? "" : String(randomInt(2, 99));
  return {
    name,
    handle: `@${slug}${suffix}`,
    color: colorFor(name),
    persona: personaKey in PERSONAS ? personaKey : "casual",
    verified: persona.verified,
  };
};

const THE_USER = { name: "You", handle: "@you", color: "#1d9bf0", persona: "casual", verified: false, isYou: true };

const cleanContent = (text) =>
  String(text || "")
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s*(?:#[\w-]+\s*)+$/, "")
    .trim();

const makeStats = () => {
  const views = randomInt(900, 240000);
  const likes = Math.max(1, Math.round(views * (0.008 + Math.random() * 0.06)));
  return {
    views,
    likes,
    reposts: Math.max(0, Math.round(likes * (0.04 + Math.random() * 0.22))),
    replyPad: randomInt(0, 3),
  };
};

const normalizeReply = (raw, personas) => {
  const content = cleanContent(raw?.content);
  if (!content) return null;
  const persona = personas.includes(raw?.persona) ? raw.persona : randomChoice(personas);
  return {
    id: generateId(),
    user: makeUser(persona),
    content,
    likes: randomInt(0, 420),
  };
};

const normalizePost = (raw, { personas, feedIndex, batchIndex }) => {
  const content = cleanContent(raw?.content);
  if (content.length < 12) return null;

  const persona = personas.includes(raw?.persona) ? raw.persona : randomChoice(personas);
  const kind = VALID_KINDS.has(raw?.kind) ? raw.kind : "take";
  const replies = Array.isArray(raw?.replies) ? raw.replies : Array.isArray(raw?.comments) ? raw.comments : [];

  return {
    id: generateId(),
    kind,
    user: makeUser(persona),
    content,
    ageLabel: formatAge(ageForIndex(feedIndex)),
    replies: replies.map((r) => normalizeReply(r, personas)).filter(Boolean).slice(0, 5),
    deepDive: cleanContent(raw?.deepDive) || null,
    deepDiveLoading: false,
    followUp: cleanContent(raw?.followUp) || null,
    stats: makeStats(),
    batchIndex,
  };
};

const newSession = (topic, runId) => ({
  runId,
  topic,
  context: null,
  batchIndex: 0,
  feedIndex: 0,
  avoid: [],
  seen: new Set(),
});

export function useInfiniteFeed({ eduLevel, personas }) {
  const [topic, setTopic] = useState("");
  const [posts, setPosts] = useState([]);
  const [context, setContext] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [bufferCount, setBufferCount] = useState(0);
  const [offline, setOffline] = useState(false);
  const [batchesLoaded, setBatchesLoaded] = useState(0);

  const runIdRef = useRef(0);
  const sessionRef = useRef(newSession("", 0));
  const bufferRef = useRef([]);
  const postsRef = useRef([]);
  const pumpRef = useRef(null);
  const failuresRef = useRef(0);
  const offlineRef = useRef(false);

  // Settings change between renders; the pump reads them through refs so an
  // in-flight generation always uses the latest values.
  const settingsRef = useRef({ eduLevel, personas });
  settingsRef.current = { eduLevel, personas };

  const commitPosts = useCallback((next) => {
    postsRef.current = next;
    setPosts(next);
  }, []);

  const generateBatch = useCallback(async (session) => {
    const { eduLevel: level, personas: activePersonas } = settingsRef.current;
    const batchIndex = session.batchIndex++;
    const shared = {
      topic: session.topic,
      context: session.context?.body || session.context?.extract || "",
      personas: activePersonas,
      count: BATCH_SIZE,
      batchIndex,
    };

    let raw = [];
    if (offlineRef.current) {
      raw = generateOfflineBatch(shared);
    } else {
      try {
        const prompt = buildFeedPrompt({
          ...shared,
          eduLevel: level,
          avoid: session.avoid.slice(-MAX_AVOID),
        });
        raw = parseObjectArray(await callAI(prompt, 4000));
      } catch (err) {
        if (!(err instanceof NoProviderError)) throw err;
        offlineRef.current = true;
        setOffline(true);
        raw = generateOfflineBatch(shared);
      }
    }

    const accepted = [];
    for (const item of raw) {
      const post = normalizePost(item, {
        personas: activePersonas,
        feedIndex: session.feedIndex,
        batchIndex,
      });
      if (!post) continue;

      const signatures = signaturesFor(post.content);
      if (signatures.some((sig) => session.seen.has(sig))) continue;
      signatures.forEach((sig) => session.seen.add(sig));

      session.avoid.push(angleFor(post.content));
      session.feedIndex++;
      accepted.push(post);
    }

    if (!accepted.length) throw new Error("No usable posts in response");
    if (session.avoid.length > MAX_AVOID * 2) session.avoid = session.avoid.slice(-MAX_AVOID);
    return accepted;
  }, []);

  /**
   * Keeps generating until BUFFER_TARGET posts are queued ahead of the reader.
   * Only one pump runs at a time; callers can fire it freely.
   */
  const pump = useCallback(() => {
    if (pumpRef.current) return pumpRef.current;
    const session = sessionRef.current;
    if (!session.topic) return Promise.resolve();

    const task = (async () => {
      setIsFetching(true);
      try {
        while (session.runId === runIdRef.current && bufferRef.current.length < BUFFER_TARGET) {
          try {
            const batch = await generateBatch(session);
            if (session.runId !== runIdRef.current) return;

            failuresRef.current = 0;
            setError("");
            setBatchesLoaded((n) => n + 1);

            // The first batch goes straight to the screen; later ones queue up.
            if (postsRef.current.length === 0) {
              commitPosts(batch);
              setPhase("ready");
            } else {
              bufferRef.current = [...bufferRef.current, ...batch];
              setBufferCount(bufferRef.current.length);
            }
          } catch (err) {
            if (session.runId !== runIdRef.current) return;
            failuresRef.current += 1;
            if (failuresRef.current >= MAX_FAILURES) {
              setError(err.message || "Could not generate more posts");
              if (postsRef.current.length === 0) setPhase("error");
              return;
            }
            await delay(700 * failuresRef.current);
          }
        }
      } finally {
        setIsFetching(false);
      }
    })();

    pumpRef.current = task.finally(() => {
      pumpRef.current = null;
    });
    return pumpRef.current;
  }, [commitPosts, generateBatch]);

  /** Moves queued posts onto the screen and tops the queue back up. */
  const loadMore = useCallback(() => {
    if (!sessionRef.current.topic) return;
    if (bufferRef.current.length > 0) {
      const next = bufferRef.current.slice(0, BATCH_SIZE);
      bufferRef.current = bufferRef.current.slice(next.length);
      setBufferCount(bufferRef.current.length);
      commitPosts([...postsRef.current, ...next]);
    }
    pump();
  }, [commitPosts, pump]);

  const start = useCallback(
    async (rawTopic) => {
      const nextTopic = String(rawTopic || "").trim();
      if (!nextTopic) return;

      const runId = ++runIdRef.current;
      sessionRef.current = newSession(nextTopic, runId);
      bufferRef.current = [];
      postsRef.current = [];
      failuresRef.current = 0;

      setTopic(nextTopic);
      setPosts([]);
      setContext(null);
      setError("");
      setBufferCount(0);
      setBatchesLoaded(0);
      setPhase("loading");

      const ctx = await fetchTopicContext(nextTopic);
      if (runIdRef.current !== runId) return;
      sessionRef.current.context = ctx;
      setContext(ctx);

      await pump();
    },
    [pump]
  );

  const retry = useCallback(() => {
    failuresRef.current = 0;
    setError("");
    if (postsRef.current.length === 0 && sessionRef.current.topic) {
      setPhase("loading");
    }
    pump();
  }, [pump]);

  const generateReplies = useCallback(async (postContent) => {
    const { personas: activePersonas } = settingsRef.current;
    const topicName = sessionRef.current.topic;

    if (offlineRef.current) {
      return generateOfflineReplies({ topic: topicName }).map((r) => normalizeReply(r, activePersonas)).filter(Boolean);
    }
    try {
      const text = await callAI(
        buildReplyPrompt({ postContent, topic: topicName, personas: activePersonas }),
        1200
      );
      const parsed = parseObjectArray(text);
      const replies = parsed.map((r) => normalizeReply(r, activePersonas)).filter(Boolean);
      if (replies.length) return replies;
    } catch (err) {
      if (err instanceof NoProviderError) {
        offlineRef.current = true;
        setOffline(true);
      }
    }
    return generateOfflineReplies({ topic: topicName })
      .map((r) => normalizeReply(r, activePersonas))
      .filter(Boolean);
  }, []);

  /** Adds a reply to a post, then pulls in AI responses to it. */
  const replyToPost = useCallback(
    async (postId, content) => {
      const mine = { id: generateId(), user: THE_USER, content: cleanContent(content), likes: 0, isYou: true };
      commitPosts(
        postsRef.current.map((p) => (p.id === postId ? { ...p, replies: [...p.replies, mine] } : p))
      );

      const replies = (await generateReplies(content)).slice(0, 3);
      if (!replies.length) return;
      commitPosts(
        postsRef.current.map((p) => (p.id === postId ? { ...p, replies: [...p.replies, ...replies] } : p))
      );
    },
    [commitPosts, generateReplies]
  );

  /** Posts as the user at the top of the feed and lets the personas respond. */
  const publishPost = useCallback(
    async (content) => {
      const post = {
        id: generateId(),
        kind: "take",
        user: THE_USER,
        content: cleanContent(content),
        ageLabel: "now",
        replies: [],
        deepDive: null,
        followUp: null,
        stats: { views: randomInt(3, 90), likes: 0, reposts: 0, replyPad: 0 },
        isYours: true,
        batchIndex: -1,
      };
      commitPosts([post, ...postsRef.current]);

      const replies = await generateReplies(content);
      if (!replies.length) return;
      commitPosts(
        postsRef.current.map((p) => (p.id === post.id ? { ...p, replies } : p))
      );
    },
    [commitPosts, generateReplies]
  );

  const updatePost = useCallback(
    (postId, patch) => {
      commitPosts(postsRef.current.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
    },
    [commitPosts]
  );

  /** Deep dives are written on demand — they are far too slow to batch. */
  const loadDeepDive = useCallback(
    async (postId) => {
      const post = postsRef.current.find((p) => p.id === postId);
      if (!post || post.deepDive || post.deepDiveLoading) return;

      const session = sessionRef.current;
      const context = session.context?.body || session.context?.extract || "";
      updatePost(postId, { deepDiveLoading: true, deepDiveError: null });

      const fallback = () =>
        generateOfflineDeepDive({ topic: session.topic, context, postContent: post.content });

      if (offlineRef.current) {
        updatePost(postId, { deepDive: fallback(), deepDiveLoading: false });
        return;
      }

      try {
        const text = await callAI(
          buildDeepDivePrompt({
            topic: session.topic,
            postContent: post.content,
            context,
            eduLevel: settingsRef.current.eduLevel,
          }),
          1400
        );
        const clean = cleanContent(text);
        updatePost(postId, {
          deepDive: clean || fallback(),
          deepDiveLoading: false,
        });
      } catch (err) {
        if (err instanceof NoProviderError) {
          offlineRef.current = true;
          setOffline(true);
          updatePost(postId, { deepDive: fallback(), deepDiveLoading: false });
          return;
        }
        updatePost(postId, {
          deepDiveLoading: false,
          deepDiveError: err.message || "Could not write the deep dive",
        });
      }
    },
    [updatePost]
  );

  return {
    topic,
    posts,
    context,
    phase,
    error,
    offline,
    isFetching,
    bufferCount,
    batchesLoaded,
    start,
    loadMore,
    retry,
    replyToPost,
    publishPost,
    updatePost,
    loadDeepDive,
  };
}
