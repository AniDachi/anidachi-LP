export type OverlayLayoutObjectId = "video" | "chat";
export type OverlayLayoutPresetId = "classic" | "cinema" | "social" | "minimal" | "custom";
export type OverlayLayoutChatMaxMessages = 3 | 5 | 8;

export interface OverlayLayoutGridRect {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface OverlayLayoutPreferences {
  chat: {
    maxMessages: OverlayLayoutChatMaxMessages;
  };
  objects: Record<OverlayLayoutObjectId, OverlayLayoutGridRect>;
  presetId: OverlayLayoutPresetId;
  version: 1;
}

export interface OverlayLayoutPreset {
  id: Exclude<OverlayLayoutPresetId, "custom">;
  label: string;
  preferences: OverlayLayoutPreferences;
}

export const OVERLAY_LAYOUT_GRID_COLUMNS = 12;
export const OVERLAY_LAYOUT_GRID_ROWS = 8;
export const OVERLAY_LAYOUT_STORAGE_VERSION = 1;
export const OVERLAY_LAYOUT_CHAT_MESSAGE_OPTIONS: OverlayLayoutChatMaxMessages[] = [3, 5, 8];

const VIDEO_FOOTPRINT: OverlayLayoutGridRect = { x: 8, y: 5, w: 4, h: 2 };
const CHAT_FOOTPRINT: OverlayLayoutGridRect = { x: 7, y: 3, w: 5, h: 2 };

const PRESET_OBJECTS: Record<
  Exclude<OverlayLayoutPresetId, "custom">,
  Record<OverlayLayoutObjectId, OverlayLayoutGridRect>
> = {
  classic: {
    video: { ...VIDEO_FOOTPRINT },
    chat: { ...CHAT_FOOTPRINT },
  },
  cinema: {
    video: { x: 9, y: 5, w: 3, h: 2 },
    chat: { x: 1, y: 6, w: 4, h: 1 },
  },
  social: {
    video: { x: 8, y: 1, w: 4, h: 2 },
    chat: { x: 6, y: 4, w: 6, h: 3 },
  },
  minimal: {
    video: { x: 10, y: 1, w: 2, h: 2 },
    chat: { x: 7, y: 6, w: 4, h: 1 },
  },
};

const PRESET_LABELS: Record<Exclude<OverlayLayoutPresetId, "custom">, string> = {
  classic: "Classic",
  cinema: "Cinema",
  social: "Social",
  minimal: "Minimal",
};

export const OVERLAY_LAYOUT_PRESETS: OverlayLayoutPreset[] = (
  Object.keys(PRESET_OBJECTS) as Array<Exclude<OverlayLayoutPresetId, "custom">>
).map((presetId) => ({
  id: presetId,
  label: PRESET_LABELS[presetId],
  preferences: createPresetPreferences(presetId),
}));

export function getDefaultOverlayLayoutPreferences(): OverlayLayoutPreferences {
  return clonePreferences(OVERLAY_LAYOUT_PRESETS[0]?.preferences ?? createPresetPreferences("classic"));
}

export function getOverlayLayoutPreset(
  presetId: OverlayLayoutPresetId,
): OverlayLayoutPreset | null {
  if (presetId === "custom") {
    return null;
  }

  return OVERLAY_LAYOUT_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function normalizeOverlayLayoutPreferences(value: unknown): OverlayLayoutPreferences {
  if (!isRecord(value)) {
    return getDefaultOverlayLayoutPreferences();
  }

  const source = value as Partial<OverlayLayoutPreferences>;
  const presetId = normalizePresetId(source.presetId);
  const fallback = presetId === "custom"
    ? getDefaultOverlayLayoutPreferences()
    : (getOverlayLayoutPreset(presetId)?.preferences ?? getDefaultOverlayLayoutPreferences());
  const sourceObjects: Record<string, unknown> = isRecord(source.objects) ? source.objects : {};
  const nextObjects = {
    video: normalizeGridRect(sourceObjects.video, fallback.objects.video),
    chat: normalizeGridRect(sourceObjects.chat, fallback.objects.chat),
  };
  const next: OverlayLayoutPreferences = {
    chat: {
      maxMessages: normalizeChatMaxMessages(
        isRecord(source.chat) ? source.chat.maxMessages : undefined,
        fallback.chat.maxMessages,
      ),
    },
    objects: resolveObjectCollisions(nextObjects),
    presetId,
    version: OVERLAY_LAYOUT_STORAGE_VERSION,
  };

  return clonePreferences(next);
}

export function applyOverlayLayoutPreset(
  presetId: OverlayLayoutPresetId,
): OverlayLayoutPreferences {
  const preset = getOverlayLayoutPreset(presetId);
  return clonePreferences(preset?.preferences ?? getDefaultOverlayLayoutPreferences());
}

export function moveOverlayLayoutObject(
  preferences: OverlayLayoutPreferences,
  objectId: OverlayLayoutObjectId,
  x: number,
  y: number,
): OverlayLayoutPreferences {
  const current = normalizeOverlayLayoutPreferences(preferences);
  const currentRect = current.objects[objectId];
  const proposed = clampGridRect({
    ...currentRect,
    x: Math.round(x),
    y: Math.round(y),
  });
  const otherObjectId = objectId === "video" ? "chat" : "video";
  const nextRect =
    findNearestAvailableRect(proposed, [current.objects[otherObjectId]]) ?? currentRect;

  return markCustom({
    ...current,
    objects: {
      ...current.objects,
      [objectId]: nextRect,
    },
  });
}

export function resizeOverlayLayoutObject(
  preferences: OverlayLayoutPreferences,
  objectId: OverlayLayoutObjectId,
  size: Pick<OverlayLayoutGridRect, "h" | "w">,
): OverlayLayoutPreferences {
  const current = normalizeOverlayLayoutPreferences(preferences);
  const currentRect = current.objects[objectId];
  const proposed = clampGridRect({
    ...currentRect,
    h: Math.round(size.h),
    w: Math.round(size.w),
  });
  const otherObjectId = objectId === "video" ? "chat" : "video";
  const nextRect =
    findNearestAvailableRect(proposed, [current.objects[otherObjectId]]) ?? currentRect;

  return markCustom({
    ...current,
    objects: {
      ...current.objects,
      [objectId]: nextRect,
    },
  });
}

export function updateOverlayLayoutChatMaxMessages(
  preferences: OverlayLayoutPreferences,
  maxMessages: number,
): OverlayLayoutPreferences {
  const current = normalizeOverlayLayoutPreferences(preferences);
  return markCustom({
    ...current,
    chat: {
      ...current.chat,
      maxMessages: normalizeChatMaxMessages(maxMessages, current.chat.maxMessages),
    },
  });
}

export function getGridRectStyle(rect: OverlayLayoutGridRect): Record<string, string> {
  const safeRect = clampGridRect(rect);
  return {
    height: `${(safeRect.h / OVERLAY_LAYOUT_GRID_ROWS) * 100}%`,
    left: `${(safeRect.x / OVERLAY_LAYOUT_GRID_COLUMNS) * 100}%`,
    top: `${(safeRect.y / OVERLAY_LAYOUT_GRID_ROWS) * 100}%`,
    width: `${(safeRect.w / OVERLAY_LAYOUT_GRID_COLUMNS) * 100}%`,
  };
}

export function getOverlayLayoutCssVariables(
  preferences: OverlayLayoutPreferences,
): Record<string, string> {
  const normalized = normalizeOverlayLayoutPreferences(preferences);
  const video = normalized.objects.video;
  const chat = normalized.objects.chat;

  return {
    "--cam-stack-left": `${(video.x / OVERLAY_LAYOUT_GRID_COLUMNS) * 100}%`,
    "--cam-stack-right": `${
      ((OVERLAY_LAYOUT_GRID_COLUMNS - video.x - video.w) / OVERLAY_LAYOUT_GRID_COLUMNS) * 100
    }%`,
    "--cam-stack-top": `${(video.y / OVERLAY_LAYOUT_GRID_ROWS) * 100}%`,
    "--live-chat-height": `${(chat.h / OVERLAY_LAYOUT_GRID_ROWS) * 100}%`,
    "--live-chat-left": `${(chat.x / OVERLAY_LAYOUT_GRID_COLUMNS) * 100}%`,
    "--live-chat-top": `${(chat.y / OVERLAY_LAYOUT_GRID_ROWS) * 100}%`,
    "--live-chat-width": `${(chat.w / OVERLAY_LAYOUT_GRID_COLUMNS) * 100}%`,
  };
}

export function getCenteredGridPosition(
  rect: OverlayLayoutGridRect,
  cellX: number,
  cellY: number,
): Pick<OverlayLayoutGridRect, "x" | "y"> {
  return {
    x: Math.round(cellX - rect.w / 2),
    y: Math.round(cellY - rect.h / 2),
  };
}

function createPresetPreferences(
  presetId: Exclude<OverlayLayoutPresetId, "custom">,
): OverlayLayoutPreferences {
  return {
    chat: {
      maxMessages: presetId === "minimal" ? 3 : presetId === "social" ? 8 : 5,
    },
    objects: resolveObjectCollisions(PRESET_OBJECTS[presetId]),
    presetId,
    version: OVERLAY_LAYOUT_STORAGE_VERSION,
  };
}

function normalizePresetId(value: unknown): OverlayLayoutPresetId {
  return value === "cinema" ||
    value === "social" ||
    value === "minimal" ||
    value === "custom"
    ? value
    : "classic";
}

function normalizeChatMaxMessages(
  value: unknown,
  fallback: OverlayLayoutChatMaxMessages,
): OverlayLayoutChatMaxMessages {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return OVERLAY_LAYOUT_CHAT_MESSAGE_OPTIONS.reduce((nearest, option) =>
    Math.abs(option - numeric) < Math.abs(nearest - numeric) ? option : nearest,
  );
}

function normalizeGridRect(
  value: unknown,
  fallback: OverlayLayoutGridRect,
): OverlayLayoutGridRect {
  if (!isRecord(value)) {
    return clampGridRect(fallback);
  }

  return clampGridRect({
    h: numberOrFallback(value.h, fallback.h),
    w: numberOrFallback(value.w, fallback.w),
    x: numberOrFallback(value.x, fallback.x),
    y: numberOrFallback(value.y, fallback.y),
  });
}

function clampGridRect(rect: OverlayLayoutGridRect): OverlayLayoutGridRect {
  const w = clamp(Math.round(rect.w), 1, OVERLAY_LAYOUT_GRID_COLUMNS);
  const h = clamp(Math.round(rect.h), 1, OVERLAY_LAYOUT_GRID_ROWS);

  return {
    h,
    w,
    x: clamp(Math.round(rect.x), 0, OVERLAY_LAYOUT_GRID_COLUMNS - w),
    y: clamp(Math.round(rect.y), 0, OVERLAY_LAYOUT_GRID_ROWS - h),
  };
}

function resolveObjectCollisions(
  objects: Record<OverlayLayoutObjectId, OverlayLayoutGridRect>,
): Record<OverlayLayoutObjectId, OverlayLayoutGridRect> {
  const video = ensureGridHasFreeCell(clampGridRect(objects.video));
  const chat = findNearestAvailableRect(clampGridRect(objects.chat), [video]);
  return chat
    ? { video, chat }
    : {
        video: { ...VIDEO_FOOTPRINT },
        chat: { ...CHAT_FOOTPRINT },
      };
}

function findNearestAvailableRect(
  proposed: OverlayLayoutGridRect,
  blockedRects: OverlayLayoutGridRect[],
): OverlayLayoutGridRect | null {
  const rect = clampGridRect(proposed);
  const blocked = blockedRects.map(clampGridRect);
  if (!blocked.some((blockedRect) => rectsOverlap(rect, blockedRect))) {
    return rect;
  }

  let best: {
    area: number;
    dimensionLoss: number;
    distance: number;
    rect: OverlayLayoutGridRect;
  } | null = null;

  for (let h = rect.h; h >= 1; h -= 1) {
    for (let w = rect.w; w >= 1; w -= 1) {
      const maxX = OVERLAY_LAYOUT_GRID_COLUMNS - w;
      const maxY = OVERLAY_LAYOUT_GRID_ROWS - h;

      for (let y = 0; y <= maxY; y += 1) {
        for (let x = 0; x <= maxX; x += 1) {
          const candidate = { h, w, x, y };
          if (blocked.some((blockedRect) => rectsOverlap(candidate, blockedRect))) {
            continue;
          }

          const area = candidate.w * candidate.h;
          const dimensionLoss = rect.w - candidate.w + (rect.h - candidate.h);
          const distance = Math.abs(candidate.x - rect.x) + Math.abs(candidate.y - rect.y);
          if (
            !best ||
            area > best.area ||
            (area === best.area && dimensionLoss < best.dimensionLoss) ||
            (area === best.area &&
              dimensionLoss === best.dimensionLoss &&
              distance < best.distance)
          ) {
            best = { area, dimensionLoss, distance, rect: candidate };
          }
        }
      }
    }
  }

  return best?.rect ?? null;
}

function ensureGridHasFreeCell(rect: OverlayLayoutGridRect): OverlayLayoutGridRect {
  if (rect.w * rect.h < OVERLAY_LAYOUT_GRID_COLUMNS * OVERLAY_LAYOUT_GRID_ROWS) {
    return rect;
  }

  return clampGridRect({
    ...rect,
    w: rect.w - 1,
  });
}

function rectsOverlap(a: OverlayLayoutGridRect, b: OverlayLayoutGridRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function markCustom(preferences: OverlayLayoutPreferences): OverlayLayoutPreferences {
  return clonePreferences({
    ...preferences,
    presetId: "custom",
  });
}

function clonePreferences(preferences: OverlayLayoutPreferences): OverlayLayoutPreferences {
  return {
    chat: { ...preferences.chat },
    objects: {
      chat: { ...preferences.objects.chat },
      video: { ...preferences.objects.video },
    },
    presetId: preferences.presetId,
    version: OVERLAY_LAYOUT_STORAGE_VERSION,
  };
}

function numberOrFallback(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
