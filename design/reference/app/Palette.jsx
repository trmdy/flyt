// flyt — Command palette (⌘K). Unified: actions + document search.
// Exposes window.FlytPalette

(function () {
  const { useState, useEffect, useRef, useMemo } = React;
  const { excerpt, relDate } = window.flytMd;

  function FlytPalette({ docs, actions, onClose, onPickDoc, onRunAction }) {
    const [q, setQ] = useState("");
    const [hi, setHi] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

    const query = q.trim().toLowerCase();

    const matchedActions = useMemo(() => {
      if (!query) return actions;
      return actions.filter((a) =>
        a.label.toLowerCase().includes(query) || (a.keywords || "").toLowerCase().includes(query));
    }, [actions, query]);

    const matchedDocs = useMemo(() => {
      const list = docs.slice().sort((a, b) => b.modified - a.modified);
      if (!query) return list.slice(0, 6);
      return list.filter((d) =>
        (d.title || "untitled").toLowerCase().includes(query) ||
        (d.file || "").toLowerCase().includes(query) ||
        (d.body || "").toLowerCase().includes(query) ||
        (d.tags || []).some((t) => t.toLowerCase().includes(query))
      );
    }, [docs, query]);

    // flatten for keyboard nav: [{type:'action',item}, {type:'doc',item}]
    const flat = useMemo(() => {
      const f = [];
      matchedActions.forEach((a) => f.push({ type: "action", item: a }));
      matchedDocs.forEach((d) => f.push({ type: "doc", item: d }));
      return f;
    }, [matchedActions, matchedDocs]);

    useEffect(() => { setHi(0); }, [q]);
    useEffect(() => {
      const el = listRef.current && listRef.current.querySelector(".palette-item.active");
      if (el) el.scrollIntoViewIfNeeded ? el.scrollIntoViewIfNeeded() : el.scrollIntoView({ block: "nearest" });
    }, [hi]);

    const choose = (entry) => {
      if (!entry) return;
      if (entry.type === "action") onRunAction(entry.item);
      else onPickDoc(entry.item.id);
    };

    const onKey = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, flat.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); choose(flat[hi]); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };

    let idx = -1;
    const rowIndex = () => (++idx);

    return (
      <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
          <div className="palette-input">
            <Icon name="search" size={17} />
            <input
              ref={inputRef}
              value={q}
              placeholder="Search documents or run a command…"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
            />
            <span className="kbd">esc</span>
          </div>

          <div className="palette-list scroll" ref={listRef}>
            {matchedActions.length > 0 && <div className="palette-label">Actions</div>}
            {matchedActions.map((a) => {
              const i = rowIndex();
              return (
                <div key={a.id} className={"palette-item" + (i === hi ? " active" : "")}
                     onMouseEnter={() => setHi(i)}
                     onMouseDown={(e) => { e.preventDefault(); onRunAction(a); }}>
                  <span className="ico"><Icon name={a.icon} size={16} /></span>
                  <div className="pi-main"><div className="pi-title">{a.label}</div></div>
                  {a.shortcut && <span className="meta">{a.shortcut}</span>}
                </div>
              );
            })}

            {matchedDocs.length > 0 && <div className="palette-label">{query ? "Documents" : "Recent"}</div>}
            {matchedDocs.map((d) => {
              const i = rowIndex();
              return (
                <div key={d.id} className={"palette-item" + (i === hi ? " active" : "")}
                     onMouseEnter={() => setHi(i)}
                     onMouseDown={(e) => { e.preventDefault(); onPickDoc(d.id); }}>
                  <span className="ico"><Icon name="doc" size={16} /></span>
                  <div className="pi-main">
                    <div className="pi-title">{d.title || "Untitled"}</div>
                    <div className="pi-sub">{d.file || "untitled"}.md{d.tags && d.tags.length ? "  ·  " + d.tags.join(", ") : ""}</div>
                  </div>
                  <span className="meta">{relDate(d.modified)}</span>
                </div>
              );
            })}

            {flat.length === 0 && <div className="palette-empty">No matches for “{q}”.</div>}
          </div>

          <div className="palette-foot">
            <span className="hint"><span className="kbd">↑↓</span> navigate</span>
            <span className="hint"><span className="kbd">↵</span> open</span>
            <span className="hint"><span className="kbd">esc</span> dismiss</span>
            <span style={{ marginLeft: "auto" }} className="hint">{docs.length} documents</span>
          </div>
        </div>
      </div>
    );
  }

  window.FlytPalette = FlytPalette;
})();
