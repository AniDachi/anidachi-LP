export const GHOST_CAM_SIZE_STEPS = [
	{ label: "Small", sizePx: 60, step: 0 },
	{ label: "Medium", sizePx: 74, step: 1 },
	{ label: "Large", sizePx: 90, step: 2 },
	{ label: "XL", sizePx: 108, step: 3 },
	{ label: "XXL", sizePx: 128, step: 4 },
] as const;

export type GhostCamSizeStep = (typeof GHOST_CAM_SIZE_STEPS)[number]["step"];

export const DEFAULT_GHOST_CAM_SIZE_STEP: GhostCamSizeStep = 1;
export const GHOST_CAM_SIZE_MIN_STEP = GHOST_CAM_SIZE_STEPS[0].step;
export const GHOST_CAM_SIZE_MAX_STEP =
	GHOST_CAM_SIZE_STEPS[GHOST_CAM_SIZE_STEPS.length - 1].step;

export function normalizeGhostCamSizeStep(value: unknown): GhostCamSizeStep {
	const numericValue =
		typeof value === "number"
			? value
			: typeof value === "string"
				? Number(value)
				: Number.NaN;

	if (!Number.isFinite(numericValue)) {
		return DEFAULT_GHOST_CAM_SIZE_STEP;
	}

	const rounded = Math.round(numericValue);
	const clamped = Math.max(
		GHOST_CAM_SIZE_MIN_STEP,
		Math.min(GHOST_CAM_SIZE_MAX_STEP, rounded),
	);
	return clamped as GhostCamSizeStep;
}

export function getGhostCamSizePx(step: GhostCamSizeStep): number {
	return GHOST_CAM_SIZE_STEPS.find((item) => item.step === step)?.sizePx ?? 74;
}

export function getResponsiveGhostCamSizePx(
	step: GhostCamSizeStep,
	{
		cameraCount = 1,
		containerHeightPx = 0,
		containerWidthPx = 0,
	}: {
		cameraCount?: number;
		containerHeightPx?: number;
		containerWidthPx?: number;
	},
): number {
	const baseSizePx = getGhostCamSizePx(step);
	if (
		!isUsefulDimension(containerWidthPx) ||
		!isUsefulDimension(containerHeightPx)
	) {
		return baseSizePx;
	}

	const safeCameraCount = Math.max(1, Math.min(4, Math.round(cameraCount)));
	const shortSidePx = Math.min(containerWidthPx, containerHeightPx);
	const longSidePx = Math.max(containerWidthPx, containerHeightPx);
	const playerScale =
		clamp01((shortSidePx - 540) / 420) * 0.72 +
		clamp01((longSidePx - 1280) / 640) * 0.28;
	const adaptiveMaxPx = getAdaptiveGhostCamMaxPx(step);
	const targetSizePx = baseSizePx + (adaptiveMaxPx - baseSizePx) * playerScale;
	const gapPx = getGhostCamGapPx(step);
	const stackShare = getCameraStackWidthShare(safeCameraCount, step);
	const maxByStackWidthPx =
		safeCameraCount === 1
			? Number.POSITIVE_INFINITY
			: Math.floor(
					(containerWidthPx * stackShare - gapPx * (safeCameraCount - 1)) /
						safeCameraCount,
				);
	const maxByPlayerHeightPx = Math.floor(containerHeightPx * 0.22);
	const finalSizePx = Math.min(
		targetSizePx,
		adaptiveMaxPx,
		maxByStackWidthPx,
		maxByPlayerHeightPx,
	);

	return Math.round(Math.max(baseSizePx, finalSizePx));
}

export function getGhostCamSizeLabel(step: GhostCamSizeStep): string {
	return (
		GHOST_CAM_SIZE_STEPS.find((item) => item.step === step)?.label ?? "Medium"
	);
}

export function getGhostCamGapPx(step: GhostCamSizeStep): number {
	return step >= 2 ? 10 : 8;
}

function getAdaptiveGhostCamMaxPx(step: GhostCamSizeStep): number {
	switch (step) {
		case 0:
			return 78;
		case 1:
			return 102;
		case 2:
			return 138;
		case 3:
			return 180;
		case 4:
			return 220;
		default:
			return getGhostCamSizePx(step);
	}
}

function getCameraStackWidthShare(
	cameraCount: number,
	step: GhostCamSizeStep,
): number {
	if (cameraCount >= 4) {
		return step === GHOST_CAM_SIZE_MAX_STEP ? 0.5 : 0.42;
	}
	if (cameraCount === 3) {
		return 0.36;
	}
	if (cameraCount === 2) {
		return 0.28;
	}
	return 1;
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.max(0, Math.min(1, value));
}

function isUsefulDimension(value: number): boolean {
	return Number.isFinite(value) && value > 0;
}
