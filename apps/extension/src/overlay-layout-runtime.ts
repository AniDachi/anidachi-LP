import type {
  OverlayLayoutContext,
  PixelRect,
  ResolvedOverlayLayout,
} from "./overlay-layout-engine";
import { OVERLAY_LAYOUT_CAMERA_SLOT_CAPACITY } from "./overlay-layout-model";

export interface OverlayLayoutRuntimeContextInput {
  width: number;
  height: number;
  cameraCount: number;
  controlsBottomInsetPx: number;
  safePaddingPx?: number;
  reservedRects?: PixelRect[];
}

export interface OverlayLayoutRightAnchoredReservation {
  top: number;
  right: number;
  width: number;
  height: number;
}

export interface OverlayLayoutReservedRectsInput {
  viewport: {
    width: number;
    height: number;
  };
  accountBubble?: OverlayLayoutRightAnchoredReservation;
  roomRail?: OverlayLayoutRightAnchoredReservation;
}

export function createOverlayLayoutRuntimeContext(
  input: OverlayLayoutRuntimeContextInput,
): OverlayLayoutContext {
  const safePaddingPx = input.safePaddingPx ?? 12;

  return {
    cameraCount: normalizeCameraCount(input.cameraCount),
    reservedRects: (input.reservedRects ?? []).map((rect) => ({ ...rect })),
    viewport: {
      height: input.height,
      safeInsets: {
        bottom: Math.max(safePaddingPx, input.controlsBottomInsetPx),
        left: safePaddingPx,
        right: safePaddingPx,
        top: safePaddingPx,
      },
      width: input.width,
    },
  };
}

export function getOverlayLayoutCameraSlotCount(
  visibleCameraCount: number,
): 0 | typeof OVERLAY_LAYOUT_CAMERA_SLOT_CAPACITY {
  return Number.isFinite(visibleCameraCount) && visibleCameraCount > 0
    ? OVERLAY_LAYOUT_CAMERA_SLOT_CAPACITY
    : 0;
}

export function getOverlayLayoutReservedRects(
  input: OverlayLayoutReservedRectsInput,
): PixelRect[] {
  const viewportWidth = finiteNonNegative(input.viewport.width);
  const viewportHeight = finiteNonNegative(input.viewport.height);

  return [input.accountBubble, input.roomRail]
    .filter((reservation): reservation is OverlayLayoutRightAnchoredReservation => reservation != null)
    .map((reservation) => toRightAnchoredRect(reservation, viewportWidth, viewportHeight));
}

export function getOverlayLayoutRuntimeStyles(
  resolved: ResolvedOverlayLayout,
): Record<string, string> {
  const source = toRecord(resolved);
  const video = toRecord(source.video);
  const chat = toRecord(source.chat);
  const videoBounds = toRect(video.bounds);
  const chatRect = toRect(chat.rect);
  const bubbleSizePx = finiteNonNegative(video.effectiveSizePx);

  return {
    "--cam-stack-left": toPx(videoBounds.x),
    "--cam-stack-top": toPx(videoBounds.y),
    "--cam-bubble-size": toPx(bubbleSizePx),
    "--cam-bubble-gap": toPx(getBubbleGapPx(video.slots, bubbleSizePx)),
    "--cam-stack-direction": video.leaderSide === "left" ? "row" : "row-reverse",
    "--live-chat-message-opacity": toMessageOpacity(chat.messageTransparency),
    "--live-chat-left": toPx(chatRect.x),
    "--live-chat-top": toPx(chatRect.y),
    "--live-chat-width": toPx(chatRect.width),
    "--live-chat-height": toPx(chatRect.height),
    "--live-chat-font-size": toPx(chat.fontSizePx),
    "--live-chat-line-height": toPx(chat.lineHeightPx),
  };
}

function toMessageOpacity(value: unknown): string {
  const transparency = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return String(1 - Math.max(0, Math.min(95, transparency)) / 100);
}

function getBubbleGapPx(slots: unknown, bubbleSizePx: number): number {
  if (!Array.isArray(slots) || slots.length < 2) {
    return 0;
  }

  const first = toRect(slots[0]);
  const second = toRect(slots[1]);
  const firstCenterX = first.x + first.width / 2;
  const secondCenterX = second.x + second.width / 2;

  return finiteNonNegative(Math.abs(secondCenterX - firstCenterX) - bubbleSizePx);
}

function normalizeCameraCount(cameraCount: number): OverlayLayoutContext["cameraCount"] {
  const rounded = typeof cameraCount === "number" && Number.isFinite(cameraCount)
    ? Math.round(cameraCount)
    : 0;
  const clamped = Math.max(0, Math.min(4, rounded));
  const cameraCounts = [0, 1, 2, 3, 4] as const;

  return cameraCounts[clamped]!;
}

function toRightAnchoredRect(
  reservation: OverlayLayoutRightAnchoredReservation,
  viewportWidth: number,
  viewportHeight: number,
): PixelRect {
  const source = toRecord(reservation);
  const width = Math.min(finiteNonNegative(source.width), viewportWidth);
  const height = Math.min(finiteNonNegative(source.height), viewportHeight);
  const maximumX = viewportWidth - width;
  const maximumY = viewportHeight - height;

  return {
    height,
    width,
    x: clamp(finiteNonNegative(viewportWidth - finiteNonNegative(source.right) - width), 0, maximumX),
    y: clamp(finiteNonNegative(source.top), 0, maximumY),
  };
}

function toRect(value: unknown): PixelRect {
  const record = toRecord(value);

  return {
    height: finiteNonNegative(record.height),
    width: finiteNonNegative(record.width),
    x: finiteNonNegative(record.x),
    y: finiteNonNegative(record.y),
  };
}

function finiteNonNegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function toPx(value: unknown): string {
  return `${finiteNonNegative(value)}px`;
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
