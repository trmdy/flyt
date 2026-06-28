// Vault settings + migration. SPIKE: behavior from Base UI's headless Dialog
// (focus trap, scroll lock, Esc / outside-click, a11y) with all styling authored
// in StyleX. Compare against the plain-CSS version in git history.

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import * as stylex from '@stylexjs/stylex'
import type { MigrateResult } from '@shared/types'
import { Icon } from './Icon'
import { CloudAccount } from './CloudAccount'
import { color, font, radius } from '../styles/tokens.stylex'

interface SettingsProps {
  vault: string
  docsCount: number
  onClose: () => void
  onMigrate: (path: string) => Promise<MigrateResult>
}

type Phase = 'edit' | 'confirm' | 'migrating' | 'done' | 'error'

const fadeIn = stylex.keyframes({ from: { opacity: 0 } })

const s = stylex.create({
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: color.scrim,
    zIndex: 80,
    animationName: fadeIn,
    animationDuration: '120ms'
  },
  popup: {
    position: 'fixed',
    top: '12vh',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 81,
    width: 560,
    maxWidth: 'calc(100vw - 60px)',
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.hair,
    boxShadow: '0 18px 50px rgba(28, 25, 21, 0.22)',
    overflow: 'hidden',
    fontFamily: font.ui,
    color: color.ink,
    animationName: fadeIn,
    animationDuration: '140ms'
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 22px 14px',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.hair
  },
  title: { fontFamily: font.prose, fontSize: 21, fontWeight: 500, letterSpacing: '-0.01em' },
  iconBtn: {
    width: 32,
    height: 32,
    border: 'none',
    borderRadius: radius.sm,
    backgroundColor: { default: 'transparent', ':hover': color.canvas2 },
    color: { default: color.ink3, ':hover': color.ink },
    cursor: { default: 'pointer', ':disabled': 'default' },
    opacity: { default: 1, ':disabled': 0.4 },
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: { padding: '20px 22px 22px' },
  fieldLabel: {
    fontFamily: font.mono,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: color.ink4,
    marginBottom: 8,
    display: 'block'
  },
  pathInput: {
    width: '100%',
    fontFamily: font.mono,
    fontSize: 13,
    color: color.ink,
    backgroundColor: color.surfaceWarm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.hairStrong, ':focus': 'var(--accent)' },
    borderRadius: radius.md,
    padding: '11px 13px',
    outline: 'none'
  },
  fieldHelp: { fontSize: 12.5, color: color.ink3, lineHeight: 1.5, marginTop: 10 },
  foot: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 22
  },
  btnInk: {
    backgroundColor: { default: color.ink, ':hover': '#000' },
    color: color.canvas,
    border: 'none',
    padding: '7px 13px',
    borderRadius: radius.sm,
    fontSize: 13,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7
  },
  btnInkDisabled: { opacity: 0.4, cursor: 'default' },
  btnGhost: {
    backgroundColor: { default: 'transparent', ':hover': color.canvas2 },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.hairStrong,
    color: color.ink2,
    padding: '6px 12px',
    borderRadius: radius.sm,
    fontSize: 12.5,
    cursor: 'pointer'
  },
  migrateBox: {
    backgroundColor: color.surfaceWarm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.hair,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 16
  },
  migrateLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: font.mono,
    fontSize: 12,
    color: color.ink2,
    padding: '3px 0'
  },
  fromText: { color: color.ink4, textDecoration: 'line-through' },
  toText: { color: color.moss },
  progress: {
    height: 4,
    backgroundColor: color.hair,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 14
  },
  barFill: { height: '100%', backgroundColor: color.ochre, borderRadius: 2, transition: 'width 180ms linear' },
  migrateCount: { fontFamily: font.mono, fontSize: 11, color: color.ink4, marginTop: 8 },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
    fontFamily: font.mono,
    fontSize: 13
  },
  moss: { color: color.moss },
  rust: { color: color.rust, fontSize: 12, padding: '4px 0 12px' }
})

export function Settings({ vault, docsCount, onClose, onMigrate }: SettingsProps): JSX.Element {
  const [path, setPath] = useState(vault)
  const [phase, setPhase] = useState<Phase>('edit')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<MigrateResult | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

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
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && phase !== 'migrating') onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop render={<div {...stylex.props(s.backdrop)} />} />
        <Dialog.Popup render={<div {...stylex.props(s.popup)} />}>
          <div {...stylex.props(s.head)}>
            <Dialog.Title {...stylex.props(s.title)}>Vault</Dialog.Title>
            <button {...stylex.props(s.iconBtn)} onClick={onClose} disabled={phase === 'migrating'}>
              <Icon name="x" size={16} />
            </button>
          </div>

          <div {...stylex.props(s.body)}>
            {phase === 'edit' && (
              <>
                <label {...stylex.props(s.fieldLabel)}>Vault location</label>
                <input
                  {...stylex.props(s.pathInput)}
                  autoFocus
                  value={path}
                  spellCheck={false}
                  onChange={(e) => setPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && changed) setPhase('confirm')
                  }}
                />
                <p {...stylex.props(s.fieldHelp)}>
                  Every Flyt document lives in this folder. Changing the location moves the entire
                  vault — all {docsCount} {docsCount === 1 ? 'document' : 'documents'} — to the new path.
                </p>
                <CloudAccount />
                <div {...stylex.props(s.foot)}>
                  <button {...stylex.props(s.btnGhost)} onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    {...stylex.props(s.btnInk, !changed && s.btnInkDisabled)}
                    disabled={!changed}
                    onClick={() => setPhase('confirm')}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {phase === 'confirm' && (
              <>
                <label {...stylex.props(s.fieldLabel)}>Confirm migration</label>
                <div {...stylex.props(s.migrateBox)}>
                  <div {...stylex.props(s.migrateLine)}>
                    <Icon name="folder" size={14} />
                    <span {...stylex.props(s.fromText)}>{vault}</span>
                  </div>
                  <div {...stylex.props(s.migrateLine)}>
                    <Icon name="arrow-right" size={14} />
                    <span {...stylex.props(s.toText)}>{clean}</span>
                  </div>
                </div>
                <p {...stylex.props(s.fieldHelp)}>
                  {docsCount} {docsCount === 1 ? 'document' : 'documents'} will be moved and every path
                  updated. Nothing is deleted — the move is atomic.
                </p>
                <div {...stylex.props(s.foot)}>
                  <button {...stylex.props(s.btnGhost)} onClick={() => setPhase('edit')}>
                    Back
                  </button>
                  <button {...stylex.props(s.btnInk)} onClick={startMigration}>
                    <Icon name="arrow-right" size={15} /> Migrate vault
                  </button>
                </div>
              </>
            )}

            {phase === 'migrating' && (
              <>
                <label {...stylex.props(s.fieldLabel)}>Migrating…</label>
                <div {...stylex.props(s.migrateBox)}>
                  <div {...stylex.props(s.migrateLine)}>
                    <Icon name="folder" size={14} />
                    <span {...stylex.props(s.toText)}>{clean}</span>
                  </div>
                  <div {...stylex.props(s.progress)}>
                    <div
                      {...stylex.props(s.barFill)}
                      style={{ width: (progress / Math.max(docsCount, 1)) * 100 + '%' }}
                    />
                  </div>
                  <div {...stylex.props(s.migrateCount)}>
                    {progress} / {docsCount} documents moved
                  </div>
                </div>
              </>
            )}

            {phase === 'done' && (
              <div {...stylex.props(s.statusRow, s.moss)}>
                <Icon name="check" size={18} /> Vault migrated to {clean}
                {result ? ` · ${result.moved} moved` : ''}
              </div>
            )}

            {phase === 'error' && (
              <>
                <div {...stylex.props(s.statusRow, s.rust)}>
                  <Icon name="x" size={16} /> {result?.error || 'Migration failed'}
                </div>
                <div {...stylex.props(s.foot)}>
                  <button {...stylex.props(s.btnGhost)} onClick={() => setPhase('edit')}>
                    Back
                  </button>
                  <button {...stylex.props(s.btnInk)} onClick={onClose}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
