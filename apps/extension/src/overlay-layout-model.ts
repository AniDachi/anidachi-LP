export const OVERLAY_LAYOUT_GRID_COLUMNS = 12;
export const OVERLAY_LAYOUT_GRID_ROWS = 8;
export const OVERLAY_LAYOUT_CAMERA_SLOT_CAPACITY = 4 as const;
export const OVERLAY_LAYOUT_STORAGE_KEY_V2 = "local:overlayLayoutPreferencesV2";
export const OVERLAY_LAYOUT_STORAGE_VERSION = 2 as const;

export type OverlayLayoutLeaderSide = "left" | "right";
export type OverlayLayoutTextScale = "compact" | "normal" | "large";
export type OverlayLayoutMessageCount = 3 | 5 | 8;
export type OverlayLayoutCameraSizeStep = 0 | 1 | 2 | 3;

export interface OverlayLayoutGridPoint {
  x: number;
  y: number;
}

export interface OverlayLayoutDefinition {
  video: {
    anchor: OverlayLayoutGridPoint;
    leaderSide: OverlayLayoutLeaderSide;
    sizeStep: OverlayLayoutCameraSizeStep;
  };
  chat: {
    position: OverlayLayoutGridPoint;
    width: number;
    textScale: OverlayLayoutTextScale;
    maxMessages: OverlayLayoutMessageCount;
  };
}

export interface OverlayLayoutPreferencesV2 {
  version: typeof OVERLAY_LAYOUT_STORAGE_VERSION;
  layout: OverlayLayoutDefinition;
}

const DEFAULT_LAYOUT = freezeDefinition({
  video: { anchor: { x: 11, y: 6 }, leaderSide: "right", sizeStep: 1 },
  chat: { position: { x: 0, y: 4 }, width: 5, textScale: "normal", maxMessages: 5 },
});

export function getDefaultOverlayLayoutDefinition(): OverlayLayoutDefinition {
  return cloneDefinition(DEFAULT_LAYOUT);
}

export function getDefaultOverlayLayoutPreferencesV2(): OverlayLayoutPreferencesV2 {
  return {
    version: OVERLAY_LAYOUT_STORAGE_VERSION,
    layout: getDefaultOverlayLayoutDefinition(),
  };
}

export function normalizeOverlayLayoutDefinition(value: unknown): OverlayLayoutDefinition {
  const source = isRecord(value) ? value : {};
  const video = isRecord(source.video) ? source.video : {};
  const chat = isRecord(source.chat) ? source.chat : {};
  const rawAnchor = isRecord(video.anchor) ? video.anchor : {};
  const rawPosition = isRecord(chat.position) ? chat.position : {};

  const anchor = {
    x: normalizeGridCoordinate(
      rawAnchor.x,
      DEFAULT_LAYOUT.video.anchor.x,
      OVERLAY_LAYOUT_GRID_COLUMNS,
    ),
    y: normalizeGridCoordinate(
      rawAnchor.y,
      DEFAULT_LAYOUT.video.anchor.y,
      OVERLAY_LAYOUT_GRID_ROWS,
    ),
  };
  const width = clampInteger(
    numberOrFallback(chat.width, DEFAULT_LAYOUT.chat.width),
    3,
    6,
  );
  const position = {
    x: Math.min(
      normalizeGridCoordinate(
        rawPosition.x,
        DEFAULT_LAYOUT.chat.position.x,
        OVERLAY_LAYOUT_GRID_COLUMNS,
      ),
      OVERLAY_LAYOUT_GRID_COLUMNS - width,
    ),
    y: normalizeGridCoordinate(
      rawPosition.y,
      DEFAULT_LAYOUT.chat.position.y,
      OVERLAY_LAYOUT_GRID_ROWS,
    ),
  };

  return {
    video: {
      anchor,
      leaderSide: normalizeLeaderSide(video.leaderSide, anchor.x),
      sizeStep: normalizeCameraSizeStep(video.sizeStep),
    },
    chat: {
      position,
      width,
      textScale: normalizeTextScale(chat.textScale),
      maxMessages: normalizeMessageCount(chat.maxMessages),
    },
  };
}

export function parseOverlayLayoutPreferencesV2(value: unknown): OverlayLayoutPreferencesV2 {
  if (!isRecord(value) || value.version !== OVERLAY_LAYOUT_STORAGE_VERSION) {
    return getDefaultOverlayLayoutPreferencesV2();
  }

  return {
    version: OVERLAY_LAYOUT_STORAGE_VERSION,
    layout: normalizeOverlayLayoutDefinition(value.layout),
  };
}

function cloneDefinition(definition: OverlayLayoutDefinition): OverlayLayoutDefinition {
  return {
    video: {
      anchor: { ...definition.video.anchor },
      leaderSide: definition.video.leaderSide,
      sizeStep: definition.video.sizeStep,
    },
    chat: {
      position: { ...definition.chat.position },
      width: definition.chat.width,
      textScale: definition.chat.textScale,
      maxMessages: definition.chat.maxMessages,
    },
  };
}

function freezeDefinition(definition: OverlayLayoutDefinition): OverlayLayoutDefinition {
  Object.freeze(definition.video.anchor);
  Object.freeze(definition.video);
  Object.freeze(definition.chat.position);
  Object.freeze(definition.chat);
  return Object.freeze(definition);
}

function normalizeLeaderSide(value: unknown, anchorX: number): OverlayLayoutLeaderSide {
  if (value === "left" || value === "right") {
    return value;
  }

  return anchorX < OVERLAY_LAYOUT_GRID_COLUMNS / 2 ? "left" : "right";
}

function normalizeTextScale(value: unknown): OverlayLayoutTextScale {
  return value === "compact" || value === "normal" || value === "large" ? value : "normal";
}

function normalizeMessageCount(value: unknown): OverlayLayoutMessageCount {
  const numeric = numberOrFallback(value, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_LAYOUT.chat.maxMessages;
  }

  return ([3, 5, 8] as const).reduce<OverlayLayoutMessageCount>(
    (nearest, option) =>
      Math.abs(option - numeric) < Math.abs(nearest - numeric) ? option : nearest,
    3,
  );
}

function normalizeCameraSizeStep(value: unknown): OverlayLayoutCameraSizeStep {
  return clampInteger(
    numberOrFallback(value, DEFAULT_LAYOUT.video.sizeStep),
    0,
    3,
  ) as OverlayLayoutCameraSizeStep;
}

function normalizeGridCoordinate(value: unknown, fallback: number, limit: number): number {
  return clampInteger(numberOrFallback(value, fallback), 0, limit - 1);
}

function numberOrFallback(value: unknown, fallback: number): number {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;

  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
