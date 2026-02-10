import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants & Config ─────────────────────────────────────────────
const PERSONAS = {
  academic: { label: "Academic", emoji: "🎓", style: "formal, citing studies and papers, using precise terminology" },
  casual: { label: "Casual", emoji: "💬", style: "relaxed, using slang, memes, and everyday language" },
  skeptic: { label: "Skeptic", emoji: "🤔", style: "questioning, playing devil's advocate, asking for evidence" },
  enthusiast: { label: "Enthusiast", emoji: "🔥", style: "excited, passionate, sharing fun facts and connections" },
  historian: { label: "Historian", emoji: "📜", style: "providing historical context and timelines" },
  techie: { label: "Techie", emoji: "💻", style: "technical, analytical, data-driven" },
};

const REACTIONS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "🤯", label: "Mind-blown" },
  { emoji: "🧠", label: "Big brain" },
  { emoji: "💡", label: "Insightful" },
];

const TRENDING_TOPICS = [
  "Quantum Computing", "CRISPR Gene Editing", "Dark Matter", "Neural Networks",
  "Climate Tipping Points", "Fermentation Science", "The Silk Road", "Stoic Philosophy",
  "Bioluminescence", "Game Theory", "The Great Filter", "Mycology",
];

const EXPLORE_TOPICS = [
  "The science of sleep", "Black holes explained", "How vaccines work",
  "Ancient Roman engineering", "The psychology of habits", "Octopus intelligence",
  "History of cryptography", "Plate tectonics", "The Turing Test",
  "Fermi Paradox", "Renaissance art techniques", "How memory works",
  "Deep sea creatures", "The history of jazz", "Quantum entanglement",
  "Viking exploration", "Behavioral economics", "The human microbiome",
  "History of mathematics", "Artificial photosynthesis", "Maya civilization",
  "The science of color", "String theory basics", "History of animation",
  "Epigenetics", "The Voynich Manuscript", "Chaos theory", "Origami mathematics",
  "Symbiotic relationships", "History of espionage", "The placebo effect",
  "Biomimicry in engineering",
];

const EDU_LABELS = {
  low: { label: "Casual & Fun", desc: "Memes, reactions, hot takes" },
  mid: { label: "Balanced", desc: "Facts mixed with opinions" },
  high: { label: "Highly Educational", desc: "Expert-level analysis" },
};

const getEduPrompt = (level) => {
  if (level <= 2) return `TONE: Extremely casual. Think TikTok comments and tweets. Use slang, abbreviations, ALL CAPS for emphasis, exaggerated reactions ("bruh", "no way", "this is wild"). Posts should feel like friends texting about the topic. Keep most posts under 2 sentences. Fun > accuracy.`;
  if (level <= 4) return `TONE: Casual but informative. Think popular Reddit posts or Twitter threads. Mix fun observations with actual facts. Use conversational language, some humor, occasional "wait, actually..." moments. Reference pop culture comparisons. Include 1-2 specific facts per post but keep it approachable.`;
  if (level <= 6) return `TONE: Balanced and engaging. Think quality YouTube explainer or a good Atlantic article. Each post should teach something specific — include real numbers, dates, named researchers, or studies. Mix explanatory posts with opinion/debate posts. Use clear analogies. Accessible but substantive.`;
  if (level <= 8) return `TONE: Highly educational and analytical. Think university lecture or Nature article summary. Include specific data points, cite named studies/researchers/papers by name, use proper technical terminology (but explain it), discuss mechanisms and causation not just facts. Posts should demonstrate deep understanding. Reference ongoing scientific debates and open questions.`;
  return `TONE: Expert/PhD level. Think peer review discussion or advanced seminar. Use precise technical terminology, reference specific papers and methodologies, discuss edge cases and limitations of current understanding, engage with nuance and complexity. Include quantitative data. Assume the reader has foundational knowledge. Discuss what we DON'T know as much as what we do.`;
};

const generateId = () => Math.random().toString(36).slice(2, 10);
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const timeAgo = (i) => {
  const units = ["just now", "1m", "3m", "5m", "12m", "28m", "1h", "2h", "4h", "6h", "9h", "14h", "1d", "2d"];
  return units[Math.min(i, units.length - 1)];
};

const generateUser = (persona) => {
  const names = {
    academic: ["Dr. Elena Voss", "Prof. James Chen", "Dr. Amara Obi", "Prof. Lena Ström", "Dr. R. Kapoor"],
    casual: ["jordan 🌊", "sammyy", "nate vibes", "mika ✨", "riley b"],
    skeptic: ["DoubtfulDave", "QuestionMark", "SkepticalSam", "ProofPlease", "DebateMeOn"],
    enthusiast: ["HYPED_Hannah", "OmgScience", "NerdAlert🔥", "CuriousCat", "WowFacts"],
    historian: ["HistoryHank", "PastTense", "ChroniclerK", "ArchiveAnna", "TimelineT"],
    techie: ["dev_null", "0xCaffeine", "bitwise_bob", "kernel_panic", "sudo_sarah"],
  };
  const n = randomChoice(names[persona] || names.casual);
  const handle = "@" + n.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) + randomInt(1, 99);
  const colors = ["#E07A5F", "#3D405B", "#81B29A", "#F2CC8F", "#6A4C93", "#1982C4", "#FF595E", "#8AC926"];
  return { name: n, handle, color: randomChoice(colors), persona };
};

// ─── Wikipedia Fetch ────────────────────────────────────────────────
const fetchWikipedia = async (topic) => {
  try {
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`
    );
    if (resp.ok) {
      const data = await resp.json();
      return { title: data.title, extract: data.extract, thumbnail: data.thumbnail?.source || null };
    }
    const search = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`
    );
    const sData = await search.json();
    if (sData.query?.search?.length) {
      const top = sData.query.search[0].title;
      const r2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top)}`);
      if (r2.ok) {
        const d2 = await r2.json();
        return { title: d2.title, extract: d2.extract, thumbnail: d2.thumbnail?.source || null };
      }
    }
    return null;
  } catch {
    return null;
  }
};

// ─── AI generation via Netlify Function ─────────────────────────────
const callAI = async (prompt, maxTokens = 4000) => {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, maxTokens }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "API error");
    return data.text;
  } catch (e) {
    console.error("AI call error:", e);
    return null;
  }
};

const generateFeedContent = async (topic, wikiData, eduLevel, activePersonas, count = 6) => {
  const eduPrompt = getEduPrompt(eduLevel);
  const personaList = activePersonas.map(p => `${PERSONAS[p].label} (${PERSONAS[p].style})`).join(", ");

  const prompt = `Generate a social media feed about "${topic}". 
${wikiData ? `Background info: ${wikiData.extract}` : ""}

${eduPrompt}

Active personas: ${personaList}

Generate EXACTLY ${count} posts as a JSON array. VARY THE LENGTH dramatically:
- 1-2 SHORT posts (1-2 punchy sentences, 40-120 chars)
- 2-3 MEDIUM posts (2-4 sentences with specific facts or insights, 150-350 chars)
- 1-2 LONG posts (mini-essay or thread-style, 350-600 chars, with multiple points. Use \\n for line breaks)

Each post must have:
- "persona": one of [${activePersonas.map(p => `"${p}"`).join(",")}]
- "content": the post text. NO hashtags. Use \\n for line breaks in longer posts.
- "hasThread": boolean, true for 3-4 posts
- "comments": if hasThread is true, array of 2-4 comment objects with {"persona", "content"} (varied lengths 40-250 chars)
- "deepDive": a detailed 3-4 paragraph expansion (600-1000 chars) with specific facts, dates, names, and surprising details
- "followUp": a compelling follow-up question that could spark a new feed

Post variety — include a MIX of:
- A bold opinion or hot take
- A specific surprising fact with a number/date/name
- A question that invites debate
- A mini-explainer breaking down a concept
- A "TIL" or story-style post
- A longer analytical post

CRITICAL RULES:
- NEVER repeat the same fact or statistic across multiple posts. Each post must cover a DIFFERENT aspect of the topic.
- If you're unsure about a specific number, date, or claim, say "roughly" or "around" — do NOT invent precise statistics.
- Each post should feel like it's from a different person with a unique angle. No two posts should make the same point.

Return ONLY valid JSON array, no markdown fences.`;

  try {
    const text = await callAI(prompt, 6000);
    if (!text) return null;
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("Feed generation error:", e);
    return null;
  }
};

const generateCommentsForPost = async (postContent, topic, activePersonas) => {
  const personaList = activePersonas.map(p => `${PERSONAS[p].label} (${PERSONAS[p].style})`).join(", ");
  const prompt = `A user posted this on a social feed about "${topic}":
"${postContent}"

Generate 3-5 realistic comment replies as a JSON array. Each comment: {"persona": one of [${activePersonas.map(p => `"${p}"`).join(",")}], "content": "reply text 60-150 chars"}

Mix agreements, disagreements, follow-up questions, and jokes. Return ONLY valid JSON array.`;

  try {
    const text = await callAI(prompt, 1000);
    if (!text) return [];
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return [];
  }
};

// ─── Skeleton Loader ────────────────────────────────────────────────
const SkeletonPost = ({ delay = 0 }) => (
  <div className="skeleton-post" style={{ animationDelay: `${delay}ms` }}>
    <div className="skeleton-header">
      <div className="skeleton-avatar" />
      <div className="skeleton-meta">
        <div className="skeleton-line w60" />
        <div className="skeleton-line w40" />
      </div>
    </div>
    <div className="skeleton-body">
      <div className="skeleton-line w100" />
      <div className="skeleton-line w90" />
      <div className="skeleton-line w70" />
    </div>
    <div className="skeleton-actions">
      <div className="skeleton-circle" />
      <div className="skeleton-circle" />
      <div className="skeleton-circle" />
      <div className="skeleton-circle" />
    </div>
  </div>
);

// ─── Post Component ─────────────────────────────────────────────────
const PostCard = ({ post, onDeepDive, onFollowUp, topic, activePersonas, animDelay }) => {
  const [expanded, setExpanded] = useState(false);
  const [reactions, setReactions] = useState(() =>
    REACTIONS.reduce((a, r) => ({ ...a, [r.emoji]: { count: randomInt(1, 80), active: false } }), {})
  );
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [localComments, setLocalComments] = useState(post.comments || []);
  const [showReply, setShowReply] = useState(false);

  const toggleReaction = (emoji) => {
    setReactions(prev => ({
      ...prev,
      [emoji]: {
        count: prev[emoji].active ? prev[emoji].count - 1 : prev[emoji].count + 1,
        active: !prev[emoji].active,
      },
    }));
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    setIsCommenting(true);
    const userComment = {
      id: generateId(),
      user: { name: "You", handle: "@you", color: "#1982C4", persona: "casual" },
      content: commentText,
      isUser: true,
    };
    setLocalComments(prev => [...prev, userComment]);
    setCommentText("");
    setExpanded(true);

    const aiReplies = await generateCommentsForPost(commentText, topic, activePersonas);
    if (aiReplies?.length) {
      const formatted = aiReplies.slice(0, 2).map(r => ({
        id: generateId(),
        user: generateUser(r.persona || randomChoice(activePersonas)),
        content: r.content,
      }));
      setLocalComments(prev => [...prev, ...formatted]);
    }
    setIsCommenting(false);
    setShowReply(false);
  };

  const commentCount = localComments.length;

  return (
    <div className="post-card" style={{ animationDelay: `${animDelay}ms` }}>
      <div className="post-header">
        <div className="post-avatar" style={{ background: post.user.color }}>
          {PERSONAS[post.user.persona]?.emoji || "💬"}
        </div>
        <div className="post-user-info">
          <span className="post-name">{post.user.name}</span>
          <span className="post-handle">{post.user.handle}</span>
        </div>
        <span className="post-time">{post.time}</span>
      </div>

      <div className="post-content">{post.content}</div>

      {post.deepDive && (
        <button className="deep-dive-btn" onClick={() => onDeepDive(post)}>
          📖 Deep Dive
        </button>
      )}

      <div className="post-reactions">
        {REACTIONS.map(r => (
          <button
            key={r.emoji}
            className={`reaction-btn ${reactions[r.emoji].active ? "active" : ""}`}
            onClick={() => toggleReaction(r.emoji)}
            title={r.label}
          >
            <span className="reaction-emoji">{r.emoji}</span>
            <span className="reaction-count">{reactions[r.emoji].count}</span>
          </button>
        ))}
        <button
          className={`reaction-btn comment-toggle ${commentCount > 0 ? "has-comments" : ""}`}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="reaction-emoji">💬</span>
          <span className="reaction-count">{commentCount}</span>
        </button>
      </div>

      {expanded && (
        <div className="comments-section">
          {localComments.map((c, i) => (
            <div key={c.id || i} className={`comment ${c.isUser ? "user-comment" : ""}`}>
              <div className="comment-avatar" style={{ background: c.user?.color || "#888" }}>
                {c.isUser ? "🫵" : PERSONAS[c.user?.persona]?.emoji || "💬"}
              </div>
              <div className="comment-body">
                <span className="comment-name">{c.user?.name || "Anon"}</span>
                <span className="comment-text">{c.content}</span>
              </div>
            </div>
          ))}
          <div className="comment-input-row">
            <input
              className="comment-input"
              placeholder="Add a reply..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleComment()}
              disabled={isCommenting}
            />
            <button className="comment-send" onClick={handleComment} disabled={!commentText.trim() || isCommenting}>
              {isCommenting ? "..." : "→"}
            </button>
          </div>
        </div>
      )}

      {!expanded && !showReply && (
        <button className="inline-reply-btn" onClick={() => { setExpanded(true); setShowReply(true); }}>
          Reply
        </button>
      )}

      {post.followUp && (
        <button className="followup-btn" onClick={() => onFollowUp(post.followUp)}>
          💡 Want to know more? <span className="followup-text">{post.followUp}</span>
        </button>
      )}
    </div>
  );
};

// ─── Deep Dive Modal ────────────────────────────────────────────────
const DeepDiveModal = ({ post, onClose }) => {
  if (!post) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content deep-dive-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="deep-dive-header">
          <div className="post-avatar large" style={{ background: post.user.color }}>
            {PERSONAS[post.user.persona]?.emoji || "💬"}
          </div>
          <div>
            <h2 className="deep-dive-title">Deep Dive</h2>
            <p className="deep-dive-origin">Expanding on {post.user.name}'s post</p>
          </div>
        </div>
        <blockquote className="deep-dive-quote">"{post.content}"</blockquote>
        <div className="deep-dive-body">{post.deepDive}</div>
      </div>
    </div>
  );
};

// ─── New Post Modal ─────────────────────────────────────────────────
const NewPostModal = ({ onClose, onPost, topic }) => {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);
    await onPost(text);
    setPosting(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content new-post-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>New Post</h2>
        <p className="modal-sub">Share a thought about <strong>{topic || "anything"}</strong> — AI commenters will respond!</p>
        <textarea
          className="new-post-textarea"
          placeholder="What's on your mind?"
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
          disabled={posting}
        />
        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose} disabled={posting}>Cancel</button>
          <button className="btn primary" onClick={handlePost} disabled={!text.trim() || posting}>
            {posting ? "Generating replies..." : "Post & Get Comments"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── How To Use Modal ───────────────────────────────────────────────
const HowToModal = ({ onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content howto-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose}>✕</button>
      <h2>How to Use Intelligent Scroll</h2>
      <div className="howto-body">
        <div className="howto-section">
          <h3>🔍 Generate a Feed</h3>
          <p>Type any topic in the search bar and press Enter. Wikipedia provides context, and AI generates a realistic social feed with posts and threaded comments.</p>
        </div>
        <div className="howto-section">
          <h3>✍️ Write Your Own Post</h3>
          <p>Click "New Post" to share your own thought. AI personas will leave comments providing different perspectives and context.</p>
        </div>
        <div className="howto-section">
          <h3>📖 Deep Dive</h3>
          <p>Click the "Deep Dive" button on any post to read a longer, article-style expansion with more detail and sources.</p>
        </div>
        <div className="howto-section">
          <h3>💡 Follow the Thread</h3>
          <p>Each post has a "Want to know more?" prompt — click it to generate a whole new feed on a related subtopic.</p>
        </div>
        <div className="howto-section">
          <h3>⚙️ Customize</h3>
          <p>Open Settings to adjust the education level (casual → expert) and choose which personas appear in your feed. Open Explore for curated topics or hit Random.</p>
        </div>
        <div className="howto-section">
          <h3>⌨️ Shortcuts</h3>
          <p><kbd>Enter</kbd> — Search &nbsp; <kbd>Esc</kbd> — Close modals &nbsp; <kbd>N</kbd> — New post &nbsp; <kbd>R</kbd> — Random topic</p>
        </div>
      </div>
    </div>
  </div>
);

// ─── Settings Panel ─────────────────────────────────────────────────
const SettingsPanel = ({ eduLevel, setEduLevel, activePersonas, setActivePersonas, onClose, onRegenerate, isLoading }) => {
  const togglePersona = (key) => {
    setActivePersonas(prev =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter(p => p !== key) : prev) : [...prev, key]
    );
  };
  const eduLabel = eduLevel <= 3 ? EDU_LABELS.low : eduLevel <= 6 ? EDU_LABELS.mid : EDU_LABELS.high;

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h3>Settings</h3>
        <button className="modal-close small" onClick={onClose}>✕</button>
      </div>
      <div className="settings-section">
        <label className="settings-label">Education Level: {eduLevel}/10</label>
        <input
          type="range" min="1" max="10" value={eduLevel}
          onChange={e => setEduLevel(Number(e.target.value))}
          className="edu-slider"
        />
        <div className="edu-preview">
          <span className="edu-tag">{eduLabel.label}</span>
          <span className="edu-desc">{eduLabel.desc}</span>
        </div>
      </div>
      <div className="settings-section">
        <label className="settings-label">Personas in Feed</label>
        <div className="persona-grid">
          {Object.entries(PERSONAS).map(([key, val]) => (
            <button
              key={key}
              className={`persona-chip ${activePersonas.includes(key) ? "active" : ""}`}
              onClick={() => togglePersona(key)}
            >
              {val.emoji} {val.label}
            </button>
          ))}
        </div>
      </div>
      {onRegenerate && (
        <button className="btn primary regenerate-btn" onClick={onRegenerate} disabled={isLoading}>
          {isLoading ? "⏳ Regenerating..." : "🔄 Regenerate Feed"}
        </button>
      )}
    </div>
  );
};

// ─── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [topic, setTopic] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [feed, setFeed] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [wikiData, setWikiData] = useState(null);

  // UI state
  const [sidebarTab, setSidebarTab] = useState(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [deepDivePost, setDeepDivePost] = useState(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(null);

  // Settings
  const [eduLevel, setEduLevel] = useState(7);
  const [activePersonas, setActivePersonas] = useState(["academic", "casual", "enthusiast", "skeptic"]);

  // History & Cache
  const [history, setHistory] = useState([]);
  const [feedCache, setFeedCache] = useState({});

  // Progressive loading & infinite scroll
  const [visibleCount, setVisibleCount] = useState(0);
  const [preloadedPosts, setPreloadedPosts] = useState([]);
  const [isPreloading, setIsPreloading] = useState(false);
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const preloadRef = useRef({ topic: "", wiki: null }); // track current context for preloading

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("scroll-history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}

    // Check URL params for shared topic
    const params = new URLSearchParams(window.location.search);
    const sharedTopic = params.get("topic");
    if (sharedTopic) {
      setTopic(sharedTopic);
      // Delay so state is ready
      setTimeout(() => generateFeed(sharedTopic), 100);
    }
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback((newHistory) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("scroll-history", JSON.stringify(newHistory.slice(0, 50)));
    } catch {}
  }, []);

  // Progressive reveal of posts
  useEffect(() => {
    if (feed.length > 0 && visibleCount < feed.length) {
      const timer = setTimeout(() => setVisibleCount(v => v + 1), 180);
      return () => clearTimeout(timer);
    }
  }, [feed, visibleCount]);

  // Preload next batch of posts in background
  const preloadNextBatch = useCallback(async () => {
    const { topic: pTopic, wiki: pWiki } = preloadRef.current;
    if (!pTopic || isPreloading) return;
    setIsPreloading(true);
    try {
      const posts = await generateFeedContent(pTopic, pWiki, eduLevel, activePersonas);
      if (posts?.length) {
        const formatted = posts.map((p, i) => ({
          id: generateId(),
          user: generateUser(p.persona || randomChoice(activePersonas)),
          content: p.content,
          time: timeAgo(i + 6),
          comments: (p.comments || []).map(c => ({
            id: generateId(),
            user: generateUser(c.persona || randomChoice(activePersonas)),
            content: c.content,
          })),
          deepDive: p.deepDive || null,
          followUp: p.followUp || null,
          hasThread: p.hasThread || false,
        }));
        setPreloadedPosts(prev => [...prev, ...formatted]);
      }
    } catch (e) {
      console.error("Preload error:", e);
    }
    setIsPreloading(false);
  }, [eduLevel, activePersonas, isPreloading]);

  // Start preloading once initial feed loads
  useEffect(() => {
    if (feed.length > 0 && preloadedPosts.length === 0 && !isPreloading && activeTopic) {
      preloadNextBatch();
    }
  }, [feed.length, activeTopic]);

  // Infinite scroll — observe bottom sentinel
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoading && activeTopic) {
          // Append preloaded posts if available
          if (preloadedPosts.length > 0) {
            setFeed(prev => [...prev, ...preloadedPosts]);
            setPreloadedPosts([]);
            // Start preloading next batch
            setTimeout(() => preloadNextBatch(), 200);
          }
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [preloadedPosts, isLoading, activeTopic]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      if (e.key === "Escape") {
        setDeepDivePost(null);
        setShowNewPost(false);
        setShowHowTo(false);
        setSidebarTab(null);
        setMobilePanel(null);
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setShowNewPost(true);
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleRandomTopic();
      }
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const generateFeed = async (searchTopic) => {
    if (!searchTopic?.trim()) return;
    const key = searchTopic.toLowerCase().trim();

    // Check cache
    if (feedCache[key]) {
      setFeed(feedCache[key].feed);
      setWikiData(feedCache[key].wiki);
      setActiveTopic(searchTopic);
      setVisibleCount(0);
      setPreloadedPosts([]);
      preloadRef.current = { topic: searchTopic, wiki: feedCache[key].wiki };
      return;
    }

    setIsLoading(true);
    setError("");
    setFeed([]);
    setVisibleCount(0);
    setActiveTopic(searchTopic);
    setPreloadedPosts([]);

    const wiki = await fetchWikipedia(searchTopic);
    setWikiData(wiki);
    preloadRef.current = { topic: searchTopic, wiki };

    const posts = await generateFeedContent(searchTopic, wiki, eduLevel, activePersonas);
    if (!posts) {
      setError("Failed to generate feed. Please try again.");
      setIsLoading(false);
      return;
    }

    const formattedFeed = posts.map((p, i) => ({
      id: generateId(),
      user: generateUser(p.persona || randomChoice(activePersonas)),
      content: p.content,
      time: timeAgo(i),
      comments: (p.comments || []).map(c => ({
        id: generateId(),
        user: generateUser(c.persona || randomChoice(activePersonas)),
        content: c.content,
      })),
      deepDive: p.deepDive || null,
      followUp: p.followUp || null,
      hasThread: p.hasThread || false,
    }));

    setFeed(formattedFeed);
    setIsLoading(false);

    setFeedCache(prev => ({ ...prev, [key]: { feed: formattedFeed, wiki } }));

    const newEntry = { topic: searchTopic, time: new Date().toISOString() };
    const newHistory = [newEntry, ...history.filter(h => h.topic.toLowerCase() !== key)].slice(0, 50);
    saveHistory(newHistory);
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    generateFeed(topic);
  };

  const handleRandomTopic = () => {
    const t = randomChoice(EXPLORE_TOPICS);
    setTopic(t);
    generateFeed(t);
    setSidebarTab(null);
    setMobilePanel(null);
  };

  const handleNewUserPost = async (content) => {
    const userPost = {
      id: generateId(),
      user: { name: "You", handle: "@you", color: "#1982C4", persona: "casual" },
      content,
      time: "just now",
      comments: [],
      deepDive: null,
      followUp: null,
      isUserPost: true,
    };

    const insertIdx = Math.min(randomInt(1, 2), feed.length);
    const newFeed = [...feed];
    newFeed.splice(insertIdx, 0, userPost);
    setFeed(newFeed);
    setVisibleCount(newFeed.length);

    const aiComments = await generateCommentsForPost(content, activeTopic, activePersonas);
    if (aiComments?.length) {
      const formatted = aiComments.map(c => ({
        id: generateId(),
        user: generateUser(c.persona || randomChoice(activePersonas)),
        content: c.content,
      }));
      setFeed(prev =>
        prev.map(p => (p.id === userPost.id ? { ...p, comments: formatted } : p))
      );
    }
  };

  const handleFollowUp = (question) => {
    setTopic(question);
    generateFeed(question);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleShareFeed = () => {
    const url = `${window.location.origin}?topic=${encodeURIComponent(activeTopic)}`;
    navigator.clipboard?.writeText(url).then(() => {
      alert("Feed link copied to clipboard!");
    }).catch(() => {
      prompt("Copy this link:", url);
    });
  };

  return (
    <div className="app-root">
      {/* ─── Top Bar ─────────────────────────────── */}
      <div className="top-bar">
        <div className="logo">
          <div className="logo-icon">iS</div>
          <span>Intelligent Scroll</span>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search any topic... (press / to focus)"
            value={topic}
            onChange={e => setTopic(e.target.value)}
          />
          <button type="submit" className="btn primary" disabled={!topic.trim() || isLoading}>
            {isLoading ? "⏳" : "Explore"}
          </button>
        </form>

        <div className="top-actions">
          <button className="btn ghost" onClick={() => setShowNewPost(true)} title="New Post (N)">✍️ Post</button>
          <button className="btn ghost" onClick={handleRandomTopic} title="Random Topic (R)">🎲</button>
          <button className="btn ghost" onClick={() => setShowHowTo(true)} title="How to Use">❓</button>
        </div>
      </div>

      {/* ─── Mobile Nav ──────────────────────────── */}
      <div className="mobile-nav">
        <div className="mobile-nav-scroll">
          <button className={`mobile-nav-btn ${mobilePanel === "explore" ? "active" : ""}`} onClick={() => setMobilePanel(mobilePanel === "explore" ? null : "explore")}>🔍 Explore</button>
          <button className={`mobile-nav-btn ${mobilePanel === "trending" ? "active" : ""}`} onClick={() => setMobilePanel(mobilePanel === "trending" ? null : "trending")}>🔥 Trending</button>
          {history.length > 0 && <button className={`mobile-nav-btn ${mobilePanel === "history" ? "active" : ""}`} onClick={() => setMobilePanel(mobilePanel === "history" ? null : "history")}>📚 History</button>}
          <button className="mobile-nav-btn" onClick={handleRandomTopic}>🎲 Random</button>
          <button className="mobile-nav-btn" onClick={() => setShowHowTo(true)}>❓ Help</button>
          <button className={`mobile-nav-btn ${sidebarTab === "settings" ? "active" : ""}`} onClick={() => { setSidebarTab(sidebarTab === "settings" ? null : "settings"); setMobilePanel(null); }}>⚙️</button>
        </div>

        {mobilePanel === "explore" && (
          <div className="mobile-dropdown">
            {EXPLORE_TOPICS.slice(0, 12).map(t => (
              <button key={t} className="mobile-dropdown-item" onClick={() => { setTopic(t); generateFeed(t); setMobilePanel(null); }}>{t}</button>
            ))}
          </div>
        )}
        {mobilePanel === "trending" && (
          <div className="mobile-dropdown">
            {TRENDING_TOPICS.map(t => (
              <button key={t} className="mobile-dropdown-item" onClick={() => { setTopic(t); generateFeed(t); setMobilePanel(null); }}>🔥 {t}</button>
            ))}
          </div>
        )}
        {mobilePanel === "history" && (
          <div className="mobile-dropdown">
            {history.slice(0, 10).map((h, i) => (
              <button key={i} className="mobile-dropdown-item" onClick={() => { setTopic(h.topic); generateFeed(h.topic); setMobilePanel(null); }}>
                {h.topic}
                <span className="history-time">{new Date(h.time).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="main-layout">
        {/* ─── Sidebar ─────────────────────────────── */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <button className="sidebar-item howto-sidebar-btn" onClick={() => setShowHowTo(true)}>
              ❓ How to Use
            </button>
          </div>

          <div className="sidebar-section">
            <h4>Explore</h4>
            <button className="sidebar-item random-btn" onClick={handleRandomTopic}>🎲 Random Topic</button>
            {EXPLORE_TOPICS.slice(0, 8).map(t => (
              <button
                key={t}
                className={`sidebar-item ${activeTopic === t ? "active" : ""}`}
                onClick={() => { setTopic(t); generateFeed(t); }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="sidebar-section">
            <h4>🔥 Trending</h4>
            {TRENDING_TOPICS.slice(0, 6).map(t => (
              <button
                key={t}
                className="sidebar-item trending"
                onClick={() => { setTopic(t); generateFeed(t); }}
              >
                <span className="trending-dot" />
                {t}
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <div className="sidebar-section">
              <h4>📚 History</h4>
              {history.slice(0, 8).map((h, i) => (
                <button
                  key={i}
                  className="sidebar-item history-item"
                  onClick={() => { setTopic(h.topic); generateFeed(h.topic); }}
                >
                  <span>{h.topic}</span>
                  <span className="history-time">
                    {new Date(h.time).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ─── Feed ────────────────────────────────── */}
        <main className="feed-area" ref={feedRef}>
          {sidebarTab === "settings" && (
            <SettingsPanel
              eduLevel={eduLevel}
              setEduLevel={setEduLevel}
              activePersonas={activePersonas}
              setActivePersonas={setActivePersonas}
              onClose={() => setSidebarTab(null)}
              onRegenerate={activeTopic ? () => {
                const key = activeTopic.toLowerCase().trim();
                setFeedCache(prev => { const n = {...prev}; delete n[key]; return n; });
                generateFeed(activeTopic);
              } : null}
              isLoading={isLoading}
            />
          )}

          {activeTopic && (
            <div className="feed-header">
              <div>
                <div className="feed-topic">{activeTopic}</div>
                <div className="feed-topic-sub">{feed.length} posts • scroll for more</div>
              </div>
              <div className="feed-actions">
                <button className="btn ghost" onClick={() => setSidebarTab(sidebarTab === "settings" ? null : "settings")}>
                  ⚙️ Settings
                </button>
                <button className="btn ghost" onClick={handleShareFeed}>🔗 Share</button>
              </div>
            </div>
          )}

          {wikiData && (
            <div className="wiki-card">
              {wikiData.thumbnail && (
                <img className="wiki-thumb" src={wikiData.thumbnail} alt={wikiData.title} />
              )}
              <div className="wiki-text">
                <span className="wiki-badge">Wikipedia Source</span>
                <h4>{wikiData.title}</h4>
                <p>{wikiData.extract}</p>
              </div>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          {isLoading && (
            <>
              <SkeletonPost delay={0} />
              <SkeletonPost delay={100} />
              <SkeletonPost delay={200} />
              <SkeletonPost delay={300} />
              <SkeletonPost delay={400} />
            </>
          )}

          {!isLoading && feed.slice(0, visibleCount).map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDeepDive={setDeepDivePost}
              onFollowUp={handleFollowUp}
              topic={activeTopic}
              activePersonas={activePersonas}
              animDelay={0}
            />
          ))}

          {/* Infinite scroll sentinel & preload indicator */}
          {!isLoading && feed.length > 0 && (
            <div ref={bottomRef} className="scroll-sentinel">
              {isPreloading && (
                <div className="preload-indicator">
                  <div className="preload-spinner" />
                  <span>Loading more posts...</span>
                </div>
              )}
              {preloadedPosts.length > 0 && !isPreloading && (
                <div className="preload-indicator ready">
                  <span>Scroll for more</span>
                </div>
              )}
            </div>
          )}

          {!isLoading && !activeTopic && feed.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">🧠</span>
              <h3>What are you curious about?</h3>
              <p>Type a topic above or pick one from the sidebar. AI will generate a social feed with diverse perspectives, threaded discussions, and deep dives.</p>
              <button className="btn primary" onClick={handleRandomTopic}>🎲 Surprise Me</button>
            </div>
          )}

          {/* ─── Footer Credit ───────────────────────── */}
          <footer className="app-footer">
            Made by <a href="https://sudsaraswat.com" target="_blank" rel="noopener noreferrer">Sud</a>
          </footer>
        </main>
      </div>

      {/* ─── Modals ──────────────────────────────── */}
      {showNewPost && (
        <NewPostModal
          onClose={() => setShowNewPost(false)}
          onPost={handleNewUserPost}
          topic={activeTopic}
        />
      )}

      {deepDivePost && (
        <DeepDiveModal post={deepDivePost} onClose={() => setDeepDivePost(null)} />
      )}

      {showHowTo && <HowToModal onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
