import { useEffect, useRef, useState } from "react";
import { IconGlobe } from "./icons.jsx";

const MAX_LENGTH = 700;

export default function Composer({ topic, onPost, autoFocus = false }) {
  const [value, setValue] = useState("");
  const [posting, setPosting] = useState(false);
  const areaRef = useRef(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) areaRef.current?.focus();
  }, [autoFocus]);

  const submit = async () => {
    const text = value.trim();
    if (!text || posting) return;
    setPosting(true);
    setValue("");
    try {
      await onPost(text);
    } finally {
      setPosting(false);
    }
  };

  const remaining = MAX_LENGTH - value.length;

  return (
    <div className="composer">
      <div className="avatar avatar--md" style={{ "--avatar-color": "#1d9bf0" }}>
        🫵
      </div>
      <div className="composer__main">
        <textarea
          ref={areaRef}
          className="composer__input"
          placeholder={topic ? "Add your take" : "What are you curious about?"}
          value={value}
          maxLength={MAX_LENGTH}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={1}
        />
        <div className="composer__foot">
          <span className="composer__audience">
            <IconGlobe size={14} />
            Everyone can reply
          </span>
          <div className="composer__right">
            {value.length > 0 && (
              <span className={`composer__count ${remaining < 60 ? "is-low" : ""}`}>{remaining}</span>
            )}
            <button className="btn" onClick={submit} disabled={!value.trim() || posting}>
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
