// flyt — vault store. localStorage-backed, with seed documents.
// Exposes window.flytStore: { useVault }

(function () {
  const { useState, useEffect, useCallback, useRef } = React;
  const KEY = "flyt.vault.v2";

  const DEFAULT_VAULT = "~/Documents/Flyt";

  function uid() {
    return "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  const SEED_DOCS = [
    {
      title: "Agent handoff protocol",
      file: "agent-handoff-protocol",
      tags: ["spec", "plan"],
      body: `# Agent handoff protocol

When a long-running task crosses a session boundary, the agent needs a way to hand state to its successor without losing the thread. This note sketches the contract.

## The handoff packet

A handoff is a small structured payload, not a transcript. It carries three things:

- **Intent** — what the user actually wants, in one sentence
- **State** — what has been done, what remains
- **Open questions** — anything blocking that needs a human

The successor reads the packet *before* reading history, so it forms intent first and detail second.

## Why not just replay the log?

Replaying is expensive and lossy. A 40-turn transcript costs more to read than the work it describes, and the signal decays. The packet is a deliberate compression — it throws away the path and keeps the position.

> Keep the position, throw away the path.

We version the packet so an older successor can still parse a newer one.`,
      created: Date.now() - 1000 * 60 * 60 * 24 * 9,
      modified: Date.now() - 1000 * 60 * 60 * 5,
    },
    {
      title: "On quiet software",
      file: "on-quiet-software",
      tags: ["note"],
      body: `# On quiet software

The best tools disappear. They don't ask for attention; they return it. A quiet tool has no badges, no streaks, no celebratory confetti when you finish a sentence.

Quiet is not the same as minimal. Minimal is a visual budget. Quiet is a *posture* — software that assumes you have somewhere to be and gets out of the way.

The test: after an hour of use, do you remember the app, or do you remember the work? If you remember the app, it was too loud.`,
      created: Date.now() - 1000 * 60 * 60 * 24 * 21,
      modified: Date.now() - 1000 * 60 * 60 * 24 * 2,
    },
    {
      title: "Vault migration design",
      file: "vault-migration-design",
      tags: ["spec", "research"],
      body: `# Vault migration design

Flyt stores everything in a single configurable folder — the *vault*. Changing the vault location should move every document, atomically, with no orphans.

## Requirements

- The path is the only configuration that matters.
- Changing it migrates the whole vault, not a subset.
- A migration is reversible until confirmed.

## Flow

1. User edits the path in Settings.
2. We compute the diff — every file's old path vs. new path.
3. A confirm step shows the count and the destination.
4. On confirm, files move and paths update in one pass.

The migration never silently merges into a folder that already has content. If it would, we ask.`,
      created: Date.now() - 1000 * 60 * 60 * 24 * 4,
      modified: Date.now() - 1000 * 60 * 60 * 24 * 1,
    },
    {
      title: "Reading list — Q2",
      file: "reading-list-q2",
      tags: ["note", "research"],
      body: `# Reading list — Q2

A running list. Crossed-out means finished.

- ~~The Timeless Way of Building~~
- Notes on the Synthesis of Form
- ~~Understanding Comics~~
- The Design of Everyday Things
- A Pattern Language

## Notes

Alexander keeps coming up. The thread between *quality without a name* and good software interfaces is worth a longer piece.`,
      created: Date.now() - 1000 * 60 * 60 * 24 * 30,
      modified: Date.now() - 1000 * 60 * 60 * 24 * 11,
    },
    {
      title: "Selection toolbar — interaction notes",
      file: "selection-toolbar-notes",
      tags: ["brief"],
      body: `# Selection toolbar — interaction notes

The toolbar appears *above* a selection and follows it. It should feel like it belongs to the text, not the chrome.

## Behaviors

- Appears only on a non-collapsed selection inside the document.
- Tracks the selection's bounding box; re-anchors on scroll.
- Dismisses the moment the selection collapses.
- Each action is reversible — toggle, don't stack.

Keep it small. Seven actions is the ceiling: **bold**, *italic*, \`code\`, link, ~~strike~~, quote, list. Anything more belongs in the command palette.`,
      created: Date.now() - 1000 * 60 * 60 * 24 * 2,
      modified: Date.now() - 1000 * 60 * 30,
    },
  ];

  function stripLeadingH1(body) {
    return (body || "").replace(/^#\s+.*\n+/, "");
  }

  function freshState() {
    return {
      vault: DEFAULT_VAULT,
      docs: SEED_DOCS.map((d) => ({ id: uid(), ...d, body: stripLeadingH1(d.body) })),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.docs)) return freshState();
      return parsed;
    } catch (e) {
      return freshState();
    }
  }

  function useVault() {
    const [state, setState] = useState(load);
    const ref = useRef(state);
    ref.current = state;

    // persist
    useEffect(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }, [state]);

    const ensureUniqueFile = useCallback((file, exceptId) => {
      const docs = ref.current.docs;
      let base = file || "untitled";
      let candidate = base;
      let n = 2;
      while (docs.some((d) => d.id !== exceptId && d.file === candidate)) {
        candidate = base + "-" + n;
        n++;
      }
      return candidate;
    }, []);

    const createDoc = useCallback(() => {
      const id = uid();
      const doc = { id, title: "", file: "", tags: [], body: "", created: Date.now(), modified: Date.now() };
      setState((s) => ({ ...s, docs: [doc, ...s.docs] }));
      return id;
    }, []);

    const updateDoc = useCallback((id, patch) => {
      setState((s) => ({
        ...s,
        docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch, modified: Date.now() } : d)),
      }));
    }, []);

    const deleteDoc = useCallback((id) => {
      setState((s) => ({ ...s, docs: s.docs.filter((d) => d.id !== id) }));
    }, []);

    const setVault = useCallback((path) => {
      setState((s) => ({ ...s, vault: path }));
    }, []);

    const allTags = useCallback(() => {
      const set = new Map();
      ref.current.docs.forEach((d) => (d.tags || []).forEach((t) => set.set(t, (set.get(t) || 0) + 1)));
      return Array.from(set.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
    }, []);

    return {
      vault: state.vault,
      docs: state.docs,
      createDoc, updateDoc, deleteDoc, setVault, ensureUniqueFile, allTags,
    };
  }

  window.flytStore = { useVault, DEFAULT_VAULT };
})();
