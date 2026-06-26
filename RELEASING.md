# Developing & releasing Flyt

## Day-to-day development — no rebuild, no signing

Run from source with hot reload. **Don't** repackage/sign for every change:

```bash
npm run dev
```

- Renderer (React/UI) changes hot-reload instantly.
- Main / preload changes restart the app automatically.
- Uses the same vault (`~/Documents/Flyt`) and settings as the installed app.

> In dev the process runs as **Electron** (bundle id `com.github.Electron`), not
> `no.thto.flyt`. So the *installed-app* integrations — the AeroSpace float rule and
> the `open -a Flyt` (⌃⌥⌘F) shortcut — target the **installed** `/Applications/Flyt.app`,
> not the dev instance. That's expected; just close the installed app while developing
> if you don't want two windows.

Fast checks without launching anything:

```bash
npm run typecheck      # main + renderer
npm run build          # bundle into out/ (no packaging)
```

## Cutting & publishing a release — signed + notarized

Releases are built **locally**, because notarization needs the Developer ID signing
key, which lives only on this Mac (never on GitHub). One command does everything:

```bash
npm run release -- 0.2.0
```

`scripts/release.sh` then:

1. verifies the working tree is clean,
2. pulls the app-specific password from **Hem** (`project/flyt/app-specific-password`),
3. sets the version, builds, **signs** (Developer ID), **notarizes**, and **staples**
   the `.app` *and* the `.dmg` (electron-builder only staples the app, so the DMG is
   notarized + stapled separately),
4. verifies with `stapler validate` + `spctl`,
5. commits the version bump, tags `vX.Y.Z`, and pushes,
6. publishes a **GitHub Release** with the signed `.dmg` + `.zip`.

### Prerequisites

- The **Developer ID Application: Ur Solutions AS (4QK8JBAU4V)** cert in your login keychain.
- `hem`, `gh` (authenticated), and Xcode command-line tools on `PATH`.
- All Apple Developer **legal agreements accepted** — otherwise notarization fails with
  `HTTP 403: A required agreement is missing or has expired`. Accept them at
  <https://developer.apple.com/account>.

### Install the freshly released build locally

```bash
open release/Flyt-<version>-arm64.dmg     # then drag Flyt → Applications
# or, straight from the build output:
cp -R release/mac-arm64/Flyt.app /Applications/
```

A locally built/installed app has no quarantine flag, so it opens without a warning
even before notarization. Notarization only matters for copies that are *downloaded*
(e.g. from the GitHub Release).

### Verify a build by hand

```bash
xcrun stapler validate "release/mac-arm64/Flyt.app"
spctl -a -vvv -t install "release/mac-arm64/Flyt.app"   # → accepted, Notarized Developer ID
```

## CI

`.github/workflows/ci.yml` runs on every push/PR: typecheck + an **unsigned** build,
uploading a test DMG as a workflow artifact. No secrets, no signing key on GitHub.

## Versioning

Bump the number you pass to `npm run release` (semver-ish): `0.1.0` → `0.1.1` for
fixes, `0.2.0` for features.
