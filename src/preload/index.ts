// The only bridge between renderer and main. Exposes a typed, data-only API
// on `window.flyt` under context isolation.

import { contextBridge, ipcRenderer } from 'electron'
import type { DocPatch, FlytApi, Settings } from '@shared/types'

const api: FlytApi = {
  getSnapshot: () => ipcRenderer.invoke('flyt:getSnapshot'),
  createDoc: () => ipcRenderer.invoke('flyt:createDoc'),
  updateDoc: (id: string, patch: DocPatch) => ipcRenderer.invoke('flyt:updateDoc', id, patch),
  upsertDoc: (doc) => ipcRenderer.invoke('flyt:upsertDoc', doc),
  deleteDoc: (id: string) => ipcRenderer.invoke('flyt:deleteDoc', id),
  migrateVault: (newPath: string) => ipcRenderer.invoke('flyt:migrateVault', newPath),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke('flyt:setSettings', patch),
  docPath: (id: string) => ipcRenderer.invoke('flyt:docPath', id),
  copyText: (text: string) => ipcRenderer.invoke('flyt:copyText', text),
  saveAsset: (docId, asset) => ipcRenderer.invoke('flyt:saveAsset', docId, asset),
  openLink: (url) => ipcRenderer.invoke('flyt:openLink', url),
  openVault: () => ipcRenderer.invoke('flyt:openVault'),
  onVaultChanged: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('flyt:vaultChanged', listener)
    return () => ipcRenderer.removeListener('flyt:vaultChanged', listener)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('flyt', api)
