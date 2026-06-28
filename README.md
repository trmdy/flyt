# flyt

[![CI](https://github.com/trmdy/flyt/actions/workflows/ci.yml/badge.svg)](https://github.com/trmdy/flyt/actions/workflows/ci.yml)

A fast, beautiful, file-first Markdown editor. **Standalone desktop app** — your
documents are plain `.md` files in one folder on disk (the *vault*), and flyt is a
calm, keyboard-first surface for writing them.

> A clean desk for durable thinking.

## What it is

- **Two views.** A home *library* (search, tags, archive) and a focused *document*
  view with an inline Markdown editor.
- **File-first.** Every document is a flat `<file>.md` in the vault, with YAML
  frontmatter (`title`, `tags`, …). The Markdown on disk is the source of truth.
- **Title ≠ filename.** Both are editable inline; the filename is auto-generated
  from the title the first time, then stays put once you edit it by hand.
- **Tags.** Per-document, with colored swatches and tag filtering on the home view.
- **Live-preview editor.** CodeMirror 6 renders Markdown inline (headings, **bold**,
  *italic*, `code`, ~~strike~~, quotes, lists); syntax markers hide until your cursor
  is on the line.
- **Selection toolbar.** Floats above a selection — bold, italic, code, strike, link,
  quote, list.
- **Command palette (`⌘K`).** Unified action list + document search.
- **Copy shortcuts.** `⌘C ⌘C` copies the whole document; `⇧⌘C ⇧⌘C` copies its path in
  the vault.
- **Configurable vault.** Point flyt at a different folder and it migrates the whole
  vault there, atomically.

### Keyboard

| Shortcut | Action |
| --- | --- |
| `⌘K` | Command palette / search |
| `⌘N` | New document |
| `⇧⌘A` | Toggle archived view |
| `⌘C ⌘C` | Copy entire document |
| `⇧⌘C ⇧⌘C` | Copy path to document |
| `⌘B` / `⌘I` / `⌘E` / `⇧⌘X` | Bold / italic / code / strikethrough |
| `⇧⌘T` | Add a tag |
| `/` | Focus search (home) |
| `Esc` | Close palette / settings |

## Architecture

A single Electron app by default — no server, no network unless optional Flyt sync
is configured.

```
src/
  main/        # owns the vault on disk: index, atomic read/write, rename,
               # delete, migrate, seed (config in the OS userData dir)
  preload/     # contextIsolated bridge → window.flyt (typed, data-only)
  shared/      # types shared across main / preload / renderer
  renderer/    # React + CodeMirror 6 UI (the ported design)
design/        # the original Claude Design handoff, kept for provenance
```

- **Main process** is the only thing that touches the filesystem. It exposes a small
  typed IPC surface (`getSnapshot`, `createDoc`, `updateDoc`, `deleteDoc`,
  `migrateVault`, `setSettings`, `copyText`, `openVault`).
- **Renderer** is optimistic: edits land in local state instantly and disk writes are
  debounced/coalesced, so typing never waits on the filesystem.
- **Optional sync** uses Convex + Better Auth + Trestle Replicate. Local Markdown
  remains the durable mirror; sync can be disabled by leaving cloud env vars unset.
- **Vault layout** is flat:

  ```
  ~/Documents/Flyt/
    agent-handoff-protocol.md
    on-quiet-software.md
    …
  ```

  Each file:

  ```markdown
  ---
  id: d…            # stable identity, survives renames
  title: Agent handoff protocol
  tags:
    - spec
    - plan
  created: '2026-…'
  ---
  When a long-running task crosses a session boundary…
  ```

The default vault is `~/Documents/Flyt`; on first run with an empty vault, a few
sample documents are written so the app isn't empty.

## Development

```bash
npm install
npm run dev        # electron-vite: HMR renderer + live main/preload reload
```

```bash
npm run typecheck  # tsc for node (main/preload) and web (renderer)
npm run build      # production bundle into out/
```

## Packaging (macOS)

```bash
npm run pack:dir   # unpacked, signed Flyt.app into release/mac-arm64/ (fast)
npm run dist       # signed .dmg + .zip into release/
```

Outputs land in `release/` (e.g. `Flyt-<version>-arm64.dmg`). The app icon is
`build/icon.png`; electron-builder generates the `.icns` from it.

### Signing

`electron-builder.yml` pins the **Developer ID Application** certificate by SHA-1
fingerprint and signs with hardened runtime + `build/entitlements.mac.plist`. A
plain `npm run dist` produces a **signed** app. Build it on a different/CI machine
by exporting the cert (`CSC_LINK=cert.p12`, `CSC_KEY_PASSWORD=…`).

### Notarization (for a warning-free install on other Macs)

A signed-but-not-notarized app triggers a Gatekeeper warning when downloaded.
electron-builder notarizes (and staples) automatically when Apple credentials are
present in the environment; without them it just signs:

```bash
# Apple ID + app-specific password (appleid.apple.com → App-Specific Passwords)
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="4QK8JBAU4V"
# (or an App Store Connect API key: APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER)

npm run dist
```

Verify: `xcrun stapler validate "release/mac-arm64/Flyt.app"` and
`spctl -a -vvv -t install "release/mac-arm64/Flyt.app"` → **accepted**.

> **Prerequisite:** the Apple Developer team must have all current legal agreements
> accepted, or notarization fails with `HTTP 403: A required agreement is missing or
> has expired`. The Account Holder accepts them at
> <https://developer.apple.com/account> (and App Store Connect → *Agreements, Tax,
> and Banking*).

### Notes

- Targets `arm64` (Apple Silicon). For Intel support add `x64` (or switch to
  `universal`) under `mac.target` in `electron-builder.yml`.
- A **locally built** app has no quarantine flag, so it runs without a warning even
  before notarization — notarization only matters for apps that are *downloaded*.
- First run creates the default vault at `~/Documents/Flyt` with a few sample docs.

## CI & releasing

- **Develop** with hot reload: `npm run dev` — no rebuild/signing per change.
- **Release** a signed + notarized build to GitHub: `npm run release -- <version>`.
- **CI** typechecks + builds (unsigned) on every push.

Full workflow, prerequisites, and verification steps: **[RELEASING.md](./RELEASING.md)**.

## Tech

Electron · React 18 · TypeScript · electron-vite · CodeMirror 6 · gray-matter ·
Geist / Geist Mono / Newsreader (bundled offline via Fontsource).

See [`PRD.md`](./PRD.md) for the product thinking.

## Optional Sync Backend

The first sync/auth backend foundation lives in `convex/` and is documented in
[`docs/sync-auth.md`](./docs/sync-auth.md). It is intentionally scoped to
personal/single-tenant sync first; billing and paid multi-tenant scoping come later.
