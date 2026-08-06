import { useState } from "react";
import { PERSONAS } from "../lib/personas.js";
import { formatCount } from "../lib/util.js";
import {
  IconBook,
  IconBookmark,
  IconChart,
  IconHeart,
  IconReply,
  IconRepost,
  IconShare,
  IconSparkle,
  IconVerified,
} from "./icons.jsx";

const KIND_LABELS = {
  fact: "Fact",
  data: "Data",
  til: "TIL",
  take: "Take",
  question: "Question",
  explainer: "Explainer",
};

const CLAMP_AT = 520;

const Avatar = ({ user, size = "md" }) => (
  <div
    className={`avatar avatar--${size}`}
    style={{ "--avatar-color": user.color }}
    title={user.name}
  >
    {user.isYou ? "🫵" : PERSONAS[user.persona]?.emoji || "💬"}
  </div>
);

const Reply = ({ reply }) => (
  <div className={`reply ${reply.isYou ? "reply--yours" : ""}`}>
    <Avatar user={reply.user} size="sm" />
    <div className="reply__body">
      <div className="reply__head">
        <span className="reply__name">{reply.user.name}</span>
        {reply.user.verified && <IconVerified size={13} />}
        <span className="reply__handle">{reply.user.handle}</span>
      </div>
      <p className="reply__text">{reply.content}</p>
    </div>
  </div>
);

export default function Post({ post, onDeepDive, onFollowUp, onReply, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const { user, stats } = post;
  const isLong = post.content.length > CLAMP_AT;
  const text = isLong && !expanded ? `${post.content.slice(0, CLAMP_AT).trimEnd()}…` : post.content;
  const replyCount = post.replies.length + stats.replyPad;
  const likeCount = stats.likes + (post.liked ? 1 : 0);
  const repostCount = stats.reposts + (post.reposted ? 1 : 0);

  const submitReply = async () => {
    const value = draft.trim();
    if (!value || sending) return;
    setSending(true);
    setDraft("");
    setShowReplies(true);
    try {
      await onReply(post.id, value);
    } finally {
      setSending(false);
    }
  };

  return (
    <article className={`post ${post.isYours ? "post--yours" : ""}`}>
      <div className="post__gutter">
        <Avatar user={user} />
      </div>

      <div className="post__body">
        <div className="post__head">
          <span className="post__name">{user.name}</span>
          {user.verified && <IconVerified size={15} />}
          <span className="post__handle">{user.handle}</span>
          <span className="post__sep">·</span>
          <span className="post__age">{post.ageLabel}</span>
          {KIND_LABELS[post.kind] && <span className="post__kind">{KIND_LABELS[post.kind]}</span>}
        </div>

        <div className="post__text">{text}</div>

        {isLong && (
          <button className="link-btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        <button className="deep-dive" onClick={() => onDeepDive(post)}>
          <IconBook size={15} />
          <span>Deep dive</span>
          <span className="deep-dive__hint">
            {post.deepDiveLoading ? "writing…" : "read the long version"}
          </span>
        </button>

        <div className="actions">
          <button
            className={`action action--reply ${showReplies ? "is-on" : ""}`}
            onClick={() => setShowReplies((v) => !v)}
            title="Replies"
          >
            <IconReply size={17} />
            <span>{replyCount ? formatCount(replyCount) : ""}</span>
          </button>

          <button
            className={`action action--repost ${post.reposted ? "is-on" : ""}`}
            onClick={() => onUpdate(post.id, { reposted: !post.reposted })}
            title="Repost"
          >
            <IconRepost size={17} />
            <span>{repostCount ? formatCount(repostCount) : ""}</span>
          </button>

          <button
            className={`action action--like ${post.liked ? "is-on" : ""}`}
            onClick={() => onUpdate(post.id, { liked: !post.liked })}
            title="Like"
          >
            <IconHeart size={17} filled={post.liked} />
            <span>{likeCount ? formatCount(likeCount) : ""}</span>
          </button>

          <button className="action action--views" title="Views" disabled>
            <IconChart size={17} />
            <span>{formatCount(stats.views)}</span>
          </button>

          <div className="actions__tail">
            <button
              className={`action ${post.bookmarked ? "is-on" : ""}`}
              onClick={() => onUpdate(post.id, { bookmarked: !post.bookmarked })}
              title="Bookmark"
            >
              <IconBookmark size={17} filled={post.bookmarked} />
            </button>
            <button
              className="action"
              title="Copy post text"
              onClick={() => navigator.clipboard?.writeText(post.content)}
            >
              <IconShare size={17} />
            </button>
          </div>
        </div>

        {post.followUp && (
          <button className="followup" onClick={() => onFollowUp(post.followUp)}>
            <IconSparkle size={15} />
            <span className="followup__text">{post.followUp}</span>
            <span className="followup__cta">Open feed</span>
          </button>
        )}

        {showReplies && (
          <div className="replies">
            {post.replies.map((reply) => (
              <Reply key={reply.id} reply={reply} />
            ))}
            {sending && <div className="replies__pending">Personas are replying…</div>}
            <div className="reply-composer">
              <input
                className="reply-composer__input"
                placeholder="Post your reply"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitReply()}
                disabled={sending}
              />
              <button className="btn btn--sm" onClick={submitReply} disabled={!draft.trim() || sending}>
                Reply
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
