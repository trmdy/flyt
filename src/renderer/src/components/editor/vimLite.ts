// A *very* light, block-level vim mode for the Markdown editor. There is no
// per-character cursor in normal mode — the unit is the "block" (a run of
// contiguous non-blank lines: a paragraph, heading, list, or quote). The current
// block is highlighted; j/k move between blocks; i/a drop into insert mode at the
// block's start/end; Ctrl-d/Ctrl-u page by roughly half a screen. Insert mode is
// just ordinary CodeMirror editing — the default, so nothing changes until Esc.

import {
  StateField,
  StateEffect,
  EditorState,
  Prec,
  RangeSetBuilder,
  type Extension
} from '@codemirror/state'
import { EditorView, Decoration, type DecorationSet, keymap } from '@codemirror/view'

export type VimMode = 'normal' | 'insert'

const setModeEffect = StateEffect.define<VimMode>()

const modeField = StateField.define<VimMode>({
  create: () => 'insert',
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setModeEffect)) return e.value
    return value
  }
})

export function getVimMode(view: EditorView): VimMode {
  return view.state.field(modeField, false) ?? 'insert'
}

export function setVimMode(view: EditorView, mode: VimMode): void {
  view.dispatch({ effects: setModeEffect.of(mode) })
  if (mode === 'insert') view.focus()
}

// ——— blocks ———

const isBlank = (t: string): boolean => /^\s*$/.test(t)

// Snap a (possibly blank) line to the nearest non-blank line — below first, then
// above — so navigation never lands on the gaps between blocks.
function snapLine(state: EditorState, lineNo: number): number {
  const doc = state.doc
  if (!isBlank(doc.line(lineNo).text)) return lineNo
  for (let i = lineNo + 1; i <= doc.lines; i++) if (!isBlank(doc.line(i).text)) return i
  for (let i = lineNo - 1; i >= 1; i--) if (!isBlank(doc.line(i).text)) return i
  return lineNo
}

function blockBounds(state: EditorState, lineNo: number): { first: number; last: number } {
  const doc = state.doc
  const ln = snapLine(state, lineNo)
  let first = ln
  let last = ln
  while (first > 1 && !isBlank(doc.line(first - 1).text)) first--
  while (last < doc.lines && !isBlank(doc.line(last + 1).text)) last++
  return { first, last }
}

function currentBlock(state: EditorState): { first: number; last: number } {
  const head = state.selection.main.head
  return blockBounds(state, state.doc.lineAt(head).number)
}

function nextBlockStart(state: EditorState, lineNo: number): number {
  const doc = state.doc
  const { last } = blockBounds(state, lineNo)
  let i = last + 1
  while (i <= doc.lines && isBlank(doc.line(i).text)) i++
  return i <= doc.lines ? i : -1
}

function prevBlockStart(state: EditorState, lineNo: number): number {
  const doc = state.doc
  const { first } = blockBounds(state, lineNo)
  let i = first - 1
  while (i >= 1 && isBlank(doc.line(i).text)) i--
  return i < 1 ? -1 : blockBounds(state, i).first
}

// ——— current-block highlight ———

const blockLine = Decoration.line({ class: 'cm-vim-block' })

function buildHighlight(state: EditorState): DecorationSet {
  if (state.field(modeField) !== 'normal') return Decoration.none
  const { first, last } = currentBlock(state)
  const b = new RangeSetBuilder<Decoration>()
  for (let i = first; i <= last; i++) b.add(state.doc.line(i).from, state.doc.line(i).from, blockLine)
  return b.finish()
}

const highlight = StateField.define<DecorationSet>({
  create: (state) => buildHighlight(state),
  update(value, tr) {
    if (tr.docChanged || tr.selection || tr.effects.some((e) => e.is(setModeEffect)))
      return buildHighlight(tr.state)
    return value
  },
  provide: (f) => EditorView.decorations.from(f)
})

// ——— scrolling (the outer .editor-scroll is the scroll container, not CM) ———

function outerScroller(view: EditorView): HTMLElement | null {
  return view.dom.closest('.editor-scroll') as HTMLElement | null
}

function contentOffset(view: EditorView, sc: HTMLElement): number {
  return view.contentDOM.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
}

// Keep `pos` comfortably within the outer scroller (CM's own scrollIntoView is a
// no-op here because .cm-scroller has overflow: visible).
function revealPos(view: EditorView, pos: number): void {
  const sc = outerScroller(view)
  if (!sc) return
  const info = view.lineBlockAt(pos)
  const off = contentOffset(view, sc)
  const top = off + info.top
  const bottom = off + info.bottom
  const m = 72
  if (top < sc.scrollTop + m) sc.scrollTop = Math.max(0, top - m)
  else if (bottom > sc.scrollTop + sc.clientHeight - m) sc.scrollTop = bottom - sc.clientHeight + m
}

function gotoLine(view: EditorView, lineNo: number): void {
  if (lineNo < 1) return
  const pos = view.state.doc.line(lineNo).from
  view.dispatch({ selection: { anchor: pos } })
  revealPos(view, pos)
}

// ——— commands ———

const moveDown = (view: EditorView): boolean => {
  if (getVimMode(view) !== 'normal') return false
  const nx = nextBlockStart(view.state, currentBlock(view.state).first)
  if (nx > 0) gotoLine(view, nx)
  return true
}

const moveUp = (view: EditorView): boolean => {
  if (getVimMode(view) !== 'normal') return false
  const pv = prevBlockStart(view.state, currentBlock(view.state).first)
  if (pv > 0) gotoLine(view, pv)
  return true
}

const insertAt = (view: EditorView, where: 'start' | 'end'): boolean => {
  if (getVimMode(view) !== 'normal') return false
  const { first, last } = currentBlock(view.state)
  const pos =
    where === 'start' ? view.state.doc.line(first).from : view.state.doc.line(last).to
  view.dispatch({ selection: { anchor: pos }, effects: setModeEffect.of('insert') })
  view.focus()
  revealPos(view, pos)
  return true
}

const halfPage = (view: EditorView, dir: 1 | -1): boolean => {
  if (getVimMode(view) !== 'normal') return false
  const sc = outerScroller(view)
  if (!sc) {
    // No scroller — just hop a few blocks.
    let ln = currentBlock(view.state).first
    for (let n = 0; n < 6; n++) {
      const nx = dir > 0 ? nextBlockStart(view.state, ln) : prevBlockStart(view.state, ln)
      if (nx < 0) break
      ln = nx
    }
    gotoLine(view, ln)
    return true
  }
  sc.scrollTop = Math.max(0, sc.scrollTop + dir * sc.clientHeight * 0.5)
  const docY = sc.scrollTop - contentOffset(view, sc) + Math.min(sc.clientHeight * 0.3, 120)
  const info = view.lineBlockAtHeight(Math.max(0, docY))
  const { first } = blockBounds(view.state, view.state.doc.lineAt(info.from).number)
  view.dispatch({ selection: { anchor: view.state.doc.line(first).from } })
  return true
}

const vimKeymap = Prec.highest(
  keymap.of([
    { key: 'j', run: moveDown },
    { key: 'k', run: moveUp },
    { key: 'i', run: (v) => insertAt(v, 'start') },
    { key: 'a', run: (v) => insertAt(v, 'end') },
    { key: 'Ctrl-d', run: (v) => halfPage(v, 1) },
    { key: 'Ctrl-u', run: (v) => halfPage(v, -1) }
  ])
)

// A click means "I want to edit here" — drop into insert and let CM place the caret.
const mouseToInsert = EditorView.domEventHandlers({
  mousedown(_e, view) {
    if (getVimMode(view) === 'normal') view.dispatch({ effects: setModeEffect.of('insert') })
    return false
  }
})

// Normal mode locks edits (block-cursor only) and tags the editor for styling.
const readOnly = EditorState.readOnly.compute([modeField], (s) => s.field(modeField) === 'normal')
const editorClass = EditorView.editorAttributes.compute([modeField], (s) => ({
  class: s.field(modeField) === 'normal' ? 'cm-vim-normal' : 'cm-vim-insert'
}))

export function vimLite(onModeChange?: (mode: VimMode) => void): Extension {
  const notify = EditorView.updateListener.of((u) => {
    const before = u.startState.field(modeField, false)
    const after = u.state.field(modeField, false)
    if (before !== after && onModeChange) onModeChange(after ?? 'insert')
  })
  return [modeField, highlight, readOnly, editorClass, vimKeymap, mouseToInsert, notify]
}
