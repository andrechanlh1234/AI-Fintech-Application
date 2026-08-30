#!/usr/bin/env bash
# Build the web app, sync it into the native iOS shell, then build + install
# + launch on the paired iPhone -- all over WiFi (the device is paired over
# localNetwork, so no cable is needed). Run this after making code changes
# to get them onto the phone.
#
#   scripts/deploy-ios.sh
#
# Requirements:
#   - iPhone on the same WiFi as this Mac, unlocked, already trusted/paired
#   - the FastAPI backend running on this Mac:
#       backend/.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
#
# Override any of these inline, e.g.  MAC_LAN_IP=192.168.1.20 scripts/deploy-ios.sh
set -euo pipefail

MAC_LAN_IP="${MAC_LAN_IP:-$(ipconfig getifaddr en0 2>/dev/null || echo 192.168.0.15)}"
DEVICE_ID="${DEVICE_ID:-00008120-000E35C82102201E}"
BUNDLE_ID="${BUNDLE_ID:-com.andrechan.cukai}"
API_BASE="${VITE_API_BASE:-http://${MAC_LAN_IP}:8000}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "▸ Web build   (VITE_API_BASE=$API_BASE)"
( cd app && VITE_API_BASE="$API_BASE" npm run build )

echo "▸ cap sync ios"
( cd app && npx cap sync ios )

echo "▸ xcodebuild  (device $DEVICE_ID)"
xcodebuild -project app/ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "id=${DEVICE_ID}" -allowProvisioningUpdates \
  -derivedDataPath build/DD build

APP_PATH="build/DD/Build/Products/Debug-iphoneos/App.app"
echo "▸ install     $APP_PATH"
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

echo "▸ launch      $BUNDLE_ID"
xcrun devicectl device process launch --terminate-existing --device "$DEVICE_ID" "$BUNDLE_ID"

echo "✓ Deployed to the phone over WiFi."
