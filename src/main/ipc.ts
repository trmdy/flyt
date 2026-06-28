// IPC surface. Every channel is a request/response `handle` — no renderer-driven
// Node access, no remote module. The renderer only ever sees plain data.

import { app, BrowserWindow, ipcMain, clipboard, shell } from 'electron'
import { watch, type FSWatcher } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { AssetInput, Doc, DocPatch, Settings, VaultSnapshot } from '@shared/types'
import { loadSettings, saveSettings, vaultAbsPath } from './config'
import * as vault from './vault'

const VAULT_CHANGE_DEBOUNCE_MS = 180

let vaultWatcher: FSWatcher | null = null
let watchedVaultPath: string | null = null
let vaultChangeTimer: ReturnType<typeof setTimeout> | null = null
let vaultWatchRestartTimer: ReturnType<typeof setTimeout> | null = null

function getSnapshot(): VaultSnapshot {
  vault.maybeSeed()
  const settings = loadSettings()
  return {
    vault: settings.vaultPath,
    vaultPath: vaultAbsPath(settings),
    docs: vault.scan(),
    settings
  }
}

function isRelevantVaultEvent(filename: string | Buffer | null): boolean {
  if (!filename) return true
  const name = String(filename)
  return name.endsWith('.md') || name.includes('.md.')
}

function sendVaultChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('flyt:vaultChanged')
  }
}

function scheduleVaultChanged(): void {
  if (vaultChangeTimer) clearTimeout(vaultChangeTimer)
  vaultChangeTimer = setTimeout(() => {
    vaultChangeTimer = null
    sendVaultChanged()
  }, VAULT_CHANGE_DEBOUNCE_MS)
}

async function openLink(raw: string): Promise<void> {
  const target = String(raw ?? '').trim()
  if (!target || target.startsWith('#')) return

  let url: URL
  try {
    url = new URL(target)
  } catch {
    return
  }

  if (url.protocol === 'file:') {
    await shell.openPath(fileURLToPath(url))
    return
  }

  if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
    await shell.openExternal(url.toString())
  }
}

function stopVaultWatcher(): void {
  if (vaultWatcher) {
    vaultWatcher.close()
    vaultWatcher = null
  }
  watchedVaultPath = null
  if (vaultChangeTimer) {
    clearTimeout(vaultChangeTimer)
    vaultChangeTimer = null
  }
  if (vaultWatchRestartTimer) {
    clearTimeout(vaultWatchRestartTimer)
    vaultWatchRestartTimer = null
  }
}

function queueVaultWatcherRestart(): void {
  if (vaultWatchRestartTimer) clearTimeout(vaultWatchRestartTimer)
  vaultWatchRestartTimer = setTimeout(() => {
    vaultWatchRestartTimer = null
    startVaultWatcher()
  }, 1000)
}

function startVaultWatcher(): void {
  const dir = vault.ensureVault()
  if (vaultWatcher && watchedVaultPath === dir) return

  stopVaultWatcher()
  watchedVaultPath = dir

  try {
    vaultWatcher = watch(dir, { persistent: false }, (_eventType, filename) => {
      if (isRelevantVaultEvent(filename)) scheduleVaultChanged()
    })
    vaultWatcher.on('error', () => {
      stopVaultWatcher()
      queueVaultWatcherRestart()
    })
  } catch {
    stopVaultWatcher()
    queueVaultWatcherRestart()
  }
}

export function registerIpc(): void {
  startVaultWatcher()
  app.once('before-quit', stopVaultWatcher)

  ipcMain.handle('flyt:getSnapshot', () => getSnapshot())
  ipcMain.handle('flyt:createDoc', () => vault.createDoc())
  ipcMain.handle('flyt:updateDoc', (_e, id: string, patch: DocPatch) => vault.updateDoc(id, patch))
  ipcMain.handle('flyt:upsertDoc', (_e, doc: Doc) => vault.upsertDoc(doc))
  ipcMain.handle('flyt:deleteDoc', (_e, id: string) => vault.deleteDoc(id))
  ipcMain.handle('flyt:migrateVault', (_e, newPath: string) => {
    const res = vault.migrateVault(newPath)
    startVaultWatcher()
    if (res.ok) scheduleVaultChanged()
    return res
  })
  ipcMain.handle('flyt:setSettings', (_e, patch: Partial<Settings>) => saveSettings(patch))
  ipcMain.handle('flyt:docPath', (_e, id: string) => vault.docPath(id))
  ipcMain.handle('flyt:copyText', (_e, text: string) => {
    clipboard.writeText(String(text ?? ''))
  })
  ipcMain.handle('flyt:saveAsset', (_e, docId: string, asset: AssetInput) => vault.saveAsset(docId, asset))
  ipcMain.handle('flyt:openLink', (_e, url: string) => openLink(url))
  ipcMain.handle('flyt:openVault', () => {
    const dir = vault.ensureVault()
    return shell.openPath(dir)
  })
}
