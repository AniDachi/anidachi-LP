#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="$ROOT_DIR/anidachi-extension-public"
EXPERIMENT_DIR="$ROOT_DIR/anidachi-extension-experiment"
PACKAGE_EXTENSION_VERSION="$(node -e "console.log(require('$ROOT_DIR/apps/extension/package.json').version)")"

WXT_EXTENSION_CHANNEL=production
NODE_ENV=production
: "${WXT_EXTENSION_VERSION:=$PACKAGE_EXTENSION_VERSION}"
WXT_WEB_HTTP_BASE=https://www.anidachi.app
WXT_API_HTTP_BASE=https://anidachi-api-production.vladislav-gul7.workers.dev
WXT_API_WS_BASE=wss://anidachi-api-production.vladislav-gul7.workers.dev
WXT_BROAD_HOST_PERMISSIONS=false
: "${WXT_BUILD_ID:=$(git rev-parse --short HEAD 2>/dev/null || echo local)-production-$(date +%Y%m%d%H%M%S)}"

if [[ -z "${WXT_VAPID_PUBLIC_KEY:-}" ]]; then
  echo "WXT_VAPID_PUBLIC_KEY is required for production extension builds" >&2
  exit 1
fi

export WXT_EXTENSION_CHANNEL
export NODE_ENV
export WXT_EXTENSION_VERSION
export WXT_WEB_HTTP_BASE
export WXT_API_HTTP_BASE
export WXT_API_WS_BASE
export WXT_BROAD_HOST_PERMISSIONS
export WXT_BUILD_ID
export WXT_VAPID_PUBLIC_KEY

cd "$ROOT_DIR"

pnpm check:extension:icons
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
