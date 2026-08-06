import { useEffect } from "react";
import { PERSONAS } from "../lib/personas.js";
import { IconClose, IconVerified } from "./icons.jsx";

function Modal({ children, onClose, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className={`sheet ${wide ? "sheet--wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="sheet__close" onClick={onClose} aria-label="Close">
          <IconClose size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DeepDiveModal({ post, source, onClose, onRetry }) {
  if (!post) return null;
  const paragraphs = (post.deepDive || "").split(/\n{2,}/).filter(Boolean);

  return (
    <Modal onClose={onClose} wide>
      <div className="dive__head">
        <div className="avatar avatar--md" style={{ "--avatar-color": post.user.color }}>
          {PERSONAS[post.user.persona]?.emoji || "💬"}
        </div>
        <div>
          <h2 className="sheet__title">Deep dive</h2>
          <p className="sheet__sub">
            Expanding {post.user.name}
            {post.user.verified && <IconVerified size={13} />}
            <span className="dive__handle">{post.user.handle}</span>
          </p>
        </div>
      </div>

      <blockquote className="dive__quote">{post.content}</blockquote>

      {post.deepDive ? (
        <div className="dive__body">
          {paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : post.deepDiveError ? (
        <div className="dive__pending">
          <p>{post.deepDiveError}</p>
          <button className="btn btn--sm" onClick={() => onRetry(post.id)}>
            Try again
          </button>
        </div>
      ) : (
        <div className="dive__body dive__body--loading">
          {[0, 1, 2].map((i) => (
            <p key={i}>
              <span className="skeleton__bar w-100" />
              <span className="skeleton__bar w-92" />
              <span className="skeleton__bar w-64" />
            </p>
          ))}
        </div>
      )}

      {source?.url && (
        <a className="dive__source" href={source.url} target="_blank" rel="noopener noreferrer">
          Background reading: {source.title} on Wikipedia →
        </a>
      )}
    </Modal>
  );
}

export function HowToModal({ onClose }) {
  return (
    <Modal onClose={onClose}>
      <h2 className="sheet__title">How Intelligent Scroll works</h2>
      <div className="howto">
        <section>
          <h3>Type a subject</h3>
          <p>
            Search anything — a science, a war, a food, a person. Wikipedia gets pulled in for grounding,
            then a timeline of posts is written about it from several different accounts.
          </p>
        </section>
        <section>
          <h3>It never ends</h3>
          <p>
            Keep scrolling and new posts keep arriving. Each batch is told to look at the subject through a
            different lens — origins, misconceptions, open questions, failures, economics, what's next — and
            is given the posts you've already seen so it stops repeating itself.
          </p>
        </section>
        <section>
          <h3>Argue with the timeline</h3>
          <p>
            Reply to any post and the personas reply back. Post your own take from the composer at the top
            and the timeline responds to that too.
          </p>
        </section>
        <section>
          <h3>Go deeper</h3>
          <p>
            <strong>Deep dive</strong> opens the long-form version of a post.{" "}
            <strong>Follow-up</strong> chips at the bottom of a post start a brand new feed on that thread.
          </p>
        </section>
        <section>
          <h3>Tune it</h3>
          <p>
            The right rail controls how academic the timeline is (1 = group chat, 10 = peer review) and which
            personas show up. Changes apply to everything generated from that point on.
          </p>
        </section>
        <section>
          <h3>Shortcuts</h3>
          <p className="howto__keys">
            <kbd>/</kbd> search <kbd>n</kbd> compose <kbd>r</kbd> random subject <kbd>j</kbd>/<kbd>k</kbd> next
            / previous post <kbd>Esc</kbd> close
          </p>
        </section>
      </div>
    </Modal>
  );
}
