#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_DIR="$ROOT_DIR/apps/extension"
OUTPUT_DIR="$EXTENSION_DIR/.output/chrome-mv3-dev"
MANIFEST_PATH="$OUTPUT_DIR/manifest.json"
PROFILE_DIR="${WXT_GOOGLE_CHROME_PROFILE_DIR:-$EXTENSION_DIR/.wxt/google-auth-chrome-data}"
START_URL="${WXT_DEV_START_URL:-https://staging.anidachi.app}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This helper opens Google Chrome via macOS 'open'."
  echo "Run 'pnpm dev:extension:staging' and load $OUTPUT_DIR manually on this OS."
  exit 1
fi

export WXT_EXTENSION_CHANNEL="${WXT_EXTENSION_CHANNEL:-staging}"
export WXT_WEB_HTTP_BASE="${WXT_WEB_HTTP_BASE:-https://staging.anidachi.app}"
export WXT_API_HTTP_BASE="${WXT_API_HTTP_BASE:-https://anidachi-api-staging.vladislav-gul7.workers.dev}"
export WXT_API_WS_BASE="${WXT_API_WS_BASE:-wss://anidachi-api-staging.vladislav-gul7.workers.dev}"
export WXT_BROAD_HOST_PERMISSIONS="${WXT_BROAD_HOST_PERMISSIONS:-true}"
export WXT_DISABLE_WEB_EXT="true"

rm -f "$MANIFEST_PATH"
mkdir -p "$PROFILE_DIR"

(
  cd "$EXTENSION_DIR"
  pnpm exec wxt
) &
WXT_PID=$!

cleanup() {
  if kill -0 "$WXT_PID" 2>/dev/null; then
    kill "$WXT_PID" 2>/dev/null || true
    wait "$WXT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

for _ in {1..120}; do
  if [[ -f "$MANIFEST_PATH" ]]; then
    break
  fi
  if ! kill -0 "$WXT_PID" 2>/dev/null; then
    wait "$WXT_PID"
  fi
  sleep 0.25
done

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "Timed out waiting for WXT dev manifest at $MANIFEST_PATH"
  exit 1
fi

open -na "Google Chrome" --args \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --new-window \
  "chrome://extensions"

cat <<EOF
Opened Google-friendly Chrome profile:
  $PROFILE_DIR

WXT dev extension output:
  $OUTPUT_DIR

One-time Chrome step for this profile:
  1. Enable Developer mode in chrome://extensions.
  2. Click "Load unpacked".
  3. Select:
     $OUTPUT_DIR
  4. Open:
     $START_URL

Keep this process running while developing. Press Ctrl-C to stop WXT.
EOF

wait "$WXT_PID"
