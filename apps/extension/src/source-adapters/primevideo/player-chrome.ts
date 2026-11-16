import { DEFAULT_PLAYER_OVERLAY_GEOMETRY, normalizePlayerOverlayGeometry, type PlayerOverlayGeometryListener } from "../core/overlay-geometry";
// Stable observed SDK wrappers plus semantic controls; never English labels or hashed classes.
const chrome = ".atvwebplayersdk-title-text, .atvwebplayersdk-episode-timing-container, .atvwebplayersdk-episode-info, .atvwebplayersdk-progress-bar-handle, button, [role=slider]";
export function getPrimeGeometry(container: HTMLElement) {
  const boundary = container.getBoundingClientRect();
  if (boundary.width <= 0 || boundary.height <= 0) return DEFAULT_PLAYER_OVERLAY_GEOMETRY;
  let top = 0, bottom = 0;
  for (const element of container.querySelectorAll<HTMLElement>(chrome)) {
    if (element.closest("anidachi-overlay-root")) continue;
    const rect = element.getBoundingClientRect(); let visible = rect.width > 0 && rect.height > 0;
    for (let node: HTMLElement | null = element; visible && node; node = node.parentElement) {
      const style = getComputedStyle(node); visible = !node.hidden && node.getAttribute("aria-hidden") !== "true" && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
      if (node === container) break;
    }
    if (!visible || rect.bottom <= boundary.top || rect.top >= boundary.bottom) continue;
    if (rect.bottom < boundary.top + boundary.height * 0.4) top = Math.max(top, rect.bottom - boundary.top + 8);
    if (rect.top > boundary.top + boundary.height * 0.6) bottom = Math.max(bottom, boundary.bottom - rect.top + 8);
  }
  return normalizePlayerOverlayGeometry({ controlsVisible: top > 0 || bottom > 0, viewport: { widthPx: boundary.width, heightPx: boundary.height },
    safeInsets: { topPx: top, bottomPx: bottom, leftPx: 0, rightPx: 0 }, launcher: { topPx: Math.max(10, top), rightPx: 10 },
    panel: { topPx: Math.max(48, top + 38), rightPx: 10 } });
}
export function subscribePrimeGeometry(container: HTMLElement, listener: PlayerOverlayGeometryListener): () => void {
  let disposed = false, frame: number | null = null;
  const update = () => { if (disposed || frame !== null) return; frame = requestAnimationFrame(() => { frame = null; if (!disposed) listener(getPrimeGeometry(container)); }); };
  const observer = new MutationObserver(records => { if (records.some(record => !(record.target instanceof Element) || !record.target.closest("anidachi-overlay-root"))) update(); });
  observer.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-hidden"] });
  const resize = new ResizeObserver(update); resize.observe(container);
  document.addEventListener("fullscreenchange", update); container.addEventListener("pointermove", update); update();
  return () => { if (disposed) return; disposed = true; observer.disconnect(); resize.disconnect(); if (frame !== null) cancelAnimationFrame(frame);
    document.removeEventListener("fullscreenchange", update); container.removeEventListener("pointermove", update); };
}
