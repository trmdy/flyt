import { ConvexError } from "convex/values";
import { replicate } from "@trestleinc/replicate/server";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getCurrentAppUser } from "./account";

export type SyncDocument = {
  id: string;
  ownerUserId: Id<"appUsers">;
  vaultId: Id<"vaults">;
  file: string;
  title: string;
  tags: string[];
  body: string;
  created: number;
  modified: number;
  archived: boolean;
  updatedByUserId?: Id<"appUsers">;
  updatedByDeviceId?: Id<"devices">;
};

const r = replicate(components.replicate);

async function requireVaultMember(ctx: QueryCtx | MutationCtx, vaultId: Id<"vaults">) {
  const user = await getCurrentAppUser(ctx);
  const vault = await ctx.db.get(vaultId);
  if (!vault) throw new ConvexError("Vault not found");

  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", vault.workspaceId).eq("userId", user._id))
    .unique();

  if (!member || member.status !== "active") {
    throw new ConvexError("Not allowed to access this vault");
  }

  return { user, vault, member };
}

async function requireAuthenticated(ctx: QueryCtx | MutationCtx) {
  return await getCurrentAppUser(ctx);
}

async function requireDocumentWrite(ctx: MutationCtx, doc: SyncDocument) {
  const { user } = await requireVaultMember(ctx, doc.vaultId);
  if (doc.ownerUserId !== user._id) {
    throw new ConvexError("Document owner does not match the current user");
  }
}

async function requireDocumentRemoval(ctx: MutationCtx, documentId: string) {
  const existing = await ctx.db
    .query("documents")
    .withIndex("by_doc_id", (q) => q.eq("id", documentId))
    .unique();

  if (!existing) {
    await requireAuthenticated(ctx);
    return;
  }

  await requireVaultMember(ctx, existing.vaultId);
}

async function requireDocumentCompaction(ctx: MutationCtx, documentId: string) {
  await requireDocumentRemoval(ctx, documentId);
}

export const {
  stream,
  material,
  recovery,
  insert,
  update,
  remove,
  mark,
  compact,
} = r<SyncDocument>({
  collection: "documents",
  compaction: {
    sizeThreshold: "5mb",
    peerTimeout: "24h",
  },
  hooks: {
    // The stock Replicate API streams a whole collection. This is correct for
    // the first personal/single-tenant sync proof. Before Flyt becomes a
    // multi-tenant paid service, these functions need vault-scoped arguments or
    // a backend-per-tenant deployment model.
    evalRead: async (ctx) => {
      await requireAuthenticated(ctx as unknown as QueryCtx);
    },
    evalWrite: async (ctx, doc) => {
      await requireDocumentWrite(ctx as unknown as MutationCtx, doc);
    },
    evalRemove: async (ctx, documentId) => {
      await requireDocumentRemoval(ctx as unknown as MutationCtx, documentId);
    },
    evalMark: async (ctx) => {
      await requireAuthenticated(ctx as unknown as MutationCtx);
    },
    evalCompact: async (ctx, documentId) => {
      await requireDocumentCompaction(ctx as unknown as MutationCtx, documentId);
    },
  },
});
