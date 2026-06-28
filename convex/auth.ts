import { betterAuth } from "better-auth";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

function configuredOrigins(): string[] {
  return [
    process.env.PUBLIC_APP_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ].filter((origin): origin is string => Boolean(origin));
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.CONVEX_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    trustedOrigins: configuredOrigins(),
    plugins: [
      convex({ authConfig }),
      crossDomain({ siteUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:5173" }),
    ],
  });

export const { getAuthUser } = authComponent.clientApi();

export const rotateKeys = internalAction({
  args: {},
  handler: async (ctx) => {
    return await createAuth(ctx).api.rotateKeys();
  },
});
