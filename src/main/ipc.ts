// IPC surface. Every channel is a request/response `handle` — no renderer-driven
// Node access, no remote module. The renderer only ever sees plain data.

import { ipcMain, clipboard, shell } from 'electron'
import type { DocPatch, Settings, VaultSnapshot } from '@shared/types'
import { loadSettings, saveSettings, vaultAbsPath } from './config'
import * as vault from './vault'

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

export function registerIpc(): void {
  ipcMain.handle('flyt:getSnapshot', () => getSnapshot())
  ipcMain.handle('flyt:createDoc', () => vault.createDoc())
  ipcMain.handle('flyt:updateDoc', (_e, id: string, patch: DocPatch) => vault.updateDoc(id, patch))
  ipcMain.handle('flyt:deleteDoc', (_e, id: string) => vault.deleteDoc(id))
  ipcMain.handle('flyt:migrateVault', (_e, newPath: string) => vault.migrateVault(newPath))
  ipcMain.handle('flyt:setSettings', (_e, patch: Partial<Settings>) => saveSettings(patch))
  ipcMain.handle('flyt:docPath', (_e, id: string) => vault.docPath(id))
  ipcMain.handle('flyt:copyText', (_e, text: string) => {
    clipboard.writeText(String(text ?? ''))
  })
  ipcMain.handle('flyt:openVault', () => {
    const dir = vault.ensureVault()
    return shell.openPath(dir)
  })
}
