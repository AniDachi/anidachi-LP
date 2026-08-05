import { describe, expect, it } from "vitest";
import { overlayStyles } from "../src/styles";

describe("overlay layout pointer surfaces", () => {
	it("keeps the cursor visible across the complete control panel", () => {
		expect(getRule(".mini-panel")).toContain("cursor: default");
	});

	it("separates personal camera controls from the participant hierarchy", () => {
		const cameraControl = getRule(".icon-button.panel-camera-control");
		expect(cameraControl).toContain("position: relative");
		expect(cameraControl).toContain("width: 48px");
		expect(cameraControl).toContain("height: 26px");
		expect(cameraControl).toContain("box-sizing: border-box");
		expect(cameraControl).toContain("overflow: hidden");
		expect(cameraControl).toContain("border-radius: 999px");
		expect(cameraControl).toContain("border: 1px solid var(--ad-border)");
		expect(cameraControl).toContain("background: var(--ad-surface)");
		expect(getRule(".panel-camera-control-thumb")).toContain("width: 20px");
		expect(getRule(".panel-camera-control-thumb")).toContain("left: 2px");
		expect(
			getRule(
				".icon-button.panel-camera-control.active .panel-camera-control-thumb",
			),
		).toContain("transform: translateX(22px)");
		expect(
			getRule(
				".icon-button.panel-camera-control.active .panel-camera-control-icon",
			),
		).toContain("color: rgba(134, 239, 172, 0.98)");
		expect(
			getRule(
				".icon-button.panel-camera-control.unavailable .panel-camera-control-icon",
			),
		).toContain("color: rgba(248, 113, 113, 0.72)");
		const peopleList = getRule(".room-people-list");
		expect(peopleList).toContain(
			"border: 1px solid rgba(255, 255, 255, 0.065)",
		);
		expect(peopleList).toContain("background: rgba(255, 255, 255, 0.018)");
		expect(getRule(".room-people-entry + .room-people-entry")).toContain(
			"border-top: 1px solid rgba(255, 255, 255, 0.055)",
		);

		const hostRow = getRule(".room-people-row.host");
		expect(hostRow).toContain("background: transparent");
		expect(hostRow).toContain("box-shadow: none");
		expect(hostRow).not.toContain("inset 2px 0");
		expect(hostRow).not.toContain("border-color");

		const hostRole = getRule(".room-people-role");
		expect(hostRole).toContain("padding: 0");
		expect(hostRole).toContain("border: 0");
		expect(hostRole).toContain("background: transparent");
		expect(getRule(".room-people-side.identity")).toContain(
			"align-self: stretch",
		);
		expect(getRule(".room-people-side.identity")).toContain(
			"align-items: flex-end",
		);
		expect(getRule(".room-people-seat-status")).toContain(
			"color: rgba(255, 255, 255, 0.5)",
		);
		expect(getRule(".room-people-camera-status.active")).toContain(
			"color: rgba(134, 239, 172, 0.9)",
		);
		expect(getRule(".room-people-camera-status.inactive")).toContain(
			"color: rgba(248, 113, 113, 0.68)",
		);

		const speakingAvatar = getRule(
			".room-people-row.speaking .room-people-avatar",
		);
		expect(speakingAvatar).toContain(
			"box-shadow: 0 0 0 2px rgba(97, 220, 154, 0.72)",
		);
		expect(getRule(".room-people-row.speaking")).not.toContain("background:");

		const mediaAction = getRule(".room-people-action");
		expect(mediaAction).toContain("display: inline-flex");
		expect(mediaAction).toContain(
			"border: 1px solid rgba(255, 255, 255, 0.09)",
		);
		expect(mediaAction).toContain("background: rgba(255, 255, 255, 0.025)");
		expect(getRule(".room-people-action svg")).toContain(
			"color: rgba(255, 155, 84, 0.9)",
		);
	});

	it("keeps Voice settings mode-only with exception feedback styling", () => {
		expect(overlayStyles).not.toContain("panel-microphone-control");
		expect(overlayStyles).not.toContain("voice-settings-status");
		expect(overlayStyles).not.toContain("voice-settings-dictate-action");
		expect(getRule(".voice-settings-feedback")).toContain("font-size: 10.5px");
	});

	it("keeps the account name flexible and the header actions aligned", () => {
		expect(getRule(".panel-account-name")).toContain("flex: 0 1 auto");
		expect(getRule(".panel-account-title-row")).toContain(
			"align-items: baseline",
		);
		const accountPlan = getRule(".panel-account-title-row .plan-badge");
		expect(accountPlan).toContain("height: auto");
		expect(accountPlan).toContain("padding: 0");
		expect(accountPlan).toContain("border: 0");
		expect(accountPlan).toContain("background: transparent");
		expect(accountPlan).toContain("font-size: 8px");
		expect(accountPlan).toContain("line-height: 1.1");
		expect(accountPlan).toContain(
			"transform: translateY(var(--plan-glyph-offset, -2px))",
		);
		expect(accountPlan).toContain("text-shadow:");
		const panelHeader = getRule(".panel-header");
		expect(panelHeader).toContain("display: grid");
		expect(panelHeader).toContain("grid-template-columns: minmax(0, 1fr) auto");
		expect(panelHeader).toContain("align-items: start");
		const headerActions = getRule(".panel-header-actions");
		expect(headerActions).toContain("display: flex");
		expect(headerActions).toContain("justify-content: flex-end");
		expect(headerActions).toContain("align-items: start");
		expect(overlayStyles).not.toContain("panel-close-button");
		expect(getRule(".icon-button.panel-camera-control:focus")).toContain(
			"outline: 0",
		);
		expect(
			getRule(".icon-button.panel-camera-control:focus-visible"),
		).toContain("box-shadow: 0 0 0 2px rgba(255, 166, 92, 0.38)");
	});

	it("keeps the room action row flush with both panel content edges", () => {
		expect(getRule(".panel-actions")).toContain("width: 100%");
		const activePrimaryAction = getRule(
			".panel-actions.room-active .panel-primary-action",
		);
		expect(activePrimaryAction).toContain("flex-basis: 112px");
		expect(activePrimaryAction).toContain("max-width: none");
	});

	it("renders room exit as a restrained destructive primary action", () => {
		const primaryAction = getRule(".button.panel-primary-action");
		expect(primaryAction).toContain("height: 36px");
		expect(primaryAction).toContain("min-height: 36px");

		const exitAction = getRule(
			".button.primary.panel-primary-action.room-exit",
		);
		expect(exitAction).toContain("border-color: rgba(248, 113, 113, 0.24)");
		expect(exitAction).toContain("background: rgba(51, 35, 37, 0.88)");
		expect(exitAction).toContain("color: rgba(255, 255, 255, 0.9)");
		expect(exitAction).toContain(
			"box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025)",
		);
		expect(exitAction).not.toContain("linear-gradient");
		expect(
			getRule(".button.primary.panel-primary-action.room-exit.confirming"),
		).toContain("background: rgba(88, 38, 42, 0.96)");
	});

	it("uses restrained text tabs for settings navigation", () => {
		const tab = getRule(".settings-category-tab");
		expect(tab).toContain("position: relative");
		expect(tab).toContain("border: 0");
		expect(tab).toContain("border-radius: 0");
		expect(tab).toContain("background: transparent");

		const indicator = getRule(".settings-category-tab::after");
		expect(indicator).toContain("width: 22px");
		expect(indicator).toContain("height: 2px");
		expect(indicator).toContain("scaleX(0)");
		expect(getRule(".settings-category-tab.active::after")).toContain(
			"scaleX(1)",
		);
	});

	it("separates structural headings from interactive accents", () => {
		const sectionTitle = getRule(".section-title");
		expect(sectionTitle).toContain("color: rgba(255, 255, 255, 0.58)");
		expect(sectionTitle).not.toContain("255, 181, 116");

		const settingsTitle = getRule(".settings-section-title");
		expect(settingsTitle).toContain(
			"border-top: 1px solid rgba(255, 255, 255, 0.07)",
		);
		expect(settingsTitle).toContain("padding-top: 14px");
		expect(settingsTitle).toContain("margin: 18px 0 2px");

		expect(getRule(".room-people-heading")).toContain("align-items: baseline");
		expect(getRule(".settings-category-tab")).toContain(
			"color: rgba(255, 255, 255, 0.58)",
		);
	});

	it("keeps the top bubble and rendered cameras interactive without blocking empty slots", () => {
		const topBubble = getRule(".top-bubble");
		expect(topBubble).toContain("pointer-events: none");
		expect(getRule(".top-bubble-reveal.bubble-visible .top-bubble")).toContain(
			"pointer-events: auto",
		);
		expect(topBubble).toContain("align-items: center");
		expect(getRule(".cam-stack")).toContain("pointer-events: none");
		expect(getRule(".cam-bubble")).toContain("pointer-events: auto");
	});

	it("reveals the top bubble only after deliberate edge intent and pins it with the panel", () => {
		const revealSurface = getRule(".top-bubble-reveal");
		expect(revealSurface).toContain("position: absolute");
		expect(revealSurface).toContain("inset: 0");
		expect(revealSurface).toContain("pointer-events: none");

		const edgeGlow = getRule(".top-bubble-edge-glow");
		expect(edgeGlow).toContain("top: 0");
		expect(edgeGlow).toContain("right: 0");
		expect(edgeGlow).not.toContain("--top-bubble-right");
		expect(edgeGlow).toContain("width: 104px");
		expect(edgeGlow).toContain("height: 0");
		expect(edgeGlow).toContain("background: transparent");
		expect(edgeGlow).toContain("pointer-events: none");
		expect(edgeGlow).toContain("opacity: 0");
		expect(edgeGlow).toContain("rgba(255, 92, 20, 0.56)");
		expect(edgeGlow).toContain("rgba(249, 115, 22, 0.34)");
		expect(edgeGlow).toContain("rgba(76, 24, 4, 0.22)");
		expect(edgeGlow).toContain("scaleX(0.7)");
		const visibleEdgeGlow = getRule(
			".top-bubble-reveal.edge-glow .top-bubble-edge-glow",
		);
		expect(visibleEdgeGlow).toContain("opacity: 0.96");
		expect(visibleEdgeGlow).toContain("scaleX(1)");

		const hiddenBubble = getRule(".top-bubble");
		expect(hiddenBubble).toContain("opacity: 0");
		expect(hiddenBubble).toContain("pointer-events: none");
		expect(hiddenBubble).not.toContain("visibility: hidden");
		expect(hiddenBubble).toContain("translateY(");

		const edgeReveal = getRule(".top-bubble-reveal.bubble-visible .top-bubble");
		expect(edgeReveal).toContain("opacity: 1");
		expect(edgeReveal).toContain("pointer-events: auto");
		expect(edgeReveal).toContain("transform: translateY(0)");

		const pinnedBubble = getRule(".top-bubble-reveal.panel-open .top-bubble");
		expect(pinnedBubble).toContain("opacity: 1");
		expect(pinnedBubble).toContain("pointer-events: auto");
		expect(pinnedBubble).toContain("transform: translateY(0)");
		expect(
			getNumericProperty(".top-bubble-reveal.panel-open", "z-index"),
		).toBeGreaterThan(getNumericProperty(".mini-panel", "z-index"));
	});

	it("styles visible player controls without a provider-specific overlay class", () => {
		const visibleControlsBubble = getRule(
			".anidachi-overlay.player-controls-visible .top-bubble",
		);
		expect(visibleControlsBubble).toContain("background: rgba(9, 9, 11, 0.78)");
		expect(overlayStyles).not.toContain(
			".anidachi-overlay.is-crunchyroll.player-controls-visible",
		);
	});

	it("keeps live objects and editor ghosts below the panel", () => {
		expect(getNumericProperty(".cam-stack", "z-index")).toBeLessThan(
			getNumericProperty(".mini-panel", "z-index"),
		);
		expect(getNumericProperty(".live-chat-column", "z-index")).toBeLessThan(
			getNumericProperty(".mini-panel", "z-index"),
		);
		expect(
			getNumericProperty(".overlay-layout-ghost-preview", "z-index"),
		).toBeLessThan(getNumericProperty(".mini-panel", "z-index"));
		expect(
			getNumericProperty(".overlay-layout-ghost-preview", "z-index"),
		).toBeGreaterThan(getNumericProperty(".cam-stack", "z-index"));
		expect(getNumericProperty(".cam-stack", "z-index")).toBeLessThan(
			getNumericProperty(".room-rail", "z-index"),
		);
		expect(getNumericProperty(".live-chat-column", "z-index")).toBeLessThan(
			getNumericProperty(".room-rail", "z-index"),
		);
		expect(
			getNumericProperty(".overlay-layout-ghost-preview", "z-index"),
		).toBeLessThan(getNumericProperty(".room-rail", "z-index"));
		expect(getNumericProperty(".room-rail", "z-index")).toBeLessThan(
			getNumericProperty(".mini-panel", "z-index"),
		);
		expect(getRule(".overlay-layout-ghost-preview")).toContain(
			"pointer-events: none",
		);
	});

	it("keeps the closed room rail inert outside a narrow edge target", () => {
		expect(getRule(".room-rail-edge")).toContain("width: 6px");
		expect(getRule(".room-rail-panel")).toContain("pointer-events: none");
		expect(getRule(".room-rail.open .room-rail-panel")).toContain(
			"pointer-events: auto",
		);
	});

	it("keeps persistent participant pills compact until direct interaction", () => {
		expect(getRule(".room-rail.persistent .room-rail-edge")).toContain(
			"pointer-events: none",
		);
		expect(getRule(".room-rail-panel")).toContain("pointer-events: none");
		expect(getRule('.room-rail-slot[data-presentation="compact"]')).toContain(
			"pointer-events: auto",
		);
		expect(
			getRule('.room-rail-slot[data-presentation="compact"] .room-rail-pill'),
		).toContain("width: 64px");
		expect(
			getRule('.room-rail-slot[data-presentation="expanded"] .room-rail-pill'),
		).toContain("width: 162px");
	});

	it("keeps participant audio controls stable on both rail and camera surfaces", () => {
		const inlineControl = getRule(".participant-audio-inline-control");
		expect(inlineControl).toContain("width: 84px");
		expect(inlineControl).toContain("flex: 0 0 84px");
		expect(inlineControl).toContain("opacity: 0");
		expect(
			getRule(
				".room-rail.open .room-rail-slot:hover .participant-audio-inline-control",
			),
		).toContain("opacity: 1");
		expect(getRule(".room-rail-panel.adjusting-audio")).toContain(
			"pointer-events: auto",
		);

		const contour = getRule(".participant-audio-contour-control");
		expect(contour).toContain("position: absolute");
		expect(contour).toContain("inset: -8px");
		expect(
			getNumericProperty(".participant-audio-contour-control", "z-index"),
		).toBeGreaterThan(getNumericProperty(".nuke-burst", "z-index"));
		expect(getRule(".participant-audio-contour-arc")).toContain(
			"conic-gradient",
		);
		expect(
			getRule(".cam-bubble:hover .participant-audio-contour-control"),
		).toContain("pointer-events: auto");
	});

	it("keeps ghost objects legible over changing video frames", () => {
		expect(
			getNumericProperty(".overlay-layout-camera-ghost", "opacity"),
		).toBeGreaterThanOrEqual(0.78);
		expect(getRule(".layout-chat-preview-shell")).not.toContain("opacity:");
		expect(
			getRule(".live-chat-message.overlay-layout-chat-preview-message"),
		).toContain("opacity: var(--live-chat-message-opacity, 1)");
	});

	it("applies user transparency to messages without hiding the preview frame", () => {
		expect(getRule(".live-chat-column.live .live-chat-message")).toContain(
			"opacity: var(--live-chat-message-opacity, 1)",
		);
		expect(
			getRule(".live-chat-message.overlay-layout-chat-preview-message"),
		).toContain("opacity: var(--live-chat-message-opacity, 1)");
		expect(getRule(".layout-chat-preview-shell")).toContain(
			"background: rgba(30, 64, 175, 0.22)",
		);
	});

	it("keeps editor chat content inert while its surface is dragged", () => {
		expect(getRule(".layout-chat-preview-v2")).toContain("user-select: none");
		expect(getRule(".layout-chat-preview-v2 > *")).toContain(
			"pointer-events: none",
		);
	});

	it("gives sample and real layout-preview chat the same framed shell", () => {
		const shell = getRule(".layout-chat-preview-shell");
		expect(shell).toContain("border: 1px dashed");
		expect(shell).toContain("justify-content: flex-end");
		expect(shell).toContain("overflow: hidden");

		const livePreview = getRule(".live-chat-column.layout-chat-preview-shell");
		expect(livePreview).toContain("justify-content: flex-start");
		expect(livePreview).toContain("mask-image: none");
		expect(
			getRule(".live-chat-column.layout-chat-preview-shell .live-chat-text"),
		).not.toContain("-webkit-line-clamp: 1");
	});

	it("wraps complete live messages with the same text flow as history", () => {
		const message = getRule(".live-chat-column.live .live-chat-message");
		const text = getRule(".live-chat-column.live .live-chat-text");

		expect(message).toContain("max-height: none");
		expect(message).toContain("overflow: visible");
		expect(text).toContain("display: block");
		expect(text).toContain("overflow-wrap: anywhere");
		expect(text).toContain("-webkit-line-clamp: unset");
		expect(overlayStyles).toContain(
			"to {\n      opacity: var(--live-chat-message-opacity, 1);",
		);
	});

	it("uses history-style bottom anchoring and scrolling for live messages", () => {
		const live = getRule(".live-chat-column.live");
		expect(live).toContain("flex-direction: column");
		expect(live).toContain("justify-content: flex-start");
		expect(live).toContain("overflow-y: auto");
		const spacer = getRule(".live-chat-column.live::before");
		expect(spacer).toContain('content: ""');
		expect(spacer).toContain("margin-top: auto");
		expect(getRule(".live-chat-column.layout-chat-preview-shell")).toContain(
			"justify-content: flex-start",
		);
	});

	it("bottom-aligns short history without hiding scrollable older messages", () => {
		const spacer = getRule(".live-chat-column.history::before");
		expect(spacer).toContain('content: ""');
		expect(spacer).toContain("margin-top: auto");
		expect(spacer).toContain("flex: 0 0 auto");
	});
});

function getRule(selector: string): string {
	const start = overlayStyles.indexOf(`${selector} {`);
	if (start < 0) {
		throw new Error(`Missing CSS rule: ${selector}`);
	}
	const end = overlayStyles.indexOf("}", start);
	if (end < 0) {
		throw new Error(`Unterminated CSS rule: ${selector}`);
	}
	return overlayStyles.slice(start, end + 1);
}

function getNumericProperty(selector: string, property: string): number {
	const rule = getRule(selector);
	const match = rule.match(new RegExp(`${property}:\\s*(\\d+(?:\\.\\d+)?)`));
	if (!match?.[1]) {
		throw new Error(`Missing ${property} in ${selector}`);
	}
	return Number(match[1]);
}
