// Floating toolbar that tracks a non-collapsed selection inside the editor and
// applies Markdown formatting. Morphs into a URL entry field for links.
// Ported from the design's Gen-A SelectionToolbar, wired to CodeMirror commands.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import * as stylex from '@stylexjs/stylex'
import type { EditorView } from '@codemirror/view'
import { Icon } from '../Icon'
import { applyLink, computeActive, runAction, type Action } from './markdownActions'
import { color, font, motion } from '../../styles/tokens.stylex'

const selIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translate(-50%, calc(-100% + 5px))' }
})

const s = stylex.create({
  toolbar: {
    position: 'fixed',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 1,
    padding: 3,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.hairStrong,
    borderRadius: 9,
    boxShadow: '0 1px 0 rgba(0,0,0,.02), 0 8px 26px rgba(28,25,21,.13), 0 1px 3px rgba(28,25,21,.07)',
    zIndex: 60,
    userSelect: 'none',
    transform: 'translate(-50%, -100%)',
    animationName: selIn,
    animationDuration: '120ms',
    animationTimingFunction: motion.ease
  },
  btn: {
    minWidth: 30,
    height: 30,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: { default: 'transparent', ':hover': color.canvas2 },
    borderRadius: 6,
    color: { default: color.ink2, ':hover': color.ink },
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBlock: 0,
    paddingInline: 6,
    fontSize: 13.5,
    transitionProperty: 'background-color, color',
    transitionTimingFunction: motion.ease,
    transitionDuration: motion.fast
  },
  btnActive: {
    backgroundColor: 'color-mix(in srgb, var(--accent) 16%, transparent)',
    color: color.ink
  },
  divider: { width: 1, height: 17, backgroundColor: color.hair, marginBlock: 0, marginInline: 3 },
  linkInput: {
    borderWidth: 0,
    borderStyle: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontFamily: font.ui,
    fontSize: 13,
    color: color.ink,
    paddingBlock: 0,
    paddingInline: 8,
    width: 200,
    '::placeholder': { color: color.ink4 }
  },
  group: { display: 'inline-flex', alignItems: 'center' },
  iBold: { fontWeight: 700 },
  iItalic: { fontFamily: font.prose, fontStyle: 'italic' },
  iStrike: { textDecoration: 'line-through' },
  iCode: {
    fontFamily: font.mono,
    fontSize: 12,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderStyle: 'none',
    padding: 0
  },
  iQuote: { fontFamily: font.prose, fontSize: 17, lineHeight: 1 }
})

const ICONS: Record<Action, ReactNode> = {
  bold: <b {...stylex.props(s.iBold)}>B</b>,
  italic: <i {...stylex.props(s.iItalic)}>i</i>,
  strike: <span {...stylex.props(s.iStrike)}>S</span>,
  code: <code {...stylex.props(s.iCode)}>{'</>'}</code>,
  link: <Icon name="link" size={15} />,
  quote: <span {...stylex.props(s.iQuote)}>&ldquo;</span>,
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
      {...stylex.props(s.toolbar)}
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {linkMode ? (
        <>
          <Icon name="link" size={15} style={{ color: 'var(--ink-3)', marginLeft: 6 }} />
          <input
            ref={linkInputRef}
            {...stylex.props(s.linkInput)}
            placeholder="Paste or type a URL…"
            value={linkVal}
            onChange={(e) => setLinkVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitLink()
              if (e.key === 'Escape') setLinkMode(false)
            }}
          />
          <button
            {...stylex.props(s.btn)}
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
            <span key={a} {...stylex.props(s.group)}>
              {needDivider && <span {...stylex.props(s.divider)} />}
              <button
                {...stylex.props(s.btn, active[a] && s.btnActive)}
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
