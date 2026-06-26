// flyt — live markdown editor + selection toolbar.
// WYSIWYG: type markdown shortcuts, they render inline. Stores markdown.
// Exposes window.FlytEditor

(function () {
  const { useRef, useEffect, useState, useCallback } = React;
  const { mdToHtml, htmlToMd, tagColor } = window.flytMd;

  // ---------- caret helpers ----------
  function placeCaretAtStart(el) {
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function getBlock(editor, node) {
    let n = node;
    while (n && n.parentNode !== editor) n = n.parentNode;
    return n && n.nodeType === 1 ? n : null;
  }
  function firstTextNode(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    return w.nextNode();
  }

  // strip a leading marker from a block's first text node
  function stripLeading(block, regex) {
    const tn = firstTextNode(block);
    if (tn) tn.nodeValue = tn.nodeValue.replace(regex, "");
  }

  function replaceBlockTag(editor, block, newTag, stripRegex) {
    const neo = document.createElement(newTag);
    while (block.firstChild) neo.appendChild(block.firstChild);
    if (stripRegex) stripLeading(neo, stripRegex);
    if (!neo.firstChild) neo.appendChild(document.createElement("br"));
    block.replaceWith(neo);
    placeCaretAtStart(neo);
    return neo;
  }

  function makeList(editor, block) {
    const ul = document.createElement("ul");
    const li = document.createElement("li");
    while (block.firstChild) li.appendChild(block.firstChild);
    stripLeading(li, /^[-*]\s?/);
    if (!li.firstChild) li.appendChild(document.createElement("br"));
    ul.appendChild(li);
    block.replaceWith(ul);
    placeCaretAtStart(li);
  }

  // ---------- line-start input rules (on space) ----------
  // Runs on the space keydown BEFORE the space is inserted, so we match the
  // bare marker (e.g. "##", ">", "-") sitting between block start and the caret.
  function caretPrefix(editor, block) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const r = sel.getRangeAt(0).cloneRange();
    const pre = document.createRange();
    pre.selectNodeContents(block);
    try { pre.setEnd(r.endContainer, r.endOffset); } catch (e) { return null; }
    return pre.toString();
  }
  function applyBlockRule(editor) {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return false;
    const node = sel.anchorNode;
    const block = getBlock(editor, node);
    if (!block) return false;
    const tag = block.tagName.toLowerCase();
    if (tag === "li" || tag === "ul" || tag === "ol") return false;
    const prefix = (caretPrefix(editor, block) || "").replace(/\s+$/, "");
    if (prefix === "#") { replaceBlockTag(editor, block, "h1", /^#\s?/); return true; }
    if (prefix === "##") { replaceBlockTag(editor, block, "h2", /^##\s?/); return true; }
    if (prefix === "###") { replaceBlockTag(editor, block, "h3", /^###\s?/); return true; }
    if (prefix === "-" || prefix === "*") { makeList(editor, block); return true; }
    if (prefix === ">") {
      const bq = document.createElement("blockquote");
      const p = document.createElement("p");
      while (block.firstChild) p.appendChild(block.firstChild);
      stripLeading(p, /^>\s?/);
      if (!p.firstChild) p.appendChild(document.createElement("br"));
      bq.appendChild(p);
      block.replaceWith(bq);
      placeCaretAtStart(p);
      return true;
    }
    return false;
  }

  // ---------- inline autoformat (on input) ----------
  const INLINE_RULES = [
    { re: /\*\*([^*]+)\*\*$/, tag: "strong" },
    { re: /~~([^~]+)~~$/, tag: "del" },
    { re: /`([^`]+)`$/, tag: "code" },
    { re: /(?:^|[^*])\*([^*\s][^*]*)\*$/, tag: "em", single: "*" },
  ];
  function applyInlineRule(editor) {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return false;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) return false;
    const offset = sel.anchorOffset;
    const before = node.nodeValue.slice(0, offset);
    for (const rule of INLINE_RULES) {
      const m = rule.re.exec(before);
      if (!m) continue;
      const content = m[1];
      if (!content.trim()) continue;
      // matched whole-token length: for em with leading char we must not eat that char
      let matchStr = m[0];
      let lead = "";
      if (rule.single && matchStr[0] !== "*") { lead = matchStr[0]; matchStr = matchStr.slice(1); }
      const startIdx = offset - matchStr.length;
      // build replacement
      const el = document.createElement(rule.tag);
      el.textContent = content;
      const r = document.createRange();
      r.setStart(node, startIdx);
      r.setEnd(node, offset);
      r.deleteContents();
      r.insertNode(el);
      // caret after el, add a zero space so typing continues outside the mark
      const after = document.createTextNode("\u200b");
      el.parentNode.insertBefore(after, el.nextSibling);
      const nr = document.createRange();
      nr.setStart(after, 1);
      nr.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nr);
      return true;
    }
    return false;
  }

  // ---------- selection toolbar ----------
  function getActive(editor) {
    const a = { bold: false, italic: false, strike: false, code: false, quote: false, list: false, link: false };
    try {
      a.bold = document.queryCommandState("bold");
      a.italic = document.queryCommandState("italic");
      a.strike = document.queryCommandState("strikeThrough");
    } catch (e) {}
    const sel = window.getSelection();
    if (sel.rangeCount) {
      let n = sel.anchorNode;
      while (n && n !== editor) {
        if (n.nodeType === 1) {
          const t = n.tagName.toLowerCase();
          if (t === "code") a.code = true;
          if (t === "blockquote") a.quote = true;
          if (t === "li") a.list = true;
          if (t === "a") a.link = true;
        }
        n = n.parentNode;
      }
    }
    return a;
  }

  function SelectionToolbar({ editor, onAction, actions }) {
    const [pos, setPos] = useState(null);
    const [active, setActive] = useState({});
    const [linkMode, setLinkMode] = useState(false);
    const [linkVal, setLinkVal] = useState("");
    const savedRange = useRef(null);
    const linkInputRef = useRef(null);

    const update = useCallback(() => {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) { setPos(null); setLinkMode(false); return; }
      const range = sel.getRangeAt(0);
      if (!editor || !editor.contains(range.commonAncestorContainer)) { setPos(null); return; }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) { setPos(null); return; }
      setPos({ top: rect.top - 9, left: rect.left + rect.width / 2 });
      setActive(getActive(editor));
    }, [editor]);

    useEffect(() => {
      if (!editor) return;
      const onSel = () => { if (!linkMode) update(); };
      document.addEventListener("selectionchange", onSel);
      const scroller = editor.closest(".editor-scroll");
      if (scroller) scroller.addEventListener("scroll", onSel, { passive: true });
      return () => {
        document.removeEventListener("selectionchange", onSel);
        if (scroller) scroller.removeEventListener("scroll", onSel);
      };
    }, [editor, update, linkMode]);

    if (!pos) return null;

    const fire = (action) => {
      if (action === "link") {
        const sel = window.getSelection();
        if (sel.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange();
        setLinkVal("");
        setLinkMode(true);
        setTimeout(() => linkInputRef.current && linkInputRef.current.focus(), 0);
        return;
      }
      onAction(action);
      setTimeout(() => setActive(getActive(editor)), 0);
    };

    const submitLink = () => {
      if (savedRange.current) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange.current);
      }
      onAction("link", linkVal.trim() || "#");
      setLinkMode(false);
      setPos(null);
    };

    const ICONS = {
      bold: <b>B</b>,
      italic: <i>i</i>,
      strike: <span className="stk">S</span>,
      code: <code>{"</>"}</code>,
      link: <Icon name="link" size={15} />,
      quote: <span style={{ fontFamily: "var(--prose)", fontSize: 17, lineHeight: 1 }}>"</span>,
      list: <Icon name="doc-lines" size={15} />,
    };
    const LABELS = { bold: "Bold ⌘B", italic: "Italic ⌘I", strike: "Strikethrough", code: "Code", link: "Link ⌘K", quote: "Quote", list: "Bullet list" };

    return ReactDOM.createPortal(
      <div className="sel-toolbar" style={{ top: pos.top, left: pos.left }}
           onMouseDown={(e) => e.preventDefault()}>
        {linkMode ? (
          <React.Fragment>
            <Icon name="link" size={15} style={{ color: "var(--ink-3)", marginLeft: 6 }} />
            <input ref={linkInputRef} className="st-link-input" placeholder="Paste or type a URL…"
                   value={linkVal} onChange={(e) => setLinkVal(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") submitLink(); if (e.key === "Escape") { setLinkMode(false); } }} />
            <button className="st-btn" onMouseDown={(e) => { e.preventDefault(); submitLink(); }} title="Apply">
              <Icon name="check" size={15} />
            </button>
          </React.Fragment>
        ) : (
          actions.map((a, i) => {
            const needDivider = (a === "link" || a === "quote");
            return (
              <React.Fragment key={a}>
                {needDivider && <span className="st-divider" />}
                <button className={"st-btn" + (active[a] ? " active" : "")} title={LABELS[a]}
                        onMouseDown={(e) => { e.preventDefault(); fire(a); }}>
                  {ICONS[a]}
                </button>
              </React.Fragment>
            );
          })
        )}
      </div>,
      document.body
    );
  }

  // ---------- main editor ----------
  function FlytEditor({ doc, onChange, toolbarActions }) {
    const ref = useRef(null);
    const [editorEl, setEditorEl] = useState(null);
    const saveTimer = useRef(null);
    const loadedId = useRef(null);

    // load content when doc id changes
    useEffect(() => {
      if (!ref.current) return;
      if (loadedId.current === doc.id) return;
      loadedId.current = doc.id;
      ref.current.innerHTML = doc.body ? mdToHtml(doc.body) : "";
      setEditorEl(ref.current);
    }, [doc.id, doc.body]);

    const serialize = useCallback(() => {
      if (!ref.current) return;
      // strip zero-width spaces before serialize
      const md = htmlToMd(ref.current).replace(/\u200b/g, "");
      onChange(md);
    }, [onChange]);

    const scheduleSave = useCallback(() => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(serialize, 450);
    }, [serialize]);

    const onInput = useCallback(() => {
      applyInlineRule(ref.current);
      scheduleSave();
    }, [scheduleSave]);

    const onKeyDown = useCallback((e) => {
      const editor = ref.current;
      if (e.key === " ") {
        if (applyBlockRule(editor)) { e.preventDefault(); scheduleSave(); return; }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const sel = window.getSelection();
        const block = getBlock(editor, sel.anchorNode);
        if (block) {
          const tag = block.tagName.toLowerCase();
          // exit heading / blockquote into a fresh paragraph at end
          if (["h1", "h2", "h3"].includes(tag)) {
            const atEnd = sel.anchorOffset === (sel.anchorNode.nodeType === 3 ? sel.anchorNode.nodeValue.length : block.childNodes.length);
            if (atEnd) {
              e.preventDefault();
              const p = document.createElement("p");
              p.appendChild(document.createElement("br"));
              block.after(p);
              placeCaretAtStart(p);
              scheduleSave();
              return;
            }
          }
        }
      }
      // formatting shortcuts
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (e.key === "b") { e.preventDefault(); document.execCommand("bold"); scheduleSave(); return; }
        if (e.key === "i") { e.preventDefault(); document.execCommand("italic"); scheduleSave(); return; }
      }
    }, [scheduleSave]);

    const onPaste = useCallback((e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, text);
      scheduleSave();
    }, [scheduleSave]);

    const handleAction = useCallback((action, arg) => {
      const editor = ref.current;
      editor.focus();
      const sel = window.getSelection();
      switch (action) {
        case "bold": document.execCommand("bold"); break;
        case "italic": document.execCommand("italic"); break;
        case "strike": document.execCommand("strikeThrough"); break;
        case "code": toggleWrap(editor, "code"); break;
        case "link": {
          if (!sel.rangeCount) break;
          const range = sel.getRangeAt(0);
          const a = document.createElement("a");
          a.setAttribute("href", arg || "#");
          a.appendChild(range.extractContents());
          range.insertNode(a);
          break;
        }
        case "quote": toggleQuote(editor); break;
        case "list": document.execCommand("insertUnorderedList"); break;
        default: break;
      }
      scheduleSave();
    }, [scheduleSave]);

    return (
      <React.Fragment>
        <div
          ref={ref}
          className="doc"
          contentEditable
          suppressContentEditableWarning
          spellCheck={true}
          data-ph="Start writing… use # for headings, - for lists, **bold**."
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={serialize}
        />
        {editorEl && <SelectionToolbar editor={editorEl} onAction={handleAction} actions={toolbarActions} />}
      </React.Fragment>
    );
  }

  // toggle wrap selection in a tag (code)
  function toggleWrap(editor, tagName) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    // if entirely inside the tag, unwrap
    let n = sel.anchorNode;
    let existing = null;
    while (n && n !== editor) {
      if (n.nodeType === 1 && n.tagName.toLowerCase() === tagName) { existing = n; break; }
      n = n.parentNode;
    }
    if (existing) {
      const parent = existing.parentNode;
      while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
      parent.removeChild(existing);
      return;
    }
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const el = document.createElement(tagName);
    el.appendChild(range.extractContents());
    range.insertNode(el);
    // reselect
    const nr = document.createRange();
    nr.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(nr);
  }

  function toggleQuote(editor) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let block = sel.anchorNode;
    while (block && block.parentNode !== editor) block = block.parentNode;
    if (!block) return;
    if (block.tagName && block.tagName.toLowerCase() === "blockquote") {
      // unwrap -> paragraphs
      const frag = document.createDocumentFragment();
      Array.from(block.childNodes).forEach((c) => {
        if (c.nodeType === 1 && c.tagName.toLowerCase() === "p") frag.appendChild(c);
        else { const p = document.createElement("p"); p.appendChild(c); frag.appendChild(p); }
      });
      block.replaceWith(frag);
    } else {
      const bq = document.createElement("blockquote");
      const p = document.createElement("p");
      while (block.firstChild) p.appendChild(block.firstChild);
      if (!p.firstChild) p.appendChild(document.createElement("br"));
      bq.appendChild(p);
      block.replaceWith(bq);
      placeCaretAtStart(p);
    }
  }

  window.FlytEditor = FlytEditor;
})();
