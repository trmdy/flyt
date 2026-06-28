// The Markdown editing surface. CodeMirror 6 holds the canonical Markdown source;
// the livePreview extension renders it inline. Mounts once per document (keyed by id).

import { useEffect, useRef } from 'react'
import { EditorSelection, EditorState, Transaction } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import type { Doc } from '@shared/types'
import { livePreview } from './livePreview'
import { toggleInline } from './markdownActions'
import { vimLite, type VimMode } from './vimLite'

interface Props {
  doc: Doc
  onChange: (md: string) => void
  onViewReady: (view: EditorView | null) => void
  onModeChange?: (mode: VimMode) => void
}

export function CodeMirrorEditor({ doc, onChange, onViewReady, onModeChange }: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const applyingExternalUpdate = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onReadyRef = useRef(onViewReady)
  onReadyRef.current = onViewReady
  const onModeRef = useRef(onModeChange)
  onModeRef.current = onModeChange

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const state = EditorState.create({
      doc: doc.body || '',
      extensions: [
        history(),
        keymap.of([
          { key: 'Mod-b', run: (v) => (toggleInline(v, 'bold'), true) },
          { key: 'Mod-i', run: (v) => (toggleInline(v, 'italic'), true) },
          { key: 'Mod-e', run: (v) => (toggleInline(v, 'code'), true) },
          { key: 'Shift-Mod-x', run: (v) => (toggleInline(v, 'strike'), true) },
          ...historyKeymap,
          ...defaultKeymap
        ]),
        markdown({ base: markdownLanguage }),
        livePreview,
        vimLite((m) => onModeRef.current?.(m)),
        EditorView.lineWrapping,
        placeholder('Start writing… use # for headings, - for lists, **bold**.'),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !applyingExternalUpdate.current) onChangeRef.current(u.state.doc.toString())
        })
      ]
    })

    const view = new EditorView({ state, parent: host })
    viewRef.current = view
    onReadyRef.current(view)
    // Focus the editor so it opens ready for vim normal-mode navigation. (Block
    // edits are locked until insert mode, so this never captures stray typing.)
    view.focus()

    return () => {
      onReadyRef.current(null)
      viewRef.current = null
      view.destroy()
    }
    // The component is keyed by doc.id, so a new document remounts this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const next = doc.body || ''
    const current = view.state.doc.toString()
    if (next === current) return

    const selection = view.state.selection.main
    const anchor = Math.min(selection.anchor, next.length)
    const head = Math.min(selection.head, next.length)

    applyingExternalUpdate.current = true
    try {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: next },
        selection: EditorSelection.single(anchor, head),
        annotations: Transaction.addToHistory.of(false)
      })
    } finally {
      applyingExternalUpdate.current = false
    }
  }, [doc.body])

  return <div className="flyt-cm" ref={hostRef} />
}
