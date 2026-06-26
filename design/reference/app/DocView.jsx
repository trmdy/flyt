// flyt — Document view. Inline title + filename + tags, wrapping the live editor.
// Exposes window.FlytDocView

(function () {
  const { useRef, useEffect, useState, useCallback } = React;
  const { slugify, tagColor, relDate } = window.flytMd;

  function isAutoFile(file, title) {
    if (!file) return true;
    const slug = slugify(title);
    return new RegExp("^" + slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(-\\d+)?$").test(file);
  }

  // ---------- tag editor ----------
  function TagEditor({ tags, allTags, onAdd, onRemove, openSignal, onLeaveToBody }) {
    const [adding, setAdding] = useState(false);
    const [val, setVal] = useState("");
    const [hi, setHi] = useState(0);
    const inputRef = useRef(null);

    // ⌘⇧T from the document focuses tag entry
    useEffect(() => {
      if (openSignal > 0) {
        setAdding(true);
        setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
      }
    }, [openSignal]);

    const suggestions = (() => {
      const q = val.trim().toLowerCase();
      const pool = allTags.filter((t) => !tags.includes(t.tag));
      const matched = pool.filter((t) => t.tag.toLowerCase().includes(q));
      const list = q ? matched : pool.slice(0, 8);
      const exact = allTags.some((t) => t.tag.toLowerCase() === q) || tags.some((t) => t.toLowerCase() === q);
      const items = list.map((t) => ({ tag: t.tag, isNew: false }));
      if (q && !exact) items.unshift({ tag: val.trim(), isNew: true });
      return items;
    })();

    useEffect(() => { if (adding && inputRef.current) inputRef.current.focus(); }, [adding]);
    useEffect(() => { setHi(0); }, [val]);

    const commit = (tag) => {
      const t = (tag || "").trim();
      if (t) onAdd(t);
      setVal("");
      setAdding(false);
    };

    // commit and immediately start another tag (Enter)
    const commitContinue = (tag) => {
      const t = (tag || "").trim();
      if (t) onAdd(t);
      setVal("");
      setHi(0);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
    };

    // commit current (if any) and drop into the editor body (Shift+Enter)
    const commitAndLeave = (tag) => {
      const t = (tag || "").trim();
      if (t) onAdd(t);
      setVal("");
      setAdding(false);
      if (onLeaveToBody) setTimeout(onLeaveToBody, 0);
    };

    return (
      <div className="tag-row">
        {tags.map((t) => (
          <span key={t} className="tag-chip">
            <span className="swatch" style={{ background: tagColor(t) }} />
            {t}
            <button className="rm" onClick={() => onRemove(t)} title="Remove tag"><Icon name="x" size={11} /></button>
          </span>
        ))}
        <div className="tag-add">
          {adding ? (
            <React.Fragment>
              <input
                ref={inputRef}
                className="tag-add-input"
                placeholder="tag…"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onBlur={() => setTimeout(() => setAdding(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); commitAndLeave(val); }
                  else if (e.key === "Enter") { e.preventDefault(); commitContinue(suggestions[hi] ? suggestions[hi].tag : val); }
                  else if (e.key === "Escape") { setAdding(false); setVal(""); }
                  else if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, suggestions.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
                }}
              />
              {suggestions.length > 0 && (
                <div className="tag-suggest">
                  {suggestions.map((s, i) => (
                    <div key={s.tag + s.isNew} className={"tag-suggest-item" + (i === hi ? " active" : "")}
                         onMouseEnter={() => setHi(i)}
                         onMouseDown={(e) => { e.preventDefault(); commitContinue(s.tag); }}>
                      <span className="swatch" style={{ background: tagColor(s.tag) }} />
                      {s.tag}
                      {s.isNew && <span className="new">create</span>}
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          ) : (
            <button className="tag-add-btn" onClick={() => setAdding(true)}>
              <Icon name="plus" size={11} /> tag
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------- doc view ----------
  function FlytDocView({ doc, vault, saving, allTags, onBack, onPatch, onOpenPalette, onDelete, onArchive, onRestore }) {
    const titleRef = useRef(null);
    const fnameRef = useRef(null);
    const loadedId = useRef(null);
    const [tagSignal, setTagSignal] = useState(0);

    // ⌘⇧T focuses the tag section to add a new tag
    useEffect(() => {
      const onKey = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "t") {
          e.preventDefault();
          setTagSignal((s) => s + 1);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
      if (loadedId.current !== doc.id && titleRef.current) {
        loadedId.current = doc.id;
        titleRef.current.textContent = doc.title || "";
      }
    }, [doc.id, doc.title]);

    const onTitleInput = useCallback(() => {
      const text = titleRef.current.textContent;
      const patch = { title: text };
      if (isAutoFile(doc.file, doc.title)) {
        patch.file = slugify(text);
        patch._regenFile = true;
      }
      onPatch(patch);
    }, [doc.file, doc.title, onPatch]);

    const onFnameChange = useCallback((e) => {
      const v = slugify(e.target.value);
      onPatch({ file: v, _manualFile: true });
    }, [onPatch]);

    const focusBody = () => {
      const el = document.querySelector(".doc");
      if (el) {
        el.focus();
        const sel = window.getSelection();
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    };

    return (
      <React.Fragment>
        <div className="bar doc-bar">
          <div className="doc-bar-side left">
            <button className="icon-btn" onClick={onBack} title="Back to library">
              <Icon name="arrow-corner" size={17} />
            </button>
          </div>
          <div className="doc-bar-meta">
            <input
              ref={fnameRef}
              className="fname-field"
              value={doc.file || ""}
              spellCheck={false}
              placeholder="untitled"
              onChange={onFnameChange}
              title="File name in the vault"
            />
            <span className="fname-path">.md</span>
          </div>
          <div className="doc-bar-side right">
            <div className={"save-dot" + (saving ? " saving" : "")}>
              <span className="d" /> {saving ? "saving…" : "saved"}
            </div>
            <button className="icon-btn" onClick={onOpenPalette} title="Command palette (⌘K)">
              <Icon name="command" size={16} />
            </button>
            {doc.archived ? (
              <button className="icon-btn" onClick={() => onRestore(doc.id)} title="Restore document">
                <Icon name="check" size={16} />
              </button>
            ) : (
              <button className="icon-btn" onClick={() => onArchive(doc.id)} title="Archive document">
                <Icon name="archive" size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="editor-scroll scroll">
          <div className="editor-col">
            <div
              ref={titleRef}
              className={"doc-title" + (!doc.title ? " empty-ph" : "")}
              contentEditable
              suppressContentEditableWarning
              data-ph="Untitled"
              onInput={onTitleInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); focusBody(); }
                if (e.key === "ArrowDown") { /* let native move; if at end go to body */ }
              }}
            />
            <TagEditor
              tags={doc.tags || []}
              allTags={allTags}
              openSignal={tagSignal}
              onLeaveToBody={focusBody}
              onAdd={(t) => onPatch({ tags: [...(doc.tags || []), t] })}
              onRemove={(t) => onPatch({ tags: (doc.tags || []).filter((x) => x !== t) })}
            />
            <FlytEditor doc={doc} onChange={(md) => onPatch({ body: md })} toolbarActions={window.FLYT_TOOLBAR_ACTIONS} />
          </div>
        </div>

        <div className="statusbar">
          <span className="vault"><Icon name="folder" size={12} /> {vault}/{doc.file || "untitled"}.md</span>
          <span className="sep">·</span>
          <span>edited {relDate(doc.modified)}</span>
          <span style={{ marginLeft: "auto" }} />
          <span className="kbd">⌘C ⌘C</span><span>copy doc</span>
          <span className="sep">·</span>
          <span className="kbd">⇧⌘C ⇧⌘C</span><span>copy path</span>
        </div>
      </React.Fragment>
    );
  }

  window.FlytDocView = FlytDocView;
})();
