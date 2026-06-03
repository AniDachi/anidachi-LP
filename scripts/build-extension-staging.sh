#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_DIR="$ROOT_DIR/anidachi-extension-staging"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"
SHORT_SHA="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo local)"

: "${WXT_EXTENSION_CHANNEL:=staging}"
: "${WXT_EXTENSION_VERSION:=0.1.0}"
: "${WXT_WEB_HTTP_BASE:=https://v0-anime-app-landing-page-git-3b9ab6-georges-projects-8c4bc43a.vercel.app}"
: "${WXT_API_HTTP_BASE:=https://anidachi-api-staging.vladislav-gul7.workers.dev}"
: "${WXT_API_WS_BASE:=wss://anidachi-api-staging.vladislav-gul7.workers.dev}"
: "${WXT_BUILD_ID:=${SHORT_SHA}-staging-$(date +%Y%m%d%H%M%S)}"

export WXT_EXTENSION_CHANNEL
export WXT_EXTENSION_VERSION
export WXT_WEB_HTTP_BASE
export WXT_API_HTTP_BASE
export WXT_API_WS_BASE
export WXT_BUILD_ID

cd "$ROOT_DIR"

pnpm build:extension:icons
pnpm --filter @anidachi/extension build

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR" "$ARTIFACTS_DIR"
rsync -a --delete "$ROOT_DIR/apps/extension/.output/chrome-mv3/" "$STAGING_DIR/"

rm -f "$ROOT_DIR/anidachi-extension-staging.zip"
(
  cd "$STAGING_DIR"
  zip -qr "$ROOT_DIR/anidachi-extension-staging.zip" .
)

rm -f "$ARTIFACTS_DIR/anidachi-extension-staging-${SHORT_SHA}.zip"
cp "$ROOT_DIR/anidachi-extension-staging.zip" "$ARTIFACTS_DIR/anidachi-extension-staging-${SHORT_SHA}.zip"

echo "Updated $STAGING_DIR"
echo "Updated $ROOT_DIR/anidachi-extension-staging.zip"
echo "Updated $ARTIFACTS_DIR/anidachi-extension-staging-${SHORT_SHA}.zip"
