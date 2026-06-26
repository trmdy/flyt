// ⌘K command palette — unified action list + document search. Ported from Gen-A FlytPalette.
// Styled with StyleX. The overlay keeps a global `.scrim` class: other views detect
// an open palette via document.querySelector('.scrim').

import { useEffect, useMemo, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import type { Doc } from '@shared/types'
import { Icon } from './Icon'
import { relDate } from '../lib/md'
import { color, font, radius, motion } from '../styles/tokens.stylex'
import { ui, scrollClass } from '../styles/ui.stylex'

const pop = stylex.keyframes({ from: { opacity: 0, transform: 'translateY(-6px) scale(.99)' } })

const s = stylex.create({
  palette: {
    width: 600,
    maxWidth: 'calc(100vw - 60px)',
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    boxShadow: `0 1px 0 rgba(0,0,0,.04), 0 18px 50px rgba(28,25,21,.22), 0 0 0 1px ${color.hair}`,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    animationName: pop,
    animationDuration: '140ms',
    animationTimingFunction: motion.ease
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    paddingBlock: 15,
    paddingInline: 18,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.hair,
    color: color.ink3
  },
  input: {
    borderWidth: 0,
    borderStyle: 'none',
    outline: 0,
    backgroundColor: 'transparent',
    fontSize: 15.5,
    flex: 1,
    color: color.ink,
    letterSpacing: '-0.005em',
    '::placeholder': { color: color.ink4 }
  },
  list: { paddingTop: 5, paddingBottom: 8, maxHeight: '50vh', overflow: 'auto' },
  label: {
    fontFamily: font.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    color: color.ink4,
    paddingTop: 10,
    paddingBottom: 5,
    paddingInline: 18
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingBlock: 9,
    paddingInline: 18,
    cursor: 'pointer',
    fontSize: 14,
    color: color.ink,
    letterSpacing: '-0.005em',
    backgroundColor: 'transparent'
  },
  itemActive: { backgroundColor: color.canvas2 },
  ico: { color: color.ink3, display: 'flex', flex: '0 0 auto' },
  piMain: { minWidth: 0, flex: '1 1 auto', overflow: 'hidden' },
  piTitle: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  piSub: {
    fontFamily: font.mono,
    fontSize: 10.5,
    color: color.ink4,
    marginTop: 2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  meta: {
    marginLeft: 'auto',
    fontFamily: font.mono,
    fontSize: 10.5,
    color: color.ink4,
    flex: '0 0 auto'
  },
  foot: {
    display: 'flex',
    alignItems: 'center',
    paddingBlock: 9,
    paddingInline: 16,
    gap: 16,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: color.hair,
    fontFamily: font.mono,
    fontSize: 10.5,
    color: color.ink4,
    backgroundColor: color.surfaceWarm
  },
  hint: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  empty: { paddingBlock: 28, paddingInline: 18, textAlign: 'center', color: color.ink4, fontSize: 13 }
})

export interface PaletteAction {
  id: string
  label: string
  icon: string
  shortcut?: string
  keywords?: string
  run: () => void
}

interface PaletteProps {
  docs: Doc[]
  actions: PaletteAction[]
  onClose: () => void
  onPickDoc: (id: string) => void
  onRunAction: (action: PaletteAction) => void
}

type Entry = { type: 'action'; item: PaletteAction } | { type: 'doc'; item: Doc }

export function Palette({ docs, actions, onClose, onPickDoc, onRunAction }: PaletteProps): JSX.Element {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const query = q.trim().toLowerCase()

  const matchedActions = useMemo(() => {
    if (!query) return actions
    return actions.filter(
      (a) => a.label.toLowerCase().includes(query) || (a.keywords || '').toLowerCase().includes(query)
    )
  }, [actions, query])

  const matchedDocs = useMemo(() => {
    const list = docs.slice().sort((a, b) => b.modified - a.modified)
    if (!query) return list.slice(0, 6)
    return list.filter(
      (d) =>
        (d.title || 'untitled').toLowerCase().includes(query) ||
        (d.file || '').toLowerCase().includes(query) ||
        (d.body || '').toLowerCase().includes(query) ||
        (d.tags || []).some((t) => t.toLowerCase().includes(query))
    )
  }, [docs, query])

  const flat: Entry[] = useMemo(
    () => [
      ...matchedActions.map((a): Entry => ({ type: 'action', item: a })),
      ...matchedDocs.map((d): Entry => ({ type: 'doc', item: d }))
    ],
    [matchedActions, matchedDocs]
  )

  useEffect(() => {
    setHi(0)
  }, [q])
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [hi])

  const choose = (entry: Entry | undefined): void => {
    if (!entry) return
    if (entry.type === 'action') onRunAction(entry.item)
    else onPickDoc(entry.item.id)
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((h) => Math.min(h + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(flat[hi])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div {...stylex.props(s.palette)} onMouseDown={(e) => e.stopPropagation()}>
        <div {...stylex.props(s.inputRow)}>
          <Icon name="search" size={17} />
          <input
            {...stylex.props(s.input)}
            ref={inputRef}
            value={q}
            placeholder="Search documents or run a command…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          <span {...stylex.props(ui.kbd)}>esc</span>
        </div>

        <div className={scrollClass(stylex.props(s.list))} ref={listRef}>
          {matchedActions.length > 0 && <div {...stylex.props(s.label)}>Actions</div>}
          {matchedActions.map((a, ai) => {
            const i = ai
            return (
              <div
                key={a.id}
                {...stylex.props(s.item, i === hi && s.itemActive)}
                data-active={i === hi || undefined}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onRunAction(a)
                }}
              >
                <span {...stylex.props(s.ico)}>
                  <Icon name={a.icon} size={16} />
                </span>
                <div {...stylex.props(s.piMain)}>
                  <div {...stylex.props(s.piTitle)}>{a.label}</div>
                </div>
                {a.shortcut && <span {...stylex.props(s.meta)}>{a.shortcut}</span>}
              </div>
            )
          })}

          {matchedDocs.length > 0 && (
            <div {...stylex.props(s.label)}>{query ? 'Documents' : 'Recent'}</div>
          )}
          {matchedDocs.map((d, di) => {
            const i = matchedActions.length + di
            return (
              <div
                key={d.id}
                {...stylex.props(s.item, i === hi && s.itemActive)}
                data-active={i === hi || undefined}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPickDoc(d.id)
                }}
              >
                <span {...stylex.props(s.ico)}>
                  <Icon name="doc" size={16} />
                </span>
                <div {...stylex.props(s.piMain)}>
                  <div {...stylex.props(s.piTitle)}>{d.title || 'Untitled'}</div>
                  <div {...stylex.props(s.piSub)}>
                    {(d.file || 'untitled') + '.md'}
                    {d.tags && d.tags.length ? '  ·  ' + d.tags.join(', ') : ''}
                  </div>
                </div>
                <span {...stylex.props(s.meta)}>{relDate(d.modified)}</span>
              </div>
            )
          })}

          {flat.length === 0 && <div {...stylex.props(s.empty)}>No matches for “{q}”.</div>}
        </div>

        <div {...stylex.props(s.foot)}>
          <span {...stylex.props(s.hint)}>
            <span {...stylex.props(ui.kbd)}>↑↓</span> navigate
          </span>
          <span {...stylex.props(s.hint)}>
            <span {...stylex.props(ui.kbd)}>↵</span> open
          </span>
          <span {...stylex.props(s.hint)}>
            <span {...stylex.props(ui.kbd)}>esc</span> dismiss
          </span>
          <span {...stylex.props(s.hint, ui.pushRight)}>{docs.length} documents</span>
        </div>
      </div>
    </div>
  )
}
