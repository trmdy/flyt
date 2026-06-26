// Sample documents written into a fresh, empty vault on first run.
// Transcribed from the design's seed set (leading H1 removed — the title is separate).

const DAY = 1000 * 60 * 60 * 24
const HOUR = 1000 * 60 * 60
const MIN = 1000 * 60

export interface SeedDoc {
  title: string
  file: string
  tags: string[]
  body: string
  /** How long ago the document was created / last modified. */
  createdAgo: number
  modifiedAgo: number
}

export const SEED_DOCS: SeedDoc[] = [
  {
    title: 'Agent handoff protocol',
    file: 'agent-handoff-protocol',
    tags: ['spec', 'plan'],
    createdAgo: DAY * 9,
    modifiedAgo: HOUR * 5,
    body: `When a long-running task crosses a session boundary, the agent needs a way to hand state to its successor without losing the thread. This note sketches the contract.

## The handoff packet

A handoff is a small structured payload, not a transcript. It carries three things:

- **Intent** — what the user actually wants, in one sentence
- **State** — what has been done, what remains
- **Open questions** — anything blocking that needs a human

The successor reads the packet *before* reading history, so it forms intent first and detail second.

## Why not just replay the log?

Replaying is expensive and lossy. A 40-turn transcript costs more to read than the work it describes, and the signal decays. The packet is a deliberate compression — it throws away the path and keeps the position.

> Keep the position, throw away the path.

We version the packet so an older successor can still parse a newer one.`
  },
  {
    title: 'On quiet software',
    file: 'on-quiet-software',
    tags: ['note'],
    createdAgo: DAY * 21,
    modifiedAgo: DAY * 2,
    body: `The best tools disappear. They don't ask for attention; they return it. A quiet tool has no badges, no streaks, no celebratory confetti when you finish a sentence.

Quiet is not the same as minimal. Minimal is a visual budget. Quiet is a *posture* — software that assumes you have somewhere to be and gets out of the way.

The test: after an hour of use, do you remember the app, or do you remember the work? If you remember the app, it was too loud.`
  },
  {
    title: 'Vault migration design',
    file: 'vault-migration-design',
    tags: ['spec', 'research'],
    createdAgo: DAY * 4,
    modifiedAgo: DAY * 1,
    body: `Flyt stores everything in a single configurable folder — the *vault*. Changing the vault location should move every document, atomically, with no orphans.

## Requirements

- The path is the only configuration that matters.
- Changing it migrates the whole vault, not a subset.
- A migration is reversible until confirmed.

## Flow

1. User edits the path in Settings.
2. We compute the diff — every file's old path vs. new path.
3. A confirm step shows the count and the destination.
4. On confirm, files move and paths update in one pass.

The migration never silently merges into a folder that already has content. If it would, we ask.`
  },
  {
    title: 'Reading list — Q2',
    file: 'reading-list-q2',
    tags: ['note', 'research'],
    createdAgo: DAY * 30,
    modifiedAgo: DAY * 11,
    body: `A running list. Crossed-out means finished.

- ~~The Timeless Way of Building~~
- Notes on the Synthesis of Form
- ~~Understanding Comics~~
- The Design of Everyday Things
- A Pattern Language

## Notes

Alexander keeps coming up. The thread between *quality without a name* and good software interfaces is worth a longer piece.`
  },
  {
    title: 'Selection toolbar — interaction notes',
    file: 'selection-toolbar-notes',
    tags: ['brief'],
    createdAgo: DAY * 2,
    modifiedAgo: MIN * 30,
    body: `The toolbar appears *above* a selection and follows it. It should feel like it belongs to the text, not the chrome.

## Behaviors

- Appears only on a non-collapsed selection inside the document.
- Tracks the selection's bounding box; re-anchors on scroll.
- Dismisses the moment the selection collapses.
- Each action is reversible — toggle, don't stack.

Keep it small. Seven actions is the ceiling: **bold**, *italic*, \`code\`, link, ~~strike~~, quote, list. Anything more belongs in the command palette.`
  }
]
