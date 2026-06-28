// The renderer's view of the vault. Backed by the main process over IPC, but
// optimistic: edits land in local state instantly and disk writes are coalesced
// so typing never waits on the filesystem.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Doc, DocPatch, MigrateResult, Settings, VaultSnapshot } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

const FLUSH_MS = 280

export interface VaultStore {
  ready: boolean
  vault: string
  vaultPath: string
  settings: Settings
  docs: Doc[]
  createDoc: () => Promise<string>
  updateDoc: (id: string, patch: DocPatch) => void
  upsertDoc: (doc: Doc) => Promise<void>
  deleteDoc: (id: string) => Promise<void>
  setSettings: (patch: Partial<Settings>) => void
  migrateVault: (path: string) => Promise<MigrateResult>
  reload: () => Promise<void>
}

export function useVault(): VaultStore {
  const [snap, setSnap] = useState<VaultSnapshot | null>(null)
  const pending = useRef<Map<string, DocPatch>>(new Map())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const writesInFlight = useRef(0)
  const reloadQueued = useRef(false)
  const reloading = useRef(false)

  const reload = useCallback(async () => {
    if (reloading.current) {
      reloadQueued.current = true
      return
    }

    reloading.current = true
    try {
      do {
        reloadQueued.current = false
        setSnap(await window.flyt.getSnapshot())
      } while (reloadQueued.current && pending.current.size === 0 && writesInFlight.current === 0)
    } finally {
      reloading.current = false
    }
  }, [])

  const reloadFromDiskChange = useCallback(async () => {
    if (pending.current.size > 0 || writesInFlight.current > 0) {
      reloadQueued.current = true
      return
    }
    await reload()
  }, [reload])

  const runQueuedReload = useCallback(() => {
    if (!reloadQueued.current) return
    if (pending.current.size > 0 || writesInFlight.current > 0) return
    reloadQueued.current = false
    void reload()
  }, [reload])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    return window.flyt.onVaultChanged(() => {
      void reloadFromDiskChange()
    })
  }, [reloadFromDiskChange])

  useEffect(() => {
    const onFocus = (): void => {
      void reloadFromDiskChange()
    }
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void reloadFromDiskChange()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reloadFromDiskChange])

  const flush = useCallback(async (id: string) => {
    const patch = pending.current.get(id)
    timers.current.delete(id)
    if (!patch) return
    pending.current.delete(id)

    let saved: Doc | null
    writesInFlight.current += 1
    try {
      saved = await window.flyt.updateDoc(id, patch)
    } catch {
      // A transient filesystem error must never silently drop the edit:
      // merge the patch back (newer keys win) and retry shortly.
      pending.current.set(id, { ...patch, ...(pending.current.get(id) || {}) })
      if (!timers.current.has(id)) timers.current.set(id, setTimeout(() => flush(id), 1000))
      return
    } finally {
      writesInFlight.current = Math.max(0, writesInFlight.current - 1)
      runQueuedReload()
    }
    if (!saved) return

    setSnap((s) => {
      if (!s) return s
      const newer = pending.current.get(id)
      const newerHasFile = !!newer && 'file' in newer
      return {
        ...s,
        docs: s.docs.map((d) => {
          if (d.id !== id) return d
          // If the user kept typing, keep local edits and adopt the resolved
          // filename only when no newer filename edit is in flight; otherwise
          // accept the authoritative saved record (modified time, etc.).
          if (newer) return newerHasFile ? d : { ...d, file: saved.file }
          return { ...d, ...saved }
        })
      }
    })
  }, [])

  const flushAll = useCallback(() => {
    for (const id of Array.from(pending.current.keys())) {
      const t = timers.current.get(id)
      if (t) clearTimeout(t)
      timers.current.delete(id)
      void flush(id)
    }
  }, [flush])

  const updateDoc = useCallback(
    (id: string, patch: DocPatch) => {
      setSnap((s) =>
        s
          ? { ...s, docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch, modified: Date.now() } : d)) }
          : s
      )
      pending.current.set(id, { ...(pending.current.get(id) || {}), ...patch })
      const existing = timers.current.get(id)
      if (existing) clearTimeout(existing)
      timers.current.set(id, setTimeout(() => flush(id), FLUSH_MS))
    },
    [flush]
  )

  const createDoc = useCallback(async () => {
    const doc = await window.flyt.createDoc()
    setSnap((s) => (s ? { ...s, docs: [doc, ...s.docs] } : s))
    return doc.id
  }, [])

  const upsertDoc = useCallback(async (doc: Doc) => {
    const saved = await window.flyt.upsertDoc(doc)
    setSnap((s) => {
      if (!s) return s
      const exists = s.docs.some((d) => d.id === saved.id)
      return {
        ...s,
        docs: exists
          ? s.docs.map((d) => (d.id === saved.id ? { ...d, ...saved } : d))
          : [saved, ...s.docs]
      }
    })
  }, [])

  const deleteDoc = useCallback(async (id: string) => {
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
    pending.current.delete(id)
    setSnap((s) => (s ? { ...s, docs: s.docs.filter((d) => d.id !== id) } : s))
    await window.flyt.deleteDoc(id)
  }, [])

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSnap((s) => (s ? { ...s, settings: { ...s.settings, ...patch } } : s))
    window.flyt.setSettings(patch)
  }, [])

  const migrateVault = useCallback(
    async (path: string) => {
      const res = await window.flyt.migrateVault(path)
      if (res.ok) await reload()
      return res
    },
    [reload]
  )

  // Shrink the data-loss window: flush queued writes whenever the window loses
  // focus or is hidden (which precede an app quit), with beforeunload as a last
  // resort. These fire while the renderer is still alive, so the async IPC
  // writes actually complete.
  useEffect(() => {
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') flushAll()
    }
    const onUnload = (): void => {
      for (const [id, patch] of pending.current) window.flyt.updateDoc(id, patch)
    }
    window.addEventListener('blur', flushAll)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('blur', flushAll)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [flushAll])

  return {
    ready: !!snap,
    vault: snap?.vault ?? DEFAULT_SETTINGS.vaultPath,
    vaultPath: snap?.vaultPath ?? '',
    settings: snap?.settings ?? DEFAULT_SETTINGS,
    docs: snap?.docs ?? [],
    createDoc,
    updateDoc,
    upsertDoc,
    deleteDoc,
    setSettings,
    migrateVault,
    reload
  }
}
