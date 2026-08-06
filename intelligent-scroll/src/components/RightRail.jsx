import { PERSONAS, PERSONA_KEYS } from "../lib/personas.js";
import { TRENDING_TOPICS } from "../lib/topics.js";
import { IconClock, IconSearch } from "./icons.jsx";

const eduDescription = (level) => {
  if (level <= 2) return "Group chat energy";
  if (level <= 4) return "Reddit thread";
  if (level <= 6) return "Good explainer";
  if (level <= 8) return "Seminar level";
  return "Peer review";
};

export default function RightRail({
  query,
  onQueryChange,
  onSubmit,
  searchRef,
  history,
  onPick,
  eduLevel,
  onEduChange,
  personas,
  onTogglePersona,
}) {
  return (
    <aside className="rail rail--right" aria-label="Discover">
      <div className="rail__sticky">
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <IconSearch size={18} />
          <input
            ref={searchRef}
            className="search__input"
            placeholder="Search any subject"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Search any subject"
          />
        </form>

        <section className="card">
          <h2 className="card__title">Feed controls</h2>
          <div className="card__pad">
            <div className="slider__head">
              <span>Depth</span>
              <span className="slider__value">
                {eduLevel} · {eduDescription(eduLevel)}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={eduLevel}
              onChange={(e) => onEduChange(Number(e.target.value))}
              className="slider"
              aria-label="Depth"
            />
            <div className="chips">
              {PERSONA_KEYS.map((key) => (
                <button
                  key={key}
                  className={`chip ${personas.includes(key) ? "is-on" : ""}`}
                  onClick={() => onTogglePersona(key)}
                >
                  <span aria-hidden="true">{PERSONAS[key].emoji}</span>
                  {PERSONAS[key].label}
                </button>
              ))}
            </div>
            <p className="card__note">Applies to everything generated from here on.</p>
          </div>
        </section>

        <section className="card">
          <h2 className="card__title">Trending</h2>
          {TRENDING_TOPICS.map((item, i) => (
            <button key={item.name} className="trend" onClick={() => onPick(item.name)}>
              <span className="trend__meta">
                {i + 1} · {item.tag}
              </span>
              <span className="trend__name">{item.name}</span>
              <span className="trend__count">{(97 - i * 7).toLocaleString()}K posts</span>
            </button>
          ))}
        </section>

        {history.length > 0 && (
          <section className="card">
            <h2 className="card__title">Recent subjects</h2>
            {history.slice(0, 8).map((item) => (
              <button key={item.topic} className="recent" onClick={() => onPick(item.topic)}>
                <IconClock size={15} />
                <span className="recent__name">{item.topic}</span>
              </button>
            ))}
          </section>
        )}

        <footer className="rail__foot">
          <a href="https://sudsaraswat.com" target="_blank" rel="noopener noreferrer">
            Made by Sud
          </a>
        </footer>
      </div>
    </aside>
  );
}
