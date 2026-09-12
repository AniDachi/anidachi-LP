import type {
	OverlayLayoutContext,
	PixelRect,
	ResolvedOverlayLayout,
} from "./overlay-layout-engine";
import { OVERLAY_LAYOUT_CAMERA_SLOT_CAPACITY } from "./overlay-layout-model";
import type { PlayerOverlayInsets } from "./source-adapters/core/overlay-geometry";

export const CAMERA_INTERACTION_CORRIDOR_PADDING_PX = 18;

export interface OverlayLayoutRuntimeContextInput {
	width: number;
	height: number;
	cameraCount: number;
	playerSafeInsets?: {
		topPx: number;
		rightPx: number;
		bottomPx: number;
		leftPx: number;
	};
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
	const safePaddingPx = normalizeSafePadding(input.safePaddingPx);
	const playerSafeInsets = input.playerSafeInsets;

	return {
		cameraCount: normalizeCameraCount(input.cameraCount),
		reservedRects: (input.reservedRects ?? []).map((rect) => ({ ...rect })),
		viewport: {
			height: finiteNonNegative(input.height),
			safeInsets: {
				bottom: Math.max(
					safePaddingPx,
					finiteNonNegative(playerSafeInsets?.bottomPx),
				),
				left: Math.max(
					safePaddingPx,
					finiteNonNegative(playerSafeInsets?.leftPx),
				),
				right: Math.max(
					safePaddingPx,
					finiteNonNegative(playerSafeInsets?.rightPx),
				),
				top: Math.max(
					safePaddingPx,
					finiteNonNegative(playerSafeInsets?.topPx),
				),
			},
			width: finiteNonNegative(input.width),
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

export function mergeMaximumPlayerOverlayInsets(
	current: PlayerOverlayInsets,
	observed: PlayerOverlayInsets,
): PlayerOverlayInsets {
	return {
		bottomPx: Math.max(
			finiteNonNegative(current.bottomPx),
			finiteNonNegative(observed.bottomPx),
		),
		leftPx: Math.max(
			finiteNonNegative(current.leftPx),
			finiteNonNegative(observed.leftPx),
		),
		rightPx: Math.max(
			finiteNonNegative(current.rightPx),
			finiteNonNegative(observed.rightPx),
		),
		topPx: Math.max(
			finiteNonNegative(current.topPx),
			finiteNonNegative(observed.topPx),
		),
	};
}

export function getCameraInteractionCorridor(
	cameraBounds: PixelRect[],
	viewport: { width: number; height: number },
	paddingPx = CAMERA_INTERACTION_CORRIDOR_PADDING_PX,
): PixelRect {
	const viewportWidth = finiteNonNegative(viewport.width);
	const viewportHeight = finiteNonNegative(viewport.height);
	const padding = finiteNonNegative(paddingPx);
	const usableBounds = cameraBounds
		.map((bounds) => toRect(bounds))
		.filter((bounds) => bounds.width > 0 && bounds.height > 0);

	if (
		viewportWidth === 0 ||
		viewportHeight === 0 ||
		usableBounds.length === 0
	) {
		return { height: 0, width: 0, x: 0, y: 0 };
	}

	const left = clamp(
		Math.min(...usableBounds.map((bounds) => bounds.x)) - padding,
		0,
		viewportWidth,
	);
	const top = clamp(
		Math.min(...usableBounds.map((bounds) => bounds.y)) - padding,
		0,
		viewportHeight,
	);
	const right = clamp(
		Math.max(...usableBounds.map((bounds) => bounds.x + bounds.width)) +
			padding,
		0,
		viewportWidth,
	);
	const bottom = clamp(
		Math.max(...usableBounds.map((bounds) => bounds.y + bounds.height)) +
			padding,
		0,
		viewportHeight,
	);

	return {
		height: Math.max(0, bottom - top),
		width: Math.max(0, right - left),
		x: left,
		y: top,
	};
}

export function getOverlayLayoutReservedRects(
	input: OverlayLayoutReservedRectsInput,
): PixelRect[] {
	const viewportWidth = finiteNonNegative(input.viewport.width);
	const viewportHeight = finiteNonNegative(input.viewport.height);

	return [input.accountBubble, input.roomRail]
		.filter(
			(reservation): reservation is OverlayLayoutRightAnchoredReservation =>
				reservation != null,
		)
		.map((reservation) =>
			toRightAnchoredRect(reservation, viewportWidth, viewportHeight),
		);
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
		"--cam-stack-direction":
			video.leaderSide === "left" ? "row" : "row-reverse",
		"--live-chat-message-opacity": toMessageOpacity(chat.messageTransparency),
		"--live-chat-left": toPx(chatRect.x),
		"--live-chat-top": toPx(chatRect.y),
		"--live-chat-width": toPx(chatRect.width),
		"--live-chat-height": toPx(chatRect.height),
		"--live-chat-font-size": toPx(chat.fontSizePx),
		"--live-chat-line-height": toPx(chat.lineHeightPx),
	};
}

export function getRoomRailRuntimeStyles(viewport: {
	height: number;
	width: number;
}): Record<string, string> {
	const width = finiteNonNegative(viewport.width);
	const height = finiteNonNegative(viewport.height);
	const widthScale = width > 0 ? width / 960 : 1;
	const heightScale = height > 0 ? height / 540 : 1;
	const scale = clamp(Math.min(widthScale, heightScale), 0.88, 1.12);
	const scaledValue = (base: number, minimum: number) =>
		Math.max(minimum, Math.round(base * scale));
	const scaled = (base: number, minimum: number) =>
		`${scaledValue(base, minimum)}px`;
	const scaledHalf = (base: number, minimum: number) =>
		`${Math.max(minimum, Math.round(base * scale * 2) / 2)}px`;
	const avatarSize = scaledValue(32, 28);
	const pillPadding = scaledValue(5, 4);
	const compactWidth = Math.max(
		scaledValue(44, 40),
		avatarSize + pillPadding * 2 + 2,
	);

	return {
		"--room-rail-audio-button-size": scaled(22, 20),
		"--room-rail-audio-gap": scaled(6, 5),
		"--room-rail-audio-height": scaled(20, 18),
		"--room-rail-audio-icon-size": scaled(12, 11),
		"--room-rail-avatar-font-size": scaledHalf(10, 9),
		"--room-rail-avatar-size": `${avatarSize}px`,
		"--room-rail-compact-width": `${compactWidth}px`,
		"--room-rail-content-gap": scaledHalf(4, 3.5),
		"--room-rail-expanded-width": scaled(196, 172),
		"--room-rail-gap": scaled(6, 5),
		"--room-rail-identity-gap": scaled(6, 5),
		"--room-rail-name-font-size": scaledHalf(11.5, 10.5),
		"--room-rail-panel-width": scaled(204, 180),
		"--room-rail-peek-width": scaled(104, 92),
		"--room-rail-pill-gap": scaled(7, 6),
		"--room-rail-pill-padding": `${pillPadding}px`,
		"--room-rail-pill-padding-end": scaled(8, 7),
		"--room-rail-pill-height": scaled(48, 44),
		"--room-rail-role-font-size": scaledHalf(8, 7.5),
		"--room-rail-slot-height": scaled(52, 48),
		"--room-rail-status-font-size": scaledHalf(9.5, 9),
		"--room-rail-voice-indicator-size": scaled(15, 13),
	};
}

export function getRoomRailBottomInsetPx(input: {
	playerBottomInsetPx: number;
	viewportHeight: number;
}): number {
	const viewportHeight = finiteNonNegative(input.viewportHeight);
	const adaptiveInset =
		viewportHeight > 0
			? clamp(Math.round(viewportHeight * 0.14), 56, 92)
			: 92;
	const providerSafeInset =
		finiteNonNegative(input.playerBottomInsetPx) + 12;

	return Math.round(Math.max(adaptiveInset, providerSafeInset));
}

function toMessageOpacity(value: unknown): string {
	const transparency =
		typeof value === "number" && Number.isFinite(value) ? value : 0;
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

	return finiteNonNegative(
		Math.abs(secondCenterX - firstCenterX) - bubbleSizePx,
	);
}

function normalizeCameraCount(
	cameraCount: number,
): OverlayLayoutContext["cameraCount"] {
	const rounded =
		typeof cameraCount === "number" && Number.isFinite(cameraCount)
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
		x: clamp(
			finiteNonNegative(
				viewportWidth - finiteNonNegative(source.right) - width,
			),
			0,
			maximumX,
		),
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
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: 0;
}

function normalizeSafePadding(value: number | undefined): number {
	return value === undefined || !Number.isFinite(value) || value < 0
		? 12
		: value;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}

function toPx(value: unknown): string {
	return `${finiteNonNegative(value)}px`;
}

function toRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}
