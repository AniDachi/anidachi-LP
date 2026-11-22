import {
  arePlayerOverlayGeometriesEqual, DEFAULT_PLAYER_OVERLAY_GEOMETRY,
  type PlayerOverlayGeometryListener,
} from "../core/overlay-geometry";

export function isVisibleInPlayer(element: Element, player: HTMLElement): boolean {
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return false;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node.hasAttribute("hidden") || style.display === "none" || style.visibility === "hidden" ||
        (style.opacity !== "" && Number(style.opacity) === 0)) return false;
    if (node === player) return true;
  }
  return false;
}

export function hboMaxOverlayGeometry(player: HTMLElement) {
  const bounds = player.getBoundingClientRect();
  // HBO renders separate control layouts for different viewport sizes.
  const visibleControl = (testId: string) => Array.from(player.querySelectorAll('[data-testid="' + testId + '"]'))
    .find(control => isVisibleInPlayer(control, player));
  const footer = visibleControl("control_footer");
  const cast = visibleControl("player-ux-chromecast-button");
  const bottom = footer ? Math.max(0, bounds.bottom - footer.getBoundingClientRect().top) : 0;
  const right = cast ? Math.max(10, bounds.right - cast.getBoundingClientRect().left + 8) : 10;
  return {
    ...DEFAULT_PLAYER_OVERLAY_GEOMETRY,
    viewport: { widthPx: bounds.width, heightPx: bounds.height },
    controlsVisible: !!footer || !!cast,
    safeInsets: { ...DEFAULT_PLAYER_OVERLAY_GEOMETRY.safeInsets, bottomPx: bottom },
    launcher: { topPx: 10, rightPx: right },
    panel: { topPx: 48, rightPx: right },
  };
}

export function subscribeHboMaxGeometry(player: HTMLElement, listener: PlayerOverlayGeometryListener) {
  let last = hboMaxOverlayGeometry(player);
  const update = () => {
    const next = hboMaxOverlayGeometry(player);
    if (!arePlayerOverlayGeometriesEqual(last, next)) {
      last = next;
      listener(next);
    }
  };
  const controls = '[data-testid="control_footer"], [data-testid="player-ux-chromecast-button"]';
  const observer = new MutationObserver(records => {
    if (records.some(record => record.type === "childList" || (record.target instanceof Element &&
        (record.target.matches(controls) || record.target.querySelector(controls))))) update();
  });
  observer.observe(player, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
  const resize = new ResizeObserver(update);
  resize.observe(player);
  player.addEventListener("transitionend", update);
  return () => {
    observer.disconnect();
    resize.disconnect();
    player.removeEventListener("transitionend", update);
  };
}
