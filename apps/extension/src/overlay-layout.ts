export interface CrunchyrollPlayerChromeState {
  controlsVisible: boolean;
  camStackBottomPx: number;
  containerHeightPx: number;
  containerWidthPx: number;
  miniPanelRightPx: number;
  miniPanelTopPx: number;
  topBubbleRightPx: number;
  topBubbleTopPx: number;
}

export const DEFAULT_CAM_STACK_BOTTOM_PX = 54;
export const DEFAULT_TOP_BUBBLE_TOP_PX = 10;
export const DEFAULT_TOP_BUBBLE_RIGHT_PX = 10;
export const DEFAULT_MINI_PANEL_TOP_PX = 48;
export const DEFAULT_MINI_PANEL_RIGHT_PX = 10;
export const DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX = 10;
export const DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE: CrunchyrollPlayerChromeState = {
  controlsVisible: false,
  camStackBottomPx: DEFAULT_CAM_STACK_BOTTOM_PX,
  containerHeightPx: 0,
  containerWidthPx: 0,
  miniPanelRightPx: DEFAULT_MINI_PANEL_RIGHT_PX,
  miniPanelTopPx: DEFAULT_MINI_PANEL_TOP_PX,
  topBubbleRightPx: DEFAULT_TOP_BUBBLE_RIGHT_PX,
  topBubbleTopPx: DEFAULT_TOP_BUBBLE_TOP_PX,
};

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
  const safeCamStackBottomPx = normalizePixelValue(camStackBottomPx, DEFAULT_CAM_STACK_BOTTOM_PX);
  const safeGhostCamSizePx = normalizePixelValue(ghostCamSizePx, 0);
  const controlsReservePx = controlsVisible
    ? Math.max(DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX, safeCamStackBottomPx)
    : DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX;
  const cameraReservePx = cameraStackVisible
    ? safeCamStackBottomPx + safeGhostCamSizePx + 18
    : DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX;

  return Math.round(
    Math.max(DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX, controlsReservePx, cameraReservePx),
  );
}

function normalizePixelValue(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
