import { describe, expect, it } from "vitest";
import { overlayStyles } from "../src/styles";

describe("overlay layout pointer surfaces", () => {
	it("keeps the cursor visible across the complete control panel", () => {
		expect(getRule(".mini-panel")).toContain("cursor: default");
	});

	it("keeps the cursor visible while crossing the message composer and emoji grid", () => {
		expect(getRule(".message-composer")).toContain("cursor: default");
		expect(getRule(".message-composer-emoji-popover")).toContain(
			"cursor: default",
		);
		expect(getRule(".message-composer input")).toContain("cursor: text");
			expect(getRule(".message-composer-emoji-popover button")).toContain(
			"cursor: pointer",
		);
	});

	it("keeps the composer interaction layer above every room overlay surface", () => {
		const panelLayer = getNumericProperty(".mini-panel", "z-index");
		const shieldLayer = getNumericProperty(
			".message-composer-shield",
			"z-index",
		);
		const composerLayer = getNumericProperty(".message-composer", "z-index");

		expect(shieldLayer).toBeGreaterThan(panelLayer);
		expect(composerLayer).toBeGreaterThan(shieldLayer);
	});

	it("moves the smart participant preview cursor all the way to the rail edge", () => {
		expect(overlayStyles.replace(/\s+/g, " ")).toContain(
			'.interface-settings-preview[data-cursor-target="rail-edge"] .interface-settings-demo-cursor { top: 57px; left: calc(100% - 4px);',
		);
	});

	it("lands the persistent participant preview cursor over the compact pill", () => {
		expect(overlayStyles.replace(/\s+/g, " ")).toContain(
			'.interface-settings-preview[data-cursor-target="participant-pill"] .interface-settings-demo-cursor { top: 57px; left: calc(100% - 34px);',
		);
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

	it("renders room exit as a clearly destructive primary action", () => {
		const primaryAction = getRule(".button.panel-primary-action");
		expect(primaryAction).toContain("height: 36px");
		expect(primaryAction).toContain("min-height: 36px");

		const exitAction = getRule(
			".button.primary.panel-primary-action.room-exit",
		);
		expect(exitAction).toContain("border-color: #842029");
		expect(exitAction).toContain("background: #58151c");
		expect(exitAction).toContain("color: rgba(255, 255, 255, 0.98)");
		expect(exitAction).toContain(
			"box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08)",
		);
		expect(exitAction).not.toContain("linear-gradient");
		const exitActionHover = getRule(
			".button.primary.panel-primary-action.room-exit:not(:disabled):hover",
		);
		expect(exitActionHover).toContain("border-color: #b02a37");
		expect(exitActionHover).toContain("background: #842029");
		const exitActionConfirming = getRule(
			".button.primary.panel-primary-action.room-exit.confirming",
		);
		expect(exitActionConfirming).toContain("border-color: #dc3545");
		expect(exitActionConfirming).toContain("background: #b02a37");
	});

	it("aligns the first settings tab with the heading label and keeps even gaps", () => {
		const rail = getRule(".settings-category-scroll");
		expect(rail).toContain("display: flex");
		expect(rail).toContain("justify-content: space-between");
		expect(rail).toContain("align-items: stretch");
		expect(rail).toContain("overflow-x: visible");
		expect(rail).toContain("position: relative");
		expect(rail).toContain("box-sizing: border-box");
		expect(rail).toContain("padding: 0 22px");
		expect(rail).toContain("border-bottom: 0");

		const track = getRule(".settings-category-scroll::after");
		expect(track).toContain("left: 0");
		expect(track).toContain("right: 0");
		expect(track).toContain("bottom: 0");
		expect(track).toContain("height: 1px");
		expect(track).toContain("z-index: 0");

		const tab = getRule(".settings-category-tab");
		expect(tab).toContain("position: relative");
		expect(tab).toContain("width: auto");
		expect(tab).toContain("height: 40px");
		expect(tab).toContain("padding: 0");
		expect(tab).toContain("font-size: 12px");
		expect(tab).toContain("font-weight: 680");
		expect(tab).toContain("letter-spacing: -0.1px");
		expect(tab).toContain("border: 0");
		expect(tab).toContain("border-radius: 0");
		expect(tab).toContain("background: transparent");

		const indicator = getRule(".settings-category-scroll::before");
		expect(indicator).toContain("left: var(--settings-indicator-left, 22px)");
		expect(indicator).toContain("width: var(--settings-indicator-width, 58px)");
		expect(indicator).toContain("height: 2px");
		expect(indicator).toContain("bottom: -0.5px");
		expect(indicator).toContain("z-index: 2");
		expect(indicator).toContain("transition:");
		expect(indicator).toContain("left 180ms");
		expect(indicator).toContain("width 180ms");
		expect(overlayStyles).not.toContain(
			'.settings-category-scroll[data-active-category="layout"]::before',
		);
		expect(overlayStyles).not.toContain(".settings-category-tab.active::after");
	});

	it("keeps the emoji shortcut row free of a redundant bottom divider", () => {
		const shortcutGrid = getRule(".reaction-shortcut-grid");
		expect(shortcutGrid).toContain("box-shadow: none");
		expect(shortcutGrid).not.toContain("inset 0 -1px");
	});

	it("keeps Layout controls open and aligns both actions evenly", () => {
		const selector = getRule(".layout-object-selector-v2");
		expect(selector).toContain("padding: 0");
		expect(selector).toContain("border: 0");
		expect(selector).toContain("border-radius: 0");
		expect(selector).toContain("background: transparent");

		const selectorButton = getRule(".layout-object-selector-v2 button");
		expect(selectorButton).toContain("border: 0");
		expect(selectorButton).toContain("border-radius: 0");
		expect(selectorButton).toContain("background: transparent");
		expect(selectorButton).toContain("display: inline-flex");

		const activeSelector = getRule(
			'.layout-object-selector-v2 button[aria-pressed="true"]',
		);
		expect(activeSelector).toContain("background: transparent");

		const slider = getRule(".stepped-setting-slider-v2");
		expect(slider).toContain("padding: 8px 2px 7px");
		expect(slider).toContain("border: 0");
		expect(slider).toContain("border-radius: 0");
		expect(slider).toContain("background: transparent");

		const actions = getRule(".layout-editor-actions-v2");
		expect(actions).toContain(
			"grid-template-columns: repeat(2, minmax(0, 1fr))",
		);
	});

	it("uses a full-width low-contrast Chat content switcher", () => {
		const segmented = getRule(".layout-chat-mode-segmented-v2");
		expect(segmented).toContain("position: relative");
		expect(segmented).toContain("width: 100%");
		expect(segmented).toContain("height: 32px");
		expect(segmented).toContain("padding: 2px");
		expect(segmented).toContain("border-radius: 8px");
		expect(segmented).toContain("background: rgba(255, 255, 255, 0.025)");
		expect(segmented).toContain(
			"grid-template-columns: repeat(2, minmax(0, 1fr))",
		);

		const activePill = getRule(".layout-chat-mode-segmented-v2::before");
		expect(activePill).toContain("border-radius: 6px");
		expect(activePill).toContain("background: rgba(255, 255, 255, 0.075)");
		expect(activePill).not.toContain("171, 73, 28");

		const historyPill = getRule(
			'.layout-chat-mode-segmented-v2[data-state="history"]::before',
		);
		expect(historyPill).toContain("transform: translateX(calc(100% + 2px))");

		const option = getRule(".layout-chat-mode-segmented-v2 button");
		expect(option).toContain("background: transparent");
		expect(option).toContain("z-index: 1");
	});

	it("uses the same low-contrast segmented pattern for Interface modes", () => {
		const segmented = getRule(".interface-settings-segmented");
		expect(segmented).toContain("position: relative");
		expect(segmented).toContain("height: 32px");
		expect(segmented).toContain("padding: 2px");
		expect(segmented).toContain("border-radius: 8px");
		expect(segmented).toContain("background: rgba(255, 255, 255, 0.025)");

		const activePill = getRule(".interface-settings-segmented::before");
		expect(activePill).toContain("border-radius: 6px");
		expect(activePill).toContain("background: rgba(255, 255, 255, 0.075)");
		expect(
			getRule('.interface-settings-segmented[data-state="second"]::before'),
		).toContain("transform: translateX(calc(100% + 2px))");

		const selected = getRule(".interface-settings-segmented button.selected");
		expect(selected).toContain("background: transparent");
	});

	it("uses the same low-contrast segmented pattern for Voice modes", () => {
		const segmented = getRule(".voice-mode-control");
		expect(segmented).toContain("position: relative");
		expect(segmented).toContain("height: 32px");
		expect(segmented).toContain("padding: 2px");
		expect(segmented).toContain("border-radius: 8px");
		expect(segmented).toContain("background: rgba(255, 255, 255, 0.025)");

		const activePill = getRule(".voice-mode-control::before");
		expect(activePill).toContain("border-radius: 6px");
		expect(activePill).toContain("background: rgba(255, 255, 255, 0.075)");
		expect(
			getRule('.voice-mode-control[data-state="second"]::before'),
		).toContain("transform: translateX(calc(100% + 2px))");

		const selected = getRule(".voice-mode-control button.selected");
		expect(selected).toContain("background: transparent");
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

		expect(settingsTitle).toContain("display: flex");
		expect(settingsTitle).toContain("align-items: center");
		expect(getRule(".section-title-icon")).toContain(
			"color: rgba(255, 181, 116, 0.82)",
		);
		expect(getRule(".room-people-heading")).toContain("align-items: center");
		expect(getRule(".settings-category-tab")).toContain(
			"color: rgba(255, 255, 255, 0.58)",
		);
		const footer = getRule(".account-footer");
		expect(footer).toContain("display: flex");
		expect(footer).toContain("border-top: 1px solid rgba(255, 255, 255, 0.07)");
		const footerAction = getRule(".account-footer-action");
		expect(footerAction).toContain("width: auto");
		expect(footerAction).toContain("background: transparent");
		expect(footerAction).toContain("color: #58151c");
		const footerActionHover = getRule(
			".account-footer-action:not(:disabled):hover",
		);
		expect(footerActionHover).toContain("background: transparent");
		expect(footerActionHover).toContain("color: #842029");
		const footerActionConfirming = getRule(".account-footer-action.confirming");
		expect(footerActionConfirming).toContain("background: transparent");
		expect(footerActionConfirming).toContain("color: #b02a37");
		expect(getRule(".account-footer-action:focus-visible")).toContain(
			"outline: 2px solid rgba(220, 53, 69, 0.62)",
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

		const editorPreview = getRule(".layout-chat-preview-v2");
		expect(editorPreview).toContain("gap: var(--layout-preview-chat-gap, 5px)");
		expect(editorPreview).toContain(
			"padding: var(--layout-preview-chat-padding-y, 8px)",
		);
		expect(editorPreview).toContain(
			"var(--layout-preview-chat-padding-x, 10px)",
		);
		expect(getRule(".layout-chat-preview-v2 .live-chat-name")).toContain(
			"font-size: var(--layout-preview-chat-name-font-size, 10px)",
		);
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
