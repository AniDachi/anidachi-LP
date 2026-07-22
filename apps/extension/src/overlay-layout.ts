export const DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX = 10;
const DEFAULT_CAMERA_STACK_BOTTOM_PX = 54;

export function getMiniPanelBottomReservePx({
	cameraStackVisible,
	camStackBottomPx,
	controlsVisible,
	ghostCamSizePx,
}: {
	cameraStackVisible: boolean;
	camStackBottomPx: number;
	controlsVisible: boolean;
	ghostCamSizePx: number;
}): number {
	const safeCamStackBottomPx = normalizePixelValue(
		camStackBottomPx,
		DEFAULT_CAMERA_STACK_BOTTOM_PX,
	);
	const safeGhostCamSizePx = normalizePixelValue(ghostCamSizePx, 0);
	const controlsReservePx = controlsVisible
		? Math.max(DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX, safeCamStackBottomPx)
		: DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX;
	const cameraReservePx = cameraStackVisible
		? safeCamStackBottomPx + safeGhostCamSizePx + 18
		: DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX;

	return Math.round(
		Math.max(
			DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX,
			controlsReservePx,
			cameraReservePx,
		),
	);
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
