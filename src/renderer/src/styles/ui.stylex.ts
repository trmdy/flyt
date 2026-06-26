// Shared StyleX primitives used across screens (top bar, buttons, kbd hint,
// status bar). Mirrors the matching selectors in app.css. Authored with
// longhand properties — StyleX drops conflicting shorthands like `background`.

import * as stylex from '@stylexjs/stylex'
import { color, font, radius, motion } from './tokens.stylex'

export const ui = stylex.create({
  // ——— shared top bar ———
  bar: {
    height: 54,
    flex: '0 0 54px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    paddingBlock: 0,
    paddingInline: 20,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.hair,
    backgroundColor: color.canvas,
    position: 'relative',
    zIndex: 4
  },

  // ——— kbd hint chip ———
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: font.mono,
    fontSize: 10.5,
    color: color.ink3,
    backgroundColor: color.canvas2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.hair,
    borderRadius: 4,
    paddingBlock: 1,
    paddingInline: 5,
    lineHeight: 1.4,
    whiteSpace: 'nowrap'
  },

  // ——— icon button ———
  iconBtn: {
    width: 32,
    height: 32,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: { default: 'transparent', ':hover': color.canvas2 },
    borderRadius: radius.sm,
    color: { default: color.ink3, ':hover': color.ink },
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transitionProperty: 'background-color, color',
    transitionTimingFunction: motion.ease,
    transitionDuration: motion.fast
  },

  // ——— solid ink button ———
  btnInk: {
    backgroundColor: { default: color.ink, ':hover': '#000' },
    color: color.canvas,
    borderWidth: 0,
    borderStyle: 'none',
    paddingBlock: 7,
    paddingInline: 13,
    borderRadius: radius.sm,
    fontSize: 13,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    whiteSpace: 'nowrap',
    transform: { default: 'none', ':active': 'translateY(0.5px)' },
    transitionProperty: 'background-color, transform',
    transitionTimingFunction: motion.ease,
    transitionDuration: motion.fast
  },

  // ——— status bar ———
  statusbar: {
    height: 28,
    flex: '0 0 28px',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: color.hair,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    paddingBlock: 0,
    paddingInline: 18,
    fontFamily: font.mono,
    fontSize: 11,
    color: color.ink4
  },
  statusSep: { color: color.ink5 },
  statusVault: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    color: { default: 'inherit', ':hover': color.ink2 }
  },
  pushRight: { marginLeft: 'auto' }
})

// Merge a StyleX props object's className with extra global utility/hook classes
// (e.g. `.scroll` webkit-scrollbar, or the `.bar`/`.doc-bar` hooks the macOS
// titlebar CSS keys off). StyleX styles carry no inline vars on these elements,
// so only the className needs merging.
export const cx = (sx: { className?: string }, ...names: string[]): string =>
  [...names, sx.className].filter(Boolean).join(' ')

export const scrollClass = (sx: { className?: string }): string => cx(sx, 'scroll')
