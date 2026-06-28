// Markdown editing commands operating on a CodeMirror selection: toggling inline
// marks (**bold**, *italic*, `code`, ~~strike~~), links, and line prefixes
// (> quote, - list). Active-state detection reads the syntax tree.

import { EditorSelection, type ChangeSpec, type EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'

export type InlineKind = 'bold' | 'italic' | 'code' | 'strike'
export type Action = InlineKind | 'link' | 'quote' | 'list'
type IndentDirection = 'in' | 'out'

const INLINE_NODE: Record<InlineKind, string> = {
  bold: 'StrongEmphasis',
  italic: 'Emphasis',
  code: 'InlineCode',
  strike: 'Strikethrough'
}
const INLINE_MARK: Record<InlineKind, string> = {
  bold: '**',
  italic: '*',
  code: '`',
  strike: '~~'
}
const ACTIVE_NODE: Record<Action, string> = {
  bold: 'StrongEmphasis',
  italic: 'Emphasis',
  code: 'InlineCode',
  strike: 'Strikethrough',
  link: 'Link',
  quote: 'Blockquote',
  list: 'ListItem'
}

function enclosing(state: EditorState, name: string): SyntaxNode | null {
  const pos = state.selection.main.from
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1)
  while (node) {
    if (node.name === name) return node
    node = node.parent
  }
  return null
}

export function isActive(state: EditorState, action: Action): boolean {
  return !!enclosing(state, ACTIVE_NODE[action])
}

export function toggleInline(view: EditorView, kind: InlineKind): void {
  const { state } = view
  const marker = INLINE_MARK[kind]
  const node = enclosing(state, INLINE_NODE[kind])

  if (node) {
    // Unwrap: drop the surrounding markers.
    const text = state.sliceDoc(node.from, node.to)
    let inner = text
    if (text.startsWith(marker) && text.endsWith(marker) && text.length >= marker.length * 2) {
      inner = text.slice(marker.length, text.length - marker.length)
    }
    view.dispatch({
      changes: { from: node.from, to: node.to, insert: inner },
      selection: EditorSelection.range(node.from, node.from + inner.length)
    })
    view.focus()
    return
  }

  const { from, to } = state.selection.main
  if (from === to) {
    view.dispatch({
      changes: { from, insert: marker + marker },
      selection: EditorSelection.cursor(from + marker.length)
    })
  } else {
    const selected = state.sliceDoc(from, to)
    view.dispatch({
      changes: { from, to, insert: marker + selected + marker },
      selection: EditorSelection.range(from + marker.length, to + marker.length)
    })
  }
  view.focus()
}

export function applyLink(view: EditorView, url: string): void {
  const { state } = view
  const href = url || '#'
  const link = enclosing(state, 'Link')
  if (link) {
    const text = state.sliceDoc(link.from, link.to)
    const m = /^\[([^\]]*)\]/.exec(text)
    const label = m ? m[1] : text
    const insert = `[${label}](${href})`
    view.dispatch({
      changes: { from: link.from, to: link.to, insert },
      selection: EditorSelection.cursor(link.from + insert.length)
    })
  } else {
    const { from, to } = state.selection.main
    const label = state.sliceDoc(from, to) || 'link'
    const insert = `[${label}](${href})`
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(from + insert.length)
    })
  }
  view.focus()
}

export function toggleLinePrefix(view: EditorView, kind: 'quote' | 'list'): void {
  const { state } = view
  const sel = state.selection.main
  const re = kind === 'quote' ? /^(\s*)>\s?/ : /^(\s*)[-*]\s+/
  const prefix = kind === 'quote' ? '> ' : '- '

  const startLine = state.doc.lineAt(sel.from).number
  const endLine = state.doc.lineAt(sel.to).number
  const lines = []
  for (let n = startLine; n <= endLine; n++) lines.push(state.doc.line(n))

  const nonBlank = lines.filter((l) => l.text.trim() !== '')
  const everyHas = nonBlank.length > 0 && nonBlank.every((l) => re.test(l.text))

  const changes: ChangeSpec[] = []
  for (const l of lines) {
    if (l.text.trim() === '') continue
    if (everyHas) {
      const m = re.exec(l.text)
      if (m) changes.push({ from: l.from, to: l.from + m[0].length, insert: m[1] || '' })
    } else if (!re.test(l.text)) {
      changes.push({ from: l.from, insert: prefix })
    }
  }
  if (changes.length) view.dispatch({ changes })
  view.focus()
}

function selectedLines(state: EditorState): number[] {
  const lines = new Set<number>()
  for (const range of state.selection.ranges) {
    let to = range.to
    if (!range.empty && to > range.from && to <= state.doc.length && to === state.doc.lineAt(to).from) to--
    const startLine = state.doc.lineAt(range.from).number
    const endLine = state.doc.lineAt(to).number
    for (let n = startLine; n <= endLine; n++) lines.add(n)
  }
  return Array.from(lines).sort((a, b) => a - b)
}

export function indentLines(view: EditorView, direction: IndentDirection): void {
  const { state } = view
  const changes: ChangeSpec[] = []

  for (const n of selectedLines(state)) {
    const line = state.doc.line(n)
    if (direction === 'in') {
      changes.push({ from: line.from, insert: '  ' })
      continue
    }

    if (line.text.startsWith('  ')) changes.push({ from: line.from, to: line.from + 2, insert: '' })
    else if (line.text.startsWith('\t') || line.text.startsWith(' '))
      changes.push({ from: line.from, to: line.from + 1, insert: '' })
  }

  if (changes.length) view.dispatch({ changes })
  view.focus()
}

export function runAction(view: EditorView, action: Action): void {
  switch (action) {
    case 'bold':
    case 'italic':
    case 'code':
    case 'strike':
      toggleInline(view, action)
      break
    case 'quote':
    case 'list':
      toggleLinePrefix(view, action)
      break
    case 'link':
      // handled by the toolbar's link-entry flow via applyLink
      break
  }
}

export function computeActive(view: EditorView): Record<Action, boolean> {
  const s = view.state
  return {
    bold: isActive(s, 'bold'),
    italic: isActive(s, 'italic'),
    code: isActive(s, 'code'),
    strike: isActive(s, 'strike'),
    link: isActive(s, 'link'),
    quote: isActive(s, 'quote'),
    list: isActive(s, 'list')
  }
}
