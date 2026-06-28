import { ConvexClient } from 'convex/browser'
import { ConvexReactClient } from 'convex/react'
import { createAuthClient } from 'better-auth/react'
import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const authUrl = import.meta.env.VITE_BETTER_AUTH_URL

export const cloudEnabled = Boolean(convexUrl && authUrl)

export const convexReactClient = cloudEnabled ? new ConvexReactClient(convexUrl) : null
export const convexClientForSync = cloudEnabled ? new ConvexClient(convexUrl) : null

export const authClient = cloudEnabled
  ? createAuthClient({
      baseURL: authUrl,
      plugins: [convexClient(), crossDomainClient()]
    })
  : null

export async function refreshConvexSyncAuth(): Promise<void> {
  if (!authClient || !convexClientForSync) return

  convexClientForSync.setAuth(async ({ forceRefreshToken }) => {
    const result = await authClient.convex.token({
      fetchOptions: {
        throw: false
      }
    })
    const token = result.data?.token ?? null
    if (!token && forceRefreshToken) return null
    return token
  })
}
