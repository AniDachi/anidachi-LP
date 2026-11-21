import { DEFAULT_PLAYER_OVERLAY_GEOMETRY, type PlayerOverlayGeometryListener } from "../core/overlay-geometry";
import { disneyControlsPortal } from "./dom";

export function disneyOverlayBinding(surface: HTMLElement) {
  const doc = surface.ownerDocument;
  const portal = disneyControlsPortal(doc);
  const fullscreen = doc.fullscreenElement;
  // The media surface and the controls are in separate stacking contexts.
  // Mount alongside both, including when Disney moves them into fullscreen.
  let parent = surface;
  if (portal && (!fullscreen || fullscreen.contains(portal))) {
    while (!parent.contains(portal) && parent.parentElement) parent = parent.parentElement;
  }
  return {
    mountTarget: parent,
    fillMountTarget: parent === surface,
    boundsElement: surface,
    useNativePlayerDoubleClick: true,
  };
}

function mainControls(surface: HTMLElement) {
  return disneyControlsPortal(surface.ownerDocument)?.querySelector<HTMLElement>("main-app-controls-overlay") ?? null;
}

export function disneyOverlayGeometry(surface: HTMLElement, controls = mainControls(surface)) {
  const bounds = surface.getBoundingClientRect();
  const root = controls?.shadowRoot ?? controls;
  const footer = root?.querySelector(".controls-footer")?.getBoundingClientRect();
  const transport = root?.querySelector(".playback-controls-narrow")?.getBoundingClientRect();
  const bottom = footer && footer.width > 0 && footer.height > 0 && footer.top > bounds.top && footer.top < bounds.bottom
    ? Math.ceil(bounds.bottom - footer.top) + 8 : 0;
  const panel = { ...DEFAULT_PLAYER_OVERLAY_GEOMETRY.panel };
  if (transport && transport.width > 0 && transport.height > 0) {
    const beside = Math.floor(bounds.right - transport.right - panel.rightPx - 8);
    const above = Math.floor(transport.top - bounds.top - panel.topPx - 8);
    if (beside >= 190) panel.maxWidthPx = beside;
    else if (above >= 64) panel.maxHeightPx = above;
  }
  return {
    ...DEFAULT_PLAYER_OVERLAY_GEOMETRY,
    viewport: { widthPx: bounds.width, heightPx: bounds.height },
    controlsVisible: bottom > 0,
    safeInsets: { ...DEFAULT_PLAYER_OVERLAY_GEOMETRY.safeInsets, bottomPx: bottom },
    panel,
  };
}

export function subscribeDisneyOverlayGeometry(surface: HTMLElement, listener: PlayerOverlayGeometryListener) {
  let controls: HTMLElement | null = null;
  const resize = new ResizeObserver(() => listener(disneyOverlayGeometry(surface, controls)));
  const bind = () => {
    if (controls?.isConnected) return;
    const next = mainControls(surface);
    if (next === controls) return;
    if (controls) resize.unobserve(controls);
    controls = next;
    if (controls) resize.observe(controls);
    listener(disneyOverlayGeometry(surface, controls));
  };
  // The host resizes from zero as Disney shows its toolbar. Rebind only if the
  // player replaces the host or installs its portal after the video.
  const observer = new MutationObserver(bind);
  observer.observe(surface.ownerDocument.body, { childList: true, subtree: true });
  resize.observe(surface);
  bind();
  return () => { observer.disconnect(); resize.disconnect(); };
}
