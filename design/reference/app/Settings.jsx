// flyt — Vault settings + migration flow.
// Changing the vault path migrates every document (confirm + progress).
// Exposes window.FlytSettings

(function () {
  const { useState, useRef, useEffect } = React;

  function FlytSettings({ vault, docs, onClose, onCommit }) {
    const [path, setPath] = useState(vault);
    const [phase, setPhase] = useState("edit"); // edit | confirm | migrating | done
    const [progress, setProgress] = useState(0);
    const inputRef = useRef(null);
    const timer = useRef(null);

    useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
    useEffect(() => () => timer.current && clearInterval(timer.current), []);

    const clean = (path || "").trim().replace(/\/+$/, "");
    const changed = clean && clean !== vault;

    const startMigration = () => {
      setPhase("migrating");
      setProgress(0);
      const total = docs.length;
      let done = 0;
      timer.current = setInterval(() => {
        done++;
        setProgress(done);
        if (done >= total) {
          clearInterval(timer.current);
          setTimeout(() => {
            onCommit(clean);
            setPhase("done");
            setTimeout(onClose, 700);
          }, 260);
        }
      }, Math.max(90, Math.min(220, 700 / Math.max(total, 1))));
    };

    return (
      <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && phase !== "migrating") onClose(); }}>
        <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
          <div className="sheet-head">
            <div className="sheet-title">Vault</div>
            <button className="icon-btn" onClick={onClose} disabled={phase === "migrating"}><Icon name="x" size={16} /></button>
          </div>

          <div className="sheet-body">
            {phase === "edit" && (
              <React.Fragment>
                <label className="field-label">Vault location</label>
                <input
                  ref={inputRef}
                  className="path-input"
                  value={path}
                  spellCheck={false}
                  onChange={(e) => setPath(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && changed) setPhase("confirm"); }}
                />
                <p className="field-help">
                  Every Flyt document lives in this folder. Changing the location moves the
                  entire vault — all {docs.length} documents — to the new path.
                </p>
                <div className="sheet-foot">
                  <button className="btn-ghost" onClick={onClose}>Cancel</button>
                  <button className="btn-ink" disabled={!changed} onClick={() => setPhase("confirm")}>
                    Continue
                  </button>
                </div>
              </React.Fragment>
            )}

            {phase === "confirm" && (
              <React.Fragment>
                <label className="field-label">Confirm migration</label>
                <div className="migrate-box">
                  <div className="migrate-line"><Icon name="folder" size={14} /><span className="from">{vault}</span></div>
                  <div className="migrate-line"><Icon name="arrow-right" size={14} /><span className="to">{clean}</span></div>
                </div>
                <p className="field-help">
                  {docs.length} {docs.length === 1 ? "document" : "documents"} will be moved and every path updated.
                  Nothing is deleted — the move is atomic.
                </p>
                <div className="sheet-foot">
                  <button className="btn-ghost" onClick={() => setPhase("edit")}>Back</button>
                  <button className="btn-ink" onClick={startMigration}>
                    <Icon name="arrow-right" size={15} /> Migrate vault
                  </button>
                </div>
              </React.Fragment>
            )}

            {phase === "migrating" && (
              <React.Fragment>
                <label className="field-label">Migrating…</label>
                <div className="migrate-box">
                  <div className="migrate-line"><Icon name="folder" size={14} /><span className="to">{clean}</span></div>
                  <div className="migrate-progress"><div className="bar" style={{ width: (progress / Math.max(docs.length, 1)) * 100 + "%" }} /></div>
                  <div className="migrate-count">{progress} / {docs.length} documents moved</div>
                </div>
              </React.Fragment>
            )}

            {phase === "done" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", color: "var(--moss)", fontFamily: "var(--mono)", fontSize: 13 }}>
                <Icon name="check" size={18} /> Vault migrated to {clean}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  window.FlytSettings = FlytSettings;
})();
