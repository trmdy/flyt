// Home / library view: search, create, tag filter, archive toggle, entry rows.
// Ported from the design's Gen-A FlytHome. Styled with StyleX.

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as stylex from '@stylexjs/stylex'
import type { Doc } from '@shared/types'
import { Icon } from './Icon'
import { ContextMenu } from './ContextMenu'
import { excerpt, relDate, tagColor } from '../lib/md'
import { color, font, radius, motion } from '../styles/tokens.stylex'
import { ui, scrollClass } from '../styles/ui.stylex'

const s = stylex.create({
  barHome: { paddingInline: 0 },
  barInner: {
    width: '100%',
    maxWidth: 940,
    marginInline: 'auto',
    paddingInline: 32,
    display: 'flex',
    alignItems: 'center',
    gap: 14
  },
  search: {
    flex: '1 1 auto',
    maxWidth: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    color: color.ink3,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.hair, ':focus-within': color.hairStrong },
    borderRadius: radius.md,
    paddingBlock: 7,
    paddingInline: 12,
    transitionProperty: 'border-color',
    transitionTimingFunction: motion.ease,
    transitionDuration: motion.fast
  },
  searchInput: {
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    outline: 'none',
    flex: 1,
    color: color.ink,
    fontSize: 13.5,
    '::placeholder': { color: color.ink4 }
  },
  homeScroll: { flex: '1 1 auto', overflow: 'auto' },
  entries: { maxWidth: 940, marginInline: 'auto', width: '100%', paddingTop: 0, paddingBottom: 64 },
  entriesHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 30,
    paddingBottom: 16,
    paddingInline: 32
  },
  entriesTitle: {
    fontFamily: font.prose,
    fontSize: 27,
    fontWeight: 500,
    letterSpacing: '-0.012em'
  },
  headRight: { display: 'flex', alignItems: 'center', gap: 14 },
  entriesSub: { fontFamily: font.mono, fontSize: 11, color: color.ink4 },
  archiveBtn: {
    fontFamily: font.ui,
    fontSize: 12.5,
    color: { default: color.ink2, ':hover': color.ink },
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.hair, ':hover': color.hairStrong },
    borderRadius: 999,
    paddingTop: 4,
    paddingBottom: 4,
    paddingRight: 11,
    paddingLeft: 9,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transitionProperty: 'all',
    transitionTimingFunction: motion.ease,
    transitionDuration: motion.fast
  },
  archiveBtnActive: {
    backgroundColor: { default: color.ink, ':hover': '#000' },
    color: { default: color.canvas, ':hover': color.canvas },
    borderColor: color.ink
  },
  chips: {
    display: 'flex',
    gap: 6,
    paddingInline: 32,
    paddingBottom: 12,
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  chip: {
    fontFamily: font.ui,
    fontSize: 12.5,
    color: color.ink2,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.hair, ':hover': color.hairStrong },
    borderRadius: 999,
    paddingTop: 3,
    paddingBottom: 4,
    paddingInline: 11,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transitionProperty: 'all',
    transitionTimingFunction: motion.ease,
    transitionDuration: motion.fast
  },
  chipActive: {
    backgroundColor: color.ink,
    color: color.canvas,
    borderColor: color.ink
  },
  ct: { fontFamily: font.mono, fontSize: 10.5, color: color.ink4 },
  ctActive: { color: 'rgba(250,247,241,0.6)' },
  swatch: { width: 6, height: 6, borderRadius: 2, flex: '0 0 auto' },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 92px',
    alignItems: 'baseline',
    paddingBlock: 15,
    paddingInline: 32,
    gap: 20,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: color.hair,
    cursor: 'pointer',
    backgroundColor: { default: 'transparent', ':hover': color.canvas2 },
    transitionProperty: 'background-color',
    transitionTimingFunction: motion.ease,
    transitionDuration: motion.fast,
    ':last-child': { borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: color.hair }
  },
  rowFocused: { backgroundColor: color.canvas2 },
  main: { minWidth: 0 },
  title: {
    fontFamily: font.prose,
    fontSize: 18,
    lineHeight: 1.35,
    fontWeight: 500,
    color: color.ink,
    marginTop: 0,
    marginBottom: 3,
    letterSpacing: '-0.005em'
  },
  preview: {
    fontFamily: font.prose,
    fontSize: 14.5,
    lineHeight: 1.5,
    color: color.ink3,
    marginTop: 0,
    marginBottom: 6,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  fname: { fontFamily: font.mono, fontSize: 10.5, color: color.ink4 },
  tags: {
    display: 'flex',
    gap: 5,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: 220
  },
  date: { fontFamily: font.mono, fontSize: 11, color: color.ink4, textAlign: 'right' },
  rowAction: {
    fontFamily: font.ui,
    fontSize: 12,
    color: { default: color.ink2, ':hover': '#fff' },
    backgroundColor: { default: 'transparent', ':hover': color.moss },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.hairStrong, ':hover': color.moss },
    borderRadius: 999,
    paddingTop: 3,
    paddingBottom: 3,
    paddingRight: 11,
    paddingLeft: 9,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    transitionProperty: 'background-color, border-color, color',
    transitionTimingFunction: motion.ease,
    transitionDuration: motion.fast
  },
  pill: {
    fontFamily: font.mono,
    fontSize: 10,
    color: color.ink2,
    backgroundColor: color.canvas2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.hair,
    borderRadius: 999,
    paddingBlock: 2,
    paddingInline: 8,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    whiteSpace: 'nowrap'
  },
  empty: { textAlign: 'center', paddingBlock: 90, paddingInline: 20, color: color.ink3 },
  emptyBig: { fontFamily: font.prose, fontSize: 20, color: color.ink2, marginBottom: 8 },
  emptySm: { fontSize: 13, color: color.ink4 }
})

function TagPill({ tag }: { tag: string }): JSX.Element {
  return (
    <span {...stylex.props(s.pill)}>
      <span {...stylex.props(s.swatch)} style={{ backgroundColor: tagColor(tag) }} />
      {tag}
    </span>
  )
}

interface HomeProps {
  vault: string
  docs: Doc[]
  query: string
  setQuery: (q: string) => void
  searchRef: RefObject<HTMLInputElement>
  showArchived: boolean
  setShowArchived: (fn: (v: boolean) => boolean) => void
  onOpen: (id: string) => void
  onCreate: () => void
  onRestore: (id: string) => void
  onArchive: (id: string) => void
  onFocusEntry: (id: string | null) => void
  onOpenVault: () => void
}

export function Home({
  vault,
  docs,
  query,
  setQuery,
  searchRef,
  showArchived,
  setShowArchived,
  onOpen,
  onCreate,
  onRestore,
  onArchive,
  onFocusEntry,
  onOpenVault
}: HomeProps): JSX.Element {
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [focusIdx, setFocusIdx] = useState(-1)
  const [menu, setMenu] = useState<{ doc: Doc; x: number; y: number } | null>(null)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const menuRef = useRef(false)
  menuRef.current = !!menu

  useEffect(() => {
    setActiveTag(null)
  }, [showArchived])

  const scoped = useMemo(
    () => docs.filter((d) => (showArchived ? d.archived : !d.archived)),
    [docs, showArchived]
  )
  const archivedCount = useMemo(() => docs.filter((d) => d.archived).length, [docs])
  const activeCount = docs.length - archivedCount

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>()
    scoped.forEach((d) => (d.tags || []).forEach((t) => m.set(t, (m.get(t) || 0) + 1)))
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [scoped])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scoped
      .filter((d) => !activeTag || (d.tags || []).includes(activeTag))
      .filter((d) => {
        if (!q) return true
        return (
          (d.title || 'untitled').toLowerCase().includes(q) ||
          (d.file || '').toLowerCase().includes(q) ||
          (d.body || '').toLowerCase().includes(q) ||
          (d.tags || []).some((t) => t.toLowerCase().includes(q))
        )
      })
      .slice()
      .sort((a, b) => b.modified - a.modified)
  }, [scoped, query, activeTag])

  // Keep the focused index in range as the list changes.
  useEffect(() => {
    setFocusIdx((i) => (filtered.length === 0 ? -1 : Math.min(i, filtered.length - 1)))
  }, [filtered.length])

  // Report the focused document up (so ⌘K can surface its actions).
  const focusedId = focusIdx >= 0 ? (filtered[focusIdx]?.id ?? null) : null
  useEffect(() => {
    onFocusEntry(focusedId)
  }, [focusedId, onFocusEntry])

  // Scroll the focused row into view.
  useEffect(() => {
    if (focusIdx >= 0) rowRefs.current[focusIdx]?.scrollIntoView({ block: 'nearest' })
  }, [focusIdx])

  // j/k + arrows move the focus; Enter opens. ArrowDown from the search box jumps
  // into the list. Disabled while an overlay or the context menu is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (menuRef.current || document.querySelector('.scrim')) return
      const inSearch = document.activeElement === searchRef.current
      const move = (delta: number): void => {
        e.preventDefault()
        if (inSearch) searchRef.current?.blur()
        setFocusIdx((i) => {
          const n = filtered.length
          if (n === 0) return -1
          if (i < 0) return delta > 0 ? 0 : n - 1
          return Math.max(0, Math.min(n - 1, i + delta))
        })
      }
      if (e.key === 'ArrowDown') move(1)
      else if (e.key === 'ArrowUp') move(-1)
      else if (!inSearch && e.key === 'j') move(1)
      else if (!inSearch && e.key === 'k') move(-1)
      else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        const idx = focusIdx >= 0 ? focusIdx : inSearch ? 0 : -1
        const d = idx >= 0 ? filtered[idx] : null
        if (d) {
          e.preventDefault()
          onOpen(d.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtered, focusIdx, searchRef, onOpen])

  return (
    <>
      <div {...stylex.props(ui.bar, s.barHome)}>
        <div {...stylex.props(s.barInner)}>
          <div {...stylex.props(s.search)}>
            <Icon name="search" size={15} />
            <input
              {...stylex.props(s.searchInput)}
              ref={searchRef}
              placeholder={showArchived ? 'Search archived…' : 'Search documents…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button {...stylex.props(ui.iconBtn)} onClick={() => setQuery('')} aria-label="Clear search">
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
          <button {...stylex.props(ui.btnInk)} onClick={onCreate}>
            <Icon name="plus" size={15} /> New
          </button>
        </div>
      </div>

      <div {...stylex.props(s.homeScroll)} className={scrollClass(stylex.props(s.homeScroll))}>
        <div {...stylex.props(s.entries)}>
          <div {...stylex.props(s.entriesHead)}>
            <div {...stylex.props(s.entriesTitle)}>{showArchived ? 'Archived' : 'Library'}</div>
            <div {...stylex.props(s.headRight)}>
              <span {...stylex.props(s.entriesSub)}>
                {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
              </span>
              <button
                {...stylex.props(s.archiveBtn, showArchived && s.archiveBtnActive)}
                onClick={() => setShowArchived((v) => !v)}
                title="⇧⌘A"
              >
                {showArchived ? (
                  <>
                    <Icon name="arrow-corner" size={13} /> Library
                  </>
                ) : (
                  <>
                    <Icon name="archive" size={13} /> Archived{archivedCount > 0 ? ' · ' + archivedCount : ''}
                  </>
                )}
              </button>
            </div>
          </div>

          {tagCounts.length > 0 && (
            <div {...stylex.props(s.chips)}>
              <button
                {...stylex.props(s.chip, !activeTag && s.chipActive)}
                onClick={() => setActiveTag(null)}
              >
                All <span {...stylex.props(s.ct, !activeTag && s.ctActive)}>{scoped.length}</span>
              </button>
              {tagCounts.map(([tag, count]) => (
                <button
                  key={tag}
                  {...stylex.props(s.chip, activeTag === tag && s.chipActive)}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                >
                  <span {...stylex.props(s.swatch)} style={{ backgroundColor: tagColor(tag) }} />
                  {tag} <span {...stylex.props(s.ct, activeTag === tag && s.ctActive)}>{count}</span>
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div {...stylex.props(s.empty)}>
              <div {...stylex.props(s.emptyBig)}>
                {query || activeTag
                  ? 'Nothing matches'
                  : showArchived
                    ? 'No archived documents'
                    : 'Your vault is empty'}
              </div>
              <div {...stylex.props(s.emptySm)}>
                {query || activeTag
                  ? 'Try a different search or filter.'
                  : showArchived
                    ? 'Documents you archive will appear here.'
                    : 'Create your first document to get started.'}
              </div>
            </div>
          ) : (
            filtered.map((d, i) => (
              <div
                key={d.id}
                ref={(el) => {
                  rowRefs.current[i] = el
                }}
                {...stylex.props(s.row, i === focusIdx && s.rowFocused)}
                onClick={() => onOpen(d.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setFocusIdx(i)
                  setMenu({ doc: d, x: e.clientX, y: e.clientY })
                }}
              >
                <div {...stylex.props(s.main)}>
                  <div {...stylex.props(s.title)}>{d.title || 'Untitled'}</div>
                  <div {...stylex.props(s.preview)}>{excerpt(d.body, 150) || 'Empty document'}</div>
                  <div {...stylex.props(s.fname)}>{d.file || 'untitled'}.md</div>
                </div>
                <div {...stylex.props(s.tags)}>
                  {showArchived ? (
                    <button
                      {...stylex.props(s.rowAction)}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRestore(d.id)
                      }}
                    >
                      <Icon name="check" size={13} /> Restore
                    </button>
                  ) : (
                    (d.tags || []).map((t) => <TagPill key={t} tag={t} />)
                  )}
                </div>
                <div {...stylex.props(s.date)}>{relDate(d.modified)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div {...stylex.props(ui.statusbar)}>
        <span {...stylex.props(ui.statusVault)} onClick={onOpenVault}>
          <Icon name="folder" size={12} /> {vault}
        </span>
        <span {...stylex.props(ui.statusSep)}>·</span>
        <span>
          {showArchived
            ? archivedCount + ' archived'
            : activeCount + (activeCount === 1 ? ' file' : ' files')}
        </span>
        <span {...stylex.props(ui.pushRight)} />
        <span {...stylex.props(ui.kbd)}>⇧⌘A</span>
        <span>archived</span>
        <span {...stylex.props(ui.statusSep)}>·</span>
        <span {...stylex.props(ui.kbd)}>⌘K</span>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Open', icon: 'arrow-corner', onSelect: () => onOpen(menu.doc.id) },
            menu.doc.archived
              ? { label: 'Restore', icon: 'check', onSelect: () => onRestore(menu.doc.id) }
              : { label: 'Archive', icon: 'archive', onSelect: () => onArchive(menu.doc.id) }
          ]}
        />
      )}
    </>
  )
}
