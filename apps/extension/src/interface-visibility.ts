import type {
	MainControlVisibility,
	ParticipantPillVisibility,
} from "./interface-preferences";

export type MainControlRevealPhase = "hidden" | "glow" | "visible";
export type ParticipantPillPresentation = "hidden" | "compact" | "expanded";

export interface MainControlPresentation {
	edgeGlowVisible: boolean;
	edgeIntentEnabled: boolean;
	pinned: boolean;
	visible: boolean;
}

export interface ParticipantRailPresentation {
	edgeIntentEnabled: boolean;
	fullListExpanded: boolean;
	persistentCompact: boolean;
}

export function resolveMainControlPresentation(input: {
	focused: boolean;
	forceVisible: boolean;
	mode: MainControlVisibility;
	panelOpen: boolean;
	phase: MainControlRevealPhase;
}): MainControlPresentation {
	const pinned =
		input.mode === "always-visible" ||
		input.panelOpen ||
		input.forceVisible ||
		input.focused;

	return {
		edgeGlowVisible: !pinned && input.phase === "glow",
		edgeIntentEnabled: !pinned,
		pinned,
		visible: pinned || input.phase === "visible",
	};
}

export function resolveParticipantRailPresentation(input: {
	edgeExpanded: boolean;
	mode: ParticipantPillVisibility;
}): ParticipantRailPresentation {
	const persistentCompact = input.mode === "always-visible";

	return {
		edgeIntentEnabled: !persistentCompact,
		fullListExpanded: !persistentCompact && input.edgeExpanded,
		persistentCompact,
	};
}

export function resolveParticipantPillPresentation(input: {
	interacted: boolean;
	mode: ParticipantPillVisibility;
	reacting?: boolean;
	railExpanded: boolean;
	speaking: boolean;
}): ParticipantPillPresentation {
	if (input.mode === "always-visible") {
		return input.interacted ? "expanded" : "compact";
	}

	if (input.railExpanded) {
		return "expanded";
	}

	return input.speaking || input.reacting ? "compact" : "hidden";
}
