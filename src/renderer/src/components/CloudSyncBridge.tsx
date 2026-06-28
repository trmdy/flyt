import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import type { Doc } from '@shared/types'
import { authClient, cloudEnabled } from '../lib/cloud'
import { pushDocsToCloud, sameDocContent, subscribeCloudDocs, type SyncAccount } from '../lib/flytSync'

interface CloudSyncBridgeProps {
  docs: Doc[]
  upsertDoc: (doc: Doc) => Promise<void>
  deleteDoc: (id: string) => Promise<void>
}

export function CloudSyncBridge({ docs, upsertDoc, deleteDoc }: CloudSyncBridgeProps): null {
  const ensureAccount = useMutation('account:ensure' as any)
  const session = authClient?.useSession()
  const [account, setAccount] = useState<SyncAccount | null>(null)
  const docsRef = useRef(docs)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  docsRef.current = docs

  useEffect(() => {
    if (!cloudEnabled || !session?.data?.session) {
      setAccount(null)
      return
    }
    let cancelled = false
    ensureAccount({ vaultName: 'Flyt' })
      .then((next: SyncAccount) => {
        if (!cancelled) setAccount(next)
      })
      .catch(() => {
        if (!cancelled) setAccount(null)
      })
    return () => {
      cancelled = true
    }
  }, [ensureAccount, session?.data?.session?.id])

  useEffect(() => {
    if (!account) return
    let unsubscribe: (() => void) | null = null
    let cancelled = false

    subscribeCloudDocs(
      async (doc) => {
        const current = docsRef.current.find((d) => d.id === doc.id)
        if (current && sameDocContent(current, doc)) return
        await upsertDoc(doc)
      },
      async (id) => {
        if (!docsRef.current.some((d) => d.id === id)) return
        await deleteDoc(id)
      }
    ).then((fn) => {
      if (cancelled) fn()
      else unsubscribe = fn
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [account, deleteDoc, upsertDoc])

  useEffect(() => {
    if (!account) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      pushDocsToCloud(docsRef.current, account).catch(() => {
        // Keep local writing independent; sync errors are retried on the next local change/session refresh.
      })
    }, 700)
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
  }, [account, docs])

  return null
}
