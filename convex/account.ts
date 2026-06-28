import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";

type AuthUser = {
  _id?: string;
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

async function getVerifiedAuthUser(ctx: QueryCtx | MutationCtx): Promise<Required<Pick<AuthUser, "_id">> & AuthUser> {
  const authUser = (await authComponent.getAuthUser(ctx)) as AuthUser;
  const authUserId = String(authUser._id ?? authUser.id ?? "");
  if (!authUserId) throw new ConvexError("Authenticated user is missing an id");
  if (!authUser.email) throw new ConvexError("Authenticated user is missing an email");
  return { ...authUser, _id: authUserId };
}

async function getAppUserByAuthId(
  ctx: QueryCtx | MutationCtx,
  authUserId: string
): Promise<Doc<"appUsers"> | null> {
  return await ctx.db
    .query("appUsers")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
}

export async function getCurrentAppUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"appUsers">> {
  const authUser = await getVerifiedAuthUser(ctx);
  const appUser = await getAppUserByAuthId(ctx, authUser._id);
  if (!appUser) throw new ConvexError("App user has not been provisioned");
  return appUser;
}

async function listMemberships(ctx: QueryCtx | MutationCtx, userId: Id<"appUsers">) {
  return await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

async function listVaultsForMemberships(ctx: QueryCtx | MutationCtx, memberships: Doc<"workspaceMembers">[]) {
  const vaults: Doc<"vaults">[] = [];
  for (const membership of memberships) {
    const workspaceVaults = await ctx.db
      .query("vaults")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", membership.workspaceId))
      .collect();
    vaults.push(...workspaceVaults);
  }
  return vaults;
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await getVerifiedAuthUser(ctx);
    const user = await getAppUserByAuthId(ctx, authUser._id);
    if (!user) return null;

    const memberships = await listMemberships(ctx, user._id);
    const workspaces = await Promise.all(memberships.map((membership) => ctx.db.get(membership.workspaceId)));
    const vaults = await listVaultsForMemberships(ctx, memberships);

    return {
      user,
      memberships,
      workspaces: workspaces.filter(Boolean),
      vaults,
      defaultVault: vaults[0] ?? null,
    };
  },
});

export const ensure = mutation({
  args: {
    workspaceName: v.optional(v.string()),
    vaultName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await getVerifiedAuthUser(ctx);
    const now = Date.now();
    let user = await getAppUserByAuthId(ctx, authUser._id);

    if (!user) {
      const userId = await ctx.db.insert("appUsers", {
        authUserId: authUser._id,
        email: String(authUser.email),
        name: authUser.name ?? undefined,
        image: authUser.image ?? undefined,
        createdAt: now,
        updatedAt: now,
      });
      user = (await ctx.db.get(userId))!;
    } else {
      await ctx.db.patch(user._id, {
        email: String(authUser.email),
        name: authUser.name ?? undefined,
        image: authUser.image ?? undefined,
        updatedAt: now,
      });
      user = (await ctx.db.get(user._id))!;
    }

    let memberships = await listMemberships(ctx, user._id);
    let workspace: Doc<"workspaces"> | null = null;
    if (memberships.length > 0) {
      workspace = await ctx.db.get(memberships[0].workspaceId);
    }

    if (!workspace) {
      const baseName = args.workspaceName?.trim() || authUser.name?.trim() || "Personal";
      const workspaceId = await ctx.db.insert("workspaces", {
        name: baseName,
        slug: `${slugify(baseName)}-${String(user._id).slice(-6)}`,
        createdByUserId: user._id,
        personal: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("workspaceMembers", {
        workspaceId,
        userId: user._id,
        role: "owner",
        status: "active",
        createdAt: now,
        joinedAt: now,
      });
      workspace = (await ctx.db.get(workspaceId))!;
      memberships = await listMemberships(ctx, user._id);
    }

    let vaults = await listVaultsForMemberships(ctx, memberships);
    let vault = vaults.find((candidate) => candidate.workspaceId === workspace!._id) ?? null;
    if (!vault) {
      const vaultId = await ctx.db.insert("vaults", {
        workspaceId: workspace._id,
        name: args.vaultName?.trim() || "Flyt",
        createdByUserId: user._id,
        createdAt: now,
        updatedAt: now,
      });
      vault = (await ctx.db.get(vaultId))!;
      vaults = await listVaultsForMemberships(ctx, memberships);
    }

    return {
      user,
      workspace,
      memberships,
      vaults,
      defaultVault: vault,
    };
  },
});
