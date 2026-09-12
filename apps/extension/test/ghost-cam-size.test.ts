import { describe, expect, it } from "vitest";
import {
	getGhostCamSizeLabel,
	getGhostCamSizePx,
	getResponsiveGhostCamSizePx,
	normalizeGhostCamSizeStep,
} from "../src/ghost-cam-size";

describe("Ghost Cam size steps", () => {
	it("labels the default bubble size as Medium", () => {
		expect(getGhostCamSizePx(1)).toBe(74);
		expect(getGhostCamSizeLabel(1)).toBe("Medium");
	});

	it("normalizes arbitrary slider values to supported steps", () => {
		expect(normalizeGhostCamSizeStep(-4)).toBe(0);
		expect(normalizeGhostCamSizeStep(2.7)).toBe(3);
		expect(normalizeGhostCamSizeStep(10)).toBe(4);
	});

	it("keeps fixed preset sizes when the player dimensions are unknown", () => {
		expect(getResponsiveGhostCamSizePx(3, {})).toBe(108);
	});

	it("scales XL up on large players without changing media capture constraints", () => {
		expect(
			getResponsiveGhostCamSizePx(3, {
				cameraCount: 1,
				containerHeightPx: 1080,
				containerWidthPx: 1920,
			}),
		).toBe(180);
	});

	it("adds XXL as a larger adaptive camera size", () => {
		expect(getGhostCamSizePx(4)).toBe(128);
		expect(getGhostCamSizeLabel(4)).toBe("XXL");
		expect(getResponsiveGhostCamSizePx(4, {})).toBe(128);
		expect(
			getResponsiveGhostCamSizePx(4, {
				cameraCount: 1,
				containerHeightPx: 1080,
				containerWidthPx: 1920,
			}),
		).toBe(220);
	});

	it("grows XXL within its explicit half-player cap at 720p", () => {
		expect(
			getResponsiveGhostCamSizePx(4, {
				cameraCount: 4,
				containerHeightPx: 720,
				containerWidthPx: 1280,
			}),
		).toBe(152);
	});

	it("keeps XXL visibly larger than XL for a four-seat 720p fullscreen layout", () => {
		const xlSizePx = getResponsiveGhostCamSizePx(3, {
			cameraCount: 4,
			containerHeightPx: 720,
			containerWidthPx: 1280,
		});
		const xxlSizePx = getResponsiveGhostCamSizePx(4, {
			cameraCount: 4,
			containerHeightPx: 720,
			containerWidthPx: 1280,
		});

		expect(xxlSizePx - xlSizePx).toBeGreaterThanOrEqual(20);
		expect(xxlSizePx * 4 + 10 * 3).toBeLessThanOrEqual(1280 * 0.5);
	});

	it("caps a four-camera stack so it does not take over the player width", () => {
		expect(
			getResponsiveGhostCamSizePx(3, {
				cameraCount: 4,
				containerHeightPx: 720,
				containerWidthPx: 1280,
			}),
		).toBe(126);
	});

	it("keeps compact players at the fixed preset size", () => {
		expect(
			getResponsiveGhostCamSizePx(3, {
				cameraCount: 2,
				containerHeightPx: 420,
				containerWidthPx: 720,
			}),
		).toBe(108);
	});
});
