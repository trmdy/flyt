// flyt — root app shell. Routing, global shortcuts, copy actions, toasts, tweaks.

const { useState, useEffect, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#b7862f",
  "proseSize": 20,
  "editorWidth": "regular",
  "showPreview": true
}/*EDITMODE-END*/;

const WIDTHS = { narrow: 680, regular: 760, wide: 880 };

// toolbar actions chosen by the user (Bold, Italic, Code, Link, Strikethrough, Bullet list, Quote)
window.FLYT_TOOLBAR_ACTIONS = ["bold", "italic", "code", "strike", "link", "quote", "list"];

function buildDocMarkdown(doc) {
  const lines = ["---"];
  lines.push("title: " + (doc.title || "Untitled"));
  if (doc.tags && doc.tags.length) lines.push("tags: " + doc.tags.join(", "));
  lines.push("---", "");
  lines.push(doc.body || "");
  return lines.join("\n").trim() + "\n";
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const store = window.flytStore.useVault();
  const { vault, docs } = store;

  const [view, setView] = useState("home"); // home | doc
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);

  const searchRef = useRef(null);
  const savingTimer = useRef(null);
  const focusTitleNext = useRef(false);

  const activeDoc = docs.find((d) => d.id === activeId) || null;
  const allTags = store.allTags();

  // ---------- toasts ----------
  const pushToast = useCallback((content) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, content }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 1900);
  }, []);

  // ---------- navigation ----------
  const openDoc = useCallback((id) => { setActiveId(id); setView("doc"); setPaletteOpen(false); }, []);
  const goHome = useCallback(() => { setView("home"); setActiveId(null); setPaletteOpen(false); }, []);

  const createDoc = useCallback(() => {
    const id = store.createDoc();
    focusTitleNext.current = true;
    openDoc(id);
    pushToast(<React.Fragment><span className="check"><Icon name="plus" size={14} /></span> New document</React.Fragment>);
  }, [store, openDoc, pushToast]);

  // focus the title field right after creating
  useEffect(() => {
    if (view === "doc" && focusTitleNext.current) {
      focusTitleNext.current = false;
      setTimeout(() => {
        const el = document.querySelector(".doc-title");
        if (el) el.focus();
      }, 60);
    }
  }, [view, activeId]);

  // safety: if the active doc disappears while viewing it, return home
  useEffect(() => {
    if (view === "doc" && activeId && !activeDoc) goHome();
  }, [view, activeId, activeDoc, goHome]);

  // ---------- patch (with saving indicator) ----------
  const patchDoc = useCallback((patch) => {
    const clean = { ...patch };
    delete clean._regenFile; delete clean._manualFile;
    store.updateDoc(activeId, clean);
    setSaving(true);
    if (savingTimer.current) clearTimeout(savingTimer.current);
    savingTimer.current = setTimeout(() => setSaving(false), 700);
  }, [store, activeId]);

  const deleteDoc = useCallback((id) => {
    store.deleteDoc(id);
    goHome();
    pushToast(<React.Fragment><Icon name="x" size={14} /> Document deleted</React.Fragment>);
  }, [store, goHome, pushToast]);

  const archiveDoc = useCallback((id) => {
    store.updateDoc(id, { archived: true });
    goHome();
    pushToast(<React.Fragment><span className="check"><Icon name="archive" size={14} /></span> Document archived</React.Fragment>);
  }, [store, goHome, pushToast]);

  const restoreDoc = useCallback((id) => {
    store.updateDoc(id, { archived: false });
    pushToast(<React.Fragment><span className="check"><Icon name="check" size={14} /></span> Document restored</React.Fragment>);
  }, [store, pushToast]);

  const toggleArchived = useCallback(() => {
    setView("home"); setActiveId(null); setPaletteOpen(false);
    setShowArchived((v) => !v);
  }, []);

  // ---------- copy actions ----------
  const copyDocument = useCallback(() => {
    if (!activeDoc) return;
    navigator.clipboard && navigator.clipboard.writeText(buildDocMarkdown(activeDoc));
    pushToast(<React.Fragment><span className="check"><Icon name="check" size={14} /></span> Copied entire document</React.Fragment>);
  }, [activeDoc, pushToast]);

  const copyPath = useCallback(() => {
    const path = activeDoc ? `${vault}/${activeDoc.file || "untitled"}.md` : vault;
    navigator.clipboard && navigator.clipboard.writeText(path);
    pushToast(<React.Fragment><span className="check"><Icon name="check" size={14} /></span> Copied <span className="kbd">{path}</span></React.Fragment>);
  }, [activeDoc, vault, pushToast]);

  // ---------- global keyboard ----------
  const lastTap = useRef({ combo: null, time: 0 });
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      // command palette
      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") {
        // only when not editing a link inside the selection toolbar etc.
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      // new doc
      if (mod && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault(); createDoc(); return;
      }
      // toggle archived view (⌘⇧A)
      if (mod && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault(); toggleArchived(); return;
      }
      // double ⌘C / ⇧⌘C
      if (mod && e.key.toLowerCase() === "c") {
        const combo = e.shiftKey ? "shift-c" : "c";
        const now = Date.now();
        const prev = lastTap.current;
        const isDouble = prev.combo === combo && now - prev.time < 650;
        if (isDouble) {
          // second press — run the bulk action
          if (combo === "c" && view === "doc") { e.preventDefault(); copyDocument(); }
          else if (combo === "shift-c") { e.preventDefault(); copyPath(); }
          lastTap.current = { combo: null, time: 0 };
        } else {
          lastTap.current = { combo, time: now };
        }
        return;
      }
      // focus search on home with /
      if (e.key === "/" && view === "home" && document.activeElement === document.body) {
        e.preventDefault(); searchRef.current && searchRef.current.focus();
      }
      if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, paletteOpen, settingsOpen, createDoc, copyDocument, copyPath, toggleArchived]);

  // ---------- palette actions ----------
  const paletteActions = (() => {
    const a = [
      { id: "new", label: "New document", icon: "plus", shortcut: "⌘N", keywords: "create add",
        run: () => createDoc() },
    ];
    if (view === "doc") {
      const arch = activeDoc && activeDoc.archived;
      a.push(
        { id: "copy-doc", label: "Copy entire document", icon: "doc", shortcut: "⌘C ⌘C", keywords: "clipboard",
          run: () => copyDocument() },
        { id: "copy-path", label: "Copy path to document", icon: "link", shortcut: "⇧⌘C ⇧⌘C", keywords: "clipboard vault location",
          run: () => copyPath() },
        { id: "library", label: "Back to library", icon: "arrow-corner", keywords: "home docs all",
          run: () => goHome() },
        arch
          ? { id: "restore", label: "Restore document", icon: "check", keywords: "unarchive",
              run: () => { restoreDoc(activeId); goHome(); } }
          : { id: "archive", label: "Archive document", icon: "archive", keywords: "hide stash",
              run: () => archiveDoc(activeId) },
        { id: "delete", label: "Delete this document", icon: "x", keywords: "remove trash permanent",
          run: () => deleteDoc(activeId) },
      );
    }
    a.push(
      { id: "archived", label: showArchived ? "View active documents" : "View archived documents", icon: "archive",
        shortcut: "⇧⌘A", keywords: "archive trash hidden", run: () => toggleArchived() },
      { id: "vault", label: "Vault settings…", icon: "settings", keywords: "location migrate folder path",
        run: () => setSettingsOpen(true) },
    );
    return a;
  })();

  const runAction = (action) => { setPaletteOpen(false); setTimeout(() => action.run(), 0); };

  // ---------- dynamic style from tweaks ----------
  const dynCss = `
    .doc { font-size: ${t.proseSize}px; }
    .editor-col { max-width: ${WIDTHS[t.editorWidth] || 760}px; }
    ::selection { background: ${hexA(t.accent, 0.20)}; }
    .st-btn.active { background: ${hexA(t.accent, 0.16)}; }
    .chip.active, .btn-ink { background: ${view === "home" ? "var(--ink)" : "var(--ink)"}; }
    .tag-add-btn:focus-within, .path-input:focus { border-color: ${t.accent}; }
    .save-dot .d { background: ${t.accent}; }
    .save-dot:not(.saving) .d { background: var(--moss); }
    ${t.showPreview ? "" : ".entry-preview { display: none; }"}
  `;

  return (
    <div className="app">
      <style dangerouslySetInnerHTML={{ __html: dynCss }} />

      {view === "home" && (
        <window.FlytHome
          vault={vault} docs={docs} query={query} setQuery={setQuery} searchRef={searchRef}
          showArchived={showArchived} setShowArchived={setShowArchived}
          onOpen={openDoc} onCreate={createDoc} onRestore={restoreDoc}
        />
      )}

      {view === "doc" && activeDoc && (
        <window.FlytDocView
          doc={activeDoc} vault={vault} saving={saving} allTags={allTags}
          onBack={goHome} onPatch={patchDoc} onDelete={deleteDoc}
          onArchive={archiveDoc} onRestore={(id) => { restoreDoc(id); goHome(); }}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      )}
      {view === "doc" && !activeDoc && (
        <div style={{ flex: 1 }} />
      )}

      {paletteOpen && (
        <window.FlytPalette
          docs={docs} actions={paletteActions}
          onClose={() => setPaletteOpen(false)}
          onPickDoc={openDoc}
          onRunAction={runAction}
        />
      )}

      {settingsOpen && (
        <window.FlytSettings
          vault={vault} docs={docs}
          onClose={() => setSettingsOpen(false)}
          onCommit={(p) => { store.setVault(p); pushToast(<React.Fragment><span className="check"><Icon name="check" size={14} /></span> Vault migrated</React.Fragment>); }}
        />
      )}

      <div className="toast-wrap">
        {toasts.map((t) => <div key={t.id} className="toast">{t.content}</div>)}
      </div>

      <TweaksPanel>
        <TweakSection label="Typography" />
        <TweakSlider label="Prose size" value={t.proseSize} min={17} max={22} step={1} unit="px"
                     onChange={(v) => setTweak("proseSize", v)} />
        <TweakRadio label="Editor width" value={t.editorWidth}
                    options={["narrow", "regular", "wide"]}
                    onChange={(v) => setTweak("editorWidth", v)} />
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent}
                    options={["#b7862f", "#6b7a3a", "#3a6b8a", "#b65838", "#9a6b94"]}
                    onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Library" />
        <TweakToggle label="Show preview text" value={t.showPreview}
                     onChange={(v) => setTweak("showPreview", v)} />
      </TweaksPanel>
    </div>
  );
}

// hex + alpha -> rgba
function hexA(hex, a) {
  const h = (hex || "#b8862f").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
