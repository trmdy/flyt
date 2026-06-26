// flyt — root shell: routing, global shortcuts, copy actions, toasts, theming.
// Ported from the design's Root.jsx, backed by a real filesystem vault.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import * as stylex from '@stylexjs/stylex'
import type { DocPatch } from '@shared/types'
import { EDITOR_WIDTHS } from '@shared/types'
import { useVault } from './lib/useVault'
import { allTags as allTagsOf, buildDocMarkdown } from './lib/md'
import { Home } from './components/Home'
import { DocView } from './components/DocView'
import { Palette, type PaletteAction } from './components/Palette'
import { Settings } from './components/Settings'
import { Icon } from './components/Icon'
import { color, font, motion } from './styles/tokens.stylex'

interface Toast {
  id: string
  content: ReactNode
}

const toastIn = stylex.keyframes({ from: { opacity: 0, transform: 'translateY(8px)' } })

const appS = stylex.create({
  app: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: color.canvas,
    overflow: 'hidden'
  },
  check: { color: '#b7c89a', display: 'flex' },
  toastWrap: {
    position: 'fixed',
    bottom: 26,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    zIndex: 90,
    pointerEvents: 'none'
  },
  toast: {
    backgroundColor: color.ink,
    color: color.canvas,
    fontSize: 12.5,
    paddingBlock: 9,
    paddingInline: 15,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 9,
    boxShadow: '0 8px 28px rgba(28,25,21,.28)',
    animationName: toastIn,
    animationDuration: '200ms',
    animationTimingFunction: motion.ease
  },
  toastKbd: {
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: font.mono,
    fontSize: 10.5,
    color: 'rgba(255,255,255,.8)',
    backgroundColor: 'rgba(255,255,255,.14)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,.16)',
    borderRadius: 4,
    paddingBlock: 1,
    paddingInline: 5,
    lineHeight: 1.4,
    whiteSpace: 'nowrap'
  }
})

function hexA(hex: string, a: number): string {
  const h = (hex || '#b8862f').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

const checkToast = (icon: string, label: ReactNode): ReactNode => (
  <>
    <span {...stylex.props(appS.check)}>
      <Icon name={icon} size={14} />
    </span>{' '}
    {label}
  </>
)

export function App(): JSX.Element {
  const store = useVault()
  const { docs, vault, vaultPath, settings, ready } = store
  // These methods are stable (useCallback in useVault); depend on them directly
  // rather than the store object, which changes identity every render.
  const {
    createDoc: vaultCreate,
    updateDoc: vaultUpdate,
    deleteDoc: vaultDelete,
    migrateVault: vaultMigrate
  } = store

  const [view, setView] = useState<'home' | 'doc'>('home')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [homeFocusId, setHomeFocusId] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const savingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTap = useRef<{ combo: string | null; time: number }>({ combo: null, time: 0 })

  const activeDoc = docs.find((d) => d.id === activeId) || null
  const tagList = useMemo(() => allTagsOf(docs), [docs])

  useEffect(() => {
    document.body.classList.toggle('is-mac', window.flyt.platform === 'darwin')
  }, [])

  const pushToast = useCallback((content: ReactNode) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((ts) => [...ts, { id, content }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 1900)
  }, [])

  // ---------- navigation + history (⌘← goes back) ----------
  const navRef = useRef<{ view: 'home' | 'doc'; activeId: string | null }>({ view, activeId })
  navRef.current = { view, activeId }
  const historyRef = useRef<Array<{ view: 'home' | 'doc'; activeId: string | null }>>([])

  const navigate = useCallback(
    (next: { view: 'home' | 'doc'; activeId: string | null }, record = true) => {
      if (record) {
        const cur = navRef.current
        if (cur.view !== next.view || cur.activeId !== next.activeId) {
          historyRef.current.push(cur)
          if (historyRef.current.length > 50) historyRef.current.shift()
        }
      }
      setPaletteOpen(false)
      setView(next.view)
      setActiveId(next.activeId)
    },
    []
  )

  const openDoc = useCallback((id: string) => navigate({ view: 'doc', activeId: id }), [navigate])
  const goHome = useCallback(() => navigate({ view: 'home', activeId: null }), [navigate])
  const goBack = useCallback(() => {
    const prev = historyRef.current.pop()
    if (prev) navigate(prev, false)
    else if (navRef.current.view === 'doc') navigate({ view: 'home', activeId: null }, false)
  }, [navigate])

  const createDoc = useCallback(async () => {
    const id = await vaultCreate()
    openDoc(id)
    pushToast(checkToast('plus', 'New document'))
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>('.doc-title')
      el?.focus()
    }, 60)
  }, [vaultCreate, openDoc, pushToast])

  // Safety: if the active document vanishes, return to the library.
  useEffect(() => {
    if (view === 'doc' && activeId && !activeDoc) navigate({ view: 'home', activeId: null }, false)
  }, [view, activeId, activeDoc, navigate])

  const patchDoc = useCallback(
    (patch: DocPatch) => {
      if (!activeId) return
      vaultUpdate(activeId, patch)
      setSaving(true)
      if (savingTimer.current) clearTimeout(savingTimer.current)
      savingTimer.current = setTimeout(() => setSaving(false), 700)
    },
    [vaultUpdate, activeId]
  )

  const deleteDoc = useCallback(
    (id: string) => {
      vaultDelete(id)
      navigate({ view: 'home', activeId: null }, false)
      pushToast(
        <>
          <Icon name="x" size={14} /> Document deleted
        </>
      )
    },
    [vaultDelete, navigate, pushToast]
  )

  const archiveDoc = useCallback(
    (id: string) => {
      vaultUpdate(id, { archived: true })
      navigate({ view: 'home', activeId: null }, false)
      pushToast(checkToast('archive', 'Document archived'))
    },
    [vaultUpdate, navigate, pushToast]
  )

  const restoreDoc = useCallback(
    (id: string) => {
      vaultUpdate(id, { archived: false })
      pushToast(checkToast('check', 'Document restored'))
    },
    [vaultUpdate, pushToast]
  )

  const toggleArchived = useCallback(() => {
    navigate({ view: 'home', activeId: null })
    setShowArchived((v) => !v)
  }, [navigate])

  const copyDocument = useCallback(() => {
    if (!activeDoc) return
    window.flyt.copyText(buildDocMarkdown(activeDoc))
    pushToast(checkToast('check', 'Copied entire document'))
  }, [activeDoc, pushToast])

  const copyPath = useCallback(() => {
    const path = activeDoc ? `${vaultPath}/${activeDoc.file || 'untitled'}.md` : vaultPath
    window.flyt.copyText(path)
    pushToast(checkToast('check', <span {...stylex.props(appS.toastKbd)}>{path}</span>))
  }, [activeDoc, vaultPath, pushToast])

  // ---------- global keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        createDoc()
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        toggleArchived()
        return
      }
      if (mod && e.key.toLowerCase() === 'c') {
        // Double-tap gesture per spec: ⌘C ⌘C copies the whole document, ⇧⌘C ⇧⌘C
        // copies the path. The first press is never prevented, so a single ⌘C
        // still does a normal native copy of any selection.
        const combo = e.shiftKey ? 'shift-c' : 'c'
        const now = Date.now()
        const prev = lastTap.current
        const isDouble = prev.combo === combo && now - prev.time < 650
        if (isDouble) {
          if (combo === 'c' && view === 'doc') {
            e.preventDefault()
            copyDocument()
          } else if (combo === 'shift-c') {
            e.preventDefault()
            copyPath()
          }
          lastTap.current = { combo: null, time: 0 }
        } else {
          lastTap.current = { combo, time: now }
        }
        return
      }
      // ⌘← navigates history back — but not while editing text (there it's line-start).
      if (mod && !e.shiftKey && e.key === 'ArrowLeft') {
        const ae = document.activeElement as HTMLElement | null
        const editable = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)
        if (!editable) {
          e.preventDefault()
          goBack()
        }
        return
      }
      if (e.key === '/' && view === 'home' && document.activeElement === document.body) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false)
        else if (settingsOpen) setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, paletteOpen, settingsOpen, createDoc, copyDocument, copyPath, toggleArchived, goBack])

  // ---------- palette actions ----------
  const paletteActions = useMemo<PaletteAction[]>(() => {
    const a: PaletteAction[] = [
      { id: 'new', label: 'New document', icon: 'plus', shortcut: '⌘N', keywords: 'create add', run: () => createDoc() }
    ]
    if (view === 'doc' && activeDoc) {
      a.push(
        { id: 'copy-doc', label: 'Copy entire document', icon: 'doc', shortcut: '⌘C ⌘C', keywords: 'clipboard', run: () => copyDocument() },
        { id: 'copy-path', label: 'Copy path to document', icon: 'link', shortcut: '⇧⌘C ⇧⌘C', keywords: 'clipboard vault location', run: () => copyPath() },
        { id: 'library', label: 'Back to library', icon: 'arrow-corner', keywords: 'home docs all', run: () => goHome() },
        activeDoc.archived
          ? { id: 'restore', label: 'Restore document', icon: 'check', keywords: 'unarchive', run: () => { restoreDoc(activeDoc.id); goHome() } }
          : { id: 'archive', label: 'Archive document', icon: 'archive', keywords: 'hide stash', run: () => archiveDoc(activeDoc.id) },
        { id: 'delete', label: 'Delete this document', icon: 'x', keywords: 'remove trash permanent', run: () => deleteDoc(activeDoc.id) }
      )
    }
    a.push(
      { id: 'archived', label: showArchived ? 'View active documents' : 'View archived documents', icon: 'archive', shortcut: '⇧⌘A', keywords: 'archive trash hidden', run: () => toggleArchived() },
      { id: 'vault', label: 'Vault settings…', icon: 'settings', keywords: 'location migrate folder path', run: () => setSettingsOpen(true) }
    )
    // When a library entry is focused, its actions go to the very top.
    if (view === 'home' && homeFocusId) {
      const d = docs.find((x) => x.id === homeFocusId)
      if (d) {
        const title = d.title || 'Untitled'
        a.unshift(
          { id: 'open-focused', label: `Open “${title}”`, icon: 'arrow-corner', keywords: 'open entry', run: () => openDoc(d.id) },
          d.archived
            ? { id: 'restore-focused', label: `Restore “${title}”`, icon: 'check', keywords: 'restore unarchive', run: () => restoreDoc(d.id) }
            : { id: 'archive-focused', label: `Archive “${title}”`, icon: 'archive', keywords: 'archive hide', run: () => archiveDoc(d.id) }
        )
      }
    }
    return a
  }, [view, activeDoc, showArchived, homeFocusId, docs, openDoc, createDoc, copyDocument, copyPath, goHome, restoreDoc, archiveDoc, deleteDoc, toggleArchived])

  const runAction = useCallback((action: PaletteAction) => {
    setPaletteOpen(false)
    setTimeout(() => action.run(), 0)
  }, [])

  // ---------- dynamic theme from settings ----------
  // Accent / editor width flow through CSS custom properties on the root so both
  // StyleX styles and the remaining global CSS pick them up. Only genuinely
  // global selectors (CodeMirror, the not-yet-migrated selection toolbar, and
  // ::selection) need a runtime stylesheet.
  const width = EDITOR_WIDTHS[settings.editorWidth] || 760
  const rootVars = {
    '--accent': settings.accent,
    '--editor-width': `${width}px`,
    '--prose-size': `${settings.proseSize}px`
  } as CSSProperties
  const dynCss = `
    .flyt-cm .cm-content { font-size: ${settings.proseSize}px; }
    ::selection { background: ${hexA(settings.accent, 0.2)}; }
  `

  if (!ready) return <div {...stylex.props(appS.app)} style={rootVars} />

  return (
    <div {...stylex.props(appS.app)} style={rootVars}>
      <style dangerouslySetInnerHTML={{ __html: dynCss }} />

      {view === 'home' && (
        <Home
          vault={vault}
          docs={docs}
          query={query}
          setQuery={setQuery}
          searchRef={searchRef}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
          onOpen={openDoc}
          onCreate={createDoc}
          onRestore={restoreDoc}
          onArchive={archiveDoc}
          onFocusEntry={setHomeFocusId}
          onOpenVault={() => window.flyt.openVault()}
          showPreview={settings.showPreview}
        />
      )}

      {view === 'doc' && activeDoc && (
        <DocView
          doc={activeDoc}
          vault={vault}
          vaultPath={vaultPath}
          saving={saving}
          allTags={tagList}
          onBack={goHome}
          onPatch={patchDoc}
          onOpenPalette={() => setPaletteOpen(true)}
          onArchive={archiveDoc}
          onRestore={(id) => {
            restoreDoc(id)
            goHome()
          }}
        />
      )}
      {view === 'doc' && !activeDoc && <div style={{ flex: 1 }} />}

      {paletteOpen && (
        <Palette
          docs={docs}
          actions={paletteActions}
          onClose={() => setPaletteOpen(false)}
          onPickDoc={openDoc}
          onRunAction={runAction}
        />
      )}

      {settingsOpen && (
        <Settings
          vault={vault}
          docsCount={docs.length}
          onClose={() => setSettingsOpen(false)}
          onMigrate={async (p) => {
            const res = await vaultMigrate(p)
            if (res.ok) {
              pushToast(
                checkToast(
                  'check',
                  res.failed > 0 ? `Vault migrated · ${res.failed} couldn't move` : 'Vault migrated'
                )
              )
            }
            return res
          }}
        />
      )}

      <div {...stylex.props(appS.toastWrap)}>
        {toasts.map((t) => (
          <div key={t.id} {...stylex.props(appS.toast)}>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  )
}
