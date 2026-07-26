import type { PlayerOverlayGeometry } from "./source-adapters/core/overlay-geometry";

export const DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX = 10;
const DEFAULT_MINI_PANEL_TOP_PX = 48;
const DEFAULT_MINI_PANEL_RIGHT_PX = 10;
const DEFAULT_TOP_BUBBLE_TOP_PX = 10;
const DEFAULT_TOP_BUBBLE_RIGHT_PX = 10;

export interface OverlayChromePlacement {
	miniPanelBottomReservePx: number;
	miniPanelRightPx: number;
	miniPanelTopPx: number;
	topBubbleRightPx: number;
	topBubbleTopPx: number;
}

export function getOverlayChromePlacement(
	geometry: Pick<
		PlayerOverlayGeometry,
		"controlsVisible" | "launcher" | "panel" | "safeInsets"
	>,
): OverlayChromePlacement {
	const controlsBottomReservePx = geometry.controlsVisible
		? normalizePixelValue(
				geometry.safeInsets.bottomPx,
				DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX,
			)
		: DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX;

	return {
		miniPanelBottomReservePx: Math.round(
			Math.max(DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX, controlsBottomReservePx),
		),
		miniPanelRightPx: normalizePixelValue(
			geometry.panel.rightPx,
			DEFAULT_MINI_PANEL_RIGHT_PX,
		),
		miniPanelTopPx: normalizePixelValue(
			geometry.panel.topPx,
			DEFAULT_MINI_PANEL_TOP_PX,
		),
		topBubbleRightPx: normalizePixelValue(
			geometry.launcher.rightPx,
			DEFAULT_TOP_BUBBLE_RIGHT_PX,
		),
		topBubbleTopPx: normalizePixelValue(
			geometry.launcher.topPx,
			DEFAULT_TOP_BUBBLE_TOP_PX,
		),
	};
}

export function shouldShowCameraStack({
	cameraParticipantCount,
	p2pSessionActive,
}: {
	cameraParticipantCount: number;
	p2pSessionActive: boolean;
}): boolean {
	return p2pSessionActive && cameraParticipantCount > 0;
}

function normalizePixelValue(value: number, fallback: number): number {
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}
