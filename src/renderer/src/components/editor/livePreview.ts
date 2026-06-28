// "Live preview" for the Markdown source: style rendered tokens and hide the
// syntax markers on lines the cursor isn't on (Obsidian-style). Driven entirely
// off the Lezer syntax tree; recomputed on doc, selection, and viewport changes.

import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view'
import type { Extension, Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

const hidden = Decoration.replace({})
const strong = Decoration.mark({ class: 'tok-strong' })
const em = Decoration.mark({ class: 'tok-em' })
const strike = Decoration.mark({ class: 'tok-strike' })
const code = Decoration.mark({ class: 'tok-code' })
const markDim = Decoration.mark({ class: 'tok-mark' })
const listMarkDim = Decoration.mark({ class: 'tok-list-mark' })

const headingLine = [
  Decoration.line({ class: 'cm-h1' }),
  Decoration.line({ class: 'cm-h2' }),
  Decoration.line({ class: 'cm-h3' })
]
const quoteLine = Decoration.line({ class: 'cm-quote-line' })
const codeblockLine = Decoration.line({ class: 'cm-codeblock-line' })

interface PreviewContext {
  vaultPath: string
  docFile: string
}

interface LivePreviewOptions {
  getContext: () => PreviewContext
  openLink: (href: string) => void
}

class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-list-bullet'
    span.textContent = '•'
    return span
  }

  eq(widget: WidgetType): boolean {
    return widget instanceof BulletWidget
  }

  ignoreEvent(): boolean {
    return false
  }
}

class ImageWidget extends WidgetType {
  constructor(
    private readonly src: string,
    private readonly alt: string
  ) {
    super()
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-image-widget'
    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.loading = 'lazy'
    wrap.appendChild(img)
    return wrap
  }

  eq(widget: WidgetType): boolean {
    return widget instanceof ImageWidget && widget.src === this.src && widget.alt === this.alt
  }

  ignoreEvent(): boolean {
    return false
  }
}

function fileUrlFromAbsolutePath(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').map((part) => encodeURIComponent(part))
  if (/^[A-Za-z]:\//.test(normalized)) {
    parts[0] = parts[0].replace('%3A', ':')
    return `file:///${parts.join('/')}`
  }
  return `file://${parts.join('/')}`
}

function docDirectoryPath(ctx: PreviewContext): string {
  const vault = (ctx.vaultPath || '').replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = (ctx.docFile || '').replace(/\\/g, '/').split('/').filter(Boolean)
  parts.pop()
  return parts.length ? `${vault}/${parts.join('/')}/` : `${vault}/`
}

function resolveMarkdownUrl(raw: string, ctx: PreviewContext): string | null {
  const url = raw.trim().replace(/^<|>$/g, '')
  if (!url) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url
  if (/^[A-Za-z]:[\\/]/.test(url) || url.startsWith('/')) return fileUrlFromAbsolutePath(url)

  try {
    return new URL(url.replace(/\\/g, '/'), fileUrlFromAbsolutePath(docDirectoryPath(ctx))).href
  } catch {
    return null
  }
}

function linkDecoration(href: string): Decoration {
  return Decoration.mark({
    tagName: 'span',
    class: 'tok-link',
    attributes: {
      'data-flyt-href': href
    }
  })
}

function imageAlt(markdown: string): string {
  return /^!\[([^\]]*)\]/.exec(markdown)?.[1]?.trim() || 'image'
}

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

function build(view: EditorView, options: LivePreviewOptions): DecorationSet {
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
            if (active.has(doc.lineAt(node.from).number)) {
              out.push(listMarkDim.range(node.from, node.to))
            } else {
              const marker = state.sliceDoc(node.from, node.to)
              if (/^\d+[.)]$/.test(marker)) out.push(listMarkDim.range(node.from, node.to))
              else out.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to))
            }
            return
          case 'Link': {
            const urlNode = node.node.getChild('URL')
            if (urlNode) {
              const href = resolveMarkdownUrl(state.sliceDoc(urlNode.from, urlNode.to), options.getContext())
              if (href) out.push(linkDecoration(href).range(node.from, node.to))
            }
            return
          }
          case 'Image': {
            const line = doc.lineAt(node.from)
            if (active.has(line.number)) return
            const urlNode = node.node.getChild('URL')
            if (!urlNode) return false
            const src = resolveMarkdownUrl(state.sliceDoc(urlNode.from, urlNode.to), options.getContext())
            if (!src) return false
            out.push(
              Decoration.replace({
                widget: new ImageWidget(src, imageAlt(state.sliceDoc(node.from, node.to)))
              }).range(node.from, node.to)
            )
            return false
          }
          case 'LinkTitle':
            hideOrDim(node.from, node.to)
            return
          case 'LinkMark':
          case 'URL': {
            const parent = node.node.parent
            if (parent && (parent.name === 'Link' || parent.name === 'Image')) hideOrDim(node.from, node.to)
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

export function livePreview(options: LivePreviewOptions): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet
        constructor(view: EditorView) {
          this.decorations = build(view, options)
        }
        update(u: ViewUpdate): void {
          if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged || u.transactions.length > 0)
            this.decorations = build(u.view, options)
        }
      },
      { decorations: (v) => v.decorations }
    ),
    EditorView.domEventHandlers({
      click(event, view) {
        const target = event.target as HTMLElement | null
        const link = target?.closest<HTMLElement>('[data-flyt-href]')
        if (!link || !view.contentDOM.contains(link)) return false
        if (!event.metaKey && !event.ctrlKey) return false
        const href = link.dataset.flytHref
        if (!href) return false
        event.preventDefault()
        options.openLink(href)
        return true
      }
    })
  ]
}
