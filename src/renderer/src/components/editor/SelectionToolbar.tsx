// Floating toolbar that tracks a non-collapsed selection inside the editor and
// applies Markdown formatting. Morphs into a URL entry field for links.
// Ported from the design's Gen-A SelectionToolbar, wired to CodeMirror commands.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { EditorView } from '@codemirror/view'
import { Icon } from '../Icon'
import { applyLink, computeActive, runAction, type Action } from './markdownActions'

const ICONS: Record<Action, ReactNode> = {
  bold: <b>B</b>,
  italic: <i>i</i>,
  strike: <span className="stk">S</span>,
  code: <code>{'</>'}</code>,
  link: <Icon name="link" size={15} />,
  quote: <span style={{ fontFamily: 'var(--prose)', fontSize: 17, lineHeight: 1 }}>&ldquo;</span>,
  list: <Icon name="doc-lines" size={15} />
}
const LABELS: Record<Action, string> = {
  bold: 'Bold ⌘B',
  italic: 'Italic ⌘I',
  strike: 'Strikethrough',
  code: 'Code',
  link: 'Link',
  quote: 'Quote',
  list: 'Bullet list'
}

interface Props {
  view: EditorView
  actions: Action[]
}

export function SelectionToolbar({ view, actions }: Props): JSX.Element | null {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [active, setActive] = useState<Partial<Record<Action, boolean>>>({})
  const [linkMode, setLinkMode] = useState(false)
  const [linkVal, setLinkVal] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)
  const linkModeRef = useRef(false)
  linkModeRef.current = linkMode

  const update = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setPos(null)
      return
    }
    const range = sel.getRangeAt(0)
    if (!view.contentDOM.contains(range.commonAncestorContainer)) {
      setPos(null)
      return
    }
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setPos(null)
      return
    }
    setPos({ top: rect.top - 9, left: rect.left + rect.width / 2 })
    setActive(computeActive(view))
  }, [view])

  useEffect(() => {
    const onSel = (): void => {
      if (!linkModeRef.current) update()
    }
    document.addEventListener('selectionchange', onSel)
    const inner = view.scrollDOM
    const outer = view.dom.closest('.editor-scroll')
    inner.addEventListener('scroll', onSel, { passive: true })
    outer?.addEventListener('scroll', onSel, { passive: true })
    return () => {
      document.removeEventListener('selectionchange', onSel)
      inner.removeEventListener('scroll', onSel)
      outer?.removeEventListener('scroll', onSel)
    }
  }, [view, update])

  if (!pos) return null

  const fire = (action: Action): void => {
    if (action === 'link') {
      setLinkVal('')
      setLinkMode(true)
      setTimeout(() => linkInputRef.current?.focus(), 0)
      return
    }
    runAction(view, action)
    setTimeout(() => setActive(computeActive(view)), 0)
  }

  const submitLink = (): void => {
    applyLink(view, linkVal.trim() || '#')
    setLinkMode(false)
    setPos(null)
  }

  return createPortal(
    <div
      className="sel-toolbar"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {linkMode ? (
        <>
          <Icon name="link" size={15} style={{ color: 'var(--ink-3)', marginLeft: 6 }} />
          <input
            ref={linkInputRef}
            className="st-link-input"
            placeholder="Paste or type a URL…"
            value={linkVal}
            onChange={(e) => setLinkVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitLink()
              if (e.key === 'Escape') setLinkMode(false)
            }}
          />
          <button
            className="st-btn"
            onMouseDown={(e) => {
              e.preventDefault()
              submitLink()
            }}
            title="Apply"
          >
            <Icon name="check" size={15} />
          </button>
        </>
      ) : (
        actions.map((a) => {
          const needDivider = a === 'link' || a === 'quote'
          return (
            <span key={a} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {needDivider && <span className="st-divider" />}
              <button
                className={'st-btn' + (active[a] ? ' active' : '')}
                title={LABELS[a]}
                onMouseDown={(e) => {
                  e.preventDefault()
                  fire(a)
                }}
              >
                {ICONS[a]}
              </button>
            </span>
          )
        })
      )}
    </div>,
    document.body
  )
}
