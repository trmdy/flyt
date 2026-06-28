// Document view: inline editable title + filename + tags, wrapping the CodeMirror
// editor and its selection toolbar. Ported from the design's Gen-A FlytDocView.
// Styled with StyleX; the contentEditable title keeps a global `.doc-title` class
// (placeholder ::before + a classList focus hook), like the CodeMirror surface.

import { useCallback, useEffect, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import type { EditorView } from '@codemirror/view'
import type { Doc, DocPatch } from '@shared/types'
import { TOOLBAR_ACTIONS } from '@shared/types'
import { Icon } from './Icon'
import { CodeMirrorEditor } from './editor/CodeMirrorEditor'
import { SelectionToolbar } from './editor/SelectionToolbar'
import type { Action } from './editor/markdownActions'
import { getVimMode, setVimMode, type VimMode } from './editor/vimLite'
import { isAutoFile, slugify, tagColor, relDate } from '../lib/md'
import { color, font, radius, motion } from '../styles/tokens.stylex'
import { ui, scrollClass, cx } from '../styles/ui.stylex'

const pulse = stylex.keyframes({ '50%': { opacity: 0.35 } })

const s = stylex.create({
  // paddingLeft via var so the macOS titlebar rule can widen it for the traffic
  // lights (StyleX's specificity hack blocks a plain global override).
  docBar: { gap: 0, paddingLeft: 'var(--doc-bar-pl, 20px)' },
  side: { flex: '1 1 0', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  sideRight: { justifyContent: 'flex-end' },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flex: '0 0 auto',
    justifyContent: 'center'
  },
  fnameField: {
    fontFamily: font.mono,
    fontSize: 12,
    color: { default: color.ink3, ':focus': color.ink },
    backgroundColor: { default: 'transparent', ':hover': color.canvas2, ':focus': color.surface },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: 'transparent', ':focus': color.hairStrong },
    borderRadius: radius.sm,
    paddingBlock: 4,
    paddingInline: 8,
    outline: 'none',
    maxWidth: 360,
    minWidth: 80,
    transitionProperty: 'border-color, background-color',
    transitionTimingFunction: motion.ease,
    transitionDuration: motion.fast
  },
  fnamePath: { fontFamily: font.mono, fontSize: 11, color: color.ink4, whiteSpace: 'nowrap' },
  saveDot: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: font.mono,
    fontSize: 10.5,
    color: color.ink4,
    whiteSpace: 'nowrap'
  },
  dot: { width: 6, height: 6, borderRadius: '50%', backgroundColor: color.moss },
  dotSaving: {
    backgroundColor: 'var(--accent)',
    animationName: pulse,
    animationDuration: '1.2s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite'
  },
  editorScroll: { flex: '1 1 auto', overflow: 'auto' },
  editorCol: {
    maxWidth: 'var(--editor-width, 760px)',
    marginInline: 'auto',
    width: '100%',
    paddingTop: 52,
    paddingInline: 40,
    paddingBottom: 200
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
    marginTop: 0,
    marginBottom: 30
  },
  tagChip: {
    fontFamily: font.mono,
    fontSize: 11,
    color: color.ink2,
    backgroundColor: color.canvas2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.hair,
    borderRadius: 999,
    paddingBlock: 3,
    paddingRight: 6,
    paddingLeft: 9,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7
  },
  swatch: { width: 6, height: 6, borderRadius: 2 },
  rm: {
    width: 14,
    height: 14,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: { default: 'transparent', ':hover': 'rgba(182,88,56,.08)' },
    color: { default: color.ink4, ':hover': color.rust },
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    padding: 0
  },
  tagAdd: { position: 'relative' },
  tagAddBtn: {
    fontFamily: font.mono,
    fontSize: 11,
    color: { default: color.ink4, ':hover': color.ink2 },
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: { default: color.hairStrong, ':hover': color.ink4 },
    borderRadius: 999,
    paddingBlock: 3,
    paddingInline: 10,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    transitionProperty: 'border-color, color',
    transitionTimingFunction: motion.ease,
    transitionDuration: motion.fast
  },
  tagAddInput: {
    fontFamily: font.mono,
    fontSize: 11,
    color: color.ink,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.hairStrong, ':focus': 'var(--accent)' },
    borderRadius: 999,
    paddingBlock: 3,
    paddingInline: 10,
    outline: 'none',
    width: 130
  },
  tagSuggest: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.hair,
    borderRadius: radius.md,
    boxShadow: `0 8px 28px rgba(28,25,21,.14), 0 0 0 1px ${color.hair}`,
    padding: 4,
    minWidth: 150,
    zIndex: 20,
    maxHeight: 220,
    overflow: 'auto'
  },
  suggestItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBlock: 6,
    paddingInline: 9,
    borderRadius: radius.sm,
    fontFamily: font.mono,
    fontSize: 11.5,
    color: { default: color.ink2, ':hover': color.ink },
    cursor: 'pointer',
    backgroundColor: { default: 'transparent', ':hover': color.canvas2 }
  },
  suggestItemActive: { backgroundColor: color.canvas2, color: color.ink },
  suggestSwatch: { width: 7, height: 7, borderRadius: 2 },
  suggestNew: {
    marginLeft: 'auto',
    fontSize: 9.5,
    color: color.ink4,
    textTransform: 'uppercase',
    letterSpacing: '.06em'
  },
  modeTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontFamily: font.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '.09em',
    color: 'var(--accent)'
  },
  modeDot: { width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--accent)' }
})

interface TagEditorProps {
  docId: string
  tags: string[]
  allTags: { tag: string; count: number }[]
  openSignal: number
  onLeaveToBody: () => void
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
}

function TagEditor({ docId, tags, allTags, openSignal, onLeaveToBody, onAdd, onRemove }: TagEditorProps): JSX.Element {
  const [adding, setAdding] = useState(false)
  const [val, setVal] = useState('')
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // ⌘⇧T bumps openSignal to open the tag entry.
  useEffect(() => {
    if (openSignal > 0) {
      setAdding(true)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [openSignal])

  // Reset the adder when switching documents (this is one persistent instance,
  // so an open adder must not bleed onto the next document).
  useEffect(() => {
    setAdding(false)
    setVal('')
    setHi(0)
  }, [docId])

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])
  useEffect(() => {
    setHi(0)
  }, [val])

  const q = val.trim().toLowerCase()
  const pool = allTags.filter((t) => !tags.includes(t.tag))
  const matched = pool.filter((t) => t.tag.toLowerCase().includes(q))
  const list = q ? matched : pool.slice(0, 8)
  const exact = allTags.some((t) => t.tag.toLowerCase() === q) || tags.some((t) => t.toLowerCase() === q)
  const suggestions: { tag: string; isNew: boolean }[] = list.map((t) => ({ tag: t.tag, isNew: false }))
  if (q && !exact) suggestions.unshift({ tag: val.trim(), isNew: true })

  const commitContinue = (tag: string): void => {
    const t = (tag || '').trim()
    if (t) onAdd(t)
    setVal('')
    setHi(0)
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  const commitAndLeave = (tag: string): void => {
    const t = (tag || '').trim()
    if (t) onAdd(t)
    setVal('')
    setAdding(false)
    setTimeout(onLeaveToBody, 0)
  }

  return (
    <div {...stylex.props(s.tagRow)}>
      {tags.map((t) => (
        <span key={t} {...stylex.props(s.tagChip)}>
          <span {...stylex.props(s.swatch)} style={{ backgroundColor: tagColor(t) }} />
          {t}
          <button {...stylex.props(s.rm)} onClick={() => onRemove(t)} title="Remove tag">
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
      <div {...stylex.props(s.tagAdd)}>
        {adding ? (
          <>
            <input
              ref={inputRef}
              {...stylex.props(s.tagAddInput)}
              placeholder="tag…"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={() => setTimeout(() => setAdding(false), 120)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                  e.preventDefault()
                  commitAndLeave(val)
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  commitContinue(suggestions[hi] ? suggestions[hi].tag : val)
                } else if (e.key === 'Escape') {
                  setAdding(false)
                  setVal('')
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setHi((h) => Math.min(h + 1, suggestions.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setHi((h) => Math.max(h - 1, 0))
                }
              }}
            />
            {suggestions.length > 0 && (
              <div {...stylex.props(s.tagSuggest)}>
                {suggestions.map((sg, i) => (
                  <div
                    key={sg.tag + String(sg.isNew)}
                    {...stylex.props(s.suggestItem, i === hi && s.suggestItemActive)}
                    onMouseEnter={() => setHi(i)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      commitContinue(sg.tag)
                    }}
                  >
                    <span {...stylex.props(s.suggestSwatch)} style={{ backgroundColor: tagColor(sg.tag) }} />
                    {sg.tag}
                    {sg.isNew && <span {...stylex.props(s.suggestNew)}>create</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <button {...stylex.props(s.tagAddBtn)} onClick={() => setAdding(true)}>
            <Icon name="plus" size={11} /> tag
          </button>
        )}
      </div>
    </div>
  )
}

interface DocViewProps {
  doc: Doc
  vault: string
  vaultPath: string
  saving: boolean
  allTags: { tag: string; count: number }[]
  onBack: () => void
  onPatch: (patch: DocPatch) => void
  onOpenPalette: () => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
}

export function DocView({
  doc,
  vault,
  saving,
  allTags,
  onBack,
  onPatch,
  onOpenPalette,
  onArchive,
  onRestore
}: DocViewProps): JSX.Element {
  const titleRef = useRef<HTMLDivElement>(null)
  const loadedId = useRef<string | null>(null)
  const titleFocused = useRef(false)
  const [view, setView] = useState<EditorView | null>(null)
  const [tagSignal, setTagSignal] = useState(0)
  const [vimMode, setVimModeState] = useState<VimMode>('normal')

  // Each document mounts a fresh editor (keyed by id) that starts in normal mode.
  useEffect(() => {
    setVimModeState('normal')
  }, [doc.id])

  // Filename field keeps a raw draft while focused (so spaces/caps can be typed)
  // and only slugifies on commit. While unfocused it mirrors the stored file
  // name (which also updates as the title auto-generates it).
  const [fileDraft, setFileDraft] = useState(doc.file)
  const fnameFocused = useRef(false)
  useEffect(() => {
    fnameFocused.current = false
    setFileDraft(doc.file)
  }, [doc.id])
  useEffect(() => {
    if (!fnameFocused.current) setFileDraft(doc.file)
  }, [doc.file])

  // ⌘⇧T focuses tag entry.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setTagSignal((sig) => sig + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Keep the non-React contentEditable in step with document reloads, but do not
  // rewrite it while the user is actively editing the title.
  useEffect(() => {
    const title = doc.title || ''
    if (titleRef.current && (loadedId.current !== doc.id || !titleFocused.current)) {
      loadedId.current = doc.id
      if (titleRef.current.textContent !== title) titleRef.current.textContent = title
    }
  }, [doc.id, doc.title])

  const onTitleInput = useCallback(() => {
    const text = titleRef.current?.textContent ?? ''
    const patch: DocPatch = { title: text }
    if (isAutoFile(doc.file, doc.title)) patch.file = slugify(text)
    onPatch(patch)
  }, [doc.file, doc.title, onPatch])

  const commitFname = useCallback(() => {
    fnameFocused.current = false
    const v = slugify(fileDraft) || 'untitled'
    setFileDraft(v)
    if (v !== doc.file) onPatch({ file: v })
  }, [fileDraft, doc.file, onPatch])

  const focusBody = useCallback(() => {
    if (view) {
      setVimMode(view, 'insert')
      view.dispatch({ selection: { anchor: 0 } })
    }
  }, [view])

  // Track whether the editor was ever focused for this doc, so re-entering an
  // untouched document drops the cursor at the end rather than the start.
  const everFocused = useRef(false)
  useEffect(() => {
    everFocused.current = false
  }, [doc.id])
  useEffect(() => {
    if (!view) return
    const mark = (): void => {
      everFocused.current = true
    }
    view.contentDOM.addEventListener('focus', mark)
    return () => view.contentDOM.removeEventListener('focus', mark)
  }, [view])

  const refocusEditor = useCallback(() => {
    if (!view) return
    // Re-entering from the chrome resumes editing (insert mode).
    setVimMode(view, 'insert')
    // CM keeps the last selection across blur; if the editor was never focused,
    // drop the caret at the end of the document.
    if (!everFocused.current) view.dispatch({ selection: { anchor: view.state.doc.length } })
  }, [view])

  // Esc/Enter focus flow: Esc leaves the editor canvas (cursor retained); a second
  // Esc (focus outside, no field) goes back to the library. Enter from outside
  // re-enters the editor at the last cursor (or end of an untouched doc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (document.querySelector('.scrim')) return // overlays own their keys
      const ae = document.activeElement as HTMLElement | null
      const inEditor = !!view && view.hasFocus
      const inTitle = !!ae && ae.classList.contains('doc-title')
      const inInput = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')

      if (e.key === 'Escape') {
        if (inEditor) {
          e.preventDefault()
          // First Esc drops from insert into block-nav (normal); a second Esc
          // from normal leaves the editor for the chrome.
          if (getVimMode(view!) === 'insert') setVimMode(view!, 'normal')
          else view!.contentDOM.blur()
        } else if (inTitle) {
          e.preventDefault()
          ae!.blur()
        } else if (inInput) {
          // let the field's own Escape handler blur it
        } else {
          e.preventDefault()
          onBack()
        }
      } else if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!inEditor && !inTitle && !inInput) {
          e.preventDefault()
          refocusEditor()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, onBack, refocusEditor])

  return (
    <>
      <div className={cx(stylex.props(ui.bar, s.docBar), 'bar', 'doc-bar')}>
        <div {...stylex.props(s.side)}>
          <button {...stylex.props(ui.iconBtn)} onClick={onBack} title="Back to library">
            <Icon name="arrow-corner" size={17} />
          </button>
        </div>
        <div {...stylex.props(s.meta)}>
          <input
            {...stylex.props(s.fnameField)}
            value={fileDraft || ''}
            spellCheck={false}
            placeholder="untitled"
            onFocus={() => {
              fnameFocused.current = true
            }}
            onChange={(e) => setFileDraft(e.target.value)}
            onBlur={commitFname}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitFname()
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                setFileDraft(doc.file)
                fnameFocused.current = false
                e.currentTarget.blur()
              }
            }}
            title="File name in the vault"
            style={{ width: Math.min(Math.max((fileDraft || 'untitled').length + 2, 11), 42) + 'ch' }}
          />
          <span {...stylex.props(s.fnamePath)}>.md</span>
        </div>
        <div {...stylex.props(s.side, s.sideRight)}>
          <div className={cx(stylex.props(s.saveDot), 'save-dot')}>
            <span {...stylex.props(s.dot, saving && s.dotSaving)} /> {saving ? 'saving…' : 'saved'}
          </div>
          <button {...stylex.props(ui.iconBtn)} onClick={onOpenPalette} title="Command palette (⌘K)">
            <Icon name="command" size={16} />
          </button>
          {doc.archived ? (
            <button {...stylex.props(ui.iconBtn)} onClick={() => onRestore(doc.id)} title="Restore document">
              <Icon name="check" size={16} />
            </button>
          ) : (
            <button {...stylex.props(ui.iconBtn)} onClick={() => onArchive(doc.id)} title="Archive document">
              <Icon name="archive" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className={'editor-scroll ' + scrollClass(stylex.props(s.editorScroll))}>
        <div {...stylex.props(s.editorCol)}>
          <div
            ref={titleRef}
            className={'doc-title' + (!doc.title ? ' empty-ph' : '')}
            contentEditable
            suppressContentEditableWarning
            data-ph="Untitled"
            onFocus={() => {
              titleFocused.current = true
            }}
            onBlur={() => {
              titleFocused.current = false
              const title = doc.title || ''
              if (titleRef.current && titleRef.current.textContent !== title) titleRef.current.textContent = title
            }}
            onInput={onTitleInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                focusBody()
              }
            }}
          />
          <TagEditor
            docId={doc.id}
            tags={doc.tags || []}
            allTags={allTags}
            openSignal={tagSignal}
            onLeaveToBody={focusBody}
            onAdd={(t) => onPatch({ tags: [...(doc.tags || []), t] })}
            onRemove={(t) => onPatch({ tags: (doc.tags || []).filter((x) => x !== t) })}
          />
          <CodeMirrorEditor
            key={doc.id}
            doc={doc}
            onChange={(md) => onPatch({ body: md })}
            onViewReady={setView}
            onModeChange={setVimModeState}
          />
        </div>
      </div>

      {view && <SelectionToolbar view={view} actions={TOOLBAR_ACTIONS as unknown as Action[]} />}

      <div {...stylex.props(ui.statusbar)}>
        <span {...stylex.props(ui.statusVault)}>
          <Icon name="folder" size={12} /> {vault}/{doc.file || 'untitled'}.md
        </span>
        <span {...stylex.props(ui.statusSep)}>·</span>
        <span>edited {relDate(doc.modified)}</span>
        {vimMode === 'normal' && (
          <>
            <span {...stylex.props(ui.statusSep)}>·</span>
            <span {...stylex.props(s.modeTag)}>
              <span {...stylex.props(s.modeDot)} /> normal
            </span>
          </>
        )}
        <span {...stylex.props(ui.pushRight)} />
        <span {...stylex.props(ui.kbd)}>⌘C ⌘C</span>
        <span>copy doc</span>
        <span {...stylex.props(ui.statusSep)}>·</span>
        <span {...stylex.props(ui.kbd)}>⇧⌘C ⇧⌘C</span>
        <span>copy path</span>
      </div>
    </>
  )
}
