# Flyt Sync/Auth Backend

Flyt now has the first backend lane wired for personal sync:

- Convex Cloud as the backend.
- Better Auth for email/password accounts and Convex JWT auth.
- App-owned `appUsers`, `workspaces`, `workspaceMembers`, `vaults`, and `devices`.
- Trestle Replicate for the `documents` collection CRDT event log and local IndexedDB/Yjs cache.
- Plain Markdown files in the local vault remain the durable local mirror.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Run `npx convex dev` and link/create the Convex project.
3. Fill in the generated `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL`.
4. Set `BETTER_AUTH_SECRET`:

   ```bash
   openssl rand -base64 32
   ```

5. Set both auth URLs to the Convex site origin:

   ```env
   BETTER_AUTH_URL=https://<your-deployment>.convex.site
   VITE_BETTER_AUTH_URL=https://<your-deployment>.convex.site
   ```

6. Push env vars to Convex:

   ```bash
   npx convex env set BETTER_AUTH_SECRET
   npx convex env set BETTER_AUTH_URL
   npx convex env set PUBLIC_APP_URL
   ```

7. Restart `npx convex dev`, then run Flyt:

   ```bash
   npm run dev
   ```

## Current Behavior

- Without `VITE_CONVEX_URL` and `VITE_BETTER_AUTH_URL`, Flyt stays local-only.
- With cloud env configured, the Settings modal shows Flyt sync sign-in/sign-up.
- Signing in provisions a personal workspace and default `Flyt` sync vault.
- Local document creates/updates are pushed into the Replicate `documents` collection.
- Remote document creates/updates are upserted back into the local Markdown vault.

## Intentional Limits

- Replicate 1.1.2 streams a whole collection; this implementation is a personal/single-tenant proof. Before paid multi-tenant SaaS, add vault-scoped Replicate functions or use a deployment-per-user/team model.
- Markdown body sync is currently whole-field. Add a Y.Text/CodeMirror bridge before claiming true simultaneous character-level collaboration.
- Local hard deletes do not yet delete cloud docs. Add tombstones/delete intents before enabling bidirectional deletes.
- Billing is intentionally omitted for this pass.
- Packaged Electron auth still needs a production-origin pass. Dev runs from
  `http://localhost:5173`; a signed app loaded from `file://` may need a
  privileged custom protocol such as `flyt://app` before cloud login is reliable.
