import { isUsableVideo } from "../core/video-discovery";

export function disneyControlsPortal(doc: Document): HTMLElement | null {
  const portals = doc.getElementsByTagName("disney-web-player-ui");
  const portal = portals.length === 1 ? portals.item(0) : null;
  return portal instanceof HTMLElement ? portal : null;
}

/** Search the player's light DOM and open web-component roots, including the root host itself. */
export function findDisneyPlusElement<T extends Element>(container: ParentNode, selector: string): T | null {
  const direct = container.querySelector<T>(selector);
  if (direct) return direct;
  for (const root of childShadowRoots(container)) {
    const found = findDisneyPlusElement<T>(root, selector);
    if (found) return found;
  }
  return null;
}

function* childShadowRoots(container: ParentNode): Generator<ShadowRoot> {
  if (container instanceof Element && container.shadowRoot) yield container.shadowRoot;
  for (const child of container.querySelectorAll("*")) {
    if (child.shadowRoot) yield child.shadowRoot;
  }
}

export function composedClosest<T extends Element>(element: Element, selector: string): T | null {
  const local = element.closest<T>(selector);
  if (local) return local;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? composedClosest<T>(root.host, selector) : null;
}

export function isDisneyPlusMainVideo(video: HTMLVideoElement, player: HTMLElement): boolean {
  return video.isConnected && video.matches("video.hive-video") && isUsableVideo(video) &&
    !composedClosest(video, "[hidden], [aria-hidden='true']") &&
    !!composedClosest(video, ".media-element-container") &&
    composedClosest(video, "disney-web-player") === player;
}

export function findDisneyPlusVideo(player: HTMLElement): HTMLVideoElement | null {
  let main: HTMLVideoElement | null = null;
  function visit(container: ParentNode): boolean {
    for (const video of container.querySelectorAll<HTMLVideoElement>("video.hive-video")) {
      if (!isDisneyPlusMainVideo(video, player)) continue;
      if (main) return false;
      main = video;
    }
    for (const root of childShadowRoots(container)) if (!visit(root)) return false;
    return true;
  }
  return visit(player) ? main : null;
}
