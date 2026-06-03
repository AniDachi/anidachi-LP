export const GHOST_CAM_SIZE_STEPS = [
  { label: "Small", sizePx: 60, step: 0 },
  { label: "Normal", sizePx: 74, step: 1 },
  { label: "Large", sizePx: 90, step: 2 },
  { label: "XL", sizePx: 108, step: 3 },
] as const;

export type GhostCamSizeStep = (typeof GHOST_CAM_SIZE_STEPS)[number]["step"];

export const DEFAULT_GHOST_CAM_SIZE_STEP: GhostCamSizeStep = 1;
export const GHOST_CAM_SIZE_MIN_STEP = GHOST_CAM_SIZE_STEPS[0].step;
export const GHOST_CAM_SIZE_MAX_STEP = GHOST_CAM_SIZE_STEPS[GHOST_CAM_SIZE_STEPS.length - 1].step;

export function normalizeGhostCamSizeStep(value: unknown): GhostCamSizeStep {
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_GHOST_CAM_SIZE_STEP;
  }

  const rounded = Math.round(numericValue);
  const clamped = Math.max(GHOST_CAM_SIZE_MIN_STEP, Math.min(GHOST_CAM_SIZE_MAX_STEP, rounded));
  return clamped as GhostCamSizeStep;
}

export function getGhostCamSizePx(step: GhostCamSizeStep): number {
  return GHOST_CAM_SIZE_STEPS.find((item) => item.step === step)?.sizePx ?? 74;
}

export function getGhostCamSizeLabel(step: GhostCamSizeStep): string {
  return GHOST_CAM_SIZE_STEPS.find((item) => item.step === step)?.label ?? "Normal";
}

export function getGhostCamGapPx(step: GhostCamSizeStep): number {
  return step >= 2 ? 10 : 8;
}
