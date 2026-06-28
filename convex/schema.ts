import { defineSchema, defineTable } from "convex/server";
import { schema as replicateSchema } from "@trestleinc/replicate/server";
import { v } from "convex/values";

export default defineSchema({
  appUsers: defineTable({
    authUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"]),

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    createdByUserId: v.id("appUsers"),
    personal: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_createdByUserId", ["createdByUserId"])
    .index("by_slug", ["slug"]),

  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("appUsers"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("guest")),
    status: v.union(v.literal("active"), v.literal("invited"), v.literal("suspended")),
    createdAt: v.number(),
    joinedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"]),

  devices: defineTable({
    userId: v.id("appUsers"),
    name: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_user", ["userId"]),

  vaults: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    createdByUserId: v.id("appUsers"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_createdByUserId", ["createdByUserId"]),

  documents: replicateSchema.table(
    {
      id: v.string(),
      ownerUserId: v.id("appUsers"),
      vaultId: v.id("vaults"),
      file: v.string(),
      title: v.string(),
      tags: v.array(v.string()),
      body: v.string(),
      created: v.number(),
      modified: v.number(),
      archived: v.boolean(),
      updatedByUserId: v.optional(v.id("appUsers")),
      updatedByDeviceId: v.optional(v.id("devices")),
    },
    (table) =>
      table
        .index("by_doc_id", ["id"])
        .index("by_timestamp", ["timestamp"])
        .index("by_owner", ["ownerUserId"])
        .index("by_vault", ["vaultId"])
        .index("by_vault_modified", ["vaultId", "modified"])
  ),
});
