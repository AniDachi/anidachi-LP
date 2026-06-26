#!/usr/bin/env bash
set -euo pipefail

CDP_PORT="${LINKEDIN_CDP_PORT:-9222}"
PROFILE_DIR="${LINKEDIN_CHROME_PROFILE:-$HOME/.chrome-linkedin-automation}"

if [[ "$(uname)" == "Darwin" ]]; then
  CHROME_BIN="${LINKEDIN_CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
else
  CHROME_BIN="${LINKEDIN_CHROME_BIN:-google-chrome}"
fi

if [[ ! -x "$CHROME_BIN" ]]; then
  echo "Chrome not found at: $CHROME_BIN" >&2
  echo "Set LINKEDIN_CHROME_BIN to your Chrome executable path." >&2
  exit 1
fi

port_in_use() {
  lsof -nP -iTCP:"$CDP_PORT" -sTCP:LISTEN >/dev/null 2>&1
}

print_port_conflict_help() {
  echo "[linkedin:chrome] Port $CDP_PORT is already in use:" >&2
  lsof -nP -iTCP:"$CDP_PORT" -sTCP:LISTEN >&2 || true
  echo >&2
  echo "[linkedin:chrome] Another Chrome debugging session is already running." >&2
  echo "[linkedin:chrome] Either reuse that window, or stop stale Chrome on this port:" >&2
  echo "  lsof -tiTCP:$CDP_PORT -sTCP:LISTEN | xargs kill" >&2
  echo "  pnpm linkedin:chrome" >&2
  echo >&2
  echo "[linkedin:chrome] Or use a different port:" >&2
  echo "  LINKEDIN_CDP_PORT=9333 pnpm linkedin:chrome" >&2
}

mkdir -p "$PROFILE_DIR"

if port_in_use; then
  if [[ "${LINKEDIN_CHROME_REUSE:-}" == "1" ]]; then
    echo "[linkedin:chrome] Port $CDP_PORT already in use; reusing existing Chrome (LINKEDIN_CHROME_REUSE=1)."
    echo "[linkedin:chrome] Open or focus your Sales Navigator people search, then run linkedin:connect."
    exit 0
  fi
  print_port_conflict_help
  exit 1
fi

echo "[linkedin:chrome] Profile: $PROFILE_DIR"
echo "[linkedin:chrome] CDP port: $CDP_PORT"
echo "[linkedin:chrome] Starting Chrome (separate from your daily profile)..."
echo "[linkedin:chrome] First time: log into LinkedIn/Sales Navigator, then open a people search."

exec "$CHROME_BIN" \
  --remote-debugging-port="$CDP_PORT" \
  --remote-debugging-address=127.0.0.1 \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling \
  --disable-features=CalculateNativeWinOcclusion \
  "https://www.linkedin.com/sales/search/people"
