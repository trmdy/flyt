# Claude Design Prompt for flyt

Design the first product UI for **flyt**: a fast, beautiful, file-first Markdown editor with native agent streaming.

flyt is for a technical founder writing long-form specs, notes, and plans. It should feel like a clean desk for durable thinking: **iA Writer restraint + Linear speed + Apple Notes warmth + Notion-like block familiarity, without Notion clutter**.

Core product model:
- Each document is an entry backed by a folder on disk.
- `index.md` is canonical Markdown.
- Assets live beside the document in `_assets/`.
- Categories/groups are metadata, not physical folders.
- Agents can read, patch, append, and stream into documents.

Design the core app shell and key states:
1. Home view listing all entries with search/filter affordances.
2. Writing view with focused Markdown/Slate editor, recent-documents sidebar, and quiet save status.
3. Agent streaming UX: side draft with live streamed text, stop/accept/discard controls, and inline “continue writing” at cursor.
4. Asset insertion state for image/GIF/video attachments.
5. Command palette / quick open concept.

Visual direction:
- Light mode only.
- Warm white/off-white canvas.
- Typography-led, elegant, calm, low chrome.
- Main editor width around 720–820px with generous whitespace.
- Muted collapsible sidebar; crisp 1px dividers.
- No generic SaaS dashboard feel.
- No heavy shadows, gradients, glassmorphism, emoji, neon, or noisy cards.
- Use excellent font choices: refined sans for UI, highly readable prose typography, tasteful mono for metadata/shortcuts.
- Microinteractions should be subtle and performance-safe: opacity/transform only.

UX principles:
- Typing must feel instant.
- UI never waits on disk/network persistence.
- Agent output should feel live but safe: large generations default to side draft; small continuations may stream inline.
- Human writing is primary. Agents assist without taking over the page.
- Keyboard-first: Cmd/Ctrl+K command palette, Cmd/Ctrl+P quick open, Cmd/Ctrl+N new entry, Cmd/Ctrl+S save.

Produce a polished visual design concept with layout, component hierarchy, typography, spacing, interaction notes, and enough concrete detail that an engineer can implement the first version in vanilla React + Slate, backed by a Node/Express server and an Electron desktop shell.