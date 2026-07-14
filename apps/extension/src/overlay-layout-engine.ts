import {
  getGhostCamGapPx,
  getResponsiveGhostCamSizePx,
} from "./ghost-cam-size";
import {
  OVERLAY_LAYOUT_CAMERA_SLOT_CAPACITY,
  OVERLAY_LAYOUT_GRID_COLUMNS,
  OVERLAY_LAYOUT_GRID_ROWS,
  type OverlayLayoutCameraSizeStep,
  type OverlayLayoutDefinition,
  type OverlayLayoutGridPoint,
  type OverlayLayoutLeaderSide,
  type OverlayLayoutMessageCount,
  normalizeOverlayLayoutDefinition,
} from "./overlay-layout-model";

const CHAT_TEXT_METRICS = {
  compact: { fontSizePx: 11, lineHeightPx: 14, rowHeightPx: 30 },
  normal: { fontSizePx: 13, lineHeightPx: 16, rowHeightPx: 34 },
  large: { fontSizePx: 15, lineHeightPx: 19, rowHeightPx: 39 },
} as const;
const CHAT_PADDING_X_PX = 10;
const CHAT_PADDING_Y_PX = 8;
const CHAT_ROW_GAP_PX = 5;
const CHAT_MESSAGE_COUNTS: readonly OverlayLayoutMessageCount[] = [8, 5, 3];

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayLayoutSafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface OverlayLayoutViewport {
  width: number;
  height: number;
  safeInsets: OverlayLayoutSafeInsets;
}

export interface ResolvedVideoLayout {
  anchor: OverlayLayoutGridPoint;
  bounds: PixelRect;
  effectiveSizePx: number;
  effectiveSizeStep: OverlayLayoutCameraSizeStep;
  leaderSide: OverlayLayoutLeaderSide;
  slots: PixelRect[];
}

export interface OverlayLayoutContext {
  viewport: OverlayLayoutViewport;
  reservedRects: PixelRect[];
  cameraCount: 0 | 1 | 2 | 3 | 4;
}

export interface ResolvedChatLayout {
  rect: PixelRect;
  position: OverlayLayoutGridPoint;
  effectiveMaxMessages: OverlayLayoutMessageCount;
  fontSizePx: number;
  lineHeightPx: number;
}

export interface ResolvedOverlayLayout {
  video: ResolvedVideoLayout;
  chat: ResolvedChatLayout;
}

export function resolveVideoLayout(
  video: OverlayLayoutDefinition["video"],
  viewport: OverlayLayoutViewport,
  cameraCount: number,
  maximumSizeStep: OverlayLayoutCameraSizeStep = video.sizeStep,
): ResolvedVideoLayout {
  const safeRect = resolveOverlayLayoutSafeRect(viewport);
  const occupiedCount = clampInteger(cameraCount, 0, OVERLAY_LAYOUT_CAMERA_SLOT_CAPACITY);
  const storedSizeStep = clampInteger(video.sizeStep, 0, 3) as OverlayLayoutCameraSizeStep;
  const sizeStepCap = clampInteger(maximumSizeStep, 0, 3) as OverlayLayoutCameraSizeStep;
  const effectiveSizeStep = Math.min(
    storedSizeStep,
    sizeStepCap,
  ) as OverlayLayoutCameraSizeStep;
  const effectiveSizePx = getResponsiveGhostCamSizePx(effectiveSizeStep, {
    cameraCount: occupiedCount,
    containerHeightPx: safeRect.height,
    containerWidthPx: safeRect.width,
  });
  const resolvedAnchor = {
    x: clampInteger(video.anchor.x, 0, OVERLAY_LAYOUT_GRID_COLUMNS - 1),
    y: clampInteger(video.anchor.y, 0, OVERLAY_LAYOUT_GRID_ROWS - 1),
  };

  if (occupiedCount === 0) {
    return {
      anchor: resolvedAnchor,
      bounds: { height: 0, width: 0, x: 0, y: 0 },
      effectiveSizePx,
      effectiveSizeStep,
      leaderSide: video.leaderSide,
      slots: [],
    };
  }

  const gapPx = getGhostCamGapPx(effectiveSizeStep);
  const leaderCenter = {
    x: safeRect.x +
      ((resolvedAnchor.x + 0.5) /
        OVERLAY_LAYOUT_GRID_COLUMNS) *
        safeRect.width,
    y: safeRect.y +
      ((resolvedAnchor.y + 0.5) /
        OVERLAY_LAYOUT_GRID_ROWS) *
        safeRect.height,
  };
  const followerDirection = video.leaderSide === "left" ? 1 : -1;
  const slots = Array.from({ length: occupiedCount }, (_, index): PixelRect => ({
    height: effectiveSizePx,
    width: effectiveSizePx,
    x:
      leaderCenter.x - effectiveSizePx / 2 +
      followerDirection * index * (effectiveSizePx + gapPx),
    y: leaderCenter.y - effectiveSizePx / 2,
  }));
  const initialBounds = getBounds(slots);
  const offsetX = resolveAxisTranslation(
    initialBounds.x,
    initialBounds.width,
    safeRect.x,
    safeRect.width,
  );
  const offsetY = resolveAxisTranslation(
    initialBounds.y,
    initialBounds.height,
    safeRect.y,
    safeRect.height,
  );
  const translatedSlots = slots.map((slot) => ({
    ...slot,
    x: slot.x + offsetX,
    y: slot.y + offsetY,
  }));

  return {
    anchor: resolvedAnchor,
    bounds: getBounds(translatedSlots),
    effectiveSizePx,
    effectiveSizeStep,
    leaderSide: video.leaderSide,
    slots: translatedSlots,
  };
}

export function resolveOverlayLayout(
  definition: OverlayLayoutDefinition,
  context: OverlayLayoutContext,
): ResolvedOverlayLayout {
  const normalizedDefinition = normalizeOverlayLayoutDefinition(definition);
  const normalizedViewport = normalizeViewport(context.viewport);
  const safeRect = resolveOverlayLayoutSafeRect(normalizedViewport);

  if (safeRect.width === 0 || safeRect.height === 0) {
    return createUnusableViewportFallback(normalizedDefinition);
  }

  const reservedRects = normalizeReservedRects(context.reservedRects);
  const cameraCount = clampInteger(
    context.cameraCount,
    0,
    OVERLAY_LAYOUT_CAMERA_SLOT_CAPACITY,
  );
  const messageCounts = CHAT_MESSAGE_COUNTS.filter(
    (count) => count <= normalizedDefinition.chat.maxMessages,
  );

  if (cameraCount === 0) {
    return resolveZeroCameraLayout(
      normalizedDefinition,
      normalizedViewport,
      safeRect,
      reservedRects,
      messageCounts,
    );
  }

  let fallbackVideo: ResolvedVideoLayout | undefined;

  for (let sizeStep = normalizedDefinition.video.sizeStep; sizeStep >= 0; sizeStep -= 1) {
    const videoCandidates = findReservedSafeVideoLayoutsAtSize(
      normalizedDefinition.video,
      normalizedViewport,
      cameraCount,
      safeRect,
      reservedRects,
      sizeStep as OverlayLayoutCameraSizeStep,
    );

    if (videoCandidates.length === 0) {
      continue;
    }

    fallbackVideo = videoCandidates[0];
    for (const video of videoCandidates) {
      for (const messageCount of messageCounts) {
        const chat = createChatLayout(normalizedDefinition, safeRect, messageCount);
        const placement = findFreeChatRect(
          normalizedDefinition.chat.position,
          normalizedDefinition.chat.width,
          safeRect,
          chat.rect,
          [video.bounds, ...reservedRects],
        );

        if (placement) {
          return { chat: { ...chat, ...placement }, video };
        }
      }
    }
  }

  return fallbackVideo
    ? createCameraPriorityFallback(normalizedDefinition, safeRect, fallbackVideo)
    : createMinimumFallback(normalizedDefinition, normalizedViewport, cameraCount, safeRect);
}

function resolveZeroCameraLayout(
  definition: OverlayLayoutDefinition,
  viewport: OverlayLayoutViewport,
  safeRect: PixelRect,
  reservedRects: PixelRect[],
  messageCounts: readonly OverlayLayoutMessageCount[],
): ResolvedOverlayLayout {
  for (let sizeStep = definition.video.sizeStep; sizeStep >= 0; sizeStep -= 1) {
    const video = resolveVideoLayout(
      definition.video,
      viewport,
      0,
      sizeStep as OverlayLayoutCameraSizeStep,
    );

    for (const messageCount of messageCounts) {
      const chat = createChatLayout(definition, safeRect, messageCount);
      const placement = findFreeChatRect(
        definition.chat.position,
        definition.chat.width,
        safeRect,
        chat.rect,
        [video.bounds, ...reservedRects],
      );

      if (placement) {
        return { chat: { ...chat, ...placement }, video };
      }
    }
  }

  return createMinimumFallback(definition, viewport, 0, safeRect);
}

function findReservedSafeVideoLayoutsAtSize(
  videoDefinition: OverlayLayoutDefinition["video"],
  viewport: OverlayLayoutViewport,
  cameraCount: number,
  safeRect: PixelRect,
  reservedRects: PixelRect[],
  sizeStep: OverlayLayoutCameraSizeStep,
): ResolvedVideoLayout[] {
  const anchors = getOrderedVideoAnchors(videoDefinition.anchor);
  const layouts: ResolvedVideoLayout[] = [];

  for (const anchor of anchors) {
    const video = resolveVideoLayout(
      {
        anchor,
        leaderSide: videoDefinition.leaderSide,
        sizeStep: videoDefinition.sizeStep,
      },
      viewport,
      cameraCount,
      sizeStep,
    );

    if (
      isWithinSafeRect(video.bounds, safeRect) &&
      !reservedRects.some((reserved) => rectsOverlap(video.bounds, reserved))
    ) {
      layouts.push(video);
    }
  }

  return layouts;
}

function getOrderedVideoAnchors(
  savedAnchor: OverlayLayoutDefinition["video"]["anchor"],
): Array<OverlayLayoutDefinition["video"]["anchor"]> {
  return Array.from(
    { length: OVERLAY_LAYOUT_GRID_COLUMNS * OVERLAY_LAYOUT_GRID_ROWS },
    (_, index) => {
      const x = index % OVERLAY_LAYOUT_GRID_COLUMNS;
      const y = Math.floor(index / OVERLAY_LAYOUT_GRID_COLUMNS);
      return {
        distance: Math.abs(x - savedAnchor.x) + Math.abs(y - savedAnchor.y),
        x,
        y,
      };
    },
  )
    .sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x)
    .map(({ x, y }) => ({ x, y }));
}

export function rectsOverlap(a: PixelRect, b: PixelRect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
    return false;
  }

  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function createUnusableViewportFallback(
  definition: OverlayLayoutDefinition,
): ResolvedOverlayLayout {
  const metrics = CHAT_TEXT_METRICS[definition.chat.textScale];
  const rect = { height: 0, width: 0, x: 0, y: 0 };

  return {
    chat: {
      effectiveMaxMessages: definition.chat.maxMessages,
      fontSizePx: metrics.fontSizePx,
      lineHeightPx: metrics.lineHeightPx,
      position: { ...definition.chat.position },
      rect,
    },
    video: {
      anchor: { ...definition.video.anchor },
      bounds: { ...rect },
      effectiveSizePx: 0,
      effectiveSizeStep: definition.video.sizeStep,
      leaderSide: definition.video.leaderSide,
      slots: [],
    },
  };
}

function createChatLayout(
  definition: OverlayLayoutDefinition,
  safeRect: PixelRect,
  effectiveMaxMessages: OverlayLayoutMessageCount,
): ResolvedChatLayout {
  const metrics = CHAT_TEXT_METRICS[definition.chat.textScale];
  const rowGaps = Math.max(0, effectiveMaxMessages - 1) * CHAT_ROW_GAP_PX;

  return {
    effectiveMaxMessages,
    fontSizePx: metrics.fontSizePx,
    lineHeightPx: metrics.lineHeightPx,
    position: { ...definition.chat.position },
    rect: {
      height: CHAT_PADDING_Y_PX * 2 + effectiveMaxMessages * metrics.rowHeightPx + rowGaps,
      width: Math.max(
        CHAT_PADDING_X_PX * 2,
        (safeRect.width * definition.chat.width) / OVERLAY_LAYOUT_GRID_COLUMNS,
      ),
      x: 0,
      y: 0,
    },
  };
}

function findFreeChatRect(
  requestedPosition: OverlayLayoutDefinition["chat"]["position"],
  chatWidthColumns: number,
  safeRect: PixelRect,
  chatRect: PixelRect,
  blockedRects: PixelRect[],
): { position: OverlayLayoutGridPoint; rect: PixelRect } | undefined {
  const candidates = Array.from(
    { length: (OVERLAY_LAYOUT_GRID_COLUMNS - chatWidthColumns + 1) * OVERLAY_LAYOUT_GRID_ROWS },
    (_, index) => {
      const x = index % (OVERLAY_LAYOUT_GRID_COLUMNS - chatWidthColumns + 1);
      const y = Math.floor(index / (OVERLAY_LAYOUT_GRID_COLUMNS - chatWidthColumns + 1));
      return {
        distance: Math.abs(x - requestedPosition.x) + Math.abs(y - requestedPosition.y),
        x,
        y,
      };
    },
  ).sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);

  for (const candidate of candidates) {
    const alignToBottomEdge =
      requestedPosition.y === OVERLAY_LAYOUT_GRID_ROWS - 1 &&
      candidate.y === OVERLAY_LAYOUT_GRID_ROWS - 1;
    const rect = {
      ...chatRect,
      x: safeRect.x + (candidate.x / OVERLAY_LAYOUT_GRID_COLUMNS) * safeRect.width,
      y: alignToBottomEdge
        ? safeRect.y + safeRect.height - chatRect.height
        : safeRect.y + (candidate.y / OVERLAY_LAYOUT_GRID_ROWS) * safeRect.height,
    };

    if (isWithinSafeRect(rect, safeRect) && !blockedRects.some((blocked) => rectsOverlap(rect, blocked))) {
      return { position: { x: candidate.x, y: candidate.y }, rect };
    }
  }

  return undefined;
}

function createMinimumFallback(
  definition: OverlayLayoutDefinition,
  viewport: OverlayLayoutViewport,
  cameraCount: number,
  safeRect: PixelRect,
): ResolvedOverlayLayout {
  const chat = createChatLayout(definition, safeRect, 3);
  const requestedRect = {
    ...chat.rect,
    x: safeRect.x + (definition.chat.position.x / OVERLAY_LAYOUT_GRID_COLUMNS) * safeRect.width,
    y: safeRect.y + (definition.chat.position.y / OVERLAY_LAYOUT_GRID_ROWS) * safeRect.height,
  };

  return {
    chat: { ...chat, rect: clampRectToSafeRect(requestedRect, safeRect) },
    video: resolveVideoLayout(definition.video, viewport, cameraCount, 0),
  };
}

function createCameraPriorityFallback(
  definition: OverlayLayoutDefinition,
  safeRect: PixelRect,
  video: ResolvedVideoLayout,
): ResolvedOverlayLayout {
  const chat = createChatLayout(definition, safeRect, 3);
  const requestedRect = {
    ...chat.rect,
    x: safeRect.x + (definition.chat.position.x / OVERLAY_LAYOUT_GRID_COLUMNS) * safeRect.width,
    y: safeRect.y + (definition.chat.position.y / OVERLAY_LAYOUT_GRID_ROWS) * safeRect.height,
  };

  return {
    chat: { ...chat, rect: clampRectToSafeRect(requestedRect, safeRect) },
    video,
  };
}

function clampRectToSafeRect(rect: PixelRect, safeRect: PixelRect): PixelRect {
  const width = Math.min(rect.width, safeRect.width);
  const height = Math.min(rect.height, safeRect.height);

  return {
    height,
    width,
    x: Math.max(safeRect.x, Math.min(rect.x, safeRect.x + safeRect.width - width)),
    y: Math.max(safeRect.y, Math.min(rect.y, safeRect.y + safeRect.height - height)),
  };
}

function isWithinSafeRect(rect: PixelRect, safeRect: PixelRect): boolean {
  return rect.x >= safeRect.x && rect.y >= safeRect.y && rect.x + rect.width <= safeRect.x + safeRect.width && rect.y + rect.height <= safeRect.y + safeRect.height;
}

function normalizeViewport(viewport: OverlayLayoutViewport): OverlayLayoutViewport {
  return {
    height: finiteNonNegative(viewport.height),
    safeInsets: {
      bottom: finiteNonNegative(viewport.safeInsets.bottom),
      left: finiteNonNegative(viewport.safeInsets.left),
      right: finiteNonNegative(viewport.safeInsets.right),
      top: finiteNonNegative(viewport.safeInsets.top),
    },
    width: finiteNonNegative(viewport.width),
  };
}

function normalizeReservedRects(rects: PixelRect[]): PixelRect[] {
  if (!Array.isArray(rects)) {
    return [];
  }

  return rects.map((rect) => ({
    height: finiteNonNegative(rect.height),
    width: finiteNonNegative(rect.width),
    x: finiteNumber(rect.x),
    y: finiteNumber(rect.y),
  }));
}

export function resolveOverlayLayoutSafeRect(
  viewport: OverlayLayoutViewport,
): PixelRect {
  const width = finiteNonNegative(viewport.width);
  const height = finiteNonNegative(viewport.height);
  const left = Math.min(width, finiteNonNegative(viewport.safeInsets.left));
  const top = Math.min(height, finiteNonNegative(viewport.safeInsets.top));
  const right = Math.max(left, width - finiteNonNegative(viewport.safeInsets.right));
  const bottom = Math.max(top, height - finiteNonNegative(viewport.safeInsets.bottom));

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  };
}

function getBounds(rects: PixelRect[]): PixelRect {
  if (rects.length === 0) {
    return { height: 0, width: 0, x: 0, y: 0 };
  }

  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  };
}

function resolveAxisTranslation(
  groupStart: number,
  groupSize: number,
  safeStart: number,
  safeSize: number,
): number {
  const minimumOffset = safeStart - groupStart;
  const maximumOffset = safeStart + safeSize - (groupStart + groupSize);

  if (minimumOffset <= maximumOffset) {
    return Math.max(minimumOffset, Math.min(maximumOffset, 0));
  }

  return (minimumOffset + maximumOffset) / 2;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const finiteValue = Number.isFinite(value) ? value : minimum;
  return Math.max(minimum, Math.min(maximum, Math.round(finiteValue)));
}
