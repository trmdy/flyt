// Persistent app configuration, stored as JSON under the OS userData dir.
// Holds the renderer-facing Settings plus a couple of private bookkeeping keys.

import { app } from 'electron'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'

export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
}

interface RawConfig extends Settings {
  /** Absolute vault paths that have already been offered seed documents. */
  seededVaults?: string[]
  /** Last window size/position, so the app reopens roughly where you left it. */
  windowBounds?: WindowBounds
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

/** Expand a leading `~` to the user's home directory. */
export function expandTilde(p: string): string {
  if (!p) return p
  if (p === '~') return homedir()
  if (p.startsWith('~/') || p.startsWith('~\\')) return join(homedir(), p.slice(2))
  return p
}

let cache: RawConfig | null = null

function loadRaw(): RawConfig {
  if (cache) return cache
  try {
    const parsed = JSON.parse(readFileSync(configPath(), 'utf8'))
    cache = { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache as RawConfig
}

function saveRaw(patch: Partial<RawConfig>): RawConfig {
  const next = { ...loadRaw(), ...patch }
  cache = next
  try {
    writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
  } catch {
    // Non-fatal: settings simply won't persist across restarts.
  }
  return next
}

/** The renderer-facing settings only (no private keys). */
export function loadSettings(): Settings {
  const { vaultPath, accent, proseSize, editorWidth, showPreview } = loadRaw()
  return { vaultPath, accent, proseSize, editorWidth, showPreview }
}

/** Merge a settings patch. `vaultPath` is ignored here — vault moves go through migrateVault. */
export function saveSettings(patch: Partial<Settings>): Settings {
  const clean = { ...patch }
  delete (clean as Partial<Settings>).vaultPath
  saveRaw(clean)
  return loadSettings()
}

/** Directly set the stored vault path (used by migration). */
export function setVaultPath(displayPath: string): void {
  saveRaw({ vaultPath: displayPath })
}

/** Absolute, resolved filesystem path of the current vault. */
export function vaultAbsPath(s?: Settings): string {
  return expandTilde((s ?? loadSettings()).vaultPath)
}

export function seededVaults(): string[] {
  return loadRaw().seededVaults ?? []
}

export function markSeeded(absPath: string): void {
  const cur = seededVaults()
  if (!cur.includes(absPath)) saveRaw({ seededVaults: [...cur, absPath] })
}

export function loadWindowBounds(): WindowBounds | null {
  return loadRaw().windowBounds ?? null
}

export function saveWindowBounds(bounds: WindowBounds): void {
  saveRaw({ windowBounds: bounds })
}
