import {
  IconHelp,
  IconHome,
  IconMoon,
  IconSearch,
  IconSparkle,
  IconSun,
} from "./icons.jsx";

export default function LeftRail({ onHome, onSearch, onRandom, onHelp, onCompose, theme, onToggleTheme }) {
  return (
    <nav className="rail rail--left" aria-label="Primary">
      <div className="rail__sticky">
        <div className="brand">
          <span className="brand__mark">iS</span>
          <span className="brand__text">Intelligent Scroll</span>
        </div>

        <ul className="nav">
          <li>
            <button className="nav__item" onClick={onHome}>
              <IconHome size={22} />
              <span>Home</span>
            </button>
          </li>
          <li>
            <button className="nav__item" onClick={onSearch}>
              <IconSearch size={22} />
              <span>Search</span>
            </button>
          </li>
          <li>
            <button className="nav__item" onClick={onRandom}>
              <IconSparkle size={22} />
              <span>Surprise me</span>
            </button>
          </li>
          <li>
            <button className="nav__item" onClick={onHelp}>
              <IconHelp size={22} />
              <span>How it works</span>
            </button>
          </li>
          <li>
            <button className="nav__item" onClick={onToggleTheme}>
              {theme === "dark" ? <IconSun size={22} /> : <IconMoon size={22} />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
          </li>
        </ul>

        <button className="btn btn--block" onClick={onCompose}>
          Post
        </button>
      </div>
    </nav>
  );
}
