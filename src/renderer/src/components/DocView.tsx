// Document view: inline editable title + filename + tags, wrapping the CodeMirror
// editor and its selection toolbar. Ported from the design's Gen-A FlytDocView.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import type { Doc, DocPatch } from '@shared/types'
import { TOOLBAR_ACTIONS } from '@shared/types'
import { Icon } from './Icon'
import { CodeMirrorEditor } from './editor/CodeMirrorEditor'
import { SelectionToolbar } from './editor/SelectionToolbar'
import type { Action } from './editor/markdownActions'
import { isAutoFile, slugify, tagColor, relDate } from '../lib/md'

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
    <div className="tag-row">
      {tags.map((t) => (
        <span key={t} className="tag-chip">
          <span className="swatch" style={{ background: tagColor(t) }} />
          {t}
          <button className="rm" onClick={() => onRemove(t)} title="Remove tag">
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
      <div className="tag-add">
        {adding ? (
          <>
            <input
              ref={inputRef}
              className="tag-add-input"
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
              <div className="tag-suggest">
                {suggestions.map((s, i) => (
                  <div
                    key={s.tag + String(s.isNew)}
                    className={'tag-suggest-item' + (i === hi ? ' active' : '')}
                    onMouseEnter={() => setHi(i)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      commitContinue(s.tag)
                    }}
                  >
                    <span className="swatch" style={{ background: tagColor(s.tag) }} />
                    {s.tag}
                    {s.isNew && <span className="new">create</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <button className="tag-add-btn" onClick={() => setAdding(true)}>
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
  const [view, setView] = useState<EditorView | null>(null)
  const [tagSignal, setTagSignal] = useState(0)

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
        setTagSignal((s) => s + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Load the title into the contentEditable only when the document changes.
  useEffect(() => {
    if (loadedId.current !== doc.id && titleRef.current) {
      loadedId.current = doc.id
      titleRef.current.textContent = doc.title || ''
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
      view.focus()
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
    view.focus()
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
          view!.contentDOM.blur()
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
      <div className="bar doc-bar">
        <div className="doc-bar-side left">
          <button className="icon-btn" onClick={onBack} title="Back to library">
            <Icon name="arrow-corner" size={17} />
          </button>
        </div>
        <div className="doc-bar-meta">
          <input
            className="fname-field"
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
          <span className="fname-path">.md</span>
        </div>
        <div className="doc-bar-side right">
          <div className={'save-dot' + (saving ? ' saving' : '')}>
            <span className="d" /> {saving ? 'saving…' : 'saved'}
          </div>
          <button className="icon-btn" onClick={onOpenPalette} title="Command palette (⌘K)">
            <Icon name="command" size={16} />
          </button>
          {doc.archived ? (
            <button className="icon-btn" onClick={() => onRestore(doc.id)} title="Restore document">
              <Icon name="check" size={16} />
            </button>
          ) : (
            <button className="icon-btn" onClick={() => onArchive(doc.id)} title="Archive document">
              <Icon name="archive" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="editor-scroll scroll">
        <div className="editor-col">
          <div
            ref={titleRef}
            className={'doc-title' + (!doc.title ? ' empty-ph' : '')}
            contentEditable
            suppressContentEditableWarning
            data-ph="Untitled"
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
          />
        </div>
      </div>

      {view && <SelectionToolbar view={view} actions={TOOLBAR_ACTIONS as unknown as Action[]} />}

      <div className="statusbar">
        <span className="vault">
          <Icon name="folder" size={12} /> {vault}/{doc.file || 'untitled'}.md
        </span>
        <span className="sep">·</span>
        <span>edited {relDate(doc.modified)}</span>
        <span style={{ marginLeft: 'auto' }} />
        <span className="kbd">⌘C ⌘C</span>
        <span>copy doc</span>
        <span className="sep">·</span>
        <span className="kbd">⇧⌘C ⇧⌘C</span>
        <span>copy path</span>
      </div>
    </>
  )
}
