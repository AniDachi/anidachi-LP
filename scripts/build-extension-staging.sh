#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"
SHORT_SHA="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo local)"
PACKAGE_EXTENSION_VERSION="$(node -e "console.log(require('$ROOT_DIR/apps/extension/package.json').version)")"

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--broad" ) ]]; then
  echo "Usage: $0 [--broad]" >&2
  exit 2
fi

OUTPUT_NAME=anidachi-extension-staging
if [[ "${1:-}" == "--broad" ]]; then
  OUTPUT_NAME=anidachi-extension-staging-local-broad
fi
OUTPUT_DIR="$ROOT_DIR/$OUTPUT_NAME"
OUTPUT_ZIP="$ROOT_DIR/$OUTPUT_NAME.zip"
ARTIFACT_ZIP="$ARTIFACTS_DIR/${OUTPUT_NAME}-${SHORT_SHA}.zip"

WXT_EXTENSION_CHANNEL=staging
NODE_ENV=production
: "${WXT_EXTENSION_VERSION:=$PACKAGE_EXTENSION_VERSION}"
WXT_WEB_HTTP_BASE=https://staging.anidachi.app
WXT_API_HTTP_BASE=https://anidachi-api-staging.vladislav-gul7.workers.dev
WXT_API_WS_BASE=wss://anidachi-api-staging.vladislav-gul7.workers.dev
: "${WXT_BUILD_ID:=${SHORT_SHA}-staging-$(date +%Y%m%d%H%M%S)}"
WXT_BROAD_HOST_PERMISSIONS=false
if [[ "${1:-}" == "--broad" ]]; then
  WXT_BROAD_HOST_PERMISSIONS=true
fi

export WXT_EXTENSION_CHANNEL
export NODE_ENV
export WXT_EXTENSION_VERSION
export WXT_WEB_HTTP_BASE
export WXT_API_HTTP_BASE
export WXT_API_WS_BASE
export WXT_BUILD_ID
export WXT_BROAD_HOST_PERMISSIONS

cd "$ROOT_DIR"

pnpm check:extension:icons
pnpm --filter @anidachi/extension build

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR" "$ARTIFACTS_DIR"
rsync -a --delete "$ROOT_DIR/apps/extension/.output/chrome-mv3/" "$OUTPUT_DIR/"

rm -f "$OUTPUT_ZIP"
(
  cd "$OUTPUT_DIR"
  zip -qr "$OUTPUT_ZIP" .
)

rm -f "$ARTIFACT_ZIP"
cp "$OUTPUT_ZIP" "$ARTIFACT_ZIP"

echo "Updated $OUTPUT_DIR"
echo "Updated $OUTPUT_ZIP"
echo "Updated $ARTIFACT_ZIP"
