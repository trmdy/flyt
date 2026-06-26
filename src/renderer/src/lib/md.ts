// Renderer-side text helpers: slugs, tag colors, relative dates, previews.
// Ported from the design's md.jsx / Root.jsx so behavior matches the mockup.

import type { Doc } from '@shared/types'

/** Title -> filename slug. */
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

/** True when the filename still tracks the title (auto-generated, not hand-edited). */
export function isAutoFile(file: string, title: string): boolean {
  if (!file) return true
  const slug = slugify(title)
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('^' + escaped + '(-\\d+)?$').test(file)
}

const TAG_PALETTE = [
  '#b8862f',
  '#6b7a3a',
  '#9a6b94',
  '#b65838',
  '#3a6b8a',
  '#7a8a3a',
  '#8a5a9a',
  '#3a8a7a',
  '#a8742f',
  '#5a6b9a'
]
const KNOWN: Record<string, string> = {
  spec: '#b8862f',
  note: '#6b7a3a',
  plan: '#9a6b94',
  brief: '#b65838',
  research: '#3a6b8a'
}

/** Stable color for a tag (curated hues for known tags, hashed otherwise). */
export function tagColor(tag: string): string {
  const k = (tag || '').toLowerCase()
  if (KNOWN[k]) return KNOWN[k]
  let h = 0
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0
  return TAG_PALETTE[h % TAG_PALETTE.length]
}

/** Plain-text excerpt of Markdown for list previews. */
export function excerpt(md: string, len = 140): string {
  const s = (md || '')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/[*_`~>#-]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return s.length > len ? s.slice(0, len).trim() + '…' : s
}

/** Relative, human date for the library and palette. */
export function relDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const ms = now.getTime() - d.getTime()
  const day = 86400000
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago'
  if (ms < day && now.getDate() === d.getDate())
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (ms < day * 2) return 'yesterday'
  if (ms < day * 7) return Math.floor(ms / day) + 'd ago'
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' })
}

/** Canonical Markdown for the document (frontmatter + body), used by "copy entire document". */
export function buildDocMarkdown(doc: Doc): string {
  const lines = ['---']
  lines.push('title: ' + (doc.title || 'Untitled'))
  if (doc.tags && doc.tags.length) lines.push('tags: ' + doc.tags.join(', '))
  lines.push('---', '')
  lines.push(doc.body || '')
  return lines.join('\n').trim() + '\n'
}

/** Aggregate tag counts across documents, most-used first. */
export function allTags(docs: Doc[]): { tag: string; count: number }[] {
  const m = new Map<string, number>()
  for (const d of docs) for (const t of d.tags || []) m.set(t, (m.get(t) || 0) + 1)
  return Array.from(m.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}
