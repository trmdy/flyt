// The vault: a flat folder of `<file>.md` documents with YAML frontmatter.
// index.md-style canonical Markdown is the source of truth; this module reads,
// writes (atomically), renames, deletes, seeds, and migrates that folder.

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  renameSync,
  unlinkSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  utimesSync
} from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import type { Doc, DocPatch, MigrateResult } from '@shared/types'
import { vaultAbsPath, setVaultPath, expandTilde, seededVaults, markSeeded } from './config'
import { SEED_DOCS } from './seed'

// id -> current filename slug, rebuilt on every scan and kept fresh on writes.
const indexById = new Map<string, string>()

function uid(): string {
  return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function slugify(title: string): string {
  return (
    (title || 'untitled')
      .toLowerCase()
      .replace(/['’"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled'
  )
}

function normalizeTags(t: unknown): string[] {
  if (Array.isArray(t)) return t.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
  if (typeof t === 'string') {
    return t
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  }
  return []
}

function toEpoch(v: unknown, fallback: number): number {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Date.parse(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

export function ensureVault(): string {
  const dir = vaultAbsPath()
  mkdirSync(dir, { recursive: true })
  return dir
}

function docFromFile(dir: string, filename: string): Doc | null {
  if (!filename.endsWith('.md') || filename.startsWith('.')) return null
  const full = join(dir, filename)
  let raw: string
  let stat
  try {
    raw = readFileSync(full, 'utf8')
    stat = statSync(full)
  } catch {
    return null
  }
  let data: Record<string, unknown> = {}
  let content = raw
  try {
    const parsed = matter(raw)
    data = (parsed.data ?? {}) as Record<string, unknown>
    content = parsed.content
  } catch {
    // Malformed frontmatter — treat the whole file as body.
  }
  const file = filename.slice(0, -3)
  // Coerce non-string scalar titles (a frontmatter `title: 2024` parses to a
  // number/Date) instead of discarding them.
  const rawTitle = data.title
  const title = rawTitle == null ? '' : typeof rawTitle === 'string' ? rawTitle : String(rawTitle)
  return {
    id: String(data.id || file),
    file,
    title,
    tags: normalizeTags(data.tags),
    body: content.replace(/^\n+/, ''),
    created: toEpoch(data.created, stat.birthtimeMs || stat.mtimeMs),
    modified: stat.mtimeMs,
    archived: data.archived === true
  }
}

/** Serialize a document to canonical Markdown with frontmatter. */
function serialize(doc: Doc): string {
  const data: Record<string, unknown> = { id: doc.id, title: doc.title || 'Untitled' }
  if (doc.tags.length) data.tags = doc.tags
  data.created = new Date(doc.created).toISOString()
  if (doc.archived) data.archived = true
  const body = (doc.body || '').replace(/^\n+/, '').replace(/\s+$/, '')
  return matter.stringify(body ? body + '\n' : '\n', data)
}

function atomicWrite(full: string, content: string): void {
  const tmp = `${full}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, full)
}

/** Pick a unique slug within the vault, optionally ignoring one doc's own current file. */
function ensureUniqueFile(base: string, exceptId?: string): string {
  const dir = vaultAbsPath()
  const safeBase = slugify(base)
  const exceptFile = exceptId ? indexById.get(exceptId) : undefined
  const conflict = (f: string): boolean => {
    if (f === exceptFile) return false
    for (const [id, file] of indexById) if (id !== exceptId && file === f) return true
    return existsSync(join(dir, f + '.md'))
  }
  let candidate = safeBase
  let n = 2
  while (conflict(candidate)) candidate = `${safeBase}-${n++}`
  return candidate
}

/** Read every document from disk and rebuild the id index. Sorted newest-first. */
export function scan(): Doc[] {
  const dir = ensureVault()
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    names = []
  }
  indexById.clear()
  const docs: Doc[] = []
  const seen = new Set<string>()
  for (const name of names) {
    const d = docFromFile(dir, name)
    if (!d) continue
    // On an id collision (e.g. a file duplicated in Finder shares a frontmatter
    // id), fall back to the filename as a synthetic id rather than silently
    // dropping the document — filenames are unique within the folder.
    if (seen.has(d.id)) d.id = d.file
    if (seen.has(d.id)) continue
    seen.add(d.id)
    docs.push(d)
    indexById.set(d.id, d.file)
  }
  docs.sort((a, b) => b.modified - a.modified)
  return docs
}

export function createDoc(): Doc {
  const dir = ensureVault()
  // Refresh the index so uniqueness checks see files created outside the app.
  if (indexById.size === 0) scan()
  const now = Date.now()
  const doc: Doc = {
    id: uid(),
    file: ensureUniqueFile('untitled'),
    title: '',
    tags: [],
    body: '',
    created: now,
    modified: now,
    archived: false
  }
  atomicWrite(join(dir, doc.file + '.md'), serialize(doc))
  indexById.set(doc.id, doc.file)
  return doc
}

export function updateDoc(id: string, patch: DocPatch): Doc | null {
  const dir = ensureVault()
  if (!indexById.has(id)) scan()
  const curFile = indexById.get(id)
  if (curFile == null) return null

  const current = docFromFile(dir, curFile + '.md')
  if (!current) {
    indexById.delete(id)
    return null
  }

  const next: Doc = { ...current }
  if (patch.title !== undefined) next.title = patch.title
  if (patch.tags !== undefined) next.tags = normalizeTags(patch.tags)
  if (patch.body !== undefined) next.body = patch.body
  if (patch.archived !== undefined) next.archived = patch.archived

  let targetFile = curFile
  if (patch.file !== undefined) {
    targetFile = ensureUniqueFile(patch.file || 'untitled', id)
  }
  next.file = targetFile
  next.created = current.created
  next.modified = Date.now()

  const targetPath = join(dir, targetFile + '.md')
  atomicWrite(targetPath, serialize(next))
  if (targetFile !== curFile) {
    try {
      unlinkSync(join(dir, curFile + '.md'))
    } catch {
      // old file already gone — fine.
    }
  }
  indexById.set(id, targetFile)
  return docFromFile(dir, targetFile + '.md') ?? next
}

export function upsertDoc(input: Doc): Doc {
  const dir = ensureVault()
  if (!indexById.has(input.id)) scan()

  const currentFile = indexById.get(input.id)
  const file = ensureUniqueFile(input.file || input.title || 'untitled', input.id)
  const now = Date.now()
  const doc: Doc = {
    id: input.id,
    file,
    title: input.title,
    tags: normalizeTags(input.tags),
    body: input.body,
    created: input.created || now,
    modified: input.modified || now,
    archived: input.archived === true
  }

  atomicWrite(join(dir, file + '.md'), serialize(doc))
  if (currentFile && currentFile !== file) {
    try {
      unlinkSync(join(dir, currentFile + '.md'))
    } catch {
      // old file already gone — fine.
    }
  }
  indexById.set(doc.id, file)
  return docFromFile(dir, file + '.md') ?? doc
}

export function deleteDoc(id: string): { ok: boolean } {
  const dir = ensureVault()
  if (!indexById.has(id)) scan()
  const file = indexById.get(id)
  if (file == null) return { ok: false }
  try {
    unlinkSync(join(dir, file + '.md'))
  } catch {
    // already gone
  }
  indexById.delete(id)
  return { ok: true }
}

export function docPath(id: string): string | null {
  if (!indexById.has(id)) scan()
  const file = indexById.get(id)
  if (file == null) return null
  const full = join(vaultAbsPath(), file + '.md')
  return existsSync(full) ? full : null
}

/** Move every `.md` from the current vault to a new location and repoint config. */
export function migrateVault(rawNewPath: string): MigrateResult {
  const oldAbs = vaultAbsPath()
  const newDisplay = (rawNewPath || '').trim().replace(/[/\\]+$/, '')
  const newAbs = expandTilde(newDisplay)

  if (!newDisplay) {
    return { ok: false, moved: 0, failed: 0, vault: rawNewPath, vaultPath: newAbs, error: 'Empty path' }
  }
  if (newAbs === oldAbs) {
    setVaultPath(newDisplay)
    return { ok: true, moved: 0, failed: 0, vault: newDisplay, vaultPath: newAbs }
  }

  try {
    mkdirSync(newAbs, { recursive: true })
  } catch (e) {
    return {
      ok: false,
      moved: 0,
      failed: 0,
      vault: oldAbs,
      vaultPath: oldAbs,
      error: `Could not create ${newAbs}: ${(e as Error).message}`
    }
  }

  const names = existsSync(oldAbs)
    ? readdirSync(oldAbs).filter((n) => n.endsWith('.md') && !n.startsWith('.'))
    : []

  let moved = 0
  let failed = 0
  for (const name of names) {
    const from = join(oldAbs, name)
    let to = join(newAbs, name)
    if (existsSync(to)) {
      // Never clobber an existing file in the destination — suffix instead.
      const base = name.slice(0, -3)
      let n = 2
      while (existsSync(join(newAbs, `${base}-${n}.md`))) n++
      to = join(newAbs, `${base}-${n}.md`)
    }
    try {
      renameSync(from, to)
      moved++
    } catch {
      // Cross-device move: copy then remove.
      try {
        copyFileSync(from, to)
        unlinkSync(from)
        moved++
      } catch {
        // Could not move this file — leave the source in place and report it.
        failed++
      }
    }
  }

  setVaultPath(newDisplay)
  // The destination is already considered "seeded" — don't drop samples into it.
  markSeeded(newAbs)
  scan()
  return {
    ok: true,
    moved,
    failed,
    vault: newDisplay,
    vaultPath: newAbs,
    error: failed > 0 ? `${failed} file${failed === 1 ? '' : 's'} could not be moved and remain in ${oldAbs}` : undefined
  }
}

/** On first encounter with an empty vault, write the sample documents. */
export function maybeSeed(): void {
  const dir = ensureVault()
  const abs = vaultAbsPath()
  if (seededVaults().includes(abs)) return

  const hasMarkdown = readdirSync(dir).some((n) => n.endsWith('.md') && !n.startsWith('.'))
  if (!hasMarkdown) {
    const now = Date.now()
    for (const s of SEED_DOCS) {
      const doc: Doc = {
        id: uid(),
        file: ensureUniqueFile(s.file),
        title: s.title,
        tags: s.tags,
        body: s.body,
        created: now - s.createdAgo,
        modified: now - s.modifiedAgo,
        archived: false
      }
      const full = join(dir, doc.file + '.md')
      atomicWrite(full, serialize(doc))
      indexById.set(doc.id, doc.file)
      // Reflect the intended "last edited" time so the library sorts naturally.
      const when = doc.modified / 1000
      try {
        utimesSync(full, when, when)
      } catch {
        // mtime is cosmetic — ignore if the platform refuses.
      }
    }
  }
  markSeeded(abs)
}
