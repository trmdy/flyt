// "Live preview" for the Markdown source: style rendered tokens and hide the
// syntax markers on lines the cursor isn't on (Obsidian-style). Driven entirely
// off the Lezer syntax tree; recomputed on doc, selection, and viewport changes.

import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

const hidden = Decoration.replace({})
const strong = Decoration.mark({ class: 'tok-strong' })
const em = Decoration.mark({ class: 'tok-em' })
const strike = Decoration.mark({ class: 'tok-strike' })
const code = Decoration.mark({ class: 'tok-code' })
const linkText = Decoration.mark({ class: 'tok-link' })
const markDim = Decoration.mark({ class: 'tok-mark' })
const listMarkDim = Decoration.mark({ class: 'tok-list-mark' })

const headingLine = [
  Decoration.line({ class: 'cm-h1' }),
  Decoration.line({ class: 'cm-h2' }),
  Decoration.line({ class: 'cm-h3' })
]
const quoteLine = Decoration.line({ class: 'cm-quote-line' })
const codeblockLine = Decoration.line({ class: 'cm-codeblock-line' })

function activeLines(view: EditorView): Set<number> {
  const set = new Set<number>()
  const { doc } = view.state
  for (const r of view.state.selection.ranges) {
    const a = doc.lineAt(r.from).number
    const b = doc.lineAt(r.to).number
    for (let i = a; i <= b; i++) set.add(i)
  }
  return set
}

const NO_ACTIVE_LINES: Set<number> = new Set()

function build(view: EditorView): DecorationSet {
  const { state } = view
  const { doc } = state
  // When the editor isn't focused, render everything cleanly (hide all markers).
  // Once focused, reveal the markers on the line(s) the cursor is on.
  const active = view.hasFocus ? activeLines(view) : NO_ACTIVE_LINES
  const out: Range<Decoration>[] = []

  const hideOrDim = (from: number, to: number, eatTrailingSpace = false): void => {
    const line = doc.lineAt(from)
    if (active.has(line.number)) {
      out.push(markDim.range(from, to))
    } else {
      const end = eatTrailingSpace ? Math.min(to + 1, line.to) : to
      if (end > from) out.push(hidden.range(from, end))
    }
  }

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name
        const headingMatch = /^ATXHeading([1-6])$/.exec(name)
        if (headingMatch) {
          const level = Math.min(parseInt(headingMatch[1], 10), 3)
          out.push(headingLine[level - 1].range(doc.lineAt(node.from).from))
          return
        }
        switch (name) {
          case 'HeaderMark':
            hideOrDim(node.from, node.to, true)
            return
          case 'StrongEmphasis':
            out.push(strong.range(node.from, node.to))
            return
          case 'Emphasis':
            out.push(em.range(node.from, node.to))
            return
          case 'Strikethrough':
            out.push(strike.range(node.from, node.to))
            return
          case 'InlineCode':
            out.push(code.range(node.from, node.to))
            return
          case 'EmphasisMark':
          case 'CodeMark':
          case 'StrikethroughMark':
            hideOrDim(node.from, node.to)
            return
          case 'Blockquote': {
            const a = doc.lineAt(node.from).number
            const b = doc.lineAt(node.to).number
            for (let i = a; i <= b; i++) out.push(quoteLine.range(doc.line(i).from))
            return
          }
          case 'QuoteMark':
            hideOrDim(node.from, node.to, true)
            return
          case 'ListMark':
            out.push(listMarkDim.range(node.from, node.to))
            return
          case 'Link':
            out.push(linkText.range(node.from, node.to))
            return
          case 'LinkMark':
          case 'URL': {
            const parent = node.node.parent
            if (parent && parent.name === 'Link') hideOrDim(node.from, node.to)
            return
          }
          case 'FencedCode':
          case 'CodeBlock': {
            const a = doc.lineAt(node.from).number
            const b = doc.lineAt(node.to).number
            for (let i = a; i <= b; i++) out.push(codeblockLine.range(doc.line(i).from))
            return
          }
          default:
            return
        }
      }
    })
  }

  return Decoration.set(out, true)
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(u: ViewUpdate): void {
      if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged)
        this.decorations = build(u.view)
    }
  },
  { decorations: (v) => v.decorations }
)
