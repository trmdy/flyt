// The Markdown editing surface. CodeMirror 6 holds the canonical Markdown source;
// the livePreview extension renders it inline. Mounts once per document (keyed by id).

import { useEffect, useRef } from 'react'
import { EditorSelection, EditorState, Transaction } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import type { Doc } from '@shared/types'
import { livePreview } from './livePreview'
import { indentLines, toggleInline } from './markdownActions'
import { vimLite, type VimMode } from './vimLite'

interface Props {
  doc: Doc
  vaultPath: string
  onChange: (md: string) => void
  onViewReady: (view: EditorView | null) => void
  onModeChange?: (mode: VimMode) => void
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(avif|bmp|gif|jpe?g|png|svg|tiff?|webp)$/i.test(file.name)
}

function pastedImageFiles(data: DataTransfer | null): File[] {
  if (!data) return []
  const files = Array.from(data.files).filter(isImageFile)
  if (files.length) return files

  return Array.from(data.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file && isImageFile(file))
}

function altFromFilename(name: string): string {
  const base = (name || 'image').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  return (base || 'image').replace(/[\\[\]]/g, '\\$&')
}

function imagePaste(docId: string) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = pastedImageFiles(event.clipboardData)
      if (!files.length) return false

      event.preventDefault()
      const selection = view.state.selection.main

      void (async () => {
        const markdown: string[] = []
        for (const file of files) {
          const saved = await window.flyt.saveAsset(docId, {
            name: file.name,
            mimeType: file.type,
            data: await file.arrayBuffer()
          })
          markdown.push(`![${altFromFilename(file.name)}](${saved.markdownPath})`)
        }

        const insert = markdown.join('\n')
        const from = Math.min(selection.from, view.state.doc.length)
        const to = Math.min(selection.to, view.state.doc.length)
        view.dispatch({
          changes: { from, to, insert },
          selection: EditorSelection.cursor(from + insert.length)
        })
        view.focus()
      })().catch((error) => {
        console.error('Failed to paste image', error)
      })

      return true
    }
  })
}

export function CodeMirrorEditor({ doc, vaultPath, onChange, onViewReady, onModeChange }: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const previewContextRef = useRef({ vaultPath, docFile: doc.file })
  const applyingExternalUpdate = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onReadyRef = useRef(onViewReady)
  onReadyRef.current = onViewReady
  const onModeRef = useRef(onModeChange)
  onModeRef.current = onModeChange
  previewContextRef.current = { vaultPath, docFile: doc.file }

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
          { key: 'Tab', run: (v) => (indentLines(v, 'in'), true) },
          { key: 'Shift-Tab', run: (v) => (indentLines(v, 'out'), true) },
          ...historyKeymap,
          ...defaultKeymap
        ]),
        markdown({ base: markdownLanguage }),
        livePreview({
          getContext: () => previewContextRef.current,
          openLink: (href) => {
            void window.flyt.openLink(href)
          }
        }),
        imagePaste(doc.id),
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

  useEffect(() => {
    viewRef.current?.dispatch({})
  }, [doc.file, vaultPath])

  return <div className="flyt-cm" ref={hostRef} />
}
