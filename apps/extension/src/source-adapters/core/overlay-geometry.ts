export interface PlayerOverlayInsets {
  topPx: number;
  rightPx: number;
  bottomPx: number;
  leftPx: number;
}

export interface PlayerOverlayAnchor {
  topPx: number;
  rightPx: number;
}

export interface PlayerOverlayGeometry {
  controlsVisible: boolean;
  viewport: {
    widthPx: number;
    heightPx: number;
  };
  safeInsets: PlayerOverlayInsets;
  launcher: PlayerOverlayAnchor;
  panel: PlayerOverlayAnchor;
}

export type PlayerOverlayGeometryListener = (geometry: PlayerOverlayGeometry) => void;

export const DEFAULT_PLAYER_OVERLAY_GEOMETRY: PlayerOverlayGeometry = {
  controlsVisible: false,
  viewport: { widthPx: 0, heightPx: 0 },
  safeInsets: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
  launcher: { topPx: 10, rightPx: 10 },
  panel: { topPx: 48, rightPx: 10 },
};

export function normalizePlayerOverlayGeometry(
  geometry: PlayerOverlayGeometry,
): PlayerOverlayGeometry {
  const viewport = {
    widthPx: normalizeDimension(
      geometry?.viewport?.widthPx,
      DEFAULT_PLAYER_OVERLAY_GEOMETRY.viewport.widthPx,
    ),
    heightPx: normalizeDimension(
      geometry?.viewport?.heightPx,
      DEFAULT_PLAYER_OVERLAY_GEOMETRY.viewport.heightPx,
    ),
  };
  const hasUsableViewport = viewport.widthPx > 0 && viewport.heightPx > 0;

  return {
    controlsVisible:
      typeof geometry?.controlsVisible === "boolean"
        ? geometry.controlsVisible
        : DEFAULT_PLAYER_OVERLAY_GEOMETRY.controlsVisible,
    viewport,
    safeInsets: {
      topPx: normalizeBoundedValue(
        geometry?.safeInsets?.topPx,
        DEFAULT_PLAYER_OVERLAY_GEOMETRY.safeInsets.topPx,
        viewport.heightPx,
        hasUsableViewport,
      ),
      rightPx: normalizeBoundedValue(
        geometry?.safeInsets?.rightPx,
        DEFAULT_PLAYER_OVERLAY_GEOMETRY.safeInsets.rightPx,
        viewport.widthPx,
        hasUsableViewport,
      ),
      bottomPx: normalizeBoundedValue(
        geometry?.safeInsets?.bottomPx,
        DEFAULT_PLAYER_OVERLAY_GEOMETRY.safeInsets.bottomPx,
        viewport.heightPx,
        hasUsableViewport,
      ),
      leftPx: normalizeBoundedValue(
        geometry?.safeInsets?.leftPx,
        DEFAULT_PLAYER_OVERLAY_GEOMETRY.safeInsets.leftPx,
        viewport.widthPx,
        hasUsableViewport,
      ),
    },
    launcher: {
      topPx: normalizeBoundedValue(
        geometry?.launcher?.topPx,
        DEFAULT_PLAYER_OVERLAY_GEOMETRY.launcher.topPx,
        viewport.heightPx,
        hasUsableViewport,
      ),
      rightPx: normalizeBoundedValue(
        geometry?.launcher?.rightPx,
        DEFAULT_PLAYER_OVERLAY_GEOMETRY.launcher.rightPx,
        viewport.widthPx,
        hasUsableViewport,
      ),
    },
    panel: {
      topPx: normalizeBoundedValue(
        geometry?.panel?.topPx,
        DEFAULT_PLAYER_OVERLAY_GEOMETRY.panel.topPx,
        viewport.heightPx,
        hasUsableViewport,
      ),
      rightPx: normalizeBoundedValue(
        geometry?.panel?.rightPx,
        DEFAULT_PLAYER_OVERLAY_GEOMETRY.panel.rightPx,
        viewport.widthPx,
        hasUsableViewport,
      ),
    },
  };
}

export function arePlayerOverlayGeometriesEqual(
  left: PlayerOverlayGeometry,
  right: PlayerOverlayGeometry,
): boolean {
  const normalizedLeft = normalizePlayerOverlayGeometry(left);
  const normalizedRight = normalizePlayerOverlayGeometry(right);

  return (
    normalizedLeft.controlsVisible === normalizedRight.controlsVisible &&
    normalizedLeft.viewport.widthPx === normalizedRight.viewport.widthPx &&
    normalizedLeft.viewport.heightPx === normalizedRight.viewport.heightPx &&
    normalizedLeft.safeInsets.topPx === normalizedRight.safeInsets.topPx &&
    normalizedLeft.safeInsets.rightPx === normalizedRight.safeInsets.rightPx &&
    normalizedLeft.safeInsets.bottomPx === normalizedRight.safeInsets.bottomPx &&
    normalizedLeft.safeInsets.leftPx === normalizedRight.safeInsets.leftPx &&
    normalizedLeft.launcher.topPx === normalizedRight.launcher.topPx &&
    normalizedLeft.launcher.rightPx === normalizedRight.launcher.rightPx &&
    normalizedLeft.panel.topPx === normalizedRight.panel.topPx &&
    normalizedLeft.panel.rightPx === normalizedRight.panel.rightPx
  );
}

function normalizeDimension(value: number | undefined, fallback: number): number {
  return normalizeNonNegativeInteger(value, fallback);
}

function normalizeBoundedValue(
  value: number | undefined,
  fallback: number,
  maximum: number,
  shouldClamp: boolean,
): number {
  const normalized = normalizeNonNegativeInteger(value, fallback);
  return shouldClamp ? Math.min(normalized, maximum) : normalized;
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
}
