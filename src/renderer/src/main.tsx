import { createRoot } from 'react-dom/client'

import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/500.css'
import '@fontsource/newsreader/600.css'
import '@fontsource/newsreader/400-italic.css'
import '@fontsource/newsreader/500-italic.css'

import './styles/app.css'
import './styles/editor.css'
import { App } from './App'
import { authClient, cloudEnabled, convexReactClient } from './lib/cloud'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    cloudEnabled && convexReactClient && authClient ? (
      <ConvexBetterAuthProvider client={convexReactClient} authClient={authClient as any}>
        <App />
      </ConvexBetterAuthProvider>
    ) : (
      <App />
    )
  )
}
