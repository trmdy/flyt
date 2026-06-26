// App lifecycle + the single document window.

import { app, shell, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { loadWindowBounds, saveWindowBounds } from './config'

const isDev = !app.isPackaged && !!process.env['ELECTRON_RENDERER_URL']

const DEFAULT_BOUNDS = { width: 1180, height: 820 }

// Restore the last window size/position — but drop a saved position that is no
// longer on any display (e.g. a disconnected monitor) so the window can't open
// off-screen.
function restoreBounds(): { width: number; height: number; x?: number; y?: number } {
  const saved = loadWindowBounds()
  if (!saved) return { ...DEFAULT_BOUNDS }
  const out: { width: number; height: number; x?: number; y?: number } = {
    width: saved.width || DEFAULT_BOUNDS.width,
    height: saved.height || DEFAULT_BOUNDS.height
  }
  if (typeof saved.x === 'number' && typeof saved.y === 'number') {
    const onScreen = screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return (
        saved.x! < a.x + a.width - 60 &&
        saved.x! + out.width > a.x + 60 &&
        saved.y! < a.y + a.height - 40 &&
        saved.y! + 60 > a.y
      )
    })
    if (onScreen) {
      out.x = saved.x
      out.y = saved.y
    }
  }
  return out
}

function createWindow(): void {
  const bounds = restoreBounds()
  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
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

  // Remember size/position (debounced) so the app reopens where you left it.
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const remember = (): void => {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!win.isDestroyed()) saveWindowBounds(win.getBounds())
    }, 400)
  }
  win.on('resize', remember)
  win.on('move', remember)
  win.on('close', () => {
    if (!win.isDestroyed() && !win.isMinimized() && !win.isFullScreen()) saveWindowBounds(win.getBounds())
  })

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
