import { describe, expect, it } from "vitest";
import {
	getParticipantVolumeFromKey,
	getParticipantVolumeFromPointer,
} from "../src/participant-volume-geometry";

const CENTER = { centerX: 100, centerY: 100 };
const RADIUS = 50;

function pointAtClockwiseAngle(angleDegrees: number, distance = RADIUS) {
	const radians = (angleDegrees * Math.PI) / 180;

	return {
		pointerX: CENTER.centerX + Math.cos(radians) * distance,
		pointerY: CENTER.centerY + Math.sin(radians) * distance,
	};
}

function pointerInput(
	angleDegrees: number,
	options: {
		captured?: boolean;
		distance?: number;
		hitBandPx?: number;
		previousValue?: number;
	} = {},
) {
	return {
		...CENTER,
		radius: RADIUS,
		...pointAtClockwiseAngle(angleDegrees, options.distance),
		captured: options.captured ?? false,
		hitBandPx: options.hitBandPx,
		previousValue: options.previousValue ?? 50,
	};
}

describe("participant volume pointer geometry", () => {
	it("maps the 270-degree active arc from lower-left through top to lower-right", () => {
		expect(getParticipantVolumeFromPointer(pointerInput(135))).toBeCloseTo(0);
		expect(getParticipantVolumeFromPointer(pointerInput(270))).toBeCloseTo(50);
		expect(getParticipantVolumeFromPointer(pointerInput(45))).toBeCloseTo(100);
	});

	it("ignores initial pointer down outside the minimum 12px annular band", () => {
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(270, { distance: RADIUS - 6 }),
			),
		).toBeCloseTo(50);
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(270, { distance: RADIUS + 6 }),
			),
		).toBeCloseTo(50);
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(270, { distance: RADIUS - 6.01 }),
			),
		).toBeNull();
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(270, { distance: RADIUS + 6.01 }),
			),
		).toBeNull();
	});

	it("does not allow a configured hit band narrower than 12px", () => {
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(270, { distance: RADIUS + 6, hitBandPx: 4 }),
			),
		).toBeCloseTo(50);
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(270, { distance: RADIUS + 6.01, hitBandPx: 4 }),
			),
		).toBeNull();
	});

	it("ignores initial pointer down in the bottom dead zone", () => {
		expect(getParticipantVolumeFromPointer(pointerInput(90))).toBeNull();
	});

	it("keeps captured movement active regardless of radial distance", () => {
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(270, { captured: true, distance: 2, previousValue: 10 }),
			),
		).toBeCloseTo(50);
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(270, { captured: true, distance: 500, previousValue: 90 }),
			),
		).toBeCloseTo(50);
	});

	it("freezes the previous value while captured movement crosses the dead zone", () => {
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(90, { captured: true, previousValue: 73 }),
			),
		).toBe(73);
	});

	it("does not wrap between 100 and 0 at either dead-zone boundary", () => {
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(45.001, { captured: true, previousValue: 100 }),
			),
		).toBe(100);
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(134.999, { captured: true, previousValue: 0 }),
			),
		).toBe(0);
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(44.999, { captured: true, previousValue: 100 }),
			),
		).toBeGreaterThan(99);
		expect(
			getParticipantVolumeFromPointer(
				pointerInput(135.001, { captured: true, previousValue: 0 }),
			),
		).toBeLessThan(1);
	});
});

describe("participant volume keyboard geometry", () => {
	it.each([
		["ArrowUp", 55],
		["ArrowRight", 55],
		["ArrowDown", 45],
		["ArrowLeft", 45],
		["Home", 0],
		["End", 100],
	])("maps %s to a stable volume action", (key, expected) => {
		expect(getParticipantVolumeFromKey(50, key)).toBe(expected);
	});

	it("clamps arrow changes to the volume range", () => {
		expect(getParticipantVolumeFromKey(98, "ArrowUp")).toBe(100);
		expect(getParticipantVolumeFromKey(2, "ArrowDown")).toBe(0);
	});

	it("ignores keys outside the volume contract", () => {
		expect(getParticipantVolumeFromKey(50, "PageUp")).toBeNull();
	});
});
