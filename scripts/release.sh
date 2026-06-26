#!/usr/bin/env bash
#
# Local release: build → sign (local Developer ID) → notarize → staple → publish.
# Notarization needs the signing key, which lives only on this Mac — so releases
# are cut locally, not in CI.
#
#   npm run release -- <version>      e.g.  npm run release -- 0.2.0
#
# Requires: the "Developer ID Application: Ur Solutions AS" cert in your keychain,
# the `hem` CLI (for the app-specific password), and `gh` (for the GitHub Release).

set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "usage: npm run release -- <version>   e.g. npm run release -- 0.2.0" >&2
  exit 1
fi
VERSION="${VERSION#v}" # tolerate a leading "v"

APPLE_ID="tormod.haugland@gmail.com"
APPLE_TEAM_ID="4QK8JBAU4V"

echo "▸ flyt release v${VERSION}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ working tree is dirty — commit or stash first." >&2
  exit 1
fi

# App-specific password from Hem (never printed or written to disk).
echo "▸ fetching notarization password from Hem…"
APPLE_APP_SPECIFIC_PASSWORD="$(hem get project/flyt/app-specific-password password --reason "flyt release v${VERSION}")"
if ! printf '%s' "$APPLE_APP_SPECIFIC_PASSWORD" | grep -qE '^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$'; then
  echo "✗ unexpected password shape from Hem" >&2
  exit 1
fi
export APPLE_ID APPLE_TEAM_ID APPLE_APP_SPECIFIC_PASSWORD

# Set the version (no git tag yet — we commit it ourselves below).
npm pkg set version="$VERSION"

# Build, sign, and notarize the app + zip (electron-builder notarizes from the env).
echo "▸ building + signing + notarizing…"
rm -rf release
npm run dist

DMG="release/Flyt-${VERSION}-arm64.dmg"
ZIP="release/Flyt-${VERSION}-arm64.zip"
APP="release/mac-arm64/Flyt.app"
[[ -f "$DMG" ]] || { echo "✗ expected $DMG not found" >&2; exit 1; }

# electron-builder staples the .app but not the .dmg — notarize + staple it too.
echo "▸ notarizing + stapling the DMG…"
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
xcrun stapler staple "$DMG"

echo "▸ verifying…"
xcrun stapler validate "$APP"
xcrun stapler validate "$DMG"
spctl -a -vvv -t install "$APP"

# Commit the version bump, tag, push.
git add package.json package-lock.json
git commit -m "release: v${VERSION}"
git tag -a "v${VERSION}" -m "Flyt v${VERSION}"
git push origin HEAD --follow-tags

# Publish the GitHub Release with the signed + notarized artifacts.
echo "▸ publishing GitHub Release v${VERSION}…"
gh release create "v${VERSION}" "$DMG" "$ZIP" \
  --title "Flyt v${VERSION}" \
  --notes "Signed + notarized macOS build (Apple Silicon). \`shasum -a 256\` of the DMG: \`$(shasum -a 256 "$DMG" | awk '{print $1}')\`"

echo "✓ released v${VERSION} → $(gh repo view --json url -q .url)/releases/tag/v${VERSION}"
