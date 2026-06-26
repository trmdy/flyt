// Home / library view: search, create, tag filter, archive toggle, entry rows.
// Ported from the design's Gen-A FlytHome.

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Doc } from '@shared/types'
import { Icon } from './Icon'
import { ContextMenu } from './ContextMenu'
import { excerpt, relDate, tagColor } from '../lib/md'

function TagPill({ tag }: { tag: string }): JSX.Element {
  return (
    <span className="tag-pill">
      <span className="swatch" style={{ background: tagColor(tag) }} />
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
      <div className="bar home-bar">
        <div className="bar-inner">
          <div className="home-search">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              placeholder={showArchived ? 'Search archived…' : 'Search documents…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="icon-btn" onClick={() => setQuery('')} aria-label="Clear search">
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
          <button className="btn-ink" onClick={onCreate}>
            <Icon name="plus" size={15} /> New
          </button>
        </div>
      </div>

      <div className="home-scroll scroll">
        <div className="entries">
          <div className="entries-head">
            <div className="entries-title">{showArchived ? 'Archived' : 'Library'}</div>
            <div className="entries-head-right">
              <span className="entries-sub">
                {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
              </span>
              <button
                className={'head-archive' + (showArchived ? ' active' : '')}
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
            <div className="chips">
              <button
                className={'chip' + (!activeTag ? ' active' : '')}
                onClick={() => setActiveTag(null)}
              >
                All <span className="ct">{scoped.length}</span>
              </button>
              {tagCounts.map(([tag, count]) => (
                <button
                  key={tag}
                  className={'chip' + (activeTag === tag ? ' active' : '')}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                >
                  <span
                    className="swatch"
                    style={{ width: 6, height: 6, borderRadius: 2, background: tagColor(tag) }}
                  />
                  {tag} <span className="ct">{count}</span>
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty">
              <div className="big">
                {query || activeTag
                  ? 'Nothing matches'
                  : showArchived
                    ? 'No archived documents'
                    : 'Your vault is empty'}
              </div>
              <div className="sm">
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
                className={'entry-row' + (i === focusIdx ? ' row-focused' : '')}
                onClick={() => onOpen(d.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setFocusIdx(i)
                  setMenu({ doc: d, x: e.clientX, y: e.clientY })
                }}
              >
                <div className="entry-main">
                  <div className="entry-title">{d.title || 'Untitled'}</div>
                  <div className="entry-preview">{excerpt(d.body, 150) || 'Empty document'}</div>
                  <div className="entry-fname">{d.file || 'untitled'}.md</div>
                </div>
                <div className="entry-tags">
                  {showArchived ? (
                    <button
                      className="row-action"
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
                <div className="entry-date">{relDate(d.modified)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="statusbar">
        <span className="vault" onClick={onOpenVault}>
          <Icon name="folder" size={12} /> {vault}
        </span>
        <span className="sep">·</span>
        <span>
          {showArchived
            ? archivedCount + ' archived'
            : activeCount + (activeCount === 1 ? ' file' : ' files')}
        </span>
        <span style={{ marginLeft: 'auto' }} />
        <span className="kbd">⇧⌘A</span>
        <span>archived</span>
        <span className="sep">·</span>
        <span className="kbd">⌘K</span>
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
