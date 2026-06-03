#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="$ROOT_DIR/anidachi-extension-public"
EXPERIMENT_DIR="$ROOT_DIR/anidachi-extension-experiment"

: "${WXT_API_HTTP_BASE:=https://anidachi-api.vladislav-gul7.workers.dev}"
: "${WXT_API_WS_BASE:=wss://anidachi-api.vladislav-gul7.workers.dev}"
: "${WXT_BUILD_ID:=$(git rev-parse --short HEAD 2>/dev/null || echo local)-$(date +%Y%m%d%H%M%S)}"

export WXT_API_HTTP_BASE
export WXT_API_WS_BASE
export WXT_BUILD_ID

cd "$ROOT_DIR"

pnpm --filter @anidachi/extension build

mkdir -p "$PUBLIC_DIR" "$EXPERIMENT_DIR"
rsync -a --delete "$ROOT_DIR/apps/extension/.output/chrome-mv3/" "$PUBLIC_DIR/"
rsync -a --delete "$ROOT_DIR/apps/extension/.output/chrome-mv3/" "$EXPERIMENT_DIR/"

rm -f "$ROOT_DIR/anidachi-extension-public.zip"
(
  cd "$PUBLIC_DIR"
  zip -qr "$ROOT_DIR/anidachi-extension-public.zip" .
)

rm -f "$ROOT_DIR/anidachi-extension-experiment.zip"
(
  cd "$EXPERIMENT_DIR"
  zip -qr "$ROOT_DIR/anidachi-extension-experiment.zip" .
)

echo "Updated $PUBLIC_DIR"
echo "Updated $ROOT_DIR/anidachi-extension-public.zip"
echo "Updated $EXPERIMENT_DIR"
echo "Updated $ROOT_DIR/anidachi-extension-experiment.zip"
