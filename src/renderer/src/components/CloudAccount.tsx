import { useEffect, useState } from 'react'
import { useMutation } from 'convex/react'
import * as stylex from '@stylexjs/stylex'
import { authClient, cloudEnabled } from '../lib/cloud'
import { Icon } from './Icon'
import { color, font, radius } from '../styles/tokens.stylex'

type Mode = 'sign-in' | 'sign-up'

const s = stylex.create({
  wrap: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: color.hair,
    marginTop: 20,
    paddingTop: 18
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  label: {
    fontFamily: font.mono,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: color.ink4,
    marginBottom: 9
  },
  status: {
    fontSize: 12.5,
    color: color.ink3,
    lineHeight: 1.5
  },
  email: {
    color: color.ink,
    fontFamily: font.mono,
    fontSize: 12
  },
  form: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 9
  },
  full: {
    gridColumn: '1 / -1'
  },
  input: {
    minWidth: 0,
    width: '100%',
    fontFamily: font.ui,
    fontSize: 13,
    color: color.ink,
    backgroundColor: color.surfaceWarm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.hairStrong, ':focus': 'var(--accent)' },
    borderRadius: radius.md,
    padding: '10px 12px',
    outline: 'none'
  },
  foot: {
    gridColumn: '1 / -1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  toggle: {
    border: 'none',
    backgroundColor: 'transparent',
    color: { default: color.ink3, ':hover': color.ink },
    fontSize: 12.5,
    cursor: 'pointer',
    padding: 0
  },
  btn: {
    backgroundColor: { default: color.ink, ':hover': '#000' },
    color: color.canvas,
    border: 'none',
    padding: '7px 13px',
    borderRadius: radius.sm,
    fontSize: 13,
    cursor: { default: 'pointer', ':disabled': 'default' },
    opacity: { default: 1, ':disabled': 0.45 },
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7
  },
  ghost: {
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
  error: {
    color: color.rust,
    fontSize: 12.5,
    lineHeight: 1.45,
    marginTop: 9
  }
})

function CloudAccountInner(): JSX.Element {
  const ensureAccount = useMutation('account:ensure' as any)
  const session = authClient!.useSession()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vaultName, setVaultName] = useState<string | null>(null)

  useEffect(() => {
    if (!session.data?.session) {
      setVaultName(null)
      return
    }
    let cancelled = false
    ensureAccount({ vaultName: 'Flyt' })
      .then((account: any) => {
        if (!cancelled) setVaultName(account?.defaultVault?.name ?? 'Flyt')
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [ensureAccount, session.data?.session?.id])

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result =
        mode === 'sign-up'
          ? await authClient!.signUp.email({ name: name.trim() || email, email, password })
          : await authClient!.signIn.email({ email, password })
      if (result.error) setError(result.error.message || 'Authentication failed')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const signedInEmail = session.data?.user?.email

  return (
    <div {...stylex.props(s.wrap)}>
      <div {...stylex.props(s.label)}>Flyt sync</div>
      {signedInEmail ? (
        <>
          <div {...stylex.props(s.row)}>
            <div {...stylex.props(s.status)}>
              Signed in as <span {...stylex.props(s.email)}>{signedInEmail}</span>
              {vaultName ? ` · ${vaultName}` : ''}
            </div>
            <button
              {...stylex.props(s.ghost)}
              onClick={() => {
                authClient!.signOut()
              }}
            >
              Sign out
            </button>
          </div>
          {error && <div {...stylex.props(s.error)}>{error}</div>}
        </>
      ) : (
        <div {...stylex.props(s.form)}>
          {mode === 'sign-up' && (
            <input
              {...stylex.props(s.input, s.full)}
              value={name}
              placeholder="Name"
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            {...stylex.props(s.input)}
            value={email}
            placeholder="Email"
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            {...stylex.props(s.input)}
            type="password"
            value={password}
            placeholder="Password"
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email && password && !busy) submit()
            }}
          />
          <div {...stylex.props(s.foot)}>
            <button
              {...stylex.props(s.toggle)}
              onClick={() => {
                setMode((v) => (v === 'sign-in' ? 'sign-up' : 'sign-in'))
                setError(null)
              }}
            >
              {mode === 'sign-in' ? 'Create account' : 'Use existing account'}
            </button>
            <button {...stylex.props(s.btn)} disabled={!email || !password || busy} onClick={submit}>
              <Icon name={mode === 'sign-in' ? 'check' : 'plus'} size={14} />
              {mode === 'sign-in' ? 'Sign in' : 'Create'}
            </button>
          </div>
          {error && <div {...stylex.props(s.error, s.full)}>{error}</div>}
        </div>
      )}
    </div>
  )
}

export function CloudAccount(): JSX.Element {
  if (!cloudEnabled || !authClient) {
    return (
      <div {...stylex.props(s.wrap)}>
        <div {...stylex.props(s.label)}>Flyt sync</div>
        <div {...stylex.props(s.status)}>Set VITE_CONVEX_URL and VITE_BETTER_AUTH_URL to enable cloud sync.</div>
      </div>
    )
  }

  return <CloudAccountInner />
}
