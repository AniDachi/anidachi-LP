export const OVERLAY_LAYOUT_GRID_COLUMNS = 12;
export const OVERLAY_LAYOUT_GRID_ROWS = 8;
export const OVERLAY_LAYOUT_STORAGE_VERSION = 2 as const;

export type OverlayLayoutPresetId = "classic" | "cinema" | "social" | "minimal" | "custom";
export type OverlayLayoutBuiltinPresetId = Exclude<OverlayLayoutPresetId, "custom">;
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
  activePresetId: OverlayLayoutPresetId;
  custom: OverlayLayoutDefinition;
}

export interface OverlayLayoutPresetV2 {
  id: OverlayLayoutBuiltinPresetId;
  definition: OverlayLayoutDefinition;
}

const CLASSIC_LAYOUT = freezeDefinition({
  video: { anchor: { x: 11, y: 6 }, leaderSide: "right", sizeStep: 1 },
  chat: { position: { x: 7, y: 3 }, width: 5, textScale: "normal", maxMessages: 5 },
});

const CINEMA_LAYOUT = freezeDefinition({
  video: { anchor: { x: 11, y: 6 }, leaderSide: "right", sizeStep: 1 },
  chat: { position: { x: 1, y: 6 }, width: 4, textScale: "normal", maxMessages: 5 },
});

const SOCIAL_LAYOUT = freezeDefinition({
  video: { anchor: { x: 11, y: 2 }, leaderSide: "right", sizeStep: 1 },
  chat: { position: { x: 6, y: 4 }, width: 6, textScale: "normal", maxMessages: 8 },
});

const MINIMAL_LAYOUT = freezeDefinition({
  video: { anchor: { x: 11, y: 2 }, leaderSide: "right", sizeStep: 1 },
  chat: { position: { x: 7, y: 6 }, width: 4, textScale: "normal", maxMessages: 3 },
});

const BUILTIN_LAYOUTS: Readonly<Record<OverlayLayoutBuiltinPresetId, OverlayLayoutDefinition>> =
  Object.freeze({
    classic: CLASSIC_LAYOUT,
    cinema: CINEMA_LAYOUT,
    social: SOCIAL_LAYOUT,
    minimal: MINIMAL_LAYOUT,
  });

export const OVERLAY_LAYOUT_PRESETS_V2: readonly OverlayLayoutPresetV2[] = Object.freeze([
  Object.freeze({ id: "classic" as const, definition: CLASSIC_LAYOUT }),
  Object.freeze({ id: "cinema" as const, definition: CINEMA_LAYOUT }),
  Object.freeze({ id: "social" as const, definition: SOCIAL_LAYOUT }),
  Object.freeze({ id: "minimal" as const, definition: MINIMAL_LAYOUT }),
]);

export function getDefaultOverlayLayoutPreferencesV2(): OverlayLayoutPreferencesV2 {
  return createPreferences("classic", CLASSIC_LAYOUT);
}

export function getActiveOverlayLayoutDefinition(
  preferences: OverlayLayoutPreferencesV2,
): OverlayLayoutDefinition {
  const normalized = normalizeOverlayLayoutPreferencesV2(preferences);
  const definition = normalized.activePresetId === "custom"
    ? normalized.custom
    : BUILTIN_LAYOUTS[normalized.activePresetId];

  return cloneDefinition(definition);
}

export function normalizeOverlayLayoutDefinition(value: unknown): OverlayLayoutDefinition {
  const source = isRecord(value) ? value : {};
  const video = isRecord(source.video) ? source.video : {};
  const chat = isRecord(source.chat) ? source.chat : {};
  const rawAnchor = isRecord(video.anchor) ? video.anchor : {};
  const rawPosition = isRecord(chat.position) ? chat.position : {};

  const anchor = {
    x: normalizeGridCoordinate(rawAnchor.x, CLASSIC_LAYOUT.video.anchor.x, OVERLAY_LAYOUT_GRID_COLUMNS),
    y: normalizeGridCoordinate(rawAnchor.y, CLASSIC_LAYOUT.video.anchor.y, OVERLAY_LAYOUT_GRID_ROWS),
  };
  const width = clampInteger(numberOrFallback(chat.width, CLASSIC_LAYOUT.chat.width), 3, 6);
  const position = {
    x: Math.min(
      normalizeGridCoordinate(rawPosition.x, CLASSIC_LAYOUT.chat.position.x, OVERLAY_LAYOUT_GRID_COLUMNS),
      OVERLAY_LAYOUT_GRID_COLUMNS - width,
    ),
    y: normalizeGridCoordinate(rawPosition.y, CLASSIC_LAYOUT.chat.position.y, OVERLAY_LAYOUT_GRID_ROWS),
  };

  return {
    video: {
      anchor,
      leaderSide: normalizeLeaderSide(video.leaderSide, anchor.x),
      sizeStep: normalizeCameraSizeStep(video.sizeStep, 1),
    },
    chat: {
      position,
      width,
      textScale: normalizeTextScale(chat.textScale),
      maxMessages: normalizeMessageCount(chat.maxMessages, CLASSIC_LAYOUT.chat.maxMessages),
    },
  };
}

export function parseOverlayLayoutPreferencesV2(
  value: unknown,
  options: { legacyCameraSizeStep?: unknown } = {},
): OverlayLayoutPreferencesV2 {
  if (!isRecord(value)) {
    return getDefaultOverlayLayoutPreferencesV2();
  }

  if (value.version === OVERLAY_LAYOUT_STORAGE_VERSION) {
    return normalizeOverlayLayoutPreferencesV2(value);
  }

  const objects = isRecord(value.objects) ? value.objects : null;
  if (!objects || !isRecord(objects.video) || !isRecord(objects.chat)) {
    return getDefaultOverlayLayoutPreferencesV2();
  }

  const legacyDefinition = migrateLegacyDefinition(objects.video, objects.chat, value.chat, options);
  return createPreferences(normalizePresetId(value.presetId), legacyDefinition);
}

function normalizeOverlayLayoutPreferencesV2(value: unknown): OverlayLayoutPreferencesV2 {
  const source = isRecord(value) ? value : {};
  return createPreferences(
    normalizePresetId(source.activePresetId),
    normalizeOverlayLayoutDefinition(source.custom),
  );
}

function migrateLegacyDefinition(
  video: Record<string, unknown>,
  chat: Record<string, unknown>,
  legacyChat: unknown,
  options: { legacyCameraSizeStep?: unknown },
): OverlayLayoutDefinition {
  const videoX = normalizeGridCoordinate(video.x, CLASSIC_LAYOUT.video.anchor.x, OVERLAY_LAYOUT_GRID_COLUMNS);
  const videoY = normalizeGridCoordinate(video.y, CLASSIC_LAYOUT.video.anchor.y, OVERLAY_LAYOUT_GRID_ROWS);
  const videoWidth = clampInteger(numberOrFallback(video.w, 1), 1, OVERLAY_LAYOUT_GRID_COLUMNS - videoX);
  const videoHeight = clampInteger(numberOrFallback(video.h, 1), 1, OVERLAY_LAYOUT_GRID_ROWS - videoY);
  const leaderSide: OverlayLayoutLeaderSide = videoX + videoWidth / 2 < OVERLAY_LAYOUT_GRID_COLUMNS / 2
    ? "left"
    : "right";

  return normalizeOverlayLayoutDefinition({
    video: {
      anchor: {
        x: leaderSide === "left" ? videoX : videoX + videoWidth - 1,
        y: Math.round(videoY + videoHeight / 2),
      },
      leaderSide,
      sizeStep: normalizeCameraSizeStep(options.legacyCameraSizeStep, 1),
    },
    chat: {
      position: {
        x: numberOrFallback(chat.x, CLASSIC_LAYOUT.chat.position.x),
        y: numberOrFallback(chat.y, CLASSIC_LAYOUT.chat.position.y),
      },
      width: numberOrFallback(chat.w, CLASSIC_LAYOUT.chat.width),
      textScale: "normal",
      maxMessages: isRecord(legacyChat) ? legacyChat.maxMessages : CLASSIC_LAYOUT.chat.maxMessages,
    },
  });
}

function createPreferences(
  activePresetId: OverlayLayoutPresetId,
  custom: OverlayLayoutDefinition,
): OverlayLayoutPreferencesV2 {
  return {
    version: OVERLAY_LAYOUT_STORAGE_VERSION,
    activePresetId,
    custom: cloneDefinition(custom),
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

function normalizePresetId(value: unknown): OverlayLayoutPresetId {
  return value === "cinema" || value === "social" || value === "minimal" || value === "custom"
    ? value
    : "classic";
}

function normalizeLeaderSide(value: unknown, anchorX: number): OverlayLayoutLeaderSide {
  if (value === "left" || value === "right") {
    return value;
  }

  return anchorX < OVERLAY_LAYOUT_GRID_COLUMNS / 2 ? "left" : "right";
}

function normalizeTextScale(value: unknown): OverlayLayoutTextScale {
  return value === "compact" || value === "large" || value === "normal" ? value : "normal";
}

function normalizeMessageCount(value: unknown, fallback: OverlayLayoutMessageCount): OverlayLayoutMessageCount {
  const numeric = numberOrFallback(value, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return ([3, 5, 8] as const).reduce<OverlayLayoutMessageCount>(
    (nearest, option) =>
      Math.abs(option - numeric) < Math.abs(nearest - numeric) ? option : nearest,
    3,
  );
}

function normalizeCameraSizeStep(value: unknown, fallback: OverlayLayoutCameraSizeStep): OverlayLayoutCameraSizeStep {
  const numeric = numberOrFallback(value, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return clampInteger(numeric, 0, 3) as OverlayLayoutCameraSizeStep;
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
