const Svg = ({ children, size = 18, fill = "none", ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={fill}
    stroke={fill === "none" ? "currentColor" : "none"}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const IconHome = (p) => (
  <Svg {...p}>
    <path d="M3.2 10.4 12 3.4l8.8 7v9.2a1 1 0 0 1-1 1h-4.9v-6.1H9.1v6.1H4.2a1 1 0 0 1-1-1z" />
  </Svg>
);

export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.4 15.4 21 21" />
  </Svg>
);

export const IconSparkle = (p) => (
  <Svg {...p}>
    <path d="M12 3.2l1.9 4.9 4.9 1.9-4.9 1.9L12 16.8l-1.9-4.9L5.2 10l4.9-1.9z" />
    <path d="M18.6 16.4l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </Svg>
);

export const IconSliders = (p) => (
  <Svg {...p}>
    <path d="M4 7h9M17.5 7H20M4 17h3M11.5 17H20" />
    <circle cx="15" cy="7" r="2.2" />
    <circle cx="9" cy="17" r="2.2" />
  </Svg>
);

export const IconHelp = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.5-1.2 1-1.2 1.9" />
    <path d="M12 17h.01" />
  </Svg>
);

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3.2 2" />
  </Svg>
);

export const IconReply = (p) => (
  <Svg {...p}>
    <path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H9l-4.5 3.5V6.5A2.5 2.5 0 0 1 7 4h10.5A2.5 2.5 0 0 1 20 6.5z" />
  </Svg>
);

export const IconRepost = (p) => (
  <Svg {...p}>
    <path d="M17 2.8 20.6 6.4 17 10" />
    <path d="M20.6 6.4H8.6a4 4 0 0 0-4 4v2.2" />
    <path d="M7 21.2 3.4 17.6 7 14" />
    <path d="M3.4 17.6h12a4 4 0 0 0 4-4v-2.2" />
  </Svg>
);

export const IconHeart = ({ filled, ...p }) => (
  <Svg {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20.6s-7-4.4-9-8.2C1.2 9 2.8 5.3 6.3 4.5c2-.5 3.9.4 4.9 2 1-1.6 2.9-2.5 4.9-2 3.5.8 5.1 4.5 3.3 7.9-2 3.8-9 8.2-9 8.2z" />
  </Svg>
);

export const IconChart = (p) => (
  <Svg {...p}>
    <path d="M3.5 20.5h17" />
    <path d="M7 20.5v-5.8M12 20.5V8.2M17 20.5v-9.1" />
  </Svg>
);

export const IconBookmark = ({ filled, ...p }) => (
  <Svg {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M6.4 3.5h11.2v17l-5.6-4.6-5.6 4.6z" />
  </Svg>
);

export const IconShare = (p) => (
  <Svg {...p}>
    <path d="M12 3.2v11.3" />
    <path d="M8.2 6.9 12 3.1l3.8 3.8" />
    <path d="M5 13.4v6.1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.1" />
  </Svg>
);

export const IconBook = (p) => (
  <Svg {...p}>
    <path d="M12 6.4C10 5 7 4.4 3.8 4.4v13.4c3.2 0 6.2.6 8.2 2 2-1.4 5-2 8.2-2V4.4C17 4.4 14 5 12 6.4z" />
    <path d="M12 6.4v13.4" />
  </Svg>
);

export const IconArrowLeft = (p) => (
  <Svg {...p}>
    <path d="M19 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </Svg>
);

export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconMoon = (p) => (
  <Svg {...p}>
    <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.7 8.7 0 1 0 11.1 11.1z" />
  </Svg>
);

export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5" />
  </Svg>
);

export const IconVerified = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-label="Verified" className="verified">
    <path
      fill="currentColor"
      d="M12 1.8l2.4 2 3.1-.4 1.3 2.9 2.9 1.3-.4 3.1 2 2.4-2 2.4.4 3.1-2.9 1.3-1.3 2.9-3.1-.4-2.4 2-2.4-2-3.1.4-1.3-2.9-2.9-1.3.4-3.1-2-2.4 2-2.4-.4-3.1L6.1 3.4l1.3-2.9 3.1.4z"
    />
    <path d="M7.8 12.3l2.6 2.6 5.4-5.6" fill="none" stroke="var(--badge-check)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconGlobe = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.2 9.6h17.6M3.2 14.4h17.6" />
    <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
  </Svg>
);
