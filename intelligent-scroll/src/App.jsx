import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Composer from "./components/Composer.jsx";
import LeftRail from "./components/LeftRail.jsx";
import Post from "./components/Post.jsx";
import RightRail from "./components/RightRail.jsx";
import Skeleton from "./components/Skeleton.jsx";
import { DeepDiveModal, HowToModal } from "./components/Modals.jsx";
import { IconSearch, IconSparkle } from "./components/icons.jsx";
import { useInfiniteFeed } from "./hooks/useInfiniteFeed.js";
import { DEFAULT_PERSONAS } from "./lib/personas.js";
import { EXPLORE_TOPICS, TRENDING_TOPICS } from "./lib/topics.js";
import { randomChoice } from "./lib/util.js";

const TABS = [
  { id: "all", label: "For you" },
  { id: "facts", label: "Facts" },
  { id: "debate", label: "Debate" },
  { id: "explainers", label: "Explainers" },
  { id: "saved", label: "Saved" },
];

const TAB_KINDS = {
  facts: new Set(["fact", "data", "til"]),
  debate: new Set(["take", "question"]),
  explainers: new Set(["explainer"]),
};

const HEADER_OFFSET = 72;
const LOAD_THRESHOLD = 1400;

const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const store = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
};

export default function App() {
  const [theme, setTheme] = useState(() => readStored("is:theme", "dark"));
  const [eduLevel, setEduLevel] = useState(() => readStored("is:edu", 7));
  const [personas, setPersonas] = useState(() => {
    const saved = readStored("is:personas", null);
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_PERSONAS;
  });
  const [history, setHistory] = useState(() => readStored("is:history", []));

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [divePostId, setDivePostId] = useState(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [composeFocus, setComposeFocus] = useState(0);

  const heroSearchRef = useRef(null);
  const railSearchRef = useRef(null);
  const feed = useInfiniteFeed({ eduLevel, personas });
  const {
    topic,
    posts,
    context,
    phase,
    error,
    offline,
    exhausted,
    isFetching,
    loadMore,
    start,
    retry,
    loadDeepDive,
    replyToPost,
    publishPost,
    updatePost,
  } = feed;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store("is:theme", theme);
  }, [theme]);

  useEffect(() => store("is:edu", eduLevel), [eduLevel]);
  useEffect(() => store("is:personas", personas), [personas]);
  useEffect(() => store("is:history", history.slice(0, 30)), [history]);

  const openTopic = useCallback(
    (next) => {
      const clean = String(next || "").trim();
      if (!clean) return;
      setQuery(clean);
      setTab("all");
      window.scrollTo({ top: 0 });
      setHistory((prev) => [
        { topic: clean, at: Date.now() },
        ...prev.filter((h) => h.topic.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 30));
      const url = new URL(window.location.href);
      url.searchParams.set("q", clean);
      window.history.replaceState({}, "", url);
      start(clean);
    },
    [start]
  );

  // Deep link support: /?q=black+holes opens straight into that feed.
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("q");
    if (shared) openTopic(shared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const randomTopic = useCallback(() => {
    const pool = [...EXPLORE_TOPICS, ...TRENDING_TOPICS.map((t) => t.name)];
    let pick = randomChoice(pool);
    while (pick === topic && pool.length > 1) pick = randomChoice(pool);
    openTopic(pick);
  }, [openTopic, topic]);

  const togglePersona = useCallback((key) => {
    setPersonas((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((p) => p !== key) : prev) : [...prev, key]
    );
  }, []);

  const divePost = useMemo(() => posts.find((p) => p.id === divePostId) || null, [posts, divePostId]);

  const openDeepDive = useCallback(
    (post) => {
      setDivePostId(post.id);
      loadDeepDive(post.id);
    },
    [loadDeepDive]
  );

  const visible = useMemo(() => {
    if (tab === "saved") return posts.filter((p) => p.bookmarked);
    const kinds = TAB_KINDS[tab];
    return kinds ? posts.filter((p) => kinds.has(p.kind)) : posts;
  }, [posts, tab]);

  /**
   * Endless scroll. A scroll listener handles the common case and the interval
   * covers the rest: if the reader is already sitting at the bottom when a
   * batch finishes generating, no scroll event would ever fire to release it.
   */
  useEffect(() => {
    if (phase !== "ready" || tab === "saved" || exhausted) return;

    let frame = 0;
    const check = () => {
      const doc = document.documentElement;
      const remaining = doc.scrollHeight - window.scrollY - window.innerHeight;
      if (remaining < LOAD_THRESHOLD) loadMore();
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const timer = setInterval(check, 500);
    check();

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [phase, tab, exhausted, loadMore]);

  const focusSearch = useCallback(() => {
    const input = heroSearchRef.current || railSearchRef.current;
    input?.focus();
    input?.select();
  }, []);

  const jumpPost = useCallback((direction) => {
    const nodes = Array.from(document.querySelectorAll(".post"));
    if (!nodes.length) return;
    const target =
      direction > 0
        ? nodes.find((n) => n.getBoundingClientRect().top > HEADER_OFFSET + 8)
        : nodes.reverse().find((n) => n.getBoundingClientRect().top < HEADER_OFFSET - 8);
    if (!target) return;
    window.scrollTo({
      top: window.scrollY + target.getBoundingClientRect().top - HEADER_OFFSET,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const typing = ["INPUT", "TEXTAREA"].includes(e.target.tagName);
      if (e.key === "Escape") {
        if (typing) e.target.blur();
        setDivePostId(null);
        setShowHowTo(false);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (divePostId || showHowTo) return;

      if (e.key === "/") {
        e.preventDefault();
        focusSearch();
      } else if (e.key === "n") {
        e.preventDefault();
        if (topic) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          setComposeFocus((c) => c + 1);
        } else {
          focusSearch();
        }
      } else if (e.key === "r") {
        e.preventDefault();
        randomTopic();
      } else if (e.key === "j") {
        jumpPost(1);
      } else if (e.key === "k") {
        jumpPost(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [divePostId, showHowTo, focusSearch, jumpPost, randomTopic, topic]);

  const heroSuggestions = useMemo(() => EXPLORE_TOPICS.slice(0, 8), []);

  return (
    <div className="layout">
      <LeftRail
        onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onSearch={focusSearch}
        onRandom={randomTopic}
        onHelp={() => setShowHowTo(true)}
        onCompose={() => {
          if (!topic) return focusSearch();
          window.scrollTo({ top: 0, behavior: "smooth" });
          setComposeFocus((c) => c + 1);
        }}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      <main className="column">
        <header className="column__header">
          <div className="column__titles">
            <h1>{topic || "Home"}</h1>
            <p>
              {topic
                ? `${posts.length} posts${
                    isFetching ? " · writing more…" : exhausted ? "" : " · endless"
                  }`
                : "Type a subject and the timeline fills in"}
            </p>
          </div>
          <form
            className="search search--inline"
            onSubmit={(e) => {
              e.preventDefault();
              openTopic(query);
            }}
          >
            <IconSearch size={16} />
            <input
              className="search__input"
              placeholder="Search any subject"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search any subject"
            />
          </form>
          {topic && (
            <nav className="tabs">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  className={`tabs__item ${tab === item.id ? "is-on" : ""}`}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                  <span className="tabs__underline" />
                </button>
              ))}
            </nav>
          )}
        </header>

        {offline && (
          <div className="notice">
            <strong>Demo mode.</strong> No AI provider is configured, so posts are assembled from the
            Wikipedia article plus discussion templates. Set <code>GROQ_API_KEY</code> to get model-written
            timelines.
          </div>
        )}

        {topic && <Composer topic={topic} onPost={publishPost} autoFocus={composeFocus > 0} />}

        {context && (
          <a className="source" href={context.url} target="_blank" rel="noopener noreferrer">
            {context.thumbnail && <img src={context.thumbnail} alt="" className="source__image" />}
            <div className="source__text">
              <span className="source__domain">en.wikipedia.org</span>
              <strong className="source__title">{context.title}</strong>
              <p className="source__extract">{context.extract}</p>
            </div>
          </a>
        )}

        {phase === "idle" && (
          <div className="hero">
            <IconSparkle size={34} />
            <h2>An endless timeline about anything</h2>
            <p>
              Name a subject. Intelligent Scroll writes a feed about it — facts, arguments, replies,
              explainers — and keeps writing as long as you keep scrolling.
            </p>
            <form
              className="hero__form"
              onSubmit={(e) => {
                e.preventDefault();
                openTopic(query);
              }}
            >
              <input
                ref={heroSearchRef}
                className="hero__input"
                placeholder="e.g. bioluminescence, the Silk Road, sleep…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Subject"
              />
              <button className="btn" type="submit" disabled={!query.trim()}>
                Start scrolling
              </button>
            </form>
            <div className="hero__chips">
              {heroSuggestions.map((item) => (
                <button key={item} className="chip" onClick={() => openTopic(item)}>
                  {item}
                </button>
              ))}
            </div>
            <button className="link-btn hero__random" onClick={randomTopic}>
              or surprise me
            </button>
          </div>
        )}

        {phase === "loading" && (
          <div className="feed">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} lines={2 + (i % 3)} />
            ))}
          </div>
        )}

        {phase === "error" && (
          <div className="failure">
            <h2>That didn't work</h2>
            <p>{error}</p>
            <button className="btn" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {phase === "ready" && (
          <div className="feed">
            {visible.map((post) => (
              <Post
                key={post.id}
                post={post}
                onDeepDive={openDeepDive}
                onFollowUp={openTopic}
                onReply={replyToPost}
                onUpdate={updatePost}
              />
            ))}

            {tab === "saved" && visible.length === 0 && (
              <p className="feed__empty">
                Nothing saved yet. Tap the bookmark on a post to keep it here.
              </p>
            )}

            {tab !== "saved" && (
              <div className="feed__tail">
                {error ? (
                  <div className="feed__error">
                    <span>{error}</span>
                    <button className="btn btn--sm" onClick={retry}>
                      Retry
                    </button>
                  </div>
                ) : exhausted ? (
                  <div className="feed__error">
                    <span>
                      {offline
                        ? "Demo mode has run out of fresh angles on this subject. Add an API key for a genuinely endless feed."
                        : "The timeline started repeating itself, so it stopped here."}
                    </span>
                    <button className="btn btn--sm" onClick={retry}>
                      Keep going
                    </button>
                  </div>
                ) : (
                  <>
                    <Skeleton lines={2} />
                    <p className="feed__status">Writing more about {topic}…</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <RightRail
        query={query}
        onQueryChange={setQuery}
        onSubmit={() => openTopic(query)}
        searchRef={railSearchRef}
        history={history}
        onPick={openTopic}
        eduLevel={eduLevel}
        onEduChange={setEduLevel}
        personas={personas}
        onTogglePersona={togglePersona}
      />

      {divePost && (
        <DeepDiveModal
          post={divePost}
          source={context}
          onRetry={loadDeepDive}
          onClose={() => setDivePostId(null)}
        />
      )}
      {showHowTo && <HowToModal onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
