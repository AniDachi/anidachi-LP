import {
  normalizeOverlayLayoutDefinition,
  OVERLAY_LAYOUT_GRID_COLUMNS,
  OVERLAY_LAYOUT_GRID_ROWS,
  type OverlayLayoutDefinition,
  type OverlayLayoutLeaderSide,
} from "./overlay-layout-model";

export type OverlayLayoutObjectIdV2 = "video" | "chat";

export interface OverlayLayoutPointerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OverlayLayoutGridPointer {
  x: number;
  y: number;
}

export interface OverlayLayoutDragOffset {
  x: number;
  y: number;
}

export function getOverlayLayoutGridPointer(
  clientX: number,
  clientY: number,
  bounds: OverlayLayoutPointerBounds,
): OverlayLayoutGridPointer {
  if (!hasUsablePointerBounds(bounds)) {
    return { x: 0, y: 0 };
  }

  return {
    x: getClampedGridBoundary(clientX, bounds.left, bounds.width, OVERLAY_LAYOUT_GRID_COLUMNS),
    y: getClampedGridBoundary(clientY, bounds.top, bounds.height, OVERLAY_LAYOUT_GRID_ROWS),
  };
}

export function getOverlayLayoutDragOffsetFromOrigin(
  pointer: OverlayLayoutGridPointer,
  origin: OverlayLayoutGridPointer,
): OverlayLayoutDragOffset {
  return {
    x: finiteOrZero(pointer.x) - finiteOrZero(origin.x),
    y: finiteOrZero(pointer.y) - finiteOrZero(origin.y),
  };
}

export function moveOverlayLayoutObjectFromPointer(
  definition: OverlayLayoutDefinition,
  objectId: OverlayLayoutObjectIdV2,
  pointer: OverlayLayoutGridPointer,
  offset: OverlayLayoutDragOffset,
): OverlayLayoutDefinition {
  const origin = {
    x: finiteOrZero(pointer.x) - finiteOrZero(offset.x),
    y: finiteOrZero(pointer.y) - finiteOrZero(offset.y),
  };

  if (objectId === "video") {
    return moveVideoAnchor(definition, origin.x - 0.5, origin.y - 0.5);
  }

  return normalizeOverlayLayoutDefinition({
    ...definition,
    chat: {
      ...definition.chat,
      position: origin,
    },
  });
}

export function moveOverlayLayoutObjectByDelta(
  definition: OverlayLayoutDefinition,
  objectId: OverlayLayoutObjectIdV2,
  dx: number,
  dy: number,
): OverlayLayoutDefinition {
  const normalized = normalizeOverlayLayoutDefinition(definition);
  const deltaX = integerOrZero(dx);
  const deltaY = integerOrZero(dy);

  if (objectId === "video") {
    return moveVideoAnchor(
      normalized,
      normalized.video.anchor.x + deltaX,
      normalized.video.anchor.y + deltaY,
    );
  }

  return normalizeOverlayLayoutDefinition({
    ...normalized,
    chat: {
      ...normalized.chat,
      position: {
        x: normalized.chat.position.x + deltaX,
        y: normalized.chat.position.y + deltaY,
      },
    },
  });
}

export function getOverlayLayoutLeaderSide(
  anchorX: number,
  currentSide: OverlayLayoutLeaderSide,
): OverlayLayoutLeaderSide {
  if (anchorX <= 4) {
    return "left";
  }

  if (anchorX >= 7) {
    return "right";
  }

  return currentSide;
}

export function cloneOverlayLayoutDefinition(
  definition: OverlayLayoutDefinition,
): OverlayLayoutDefinition {
  return {
    video: {
      anchor: { ...definition.video.anchor },
      leaderSide: definition.video.leaderSide,
      sizeStep: definition.video.sizeStep,
    },
    chat: {
      messageTransparency: definition.chat.messageTransparency,
      position: { ...definition.chat.position },
      width: definition.chat.width,
      textScale: definition.chat.textScale,
      maxMessages: definition.chat.maxMessages,
    },
  };
}

export function overlayLayoutDefinitionsEqual(
  left: OverlayLayoutDefinition,
  right: OverlayLayoutDefinition,
): boolean {
  return left.video.anchor.x === right.video.anchor.x
    && left.video.anchor.y === right.video.anchor.y
    && left.video.leaderSide === right.video.leaderSide
    && left.video.sizeStep === right.video.sizeStep
    && left.chat.position.x === right.chat.position.x
    && left.chat.position.y === right.chat.position.y
    && left.chat.messageTransparency === right.chat.messageTransparency
    && left.chat.width === right.chat.width
    && left.chat.textScale === right.chat.textScale
    && left.chat.maxMessages === right.chat.maxMessages;
}

function moveVideoAnchor(
  definition: OverlayLayoutDefinition,
  anchorX: number,
  anchorY: number,
): OverlayLayoutDefinition {
  const normalized = normalizeOverlayLayoutDefinition({
    ...definition,
    video: {
      ...definition.video,
      anchor: { x: anchorX, y: anchorY },
    },
  });

  return {
    ...normalized,
    video: {
      ...normalized.video,
      leaderSide: getOverlayLayoutLeaderSide(
        normalized.video.anchor.x,
        normalized.video.leaderSide,
      ),
    },
  };
}

function hasUsablePointerBounds(bounds: OverlayLayoutPointerBounds): boolean {
  return Number.isFinite(bounds.left)
    && Number.isFinite(bounds.top)
    && Number.isFinite(bounds.width)
    && Number.isFinite(bounds.height)
    && bounds.width > 0
    && bounds.height > 0;
}

function getClampedGridBoundary(
  clientCoordinate: number,
  offset: number,
  size: number,
  gridSize: number,
): number {
  if (!Number.isFinite(clientCoordinate)) {
    return 0;
  }

  return Math.max(0, Math.min(gridSize, ((clientCoordinate - offset) / size) * gridSize));
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function integerOrZero(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}
