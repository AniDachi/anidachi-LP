import { describe, expect, it } from "vitest";
import {
	resolveMainControlPresentation,
	resolveParticipantPillPresentation,
	resolveParticipantRailPresentation,
} from "../src/interface-visibility";

describe("main control visibility", () => {
	it.each([
		["auto-hide", "hidden", false, false],
		["auto-hide", "glow", false, true],
		["auto-hide", "visible", true, false],
		["always-visible", "hidden", true, false],
	] as const)("resolves %s / %s", (mode, phase, visible, edgeGlowVisible) => {
		expect(
			resolveMainControlPresentation({
				focused: false,
				mode,
				panelOpen: false,
				phase,
			}),
		).toMatchObject({ edgeGlowVisible, visible });
	});

	it.each([
		{
			focused: false,
			name: "an open panel",
			panelOpen: true,
		},
		{
			focused: true,
			name: "keyboard focus",
			panelOpen: false,
		},
	])("pins Auto hide for $name", ({ focused, panelOpen }) => {
		expect(
			resolveMainControlPresentation({
				focused,
				mode: "auto-hide",
				panelOpen,
				phase: "hidden",
			}),
		).toEqual({
			edgeGlowVisible: false,
			edgeIntentEnabled: false,
			pinned: true,
			visible: true,
		});
	});

	it("disables edge intent while Always visible is selected", () => {
		expect(
			resolveMainControlPresentation({
				focused: false,
				mode: "always-visible",
				panelOpen: false,
				phase: "hidden",
			}),
		).toEqual({
			edgeGlowVisible: false,
			edgeIntentEnabled: false,
			pinned: true,
			visible: true,
		});
	});
});

describe("participant rail visibility", () => {
	it("retains edge intent and full-list expansion in Smart mode", () => {
		expect(
			resolveParticipantRailPresentation({
				edgeExpanded: true,
				mode: "smart",
			}),
		).toEqual({
			edgeIntentEnabled: true,
			fullListExpanded: true,
			persistentCompact: false,
		});
	});

	it("disables edge intent and full-list expansion in persistent mode", () => {
		expect(
			resolveParticipantRailPresentation({
				edgeExpanded: true,
				mode: "always-visible",
			}),
		).toEqual({
			edgeIntentEnabled: false,
			fullListExpanded: false,
			persistentCompact: true,
		});
	});
});

describe("participant pill visibility", () => {
	it("keeps Smart quiet pills hidden and speaking pills compact", () => {
		expect(
			resolveParticipantPillPresentation({
				interacted: false,
				mode: "smart",
				railExpanded: false,
				speaking: false,
			}),
		).toBe("hidden");
		expect(
			resolveParticipantPillPresentation({
				interacted: false,
				mode: "smart",
				railExpanded: false,
				speaking: true,
			}),
		).toBe("compact");
	});

	it("briefly exposes a quiet Smart pill as compact for a reaction cue", () => {
		expect(
			resolveParticipantPillPresentation({
				interacted: false,
				mode: "smart",
				reacting: true,
				railExpanded: false,
				speaking: false,
			}),
		).toBe("compact");
	});

	it("reveals quiet Smart pills at peek width until one is interacted with", () => {
		expect(
			resolveParticipantPillPresentation({
				interacted: false,
				mode: "smart",
				railExpanded: true,
				speaking: false,
			}),
		).toBe("peek");
		expect(
			resolveParticipantPillPresentation({
				interacted: true,
				mode: "smart",
				railExpanded: true,
				speaking: false,
			}),
		).toBe("expanded");
	});

	it("keeps persistent pills compact until interaction reveals dock peers", () => {
		expect(
			resolveParticipantPillPresentation({
				interacted: false,
				mode: "always-visible",
				railExpanded: false,
				speaking: true,
			}),
		).toBe("compact");
		expect(
			resolveParticipantPillPresentation({
				interacted: false,
				mode: "always-visible",
				railExpanded: true,
				speaking: false,
			}),
		).toBe("peek");
		expect(
			resolveParticipantPillPresentation({
				interacted: true,
				mode: "always-visible",
				railExpanded: true,
				speaking: false,
			}),
		).toBe("expanded");
	});
});
