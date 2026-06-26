// A small custom context menu (matches the app aesthetic), portal-rendered at the
// cursor and clamped to the viewport. Dismisses on outside-click or Escape.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as stylex from '@stylexjs/stylex'
import { Icon } from './Icon'
import { color, font, radius, motion } from '../styles/tokens.stylex'

const pop = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(-6px) scale(.99)' }
})

const s = stylex.create({
  menu: {
    position: 'fixed',
    zIndex: 85,
    minWidth: 172,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.hair,
    borderRadius: radius.md,
    boxShadow: `0 1px 0 rgba(0,0,0,0.03), 0 10px 30px rgba(28,25,21,0.18), 0 0 0 1px ${color.hair}`,
    padding: 4,
    animationName: pop,
    animationDuration: '120ms',
    animationTimingFunction: motion.ease
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: { default: 'transparent', ':hover': color.canvas2 },
    paddingBlock: 7,
    paddingInline: 10,
    borderRadius: radius.sm,
    fontFamily: font.ui,
    fontSize: 13,
    color: color.ink,
    letterSpacing: '-0.005em',
    cursor: 'pointer',
    textAlign: 'left'
  },
  itemDanger: {
    color: color.rust,
    backgroundColor: { default: 'transparent', ':hover': 'rgba(182,88,56,0.08)' }
  },
  ico: { display: 'flex', flex: '0 0 auto', color: color.ink3 },
  icoDanger: { color: color.rust }
})

export interface MenuItem {
  label: string
  icon?: string
  danger?: boolean
  onSelect: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let nx = x
    let ny = y
    if (x + r.width > window.innerWidth - 8) nx = Math.max(8, window.innerWidth - r.width - 8)
    if (y + r.height > window.innerHeight - 8) ny = Math.max(8, window.innerHeight - r.height - 8)
    setPos({ x: nx, y: ny })
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      {...stylex.props(s.menu)}
      style={{ top: pos.y, left: pos.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => (
        <button
          key={i}
          {...stylex.props(s.item, it.danger && s.itemDanger)}
          onClick={() => {
            onClose()
            it.onSelect()
          }}
        >
          {it.icon && (
            <span {...stylex.props(s.ico, it.danger && s.icoDanger)}>
              <Icon name={it.icon} size={14} />
            </span>
          )}
          <span>{it.label}</span>
        </button>
      ))}
    </div>,
    document.body
  )
}
