// Vault settings + migration. Changing the path moves every document. Ported from Gen-A FlytSettings,
// wired to a real filesystem migration in the main process.

import { useEffect, useRef, useState } from 'react'
import type { MigrateResult } from '@shared/types'
import { Icon } from './Icon'

interface SettingsProps {
  vault: string
  docsCount: number
  onClose: () => void
  onMigrate: (path: string) => Promise<MigrateResult>
}

type Phase = 'edit' | 'confirm' | 'migrating' | 'done' | 'error'

export function Settings({ vault, docsCount, onClose, onMigrate }: SettingsProps): JSX.Element {
  const [path, setPath] = useState(vault)
  const [phase, setPhase] = useState<Phase>('edit')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<MigrateResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current)
    },
    []
  )

  const clean = path.trim().replace(/[/\\]+$/, '')
  const changed = !!clean && clean !== vault

  const startMigration = async (): Promise<void> => {
    setPhase('migrating')
    setProgress(0)
    const total = Math.max(docsCount, 1)
    let done = 0
    timer.current = setInterval(
      () => {
        done++
        setProgress(Math.min(done, total))
        if (done >= total && timer.current) {
          clearInterval(timer.current)
          timer.current = null
        }
      },
      Math.max(90, Math.min(220, 700 / total))
    )

    const res = await onMigrate(clean)
    setResult(res)
    setProgress(total)
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }
    if (res.ok) {
      setPhase('done')
      setTimeout(onClose, 900)
    } else {
      setPhase('error')
    }
  }

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== 'migrating') onClose()
      }}
    >
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="sheet-title">Vault</div>
          <button className="icon-btn" onClick={onClose} disabled={phase === 'migrating'}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="sheet-body">
          {phase === 'edit' && (
            <>
              <label className="field-label">Vault location</label>
              <input
                ref={inputRef}
                className="path-input"
                value={path}
                spellCheck={false}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && changed) setPhase('confirm')
                }}
              />
              <p className="field-help">
                Every Flyt document lives in this folder. Changing the location moves the entire vault —
                all {docsCount} {docsCount === 1 ? 'document' : 'documents'} — to the new path.
              </p>
              <div className="sheet-foot">
                <button className="btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn-ink" disabled={!changed} onClick={() => setPhase('confirm')}>
                  Continue
                </button>
              </div>
            </>
          )}

          {phase === 'confirm' && (
            <>
              <label className="field-label">Confirm migration</label>
              <div className="migrate-box">
                <div className="migrate-line">
                  <Icon name="folder" size={14} />
                  <span className="from">{vault}</span>
                </div>
                <div className="migrate-line">
                  <Icon name="arrow-right" size={14} />
                  <span className="to">{clean}</span>
                </div>
              </div>
              <p className="field-help">
                {docsCount} {docsCount === 1 ? 'document' : 'documents'} will be moved and every path
                updated. Nothing is deleted — the move is atomic.
              </p>
              <div className="sheet-foot">
                <button className="btn-ghost" onClick={() => setPhase('edit')}>
                  Back
                </button>
                <button className="btn-ink" onClick={startMigration}>
                  <Icon name="arrow-right" size={15} /> Migrate vault
                </button>
              </div>
            </>
          )}

          {phase === 'migrating' && (
            <>
              <label className="field-label">Migrating…</label>
              <div className="migrate-box">
                <div className="migrate-line">
                  <Icon name="folder" size={14} />
                  <span className="to">{clean}</span>
                </div>
                <div className="migrate-progress">
                  <div
                    className="bar-fill"
                    style={{ width: (progress / Math.max(docsCount, 1)) * 100 + '%' }}
                  />
                </div>
                <div className="migrate-count">
                  {progress} / {docsCount} documents moved
                </div>
              </div>
            </>
          )}

          {phase === 'done' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  color: 'var(--moss)',
                  fontFamily: 'var(--mono)',
                  fontSize: 13
                }}
              >
                <Icon name="check" size={18} /> Vault migrated to {clean}
                {result ? ` · ${result.moved} moved` : ''}
              </div>
              {result && result.failed > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '2px 0',
                    color: 'var(--rust)',
                    fontFamily: 'var(--mono)',
                    fontSize: 12
                  }}
                >
                  <Icon name="x" size={14} /> {result.failed} file{result.failed === 1 ? '' : 's'} could
                  not be moved
                </div>
              )}
            </>
          )}

          {phase === 'error' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 0 12px',
                  color: 'var(--rust)',
                  fontFamily: 'var(--mono)',
                  fontSize: 13
                }}
              >
                <Icon name="x" size={16} /> {result?.error || 'Migration failed'}
              </div>
              <div className="sheet-foot">
                <button className="btn-ghost" onClick={() => setPhase('edit')}>
                  Back
                </button>
                <button className="btn-ink" onClick={onClose}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
