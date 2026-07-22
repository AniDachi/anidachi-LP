import { describe, expect, it } from "vitest";
import {
	areCrunchyrollPlayerChromeStatesEqual,
	DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE,
	getCrunchyrollPlayerChromeState,
} from "../../../src/source-adapters/crunchyroll/player-chrome";

describe("Crunchyroll player chrome", () => {
	it("measures visible controls without treating the whole controls root as chrome", () => {
		document.body.innerHTML = `
      <div id="player-container">
        <div data-testid="player-controls-root"></div>
        <div data-testid="timeline-controls-container"></div>
        <button data-testid="settings-button"></button>
      </div>
    `;
		const container = document.querySelector(
			"#player-container",
		) as HTMLElement;
		mockRect(container, 0, 0, 960, 540);
		mockRect(
			document.querySelector("[data-testid='player-controls-root']"),
			0,
			0,
			960,
			540,
		);
		mockRect(
			document.querySelector("[data-testid='timeline-controls-container']"),
			20,
			450,
			920,
			70,
		);
		mockRect(
			document.querySelector("[data-testid='settings-button']"),
			860,
			12,
			32,
			32,
		);

		expect(getCrunchyrollPlayerChromeState(container)).toEqual({
			camStackBottomPx: 108,
			containerHeightPx: 540,
			containerWidthPx: 960,
			controlsVisible: true,
			miniPanelRightPx: 10,
			miniPanelTopPx: 51,
			topBubbleRightPx: 10,
			topBubbleTopPx: 13,
		});
	});

	it("keeps the literal default state for an unusable player", () => {
		const container = document.createElement("div");

		expect(getCrunchyrollPlayerChromeState(container)).toBe(
			DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE,
		);
		expect(DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE).toEqual({
			camStackBottomPx: 54,
			containerHeightPx: 0,
			containerWidthPx: 0,
			controlsVisible: false,
			miniPanelRightPx: 10,
			miniPanelTopPx: 48,
			topBubbleRightPx: 10,
			topBubbleTopPx: 10,
		});
		expect(
			areCrunchyrollPlayerChromeStatesEqual(
				DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE,
				{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE },
			),
		).toBe(true);
	});

	it.each([
		[
			"controlsVisible",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, controlsVisible: true },
		],
		[
			"camStackBottomPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, camStackBottomPx: 55 },
		],
		[
			"containerHeightPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, containerHeightPx: 1 },
		],
		[
			"containerWidthPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, containerWidthPx: 1 },
		],
		[
			"miniPanelRightPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, miniPanelRightPx: 11 },
		],
		[
			"miniPanelTopPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, miniPanelTopPx: 49 },
		],
		[
			"topBubbleRightPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, topBubbleRightPx: 11 },
		],
		[
			"topBubbleTopPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, topBubbleTopPx: 11 },
		],
	])("returns false when %s differs", (_field, changedState) => {
		expect(
			areCrunchyrollPlayerChromeStatesEqual(
				DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE,
				changedState,
			),
		).toBe(false);
	});
});

function mockRect(
	element: Element | null,
	left: number,
	top: number,
	width: number,
	height: number,
): void {
	if (!element) {
		throw new Error("Expected element");
	}

	Object.defineProperty(element, "getBoundingClientRect", {
		configurable: true,
		value: () =>
			({
				bottom: top + height,
				height,
				left,
				right: left + width,
				top,
				width,
			}) as DOMRect,
	});
}
