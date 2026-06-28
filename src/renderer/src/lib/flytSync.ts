import { collection, persistence } from '@trestleinc/replicate/client'
import { convexClientForSync, refreshConvexSyncAuth } from './cloud'
import type { Doc } from '@shared/types'
import { z } from 'zod'

const syncDocSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  vaultId: z.string(),
  file: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  body: z.string(),
  created: z.number(),
  modified: z.number(),
  archived: z.boolean(),
  updatedByUserId: z.string().optional(),
  updatedByDeviceId: z.string().optional()
})

export type SyncDoc = z.infer<typeof syncDocSchema>

export interface SyncAccount {
  user: { _id: string }
  defaultVault: { _id: string }
}

const documents = collection.create({
  persistence: () => persistence.indexeddb('flyt-documents'),
  config: () => {
    if (!convexClientForSync) throw new Error('Convex sync client is not configured')
    return {
      schema: syncDocSchema,
      convexClient: convexClientForSync,
      api: {
        stream: 'documents:stream' as any,
        material: 'documents:material' as any,
        recovery: 'documents:recovery' as any,
        insert: 'documents:insert' as any,
        update: 'documents:update' as any,
        remove: 'documents:remove' as any,
        mark: 'documents:mark' as any,
        compact: 'documents:compact' as any
      },
      getKey: (doc: SyncDoc) => doc.id
    }
  }
})

let initPromise: Promise<void> | null = null

async function getCollection() {
  await refreshConvexSyncAuth()
  if (!initPromise) initPromise = documents.init()
  await initPromise
  const coll = documents.get()
  await coll.preload()
  return coll
}

function toSyncDoc(doc: Doc, account: SyncAccount): SyncDoc {
  return {
    id: doc.id,
    ownerUserId: account.user._id,
    vaultId: account.defaultVault._id,
    file: doc.file,
    title: doc.title,
    tags: doc.tags,
    body: doc.body,
    created: doc.created,
    modified: doc.modified,
    archived: doc.archived,
    updatedByUserId: account.user._id
  }
}

export function fromSyncDoc(doc: SyncDoc): Doc {
  return {
    id: doc.id,
    file: doc.file,
    title: doc.title,
    tags: doc.tags,
    body: doc.body,
    created: doc.created,
    modified: doc.modified,
    archived: doc.archived
  }
}

export function sameDocContent(local: Doc, remote: Pick<SyncDoc, keyof Doc>): boolean {
  return (
    local.file === remote.file &&
    local.title === remote.title &&
    local.body === remote.body &&
    local.archived === remote.archived &&
    local.created === remote.created &&
    local.tags.length === remote.tags.length &&
    local.tags.every((tag, i) => tag === remote.tags[i])
  )
}

export async function pushDocsToCloud(docs: Doc[], account: SyncAccount): Promise<void> {
  const coll = await getCollection()
  for (const doc of docs) {
    const next = toSyncDoc(doc, account)
    const existing = coll.get(doc.id) as SyncDoc | undefined
    if (!existing) {
      const tx = coll.insert(next)
      await tx.isPersisted.promise
      continue
    }
    if (sameDocContent(doc, existing)) continue
    const tx = coll.update(doc.id, (draft: SyncDoc) => {
      draft.file = next.file
      draft.title = next.title
      draft.tags = next.tags
      draft.body = next.body
      draft.created = next.created
      draft.modified = next.modified
      draft.archived = next.archived
      draft.updatedByUserId = next.updatedByUserId
    })
    await tx.isPersisted.promise
  }
}

export async function subscribeCloudDocs(
  onUpsert: (doc: Doc) => void | Promise<void>,
  onDelete: (id: string) => void | Promise<void>
): Promise<() => void> {
  const coll = await getCollection()
  const subscription = coll.subscribeChanges(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'delete') {
          void onDelete(String(change.key))
          continue
        }
        void onUpsert(fromSyncDoc(change.value as SyncDoc))
      }
    },
    { includeInitialState: true }
  )
  return () => subscription.unsubscribe()
}
