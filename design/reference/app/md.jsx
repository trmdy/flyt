// flyt — markdown helpers, slugify, tag colors, formatting.
// Exposes window.flytMd

(function () {
  // ---------- inline markdown -> html ----------
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function inlineToHtml(text) {
    let s = escapeHtml(text);
    // links [t](u)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => {
      const url = u.replace(/"/g, "%22");
      return `<a href="${url}">${t}</a>`;
    });
    // bold **x** or __x__
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    // strike ~~x~~
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    // italic *x* or _x_  (avoid bold already replaced)
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
    // inline code `x`
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    return s;
  }

  // ---------- markdown (block) -> html ----------
  function mdToHtml(md) {
    const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let para = [];
    const flushPara = () => {
      if (para.length) {
        out.push("<p>" + inlineToHtml(para.join(" ")) + "</p>");
        para = [];
      }
    };
    while (i < lines.length) {
      const line = lines[i];
      const t = line.trim();
      if (t === "") { flushPara(); i++; continue; }
      let m;
      if ((m = /^(#{1,3})\s+(.*)$/.exec(t))) {
        flushPara();
        const lvl = m[1].length;
        out.push(`<h${lvl}>` + inlineToHtml(m[2]) + `</h${lvl}>`);
        i++; continue;
      }
      if (/^>\s?/.test(t)) {
        flushPara();
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          buf.push(lines[i].trim().replace(/^>\s?/, ""));
          i++;
        }
        out.push("<blockquote><p>" + inlineToHtml(buf.join(" ")) + "</p></blockquote>");
        continue;
      }
      if (/^[-*]\s+/.test(t)) {
        flushPara();
        const items = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
          items.push("<li>" + inlineToHtml(lines[i].trim().replace(/^[-*]\s+/, "")) + "</li>");
          i++;
        }
        out.push("<ul>" + items.join("") + "</ul>");
        continue;
      }
      if (/^\d+\.\s+/.test(t)) {
        flushPara();
        const items = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          items.push("<li>" + inlineToHtml(lines[i].trim().replace(/^\d+\.\s+/, "")) + "</li>");
          i++;
        }
        out.push("<ol>" + items.join("") + "</ol>");
        continue;
      }
      para.push(t);
      i++;
    }
    flushPara();
    return out.join("\n") || "<p><br></p>";
  }

  // ---------- html (editor dom) -> markdown ----------
  function inlineToMd(node) {
    let s = "";
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { s += c.nodeValue; return; }
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toLowerCase();
      const inner = inlineToMd(c);
      if (tag === "strong" || tag === "b") s += "**" + inner + "**";
      else if (tag === "em" || tag === "i") s += "*" + inner + "*";
      else if (tag === "del" || tag === "s" || tag === "strike") s += "~~" + inner + "~~";
      else if (tag === "code") s += "`" + inner + "`";
      else if (tag === "a") s += "[" + inner + "](" + (c.getAttribute("href") || "") + ")";
      else if (tag === "br") s += "\n";
      else s += inner;
    });
    return s;
  }
  function htmlToMd(root) {
    const blocks = [];
    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeType === 3) {
        const t = node.nodeValue.trim();
        if (t) blocks.push(inlineToHtmlTextFallback(t));
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (tag === "h1") blocks.push("# " + inlineToMd(node));
      else if (tag === "h2") blocks.push("## " + inlineToMd(node));
      else if (tag === "h3") blocks.push("### " + inlineToMd(node));
      else if (tag === "blockquote") {
        const inner = inlineToMd(node).trim();
        blocks.push(inner.split("\n").map((l) => "> " + l).join("\n"));
      } else if (tag === "ul") {
        const items = Array.from(node.querySelectorAll(":scope > li")).map((li) => "- " + inlineToMd(li).trim());
        blocks.push(items.join("\n"));
      } else if (tag === "ol") {
        const items = Array.from(node.querySelectorAll(":scope > li")).map((li, idx) => (idx + 1) + ". " + inlineToMd(li).trim());
        blocks.push(items.join("\n"));
      } else if (tag === "div" || tag === "p") {
        const inner = inlineToMd(node).trim();
        blocks.push(inner);
      } else {
        const inner = inlineToMd(node).trim();
        if (inner) blocks.push(inner);
      }
    });
    return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function inlineToHtmlTextFallback(t) { return t; }

  // plain-text excerpt for list previews
  function excerpt(md, len) {
    len = len || 140;
    let s = (md || "")
      .replace(/^#{1,3}\s+/gm, "")
      .replace(/[*_`~>#-]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    return s.length > len ? s.slice(0, len).trim() + "…" : s;
  }

  function firstHeading(md) {
    const m = /^#\s+(.+)$/m.exec(md || "");
    return m ? m[1].trim() : "";
  }

  // ---------- slugify -> filename ----------
  function slugify(title) {
    const base = (title || "untitled")
      .toLowerCase()
      .replace(/['’"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled";
    return base;
  }

  // ---------- tag colors (stable hash -> palette) ----------
  const TAG_PALETTE = [
    "#b8862f", "#6b7a3a", "#9a6b94", "#b65838", "#3a6b8a",
    "#7a8a3a", "#8a5a9a", "#3a8a7a", "#a8742f", "#5a6b9a",
  ];
  // curated known tags keep their original hues
  const KNOWN = { spec: "#b8862f", note: "#6b7a3a", plan: "#9a6b94", brief: "#b65838", research: "#3a6b8a" };
  function tagColor(tag) {
    const k = (tag || "").toLowerCase();
    if (KNOWN[k]) return KNOWN[k];
    let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return TAG_PALETTE[h % TAG_PALETTE.length];
  }

  // ---------- dates ----------
  function relDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const ms = now - d;
    const day = 86400000;
    if (ms < 60000) return "just now";
    if (ms < 3600000) return Math.floor(ms / 60000) + "m ago";
    if (ms < day && now.getDate() === d.getDate()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (ms < day * 2) return "yesterday";
    if (ms < day * 7) return Math.floor(ms / day) + "d ago";
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  }

  window.flytMd = { mdToHtml, htmlToMd, excerpt, firstHeading, slugify, tagColor, relDate, inlineToHtml };
})();
