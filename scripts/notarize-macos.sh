#!/usr/bin/env bash
#
# notarize-macos.sh — code-sign and notarize the Meridian macOS build locally.
#
# Security Checklist #4: Signed + notarized releases are trusted by macOS
# Gatekeeper (no "unidentified developer" warnings) and by the App Store.
#
# PREREQUISITES (macOS only):
#   1. A Developer ID Application certificate in your keychain
#      (or export it and import it with the commands below).
#   2. Your Apple ID + an app-specific password (for notarytool).
#
# USAGE:
#   bash scripts/notarize-macos.sh [path-to-Meridian.app]
#
#   Default app path: dist/meridian/Meridian.app
#
# ENV VARS (optional, otherwise prompted):
#   APPLE_ID                    - Apple ID email
#   APPLE_APP_SPECIFIC_PASSWORD - app-specific password for notarization
#   APPLE_TEAM_ID               - Apple Developer Team ID
#   APPLE_CERTIFICATE_P12       - base64 of Developer ID Application .p12
#   APPLE_CERTIFICATE_PASSWORD  - password for that .p12 (if importing)
#
# The .p12 import is optional — if you already have the cert in your
# keychain, you can skip the APPLE_CERTIFICATE_* vars entirely.

set -euo pipefail

APP_PATH="${1:-dist/meridian/Meridian.app}"

if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: App bundle not found at '$APP_PATH'." >&2
  echo "Build it first with: npm run dist -- --release --macos-bundle" >&2
  exit 1
fi

# ── Optional: import the Developer ID cert into a throwaway keychain ────────
if [ -n "${APPLE_CERTIFICATE_P12:-}" ]; then
  echo "Importing Developer ID certificate from APPLE_CERTIFICATE_P12..."
  TMP_P12="$(mktemp)"
  echo -n "$APPLE_CERTIFICATE_P12" | base64 --decode > "$TMP_P12"
  security import "$TMP_P12" -k "$(security default-keychain -d user)" \
    -P "${APPLE_CERTIFICATE_PASSWORD:-}" -T /usr/bin/codesign -T /usr/bin/security
  rm -f "$TMP_P12"
fi

# ── Sign ─────────────────────────────────────────────────────────────────────
SIGN_IDENTITY="${APPLE_SIGN_IDENTITY:-Developer ID Application}"
echo "Code-signing '$APP_PATH' with identity: $SIGN_IDENTITY"
codesign --force --deep --options runtime \
  --entitlements build/entitlements.mac.plist \
  --sign "$SIGN_IDENTITY" "$APP_PATH"
codesign --verify --verbose=2 "$APP_PATH"
echo "Signature verification passed."

# ── Notarize ────────────────────────────────────────────────────────────────
if [ -z "${APPLE_ID:-}" ] || [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] || [ -z "${APPLE_TEAM_ID:-}" ]; then
  echo ""
  echo "Skipping notarization — set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD,"
  echo "and APPLE_TEAM_ID to notarize. The app is signed but not notarized."
  exit 0
fi

ZIP_PATH="$(mktemp -d)/Meridian-notarize.zip"
echo "Submitting to Apple for notarization (this can take a few minutes)..."
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"
xcrun notarytool submit "$ZIP_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "Stapling the notarization ticket to the app..."
xcrun stapler staple "$APP_PATH"
rm -f "$ZIP_PATH"

echo ""
echo "✓ Signed and notarized: $APP_PATH"
echo "  You can now distribute this app; Gatekeeper will trust it."
