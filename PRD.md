# flyt PRD

## Summary

flyt is a fast, beautiful, file-first writing app for long-form Markdown documents. It replaces Proof's slow writing UX with a local-feeling editor that treats the filesystem as the database, Markdown as the durable format, Slate as the editing instrument, and agents as first-class collaborators.

The first version is a no-auth app hosted on `linux02`, exposed through a local DNS alias, and backed by a folder on disk.

## Product Principles

1. **File first** — documents are ordinary folders and Markdown files on disk.
2. **Markdown compatible** — `index.md` is the canonical human-readable source of truth.
3. **Instant editing** — typing, selection, formatting, and navigation never wait on server or disk latency.
4. **Agent native** — agents can read, create, patch, append, and stream into documents through stable APIs and filesystem conventions.
5. **Beautifully simple** — light-mode, typography-led, low-chrome UI with excellent keyboard flow.
6. **Flat by default** — entries are physically flat; categories/groups are metadata-driven.
7. **Safe persistence** — atomic saves, revisions, conflicts, and recoverability matter more than cleverness.

## Target User

A technical founder/operator writing specifications, notes, plans, and agent-readable documents. The app should feel like a clean desk for durable thinking, not a CMS.

## Core Use Cases

- Create a new long-form document quickly.
- Open and edit existing Markdown-backed entries.
- Browse recent entries from a sidebar.
- View all entries from a home/list view.
- Group documents into categories without physically nesting folders.
- Insert images, GIFs, and videos stored next to the document.
- Ask an agent to continue, rewrite, summarize, or draft sections.
- Stream agent output into a side draft, selected range, or cursor location.
- Let external tools and agents operate directly against files or stable APIs.

## Non-Goals for MVP

- Multi-user SaaS.
- Public sharing.
- Full collaborative realtime editing.
- Complex permissions/auth.
- Database-backed storage.
- Mobile-native app.
- Perfect support for every Markdown extension.

## Technology Choices

Use a boring, reliable TypeScript monorepo. Avoid framework cleverness in the core writing path.

- Repository: Turborepo workspace.
- Web app: vanilla React + Vite.
- Desktop app: Electron wrapper that connects to the server running on `linux02`.
- Backend: Node.js + Express.
- Editor: Slate.
- Storage: server-local filesystem on `linux02`.
- Canonical text format: Markdown.
- Internal editor format: Slate JSON, stored only as optional cache/lossless sidecar.
- Streaming transport: SSE first; WebSockets only if later needed.
- Hosting: `linux02` via systemd.

### Monorepo Shape

```txt
apps/
  web/          React + Vite browser client
  server/       Node + Express API/filesystem backend
  desktop/      Electron desktop shell connecting to linux02
packages/
  shared/       shared schemas, types, constants, API contracts
  markdown/     Markdown <-> Slate conversion helpers
  ui/           reusable React UI primitives
```

The web and desktop apps should consume the same React editor surface where practical. Electron should not fork product behavior; it is a local shell for the same flyt client.

## Filesystem Model

The content root contains flat entries and system metadata.

```txt
/content/
  _system/
    categories.json
    groups.json
    index.json
    agent-events.ndjson
  entries/
    my-entry/
      index.md
      _meta.json
      _editor.slate.json
      _assets/
        image-001.png
        demo.gif
        clip.mp4
      _versions/
        2026-05-27T123000.md
```

### Entry Folder

Each entry lives in one folder named by stable slug.

Required:

- `index.md` — canonical Markdown source of truth.
- `_meta.json` — title, slug, category, groups, timestamps, and display metadata.
- `_assets/` — entry-local images, GIFs, videos, and other attachments.

Optional/generated:

- `_editor.slate.json` — optional derived/lossless Slate cache. May be deleted and regenerated from Markdown.
- `_versions/` — lightweight revision snapshots.

### Source of Truth Rule

```txt
index.md is canonical.
_editor.slate.json is cache/sidecar.
```

If the two disagree, the app must prefer `index.md` unless a deliberate recovery flow says otherwise.

### Metadata Example

```json
{
  "title": "File-first Editor Spec",
  "slug": "file-first-editor-spec",
  "category": "specifications",
  "groups": ["flyt", "editor"],
  "createdAt": "2026-05-27T12:00:00Z",
  "updatedAt": "2026-05-27T12:30:00Z"
}
```

### Categories and Groups

Categories and groups are stored in `_system/categories.json` and `_system/groups.json`.

Entries remain physically flat. Organization is metadata-driven to avoid painful folder renames, multi-category conflicts, and future backlink/search complexity.

## Markdown Support

MVP should support roundtrip for:

- paragraphs
- headings
- bold, italic, strikethrough
- inline code
- links
- blockquotes
- ordered lists
- unordered lists
- task lists
- code blocks
- tables
- images
- horizontal rules
- inline HTML for video embeds

Video may use Markdown-compatible HTML:

```md
<video src="_assets/demo.mp4" controls></video>
```

## Editor UX

The editor should feel immediate and calm.

Required:

- Slate-powered rich text editing.
- Markdown load/save.
- Autosave with quiet save indicator.
- Manual save via `Cmd/Ctrl+S`.
- Undo/redo that behaves predictably across agent insertions.
- Drag/drop or upload assets into `_assets`.
- Relative Markdown references for assets.
- Main writing column with focused readable width.
- Extendible/collapsible sidebar with recent entries.
- Home view listing all files.

Recommended keyboard shortcuts:

- `Cmd/Ctrl+K` — command palette.
- `Cmd/Ctrl+P` — quick open entry.
- `Cmd/Ctrl+N` — new entry.
- `Cmd/Ctrl+S` — save now.
- `Cmd/Ctrl+B/I` — bold/italic.
- `/` — block/agent insert menu in editor.
- `Esc` — close palettes/panels and return to sane focus.

## Design Direction

Light mode only initially. The app should be sleek, warm, restrained, and typographic.

Taste references:

- iA Writer restraint.
- Linear speed.
- Notion-like block familiarity without Notion clutter.
- Apple Notes warmth.

Avoid generic SaaS dashboard aesthetics. No heavy shadows, gradients, noisy panels, or gratuitous chrome.

Suggested qualities:

- Warm white/off-white canvas.
- Excellent prose typography.
- Muted sidebar.
- Crisp dividers.
- Generous whitespace.
- Beautiful empty states.
- Subtle microinteractions only via `transform` and `opacity`.

## Performance Requirements

Follow Linear-style principles adapted to a file-backed editor.

```txt
keystroke -> local editor state immediately
save queue -> disk write in background
UI never waits for persistence
```

Required:

- Typing must not wait on network or disk.
- Autosave is debounced and non-blocking.
- Disk writes are atomic: write temp file, then rename over old file.
- File list/search uses an index/cache, not recursive filesystem scans on every navigation.
- Editor and sidebar render independently.
- Small metadata changes must not refetch/rerender the whole app.
- Streaming output is buffered/batched before touching Slate state.

Target feel:

- Typing latency: invisible.
- Normal document open: effectively instant after shell load.
- Sidebar updates: async and never blocking editor.
- Save status: quiet, clear, non-intrusive.

## Agent Integration

flyt is agent-native. Agents must operate through stable APIs and canonical files, not a separate AI-only store.

Agents should be able to:

- list entries
- read an entry
- create an entry
- patch an entry
- append to an entry
- stream generated text into an entry
- inspect/update metadata
- attach assets
- create categories/groups
- search the corpus
- operate safely with revisions and conflict handling

### Suggested API Surface

```txt
GET    /api/manifest
GET    /api/entries
POST   /api/entries
GET    /api/entries/:slug
PATCH  /api/entries/:slug
POST   /api/entries/:slug/append
POST   /api/entries/:slug/stream
POST   /api/entries/:slug/assets
GET    /api/search?q=
GET    /api/categories
POST   /api/categories
GET    /api/groups
POST   /api/groups
```

### Manifest Endpoint

`GET /api/manifest` returns enough context for agents to orient themselves cheaply.

```json
{
  "root": "/content",
  "entries": [
    {
      "slug": "product-spec",
      "title": "Product Spec",
      "path": "entries/product-spec/index.md",
      "updatedAt": "2026-05-27T12:00:00Z",
      "category": "specifications",
      "groups": ["flyt"]
    }
  ],
  "categories": ["specifications", "notes", "strategy"]
}
```

### Agent-Safe Patch Operations

Agents should not need to replace entire files for common edits.

MVP operations:

- `append_to_end`
- `prepend_to_start`
- `append_under_heading`
- `replace_heading_section`
- `insert_before_heading`
- `insert_after_heading`
- `replace_exact_range`

All mutations should use version preconditions to avoid overwriting human edits.

Example:

```http
PATCH /api/entries/product-spec
If-Match: "version-42"
```

On conflict:

```json
{
  "error": "version_conflict",
  "currentVersion": 43
}
```

Human visible editor state wins over background agent writes.

## Streaming

flyt supports Proof-style streaming, but faster and safer.

Streaming targets:

- current cursor position
- selected range
- end of document
- under a named heading
- new entry
- side draft panel

Streaming modes:

1. **Inline stream** — generated text appears at cursor.
2. **Replacement stream** — selected text is replaced; original is preserved in undo/revision.
3. **Side draft stream** — generated text appears as an accept/discard candidate.

MVP should prioritize side draft streaming and simple inline continuation.

### Streaming Transport

Use SSE first.

Events:

```txt
stream.started
stream.delta
stream.patch
stream.completed
stream.error
stream.cancelled
```

Do not insert every token directly into Slate. Buffer and batch deltas every 50–100ms or on block/sentence boundaries.

MVP flow:

```txt
agent delta text
-> append to transient stream buffer
-> render live draft/ghost text
-> accept parses Markdown into Slate and inserts
-> autosave
```

Large generations should default to side draft mode. Small continuations may stream inline.

## Conflict and External Edit Handling

If files are edited outside flyt:

- detect timestamp/version mismatch
- warn before overwriting
- offer reload from disk, overwrite, or save copy

Full merge can wait. Silent overwrite is not acceptable.

## Hosting

- Host on `linux02`.
- Run via systemd.
- No auth initially.
- Bind only to trusted LAN/Tailscale/local network.
- Expose with local DNS alias, likely `flyt.local` or `write.local`.

If exposed beyond a trusted network, add at least basic reverse-proxy auth before use.

## MVP Phases

### MVP 1: Writing Spine

- Turborepo workspace with React web app, Express server, and Electron desktop app.
- Filesystem adapter.
- Entry create/read/update/list.
- Markdown load/save.
- Slate editor.
- Autosave.
- `_meta.json` support.
- Home list.
- Recent sidebar.
- Basic formatting.
- Asset upload into `_assets`.
- Local deployment on `linux02`.

### MVP 2: Agent-Native Streaming

- Agent API.
- Manifest endpoint.
- SSE streaming endpoint.
- Side draft streaming.
- Inline continue at cursor.
- Rewrite selected text.
- Stop/accept/discard.
- Event log.
- Version conflict protection.

### MVP 3: Organization and Polish

- Categories/groups UI.
- Search.
- Quick open.
- Command palette.
- Rename/archive/delete.
- File watcher.
- External edit conflict handling.
- Revision snapshots.
- Table editing improvements.
- Typography/design refinement.

## Success Criteria

flyt succeeds when writing feels instant, files remain obvious and portable, and agents can contribute without fighting the UI or corrupting documents.

The product should feel like:

```txt
a quiet, fast, beautiful machine for turning thoughts into durable text
```
