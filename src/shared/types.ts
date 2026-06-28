// Shared contract between the main process, the preload bridge, and the renderer.

/** A single document in the vault. One flat `<file>.md` on disk with YAML frontmatter. */
export interface Doc {
  /** Stable identity, persisted in frontmatter. Survives filename changes. */
  id: string
  /** On-disk filename without the `.md` extension (a slug). Unique within the vault. */
  file: string
  title: string
  tags: string[]
  /** Markdown body (frontmatter stripped). */
  body: string
  /** Epoch ms. */
  created: number
  /** Epoch ms (filesystem mtime, or last write). */
  modified: number
  archived: boolean
}

/** Partial update for a document. Any subset of mutable fields. */
export interface DocPatch {
  title?: string
  file?: string
  tags?: string[]
  body?: string
  archived?: boolean
}

export type EditorWidth = 'narrow' | 'regular' | 'wide'

export interface Settings {
  /** Vault location as the user entered it (may contain a leading `~`). */
  vaultPath: string
  accent: string
  proseSize: number
  editorWidth: EditorWidth
  showPreview: boolean
}

/** Everything the renderer needs to boot. */
export interface VaultSnapshot {
  /** Display path (as entered, may contain `~`). */
  vault: string
  /** Absolute, resolved filesystem path. */
  vaultPath: string
  docs: Doc[]
  settings: Settings
}

export interface MigrateResult {
  ok: boolean
  moved: number
  /** Files that could not be moved and remain in the old vault. */
  failed: number
  /** New display path. */
  vault: string
  /** New absolute path. */
  vaultPath: string
  error?: string
}

/** The API surface exposed on `window.flyt` by the preload bridge. */
export interface FlytApi {
  getSnapshot(): Promise<VaultSnapshot>
  createDoc(): Promise<Doc>
  updateDoc(id: string, patch: DocPatch): Promise<Doc | null>
  upsertDoc(doc: Doc): Promise<Doc>
  deleteDoc(id: string): Promise<{ ok: boolean }>
  migrateVault(newPath: string): Promise<MigrateResult>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  /** Absolute path on disk for a document, or null if it no longer exists. */
  docPath(id: string): Promise<string | null>
  /** Write arbitrary text to the system clipboard (via the main process). */
  copyText(text: string): Promise<void>
  /** Reveal the vault folder in the OS file manager. */
  openVault(): Promise<void>
  /** Subscribe to local vault filesystem changes. Returns an unsubscribe function. */
  onVaultChanged(callback: () => void): () => void
  platform: Platform
}

export type Platform =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd'

export const DEFAULT_SETTINGS: Settings = {
  vaultPath: '~/Documents/Flyt',
  accent: '#b7862f',
  proseSize: 20,
  editorWidth: 'regular',
  showPreview: true
}

export const EDITOR_WIDTHS: Record<EditorWidth, number> = {
  narrow: 680,
  regular: 760,
  wide: 880
}

/** Toolbar actions, in the order the user chose in the design. */
export const TOOLBAR_ACTIONS = ['bold', 'italic', 'code', 'strike', 'link', 'quote', 'list'] as const
export type ToolbarAction = (typeof TOOLBAR_ACTIONS)[number]
