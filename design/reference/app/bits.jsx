// flyt — shared icons and small primitives
// Loaded before screens.jsx; exposes window.flytIcons and window.flytBits.

const Icon = ({ name, size = 14, stroke = 1.5, className, style }) => {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    style,
    "aria-hidden": "true",
  };
  switch (name) {
    case "search":
      return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "doc":
      return <svg {...props}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>;
    case "doc-lines":
      return <svg {...props}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>;
    case "folder":
      return <svg {...props}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>;
    case "inbox":
      return <svg {...props}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>;
    case "star":
      return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case "archive":
      return <svg {...props}><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>;
    case "sparkles":
      return <svg {...props}><path d="M12 3 13.5 8.5 19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/></svg>;
    case "image":
      return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 20"/></svg>;
    case "video":
      return <svg {...props}><rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4z"/></svg>;
    case "link":
      return <svg {...props}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>;
    case "paperclip":
      return <svg {...props}><path d="m21 12-9.5 9.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-9.5 9.5a2 2 0 0 1-2.8-2.8L16 8"/></svg>;
    case "plus":
      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case "pen":
      return <svg {...props}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>;
    case "command":
      return <svg {...props}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>;
    case "arrow-right":
      return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "arrow-corner":
      return <svg {...props}><path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>;
    case "check":
      return <svg {...props}><path d="M5 12l5 5L20 7"/></svg>;
    case "x":
      return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case "stop":
      return <svg {...props}><rect x="6" y="6" width="12" height="12" rx="1"/></svg>;
    case "sidebar":
      return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>;
    case "settings":
      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "filter":
      return <svg {...props}><path d="M22 3H2l8 9.5V19l4 2v-8.5z"/></svg>;
    case "clock":
      return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "hash":
      return <svg {...props}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>;
    case "tag":
      return <svg {...props}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></svg>;
    case "chevron-right":
      return <svg {...props}><path d="m9 6 6 6-6 6"/></svg>;
    case "chevron-down":
      return <svg {...props}><path d="m6 9 6 6 6-6"/></svg>;
    case "more":
      return <svg {...props}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
    case "wand":
      return <svg {...props}><path d="m3 21 12-12M15 9l3-3"/><path d="m13 7 4 4M7 3v4M5 5h4M19 13v4M17 15h4"/></svg>;
    case "branch":
      return <svg {...props}><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="20" r="2"/><path d="M6 8v4a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V8"/><path d="M12 16v2"/></svg>;
    case "globe":
      return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case "diamond":
      return <svg {...props}><path d="M12 3 4 12l8 9 8-9z"/></svg>;
    case "file-md":
      return <svg {...props}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8 14v3M8 14l1.5 1.5L11 14v3M14 14v3M14 17l1.5-1.5L17 17"/></svg>;
    case "zen":
      // Inward-pointing corners — "focus mode" / "enter zen"
      return <svg {...props}><path d="M9 3H4a1 1 0 0 0-1 1v5"/><path d="M15 3h5a1 1 0 0 1 1 1v5"/><path d="M9 21H4a1 1 0 0 1-1-1v-5"/><path d="M15 21h5a1 1 0 0 0 1-1v-5"/></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="9"/></svg>;
  }
};

// flyt brand mark — minimal "f" glyph
const FlytMark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M7 21V8a5 5 0 0 1 5-5h4M5 13h9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="17.5" cy="6" r="1.6" fill="currentColor"/>
  </svg>
);

const WinChrome = ({ title }) => (
  <div className="win-chrome">
    <div className="win-dots">
      <span className="win-dot r"></span>
      <span className="win-dot y"></span>
      <span className="win-dot g"></span>
    </div>
    <span className="win-title">{title}</span>
  </div>
);

const Kbd = ({ children }) => <span className="kbd">{children}</span>;

window.Icon = Icon;
window.FlytMark = FlytMark;
window.WinChrome = WinChrome;
window.Kbd = Kbd;
