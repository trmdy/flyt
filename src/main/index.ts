// App lifecycle + the single document window.

import { app, shell, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'

const isDev = !app.isPackaged && !!process.env['ELECTRON_RENDERER_URL']

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    show: false,
    backgroundColor: '#faf7f1',
    title: 'Flyt',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 19 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())

  // External links open in the user's browser, never inside the app shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault()
      if (/^https?:\/\//.test(url)) shell.openExternal(url)
    }
  })

  if (isDev) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] as string)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setName('Flyt')
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
