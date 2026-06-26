// Design tokens as StyleX variables. Mirrors the values in app.css's :root so a
// StyleX'd component is pixel-identical to the original CSS-class version.

import * as stylex from '@stylexjs/stylex'

export const color = stylex.defineVars({
  canvas: '#faf7f1',
  canvas2: '#f4f0e7',
  surface: '#ffffff',
  surfaceWarm: '#fbf8f2',
  ink: '#1c1915',
  ink2: '#4a443c',
  ink3: '#807769',
  ink4: '#b4ab9b',
  ink5: '#d8d1c2',
  hair: '#e8e1d2',
  hairStrong: '#ddd4c1',
  ochre: '#b8862f',
  ochreSoft: '#f0e4c3',
  moss: '#6b7a3a',
  rust: '#b65838',
  scrim: 'rgba(28, 25, 21, 0.2)'
})

export const font = stylex.defineVars({
  ui: '"Geist Sans", -apple-system, BlinkMacSystemFont, "Inter Tight", system-ui, sans-serif',
  prose: '"Newsreader", "Iowan Old Style", "Charter", "Georgia", serif',
  mono: '"Geist Mono", ui-monospace, "SF Mono", "JetBrains Mono", monospace'
})

export const radius = stylex.defineVars({
  sm: '4px',
  md: '6px',
  lg: '10px'
})

export const motion = stylex.defineVars({
  fast: '120ms',
  med: '220ms',
  ease: 'cubic-bezier(.2,.7,.3,1)'
})
