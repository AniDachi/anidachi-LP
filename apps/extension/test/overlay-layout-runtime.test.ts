import { describe, expect, it } from "vitest";
import {
	createOverlayLayoutRuntimeContext,
	getCameraInteractionCorridor,
	getOverlayLayoutCameraSlotCount,
	getOverlayLayoutReservedRects,
	getOverlayLayoutRuntimeStyles,
	getRoomRailBottomInsetPx,
	getRoomRailRuntimeStyles,
	mergeMaximumPlayerOverlayInsets,
} from "../src/overlay-layout-runtime";

describe("overlay layout runtime context", () => {
	it("reserves the full four-seat camera layout whenever any camera is visible", () => {
		expect(getOverlayLayoutCameraSlotCount(0)).toBe(0);
		expect(getOverlayLayoutCameraSlotCount(1)).toBe(4);
		expect(getOverlayLayoutCameraSlotCount(3)).toBe(4);
		expect(getOverlayLayoutCameraSlotCount(Number.NaN)).toBe(0);
	});

	it("builds safe insets and defensively copies reserved rectangles", () => {
		const reservedRects = [{ height: 40, width: 120, x: 16, y: 24 }];
		const context = createOverlayLayoutRuntimeContext({
			cameraCount: 2,
			height: 720,
			playerSafeInsets: {
				bottomPx: 48,
				leftPx: 6,
				rightPx: 30,
				topPx: 24,
			},
			reservedRects,
			width: 1280,
		});

		expect(context).toEqual({
			cameraCount: 2,
			reservedRects: [{ height: 40, width: 120, x: 16, y: 24 }],
			viewport: {
				height: 720,
				safeInsets: { bottom: 48, left: 12, right: 30, top: 24 },
				width: 1280,
			},
		});
		expect(context.reservedRects).not.toBe(reservedRects);
		expect(context.reservedRects[0]).not.toBe(reservedRects[0]);

		reservedRects[0]!.x = 999;
		expect(context.reservedRects[0]!.x).toBe(16);
	});

	it("uses supplied safe padding when controls need less bottom space", () => {
		const context = createOverlayLayoutRuntimeContext({
			cameraCount: 0,
			height: 360,
			playerSafeInsets: { bottomPx: 8, leftPx: 4, rightPx: 12, topPx: 0 },
			safePaddingPx: 20,
			width: 640,
		});

		expect(context.viewport.safeInsets).toEqual({
			bottom: 20,
			left: 20,
			right: 20,
			top: 20,
		});
	});

	it("uses default safe padding when provider insets are missing", () => {
		const context = createOverlayLayoutRuntimeContext({
			cameraCount: 0,
			height: 360,
			width: 640,
		});

		expect(context.viewport.safeInsets).toEqual({
			bottom: 12,
			left: 12,
			right: 12,
			top: 12,
		});
	});

	it("normalizes malformed safe padding and provider insets", () => {
		const context = createOverlayLayoutRuntimeContext({
			cameraCount: 0,
			height: 360,
			playerSafeInsets: {
				bottomPx: -10,
				leftPx: 7,
				rightPx: Number.POSITIVE_INFINITY,
				topPx: Number.NaN,
			},
			safePaddingPx: Number.NaN,
			width: 640,
		});

		expect(context.viewport.safeInsets).toEqual({
			bottom: 12,
			left: 12,
			right: 12,
			top: 12,
		});
	});

	it("keeps finite provider insets for a zero-sized viewport", () => {
		const context = createOverlayLayoutRuntimeContext({
			cameraCount: 0,
			height: 0,
			playerSafeInsets: { bottomPx: 40, leftPx: 30, rightPx: 20, topPx: 10 },
			width: 0,
		});

		expect(context.viewport).toEqual({
			height: 0,
			safeInsets: { bottom: 40, left: 30, right: 20, top: 12 },
			width: 0,
		});
	});

	it.each([
		{ cameraCount: -2, expected: 0, label: "clamps negative counts to zero" },
		{ cameraCount: 9, expected: 4, label: "clamps counts above four" },
		{
			cameraCount: 2.6,
			expected: 3,
			label: "rounds fractional counts before clamping",
		},
	])("$label", ({ cameraCount, expected }) => {
		const context = createOverlayLayoutRuntimeContext({
			cameraCount,
			height: 360,
			width: 640,
		});

		expect(context.cameraCount).toBe(expected);
	});

	it("retains the largest provider chrome reservation after controls hide", () => {
		expect(
			mergeMaximumPlayerOverlayInsets(
				{ bottomPx: 82, leftPx: 0, rightPx: 16, topPx: 12 },
				{ bottomPx: 128, leftPx: 4, rightPx: 0, topPx: 8 },
			),
		).toEqual({ bottomPx: 128, leftPx: 4, rightPx: 16, topPx: 12 });
	});
});

describe("camera interaction corridor", () => {
	it("covers both hidden-controls and visible-controls camera positions", () => {
		expect(
			getCameraInteractionCorridor(
				[
					{ height: 80, width: 80, x: 900, y: 420 },
					{ height: 80, width: 80, x: 900, y: 330 },
				],
				{ height: 720, width: 1280 },
				18,
			),
		).toEqual({ height: 206, width: 116, x: 882, y: 312 });
	});

	it("clips its enlarged pointer area to the overlay viewport", () => {
		expect(
			getCameraInteractionCorridor(
				[{ height: 44, width: 44, x: 4, y: 3 }],
				{ height: 60, width: 70 },
				18,
			),
		).toEqual({ height: 60, width: 66, x: 0, y: 0 });
	});

	it("stays inert when no camera layout is available", () => {
		expect(
			getCameraInteractionCorridor(
				[{ height: 0, width: 0, x: 0, y: 0 }],
				{ height: 720, width: 1280 },
				18,
			),
		).toEqual({ height: 0, width: 0, x: 0, y: 0 });
	});
});

describe("overlay layout reserved rectangles", () => {
	it("converts right-anchored account and rail areas to clamped local rectangles in order", () => {
		const input = {
			accountBubble: { height: 20, right: 10, top: 12, width: 30 },
			roomRail: { height: 50, right: 90, top: 75, width: 50 },
			viewport: { height: 80, width: 100 },
		};

		const reservedRects = getOverlayLayoutReservedRects(input);

		expect(reservedRects).toEqual([
			{ height: 20, width: 30, x: 60, y: 12 },
			{ height: 50, width: 50, x: 0, y: 30 },
		]);

		reservedRects[0]!.x = 999;
		const nextReservedRects = getOverlayLayoutReservedRects(input);
		expect(nextReservedRects).toEqual([
			{ height: 20, width: 30, x: 60, y: 12 },
			{ height: 50, width: 50, x: 0, y: 30 },
		]);
		expect(nextReservedRects).not.toBe(reservedRects);
		expect(nextReservedRects[0]).not.toBe(reservedRects[0]);
	});

	it("returns no rectangles for missing areas and makes malformed measurements finite", () => {
		expect(
			getOverlayLayoutReservedRects({ viewport: { height: 80, width: 100 } }),
		).toEqual([]);

		expect(
			getOverlayLayoutReservedRects({
				accountBubble: {
					height: Number.NEGATIVE_INFINITY,
					right: Number.POSITIVE_INFINITY,
					top: -5,
					width: Number.NaN,
				},
				viewport: { height: Number.NaN, width: Number.POSITIVE_INFINITY },
			}),
		).toEqual([{ height: 0, width: 0, x: 0, y: 0 }]);
	});
});

describe("overlay layout runtime styles", () => {
	it("scales the complete room rail down for compact players", () => {
		const compactStyles = {
			"--room-rail-audio-button-size": "20px",
			"--room-rail-audio-gap": "5px",
			"--room-rail-audio-height": "18px",
			"--room-rail-audio-icon-size": "11px",
			"--room-rail-avatar-font-size": "9px",
			"--room-rail-avatar-size": "28px",
			"--room-rail-compact-width": "40px",
			"--room-rail-content-gap": "3.5px",
			"--room-rail-expanded-width": "172px",
			"--room-rail-gap": "5px",
			"--room-rail-identity-gap": "5px",
			"--room-rail-name-font-size": "10.5px",
			"--room-rail-panel-width": "180px",
			"--room-rail-peek-width": "92px",
			"--room-rail-pill-gap": "6px",
			"--room-rail-pill-padding": "4px",
			"--room-rail-pill-padding-end": "7px",
			"--room-rail-pill-height": "44px",
			"--room-rail-role-font-size": "7.5px",
			"--room-rail-slot-height": "48px",
			"--room-rail-status-font-size": "9px",
			"--room-rail-voice-indicator-size": "13px",
		};

		expect(getRoomRailRuntimeStyles({ height: 270, width: 480 })).toEqual(
			compactStyles,
		);
		expect(getRoomRailRuntimeStyles({ height: 360, width: 640 })).toEqual(
			compactStyles,
		);
	});

	it("uses the current balanced room rail size at the 960 by 540 baseline", () => {
		expect(getRoomRailRuntimeStyles({ height: 540, width: 960 })).toEqual({
			"--room-rail-audio-button-size": "22px",
			"--room-rail-audio-gap": "6px",
			"--room-rail-audio-height": "20px",
			"--room-rail-audio-icon-size": "12px",
			"--room-rail-avatar-font-size": "10px",
			"--room-rail-avatar-size": "32px",
			"--room-rail-compact-width": "44px",
			"--room-rail-content-gap": "4px",
			"--room-rail-expanded-width": "196px",
			"--room-rail-gap": "6px",
			"--room-rail-identity-gap": "6px",
			"--room-rail-name-font-size": "11.5px",
			"--room-rail-panel-width": "204px",
			"--room-rail-peek-width": "104px",
			"--room-rail-pill-gap": "7px",
			"--room-rail-pill-padding": "5px",
			"--room-rail-pill-padding-end": "8px",
			"--room-rail-pill-height": "48px",
			"--room-rail-role-font-size": "8px",
			"--room-rail-slot-height": "52px",
			"--room-rail-status-font-size": "9.5px",
			"--room-rail-voice-indicator-size": "15px",
		});
	});

	it("grows the complete room rail modestly on large and fullscreen players", () => {
		const largeStyles = {
			"--room-rail-audio-button-size": "25px",
			"--room-rail-audio-gap": "7px",
			"--room-rail-audio-height": "22px",
			"--room-rail-audio-icon-size": "13px",
			"--room-rail-avatar-font-size": "11px",
			"--room-rail-avatar-size": "36px",
			"--room-rail-compact-width": "50px",
			"--room-rail-content-gap": "4.5px",
			"--room-rail-expanded-width": "220px",
			"--room-rail-gap": "7px",
			"--room-rail-identity-gap": "7px",
			"--room-rail-name-font-size": "13px",
			"--room-rail-panel-width": "228px",
			"--room-rail-peek-width": "116px",
			"--room-rail-pill-gap": "8px",
			"--room-rail-pill-padding": "6px",
			"--room-rail-pill-padding-end": "9px",
			"--room-rail-pill-height": "54px",
			"--room-rail-role-font-size": "9px",
			"--room-rail-slot-height": "58px",
			"--room-rail-status-font-size": "10.5px",
			"--room-rail-voice-indicator-size": "17px",
		};

		expect(getRoomRailRuntimeStyles({ height: 720, width: 1280 })).toEqual(
			largeStyles,
		);
		expect(getRoomRailRuntimeStyles({ height: 1080, width: 1920 })).toEqual(
			largeStyles,
		);
	});

	it("uses the shorter player edge so wide letterbox players do not overscale", () => {
		expect(
			getRoomRailRuntimeStyles({ height: 500, width: 1920 }),
		).toMatchObject({
			"--room-rail-avatar-size": "30px",
			"--room-rail-expanded-width": "181px",
			"--room-rail-panel-width": "189px",
			"--room-rail-pill-height": "44px",
			"--room-rail-slot-height": "48px",
		});
	});

	it("keeps the room rail above provider controls without wasting compact-player height", () => {
		expect(
			getRoomRailBottomInsetPx({
				playerBottomInsetPx: 0,
				viewportHeight: 270,
			}),
		).toBe(56);
		expect(
			getRoomRailBottomInsetPx({
				playerBottomInsetPx: 0,
				viewportHeight: 360,
			}),
		).toBe(56);
		expect(
			getRoomRailBottomInsetPx({
				playerBottomInsetPx: 0,
				viewportHeight: 540,
			}),
		).toBe(76);
		expect(
			getRoomRailBottomInsetPx({
				playerBottomInsetPx: 0,
				viewportHeight: 720,
			}),
		).toBe(92);
		expect(
			getRoomRailBottomInsetPx({
				playerBottomInsetPx: 108,
				viewportHeight: 540,
			}),
		).toBe(120);
		expect(
			getRoomRailBottomInsetPx({
				playerBottomInsetPx: Number.NaN,
				viewportHeight: Number.NaN,
			}),
		).toBe(92);
	});

	it("maps a left leader, bubble gap, and chat typography to pixel custom properties", () => {
		expect(
			getOverlayLayoutRuntimeStyles({
				chat: {
					messageTransparency: 65,
					effectiveMaxMessages: 5,
					fontSizePx: 13,
					lineHeightPx: 16,
					position: { x: 0, y: 1 },
					rect: { height: 186, width: 300, x: 24, y: 108 },
				},
				video: {
					anchor: { x: 8, y: 1 },
					bounds: { height: 80, width: 176, x: 900, y: 48 },
					effectiveSizePx: 80,
					effectiveSizeStep: 1,
					leaderSide: "left",
					slots: [
						{ height: 80, width: 80, x: 900, y: 48 },
						{ height: 80, width: 80, x: 996, y: 48 },
					],
				},
			}),
		).toEqual({
			"--cam-bubble-gap": "16px",
			"--cam-bubble-size": "80px",
			"--cam-stack-direction": "row",
			"--cam-stack-left": "900px",
			"--cam-stack-top": "48px",
			"--live-chat-font-size": "13px",
			"--live-chat-message-opacity": "0.35",
			"--live-chat-height": "186px",
			"--live-chat-left": "24px",
			"--live-chat-line-height": "16px",
			"--live-chat-top": "108px",
			"--live-chat-width": "300px",
		});
	});

	it("uses row-reverse for a right leader and zero gap for one slot", () => {
		const styles = getOverlayLayoutRuntimeStyles({
			chat: {
				messageTransparency: 65,
				effectiveMaxMessages: 3,
				fontSizePx: 11,
				lineHeightPx: 14,
				position: { x: 0, y: 0 },
				rect: { height: 116, width: 200, x: 0, y: 0 },
			},
			video: {
				anchor: { x: 11, y: 0 },
				bounds: { height: 72, width: 72, x: 1100, y: 40 },
				effectiveSizePx: 72,
				effectiveSizeStep: 0,
				leaderSide: "right",
				slots: [{ height: 72, width: 72, x: 1100, y: 40 }],
			},
		});

		expect(styles["--cam-stack-direction"]).toBe("row-reverse");
		expect(styles["--cam-bubble-gap"]).toBe("0px");
	});

	it("falls back to finite nonnegative pixel values for malformed resolved geometry", () => {
		const styles = getOverlayLayoutRuntimeStyles({
			chat: {
				fontSizePx: Number.POSITIVE_INFINITY,
				lineHeightPx: -1,
				rect: {
					height: Number.NaN,
					width: -1,
					x: Number.NEGATIVE_INFINITY,
					y: -5,
				},
			},
			video: {
				bounds: {
					height: Number.NaN,
					width: -1,
					x: Number.POSITIVE_INFINITY,
					y: -1,
				},
				effectiveSizePx: Number.NaN,
				leaderSide: "invalid",
				slots: [
					{ height: 10, width: 10, x: Number.NaN, y: 0 },
					{ height: 10, width: 10, x: Number.POSITIVE_INFINITY, y: 0 },
				],
			},
		} as never);

		expect(styles).toEqual({
			"--cam-bubble-gap": "0px",
			"--cam-bubble-size": "0px",
			"--cam-stack-direction": "row-reverse",
			"--cam-stack-left": "0px",
			"--cam-stack-top": "0px",
			"--live-chat-font-size": "0px",
			"--live-chat-message-opacity": "1",
			"--live-chat-height": "0px",
			"--live-chat-left": "0px",
			"--live-chat-line-height": "0px",
			"--live-chat-top": "0px",
			"--live-chat-width": "0px",
		});
	});
});
