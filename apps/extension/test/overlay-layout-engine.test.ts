import { describe, expect, it } from "vitest";
import {
	rectsOverlap,
	resolveOverlayLayout,
	resolveVideoLayout,
} from "../src/overlay-layout-engine";
import { getDefaultOverlayLayoutDefinition } from "../src/overlay-layout-model";

const viewport = {
	height: 720,
	safeInsets: { bottom: 56, left: 12, right: 12, top: 12 },
	width: 1280,
};

describe("overlay layout camera geometry", () => {
	it.each([
		0, 1, 2, 3, 4,
	] as const)("keeps edge anchors flush with the safe area at camera size step %i", (sizeStep) => {
		const rightBottom = resolveVideoLayout(
			{ anchor: { x: 11, y: 7 }, leaderSide: "right", sizeStep },
			viewport,
			4,
		);
		const leftTop = resolveVideoLayout(
			{ anchor: { x: 0, y: 0 }, leaderSide: "left", sizeStep },
			viewport,
			4,
		);

		expect(rightBottom.slots[0]!.x + rightBottom.slots[0]!.width).toBeCloseTo(
			1268,
		);
		expect(rightBottom.slots[0]!.y + rightBottom.slots[0]!.height).toBeCloseTo(
			664,
		);
		expect(leftTop.slots[0]!.x).toBeCloseTo(12);
		expect(leftTop.slots[0]!.y).toBeCloseTo(12);
	});

	it("places four right-side slots from the leader inward", () => {
		const result = resolveVideoLayout(
			{ anchor: { x: 11, y: 5 }, leaderSide: "right", sizeStep: 1 },
			viewport,
			4,
		);

		expect(result.slots).toHaveLength(4);
		expect(result.slots[0]!.x).toBeGreaterThan(result.slots[1]!.x);
		expect(result.slots[1]!.x).toBeGreaterThan(result.slots[2]!.x);
		expect(result.slots[2]!.x).toBeGreaterThan(result.slots[3]!.x);
	});

	it("places left-side followers toward the screen interior", () => {
		const result = resolveVideoLayout(
			{ anchor: { x: 0, y: 3 }, leaderSide: "left", sizeStep: 1 },
			viewport,
			4,
		);

		expect(result.slots[0]!.x).toBeLessThan(result.slots[1]!.x);
		expect(result.slots[3]!.x + result.slots[3]!.width).toBeLessThanOrEqual(
			1268,
		);
	});

	it("returns only occupied runtime slots and keeps all geometry in bounds", () => {
		for (const count of [0, 1, 2, 3, 4] as const) {
			const result = resolveVideoLayout(
				{ anchor: { x: 11, y: 7 }, leaderSide: "right", sizeStep: 3 },
				{ ...viewport, height: 360, width: 640 },
				count,
			);

			expect(result.slots).toHaveLength(count);
			for (const slot of result.slots) {
				expect(slot.x).toBeGreaterThanOrEqual(12);
				expect(slot.y).toBeGreaterThanOrEqual(12);
				expect(slot.x + slot.width).toBeLessThanOrEqual(628);
				expect(slot.y + slot.height).toBeLessThanOrEqual(304);
			}
		}
	});

	it("sizes four slots against the usable safe rectangle", () => {
		const constrainedViewport = {
			height: 720,
			safeInsets: { bottom: 0, left: 100, right: 710, top: 20 },
			width: 1280,
		};
		const result = resolveVideoLayout(
			{ anchor: { x: 11, y: 5 }, leaderSide: "right", sizeStep: 3 },
			constrainedViewport,
			4,
		);
		const safeRect = { bottom: 720, left: 100, right: 570, top: 20 };

		expect(result.slots).toHaveLength(4);
		for (const slot of result.slots) {
			expect(slot.x).toBeGreaterThanOrEqual(safeRect.left);
			expect(slot.y).toBeGreaterThanOrEqual(safeRect.top);
			expect(slot.x + slot.width).toBeLessThanOrEqual(safeRect.right);
			expect(slot.y + slot.height).toBeLessThanOrEqual(safeRect.bottom);
		}
	});

	it("returns finite zero bounds when no cameras are occupied", () => {
		const result = resolveVideoLayout(
			{ anchor: { x: 11, y: 7 }, leaderSide: "right", sizeStep: 3 },
			{
				height: Number.NaN,
				safeInsets: {
					bottom: Number.POSITIVE_INFINITY,
					left: -10,
					right: Number.NaN,
					top: -20,
				},
				width: Number.NEGATIVE_INFINITY,
			},
			0,
		);

		expect(result.bounds).toEqual({ height: 0, width: 0, x: 0, y: 0 });
		expect(result.slots).toEqual([]);
		expect(Object.values(result.bounds).every(Number.isFinite)).toBe(true);
	});

	it("clamps camera count and caps the effective size step without changing intent", () => {
		const video = {
			anchor: { x: 11, y: 5 },
			leaderSide: "right",
			sizeStep: 3,
		} as const;
		const originalVideo = structuredClone(video);
		const originalViewport = structuredClone(viewport);
		const result = resolveVideoLayout(video, viewport, 99.7, 1);

		expect(result.slots).toHaveLength(4);
		expect(result.effectiveSizeStep).toBe(1);
		expect(result.effectiveSizePx).toBe(79);
		expect(video).toEqual(originalVideo);
		expect(viewport).toEqual(originalViewport);
	});

	it("keeps XXL as the effective size on a large single-camera player", () => {
		const result = resolveVideoLayout(
			{ anchor: { x: 11, y: 5 }, leaderSide: "right", sizeStep: 4 },
			{
				height: 1080,
				safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
				width: 1920,
			},
			1,
		);

		expect(result.effectiveSizeStep).toBe(4);
		expect(result.effectiveSizePx).toBe(220);
	});

	it("keeps XXL visibly distinct for the reserved four-seat 720p layout", () => {
		const result = resolveVideoLayout(
			{ anchor: { x: 11, y: 5 }, leaderSide: "right", sizeStep: 4 },
			{
				height: 720,
				safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
				width: 1280,
			},
			4,
		);

		expect(result.effectiveSizeStep).toBe(4);
		expect(result.effectiveSizePx).toBe(152);
		expect(result.bounds.width).toBeLessThanOrEqual(1280 * 0.5);
	});
});

describe("overlay layout resolver", () => {
	it("keeps a one-column chat flush with the right safe-area edge", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		definition.chat.position = { x: 11, y: 4 };
		definition.chat.width = 1;

		const result = resolveOverlayLayout(definition, {
			cameraCount: 0,
			reservedRects: [],
			viewport,
		});

		expect(result.chat.rect.width).toBeCloseTo((1280 - 24) / 12);
		expect(result.chat.rect.x + result.chat.rect.width).toBeCloseTo(1268);
	});

	it.each([
		["compact", 3, 11, 14, 107],
		["compact", 5, 11, 14, 171],
		["compact", 8, 11, 14, 267],
		["normal", 3, 13, 16, 113],
		["normal", 5, 13, 16, 181],
		["normal", 8, 13, 16, 283],
		["large", 3, 15, 19, 122],
		["large", 5, 15, 19, 196],
		["large", 8, 15, 19, 307],
		["xlarge", 3, 17, 21, 128],
		["xlarge", 5, 17, 21, 206],
		["xlarge", 8, 17, 21, 323],
	] as const)("derives exact chat metrics for %s text at %i messages", (textScale, maxMessages, fontSizePx, lineHeightPx, height) => {
		const definition = getDefaultOverlayLayoutDefinition();
		const result = resolveOverlayLayout(
			{ ...definition, chat: { ...definition.chat, maxMessages, textScale } },
			{ cameraCount: 0, reservedRects: [], viewport },
		);

		expect(result.chat.effectiveMaxMessages).toBe(maxMessages);
		expect(result.chat.fontSizePx).toBe(fontSizePx);
		expect(result.chat.lineHeightPx).toBe(lineHeightPx);
		expect(result.chat.rect.height).toBe(height);
	});

	it("compacts a filled chat above bottom cameras when the viewport shrinks", () => {
		const definition = {
			video: {
				anchor: { x: 0, y: 7 },
				leaderSide: "left" as const,
				sizeStep: 0 as const,
			},
			chat: {
				messageTransparency: 0,
				position: { x: 0, y: 6 },
				width: 6,
				textScale: "normal" as const,
				maxMessages: "fill" as const,
			},
		};
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [],
			viewport: {
				height: 360,
				safeInsets: { bottom: 56, left: 12, right: 12, top: 12 },
				width: 640,
			},
		});

		expect(result.video.anchor).toEqual(definition.video.anchor);
		expect(result.chat.position).toEqual(definition.chat.position);
		expect(result.chat.effectiveMaxMessages).toBe(6);
		expect(result.chat.rect.x).toBeCloseTo(12);
		expect(
			result.video.bounds.y - (result.chat.rect.y + result.chat.rect.height),
		).toBeCloseTo(12);
	});

	it("does not shrink chat when bottom cameras move to the side", () => {
		const createDefinition = (cameraX: number) => ({
			video: {
				anchor: { x: cameraX, y: 7 },
				leaderSide: "left" as const,
				sizeStep: 1 as const,
			},
			chat: {
				messageTransparency: 0,
				position: { x: 0, y: 6 },
				width: 3,
				textScale: "large" as const,
				maxMessages: 15,
			},
		});
		const context = {
			cameraCount: 4 as const,
			reservedRects: [],
			viewport: {
				height: 720,
				safeInsets: { bottom: 56, left: 12, right: 12, top: 12 },
				width: 1280,
			},
		};
		const stacked = resolveOverlayLayout(createDefinition(0), context);
		const sideBySide = resolveOverlayLayout(createDefinition(4), context);

		expect(sideBySide.chat.effectiveMaxMessages).toBeGreaterThanOrEqual(
			stacked.chat.effectiveMaxMessages,
		);
		expect(sideBySide.chat.rect.height).toBeGreaterThanOrEqual(
			stacked.chat.rect.height,
		);
	});

	it("moves chat monotonically while it crosses a centered camera group", () => {
		const definition = {
			video: {
				anchor: { x: 6, y: 7 },
				leaderSide: "right" as const,
				sizeStep: 1 as const,
			},
			chat: {
				messageTransparency: 0,
				position: { x: 0, y: 6 },
				width: 3,
				textScale: "large" as const,
				maxMessages: 15,
			},
		};
		const context = {
			cameraCount: 4 as const,
			reservedRects: [],
			viewport: {
				height: 720,
				safeInsets: { bottom: 56, left: 12, right: 12, top: 12 },
				width: 1280,
			},
		};
		const horizontalPositions = Array.from(
			{ length: 10 },
			(_, x) =>
				resolveOverlayLayout(
					{
						...definition,
						chat: { ...definition.chat, position: { x, y: 6 } },
					},
					context,
				).chat.rect.x,
		);

		expect(horizontalPositions).toEqual(
			[...horizontalPositions].sort((left, right) => left - right),
		);
	});

	it("keeps a tall chat stable while it crosses the horizontal midpoint", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		definition.chat.width = 3;
		definition.chat.textScale = "large";
		definition.chat.maxMessages = 15;
		const context = {
			cameraCount: 0 as const,
			reservedRects: [],
			viewport: {
				height: 720,
				safeInsets: { bottom: 56, left: 12, right: 12, top: 12 },
				width: 1280,
			},
		};
		const layouts = Array.from(
			{ length: 8 },
			(_, y) =>
				resolveOverlayLayout(
					{
						...definition,
						chat: { ...definition.chat, position: { x: 0, y } },
					},
					context,
				).chat,
		);
		const topPositions = layouts.map((layout) => layout.rect.y);

		expect(layouts.every((layout) => layout.effectiveMaxMessages === 15)).toBe(
			true,
		);
		expect(topPositions).toEqual(
			[...topPositions].sort((topA, topB) => topA - topB),
		);
	});

	it("derives chat geometry for a message count between the former presets", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		const result = resolveOverlayLayout(
			{
				...definition,
				chat: { ...definition.chat, maxMessages: 11, textScale: "normal" },
			},
			{ cameraCount: 0, reservedRects: [], viewport },
		);

		expect(result.chat.effectiveMaxMessages).toBe(11);
		expect(result.chat.rect.height).toBe(385);
	});

	it("fills the available height with the largest complete message count", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		definition.chat.maxMessages = "fill";
		definition.chat.position = { x: 0, y: 0 };
		const result = resolveOverlayLayout(definition, {
			cameraCount: 0,
			reservedRects: [],
			viewport: {
				height: 360,
				safeInsets: { bottom: 12, left: 12, right: 12, top: 12 },
				width: 640,
			},
		});

		expect(result.chat.effectiveMaxMessages).toBe(9);
		expect(result.chat.rect.height).toBe(317);
		expect(result.chat.rect.y + result.chat.rect.height).toBeLessThanOrEqual(
			348,
		);
	});

	it("moves chat to the nearest free grid position without moving the camera anchor", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [{ x: 0, y: 650, width: 1280, height: 70 }],
			viewport,
		});

		expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
		expect(result.video.leaderSide).toBe(definition.video.leaderSide);
	});

	it.each([
		0, 3,
	] as const)("keeps chat exactly 12px above bottom cameras at size step %i", (sizeStep) => {
		const definition = {
			video: { anchor: { x: 0, y: 7 }, leaderSide: "left" as const, sizeStep },
			chat: {
				messageTransparency: 0,
				position: { x: 0, y: 7 },
				width: 3,
				textScale: "compact" as const,
				maxMessages: 3 as const,
			},
		};
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [],
			viewport,
		});

		expect(result.video.anchor).toEqual(definition.video.anchor);
		expect(result.video.effectiveSizeStep).toBe(sizeStep);
		expect(result.chat.position).toEqual(definition.chat.position);
		expect(
			result.video.bounds.y - (result.chat.rect.y + result.chat.rect.height),
		).toBeCloseTo(12);
	});

	it.each([
		["compact", 3],
		["normal", 5],
		["large", 8],
	] as const)("preserves the 12px camera gap for %s chat with %i messages", (textScale, maxMessages) => {
		const definition = {
			video: {
				anchor: { x: 0, y: 7 },
				leaderSide: "left" as const,
				sizeStep: 0 as const,
			},
			chat: {
				messageTransparency: 0,
				position: { x: 0, y: 7 },
				width: 3,
				textScale,
				maxMessages,
			},
		};
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [],
			viewport,
		});

		expect(result.chat.effectiveMaxMessages).toBe(maxMessages);
		expect(result.chat.position).toEqual(definition.chat.position);
		expect(
			result.video.bounds.y - (result.chat.rect.y + result.chat.rect.height),
		).toBeCloseTo(12);
	});

	it("places an overlapping top chat 12px below cameras when there is no room above", () => {
		const definition = {
			video: {
				anchor: { x: 0, y: 0 },
				leaderSide: "left" as const,
				sizeStep: 3 as const,
			},
			chat: {
				messageTransparency: 0,
				position: { x: 0, y: 0 },
				width: 3,
				textScale: "large" as const,
				maxMessages: 8 as const,
			},
		};
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [],
			viewport,
		});

		expect(result.video.anchor).toEqual(definition.video.anchor);
		expect(result.chat.position).toEqual(definition.chat.position);
		expect(
			result.chat.rect.y - (result.video.bounds.y + result.video.bounds.height),
		).toBeCloseTo(12);
		expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
	});

	it("keeps a 12px horizontal gap when vertical contact cannot fit", () => {
		const definition = {
			video: {
				anchor: { x: 0, y: 3 },
				leaderSide: "left" as const,
				sizeStep: 0 as const,
			},
			chat: {
				messageTransparency: 0,
				position: { x: 2, y: 3 },
				width: 3,
				textScale: "large" as const,
				maxMessages: 8 as const,
			},
		};
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [],
			viewport,
		});

		expect(
			result.chat.rect.x - (result.video.bounds.x + result.video.bounds.width),
		).toBeCloseTo(12);
		expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
	});

	it("aligns the last chat row and column with the safe-area edges", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		definition.chat.position = { x: 7, y: 7 };
		const result = resolveOverlayLayout(definition, {
			cameraCount: 0,
			reservedRects: [],
			viewport,
		});

		expect(result.chat.position).toEqual({ x: 7, y: 7 });
		expect(result.chat.rect.x + result.chat.rect.width).toBeCloseTo(1268);
		expect(result.chat.rect.y + result.chat.rect.height).toBe(664);
	});

	it("moves a camera group away from a top-right reserved area before resolving chat", () => {
		const definition = {
			...getDefaultOverlayLayoutDefinition(),
			video: {
				anchor: { x: 11, y: 0 },
				leaderSide: "right" as const,
				sizeStep: 1 as const,
			},
		};
		const reservation = { height: 150, width: 200, x: 1000, y: 0 };
		const result = resolveOverlayLayout(definition, {
			cameraCount: 1,
			reservedRects: [reservation],
			viewport: reservedCameraViewport,
		});

		expect(result.video.bounds).toMatchObject({ x: 907, y: 0 });
		expect(rectsOverlap(result.video.bounds, reservation)).toBe(false);
		expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
		expect(rectsOverlap(result.chat.rect, reservation)).toBe(false);
	});

	it("moves a four-camera group away from a right-side rail", () => {
		const definition = {
			...getDefaultOverlayLayoutDefinition(),
			video: {
				anchor: { x: 11, y: 6 },
				leaderSide: "right" as const,
				sizeStep: 1 as const,
			},
		};
		const rail = { height: 800, width: 300, x: 900, y: 0 };
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [rail],
			viewport: reservedCameraViewport,
		});

		expect(result.video.effectiveSizeStep).toBe(1);
		expect(result.video.bounds).toMatchObject({ x: 525, y: 607 });
		expect(result.video.slots.every((slot) => !rectsOverlap(slot, rail))).toBe(
			true,
		);
		expect(rectsOverlap(result.video.bounds, rail)).toBe(false);
	});

	it("selects the nearest reserved-safe camera anchor by distance, y, then x", () => {
		const definition = {
			...getDefaultOverlayLayoutDefinition(),
			video: {
				anchor: { x: 5, y: 3 },
				leaderSide: "left" as const,
				sizeStep: 0 as const,
			},
		};
		const result = resolveOverlayLayout(definition, {
			cameraCount: 1,
			reservedRects: [{ height: 75, width: 75, x: 513, y: 663 }],
			viewport: selectionViewport,
		});

		expect(result.video.bounds).toMatchObject({ x: 512.5, y: 462.5 });
	});

	it("keeps the requested camera size when another same-size anchor avoids reservations", () => {
		const definition = {
			...getDefaultOverlayLayoutDefinition(),
			video: {
				anchor: { x: 11, y: 0 },
				leaderSide: "right" as const,
				sizeStep: 3 as const,
			},
		};
		const reservation = { height: 220, width: 250, x: 950, y: 0 };
		const result = resolveOverlayLayout(definition, {
			cameraCount: 1,
			reservedRects: [reservation],
			viewport: reservedCameraViewport,
		});

		expect(result.video.effectiveSizeStep).toBe(3);
		expect(rectsOverlap(result.video.bounds, reservation)).toBe(false);
	});

	it("tries every same-size camera anchor before compacting the camera group", () => {
		const definition = {
			video: {
				anchor: { x: 5, y: 3 },
				leaderSide: "left" as const,
				sizeStep: 1 as const,
			},
			chat: {
				messageTransparency: 0,
				position: { x: 0, y: 4 },
				width: 5,
				textScale: "compact" as const,
				maxMessages: 3 as const,
			},
		};
		const reservation = { height: 135, width: 400, x: 0, y: 0 };

		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [reservation],
			viewport: {
				height: 360,
				safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
				width: 640,
			},
		});

		expect(result.video.effectiveSizeStep).toBe(1);
		expect(rectsOverlap(result.video.bounds, reservation)).toBe(false);
		expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
	});

	it("does not mutate saved camera intent or context while resolving reservations", () => {
		const definition = {
			...getDefaultOverlayLayoutDefinition(),
			video: {
				anchor: { x: 11, y: 0 },
				leaderSide: "right" as const,
				sizeStep: 3 as const,
			},
		};
		const context = {
			cameraCount: 1 as const,
			reservedRects: [{ height: 220, width: 250, x: 950, y: 0 }],
			viewport: reservedCameraViewport,
		};
		const definitionSnapshot = structuredClone(definition);
		const contextSnapshot = structuredClone(context);
		const result = resolveOverlayLayout(definition, context);

		expect(definition).toEqual(definitionSnapshot);
		expect(context).toEqual(contextSnapshot);
		expect(result.video.leaderSide).toBe(definition.video.leaderSide);
		expect(result.video.effectiveSizeStep).toBe(definition.video.sizeStep);
	});

	it("keeps zero-camera output unchanged when reservations are present", () => {
		const result = resolveOverlayLayout(getDefaultOverlayLayoutDefinition(), {
			cameraCount: 0,
			reservedRects: [{ height: 800, width: 300, x: 900, y: 0 }],
			viewport: reservedCameraViewport,
		});

		expect(result.video).toMatchObject({
			bounds: { height: 0, width: 0, x: 0, y: 0 },
			slots: [],
		});
	});

	it("uses temporary compact fallback without mutating preferences", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		const snapshot = structuredClone(definition);
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [],
			viewport: {
				height: 360,
				safeInsets: { bottom: 40, left: 8, right: 8, top: 8 },
				width: 640,
			},
		});

		expect(definition).toEqual(snapshot);
		expect(result.chat.effectiveMaxMessages).toBeLessThanOrEqual(5);
		expect(result.video.effectiveSizeStep).toBeLessThanOrEqual(
			definition.video.sizeStep,
		);
		expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
	});

	it("reduces camera size when reservations leave no chat space at the requested size", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		const context = {
			cameraCount: 4 as const,
			reservedRects: [
				{ height: 175, width: 640, x: 0, y: 185 },
				{ height: 360, width: 80, x: 560, y: 0 },
			],
			viewport: {
				height: 360,
				safeInsets: { bottom: 8, left: 8, right: 8, top: 8 },
				width: 640,
			},
		};
		const definitionSnapshot = structuredClone(definition);
		const contextSnapshot = structuredClone(context);

		const result = resolveOverlayLayout(definition, context);

		expect(result.video.effectiveSizeStep).toBe(0);
		expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
		for (const reservation of context.reservedRects) {
			expect(rectsOverlap(result.video.bounds, reservation)).toBe(false);
			expect(rectsOverlap(result.chat.rect, reservation)).toBe(false);
		}
		expect(definition).toEqual(definitionSnapshot);
		expect(context).toEqual(contextSnapshot);
	});

	it("compacts chat before reducing the stored camera size", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [],
			viewport: {
				height: 180,
				safeInsets: { bottom: 8, left: 8, right: 8, top: 8 },
				width: 640,
			},
		});

		expect(result.chat.effectiveMaxMessages).toBe(4);
		expect(result.video.effectiveSizeStep).toBe(definition.video.sizeStep);
	});

	it("reduces the camera size step when the selected group exceeds the safe width", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [],
			viewport: {
				height: 600,
				safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
				width: 300,
			},
		});

		expect(result.video.effectiveSizeStep).toBe(0);
		expect(result.video.slots).toHaveLength(4);
		for (const slot of result.video.slots) {
			expect(slot.x).toBeGreaterThanOrEqual(0);
			expect(slot.y).toBeGreaterThanOrEqual(0);
			expect(slot.x + slot.width).toBeLessThanOrEqual(300);
			expect(slot.y + slot.height).toBeLessThanOrEqual(600);
		}
	});

	it("selects the nearest unblocked chat cell by Manhattan distance", () => {
		const definition = createCompactChatDefinition();
		const result = resolveOverlayLayout(definition, {
			cameraCount: 0,
			reservedRects: [
				blockChatGridSpan(5, 3, 3),
				blockChatGridCell(5, 2),
				blockChatGridCell(5, 4),
			],
			viewport: selectionViewport,
		});

		expect(result.chat.rect.x).toBe(500);
		expect(result.chat.rect.y).toBeCloseTo(chatTopForSelectionRow(1));
	});

	it("breaks equal-distance chat placement ties by y before x", () => {
		const definition = createCompactChatDefinition();
		const result = resolveOverlayLayout(definition, {
			cameraCount: 0,
			reservedRects: [blockChatGridCell(5, 3)],
			viewport: selectionViewport,
		});

		expect(result.chat.rect.x).toBe(500);
		expect(result.chat.rect.y).toBeCloseTo(chatTopForSelectionRow(2));
	});

	it("breaks equal-distance and y chat placement ties by x", () => {
		const definition = createCompactChatDefinition();
		const result = resolveOverlayLayout(definition, {
			cameraCount: 0,
			reservedRects: [
				blockChatRow(0),
				blockChatRow(1),
				blockChatRow(2),
				blockChatRow(4),
				blockChatRow(5),
				blockChatGridSpan(5, 3, 3),
			],
			viewport: selectionViewport,
		});

		expect(result.chat.rect.x).toBe(200);
		expect(result.chat.rect.y).toBeCloseTo(chatTopForSelectionRow(3));
	});

	it("returns a finite clamped minimum fallback for impossible reserved geometry", () => {
		const defaultDefinition = getDefaultOverlayLayoutDefinition();
		const definition = {
			...defaultDefinition,
			chat: { ...defaultDefinition.chat, position: { x: 0, y: 7 } },
		};
		const snapshot = structuredClone(definition);
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [{ x: 0, y: 0, width: 640, height: 360 }],
			viewport: {
				height: 360,
				safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
				width: 640,
			},
		});

		expect(definition).toEqual(snapshot);
		expect(result.chat.effectiveMaxMessages).toBe(3);
		expect(result.video.effectiveSizeStep).toBe(0);
		expect(result.chat.rect.x).toBeGreaterThanOrEqual(0);
		expect(result.chat.rect.y).toBeGreaterThanOrEqual(0);
		expect(result.chat.rect.x + result.chat.rect.width).toBeLessThanOrEqual(
			640,
		);
		expect(result.chat.rect.y + result.chat.rect.height).toBeLessThanOrEqual(
			360,
		);
		expect(Object.values(result.chat.rect).every(Number.isFinite)).toBe(true);
		expect(Object.values(result.video.bounds).every(Number.isFinite)).toBe(
			true,
		);
	});

	it("returns finite geometry for an invalid viewport", () => {
		const definition = getDefaultOverlayLayoutDefinition();
		const result = resolveOverlayLayout(definition, {
			cameraCount: 4,
			reservedRects: [],
			viewport: {
				height: Number.NaN,
				safeInsets: { bottom: -1, left: Number.NaN, right: 0, top: 0 },
				width: 0,
			},
		});

		for (const value of Object.values(result.chat.rect))
			expect(Number.isFinite(value)).toBe(true);
		for (const value of Object.values(result.video.bounds))
			expect(Number.isFinite(value)).toBe(true);
	});
});

const selectionViewport = {
	height: 1600,
	safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
	width: 1200,
};

const reservedCameraViewport = {
	height: 800,
	safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
	width: 1200,
};

function createCompactChatDefinition() {
	const definition = getDefaultOverlayLayoutDefinition();
	return {
		...definition,
		chat: {
			...definition.chat,
			maxMessages: 3 as const,
			position: { x: 5, y: 3 },
			textScale: "compact" as const,
			width: 3,
		},
	};
}

function blockChatGridCell(x: number, y: number) {
	return {
		height: 1,
		width: 1,
		x: x * 100 + 1,
		y: chatTopForSelectionRow(y) + 1,
	};
}

function blockChatRow(y: number) {
	return {
		height: 1,
		width: 1200,
		x: 0,
		y: chatTopForSelectionRow(y) + 1,
	};
}

function blockChatGridSpan(x: number, y: number, width: number) {
	return {
		height: 1,
		width: width * 100,
		x: x * 100,
		y: chatTopForSelectionRow(y) + 1,
	};
}

function chatTopForSelectionRow(y: number) {
	const compactChatHeight = 107;
	return (y / 7) * (selectionViewport.height - compactChatHeight);
}
