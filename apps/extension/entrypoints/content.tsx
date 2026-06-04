import { createRoot, type Root } from "react-dom/client";
import { defineContentScript } from "wxt/utils/define-content-script";
import { startCrunchyrollLauncher } from "../src/crunchyroll-launcher";
import { startCrunchyrollStudyIfEnabled } from "../src/crunchyroll-study";
import { startDebugProbe } from "../src/debug-probe";
import { elementDebugSnapshot, logDebug, videoDebugSnapshot } from "../src/debug-log";
import {
  ANIDACHI_COMPOSER_OPEN_ATTR,
  ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT,
  ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT,
  isMessageComposerShortcutEvent,
} from "../src/message-composer-events";
import { getOverlayMountDecision } from "../src/overlay-mount";
import { OverlayApp } from "../src/overlay-app";
import { findBestVideoAdapter, type VideoAdapter } from "../src/video-adapter";

interface MountedOverlay {
  adapter: VideoAdapter;
  host: HTMLElement;
  root: Root;
  stopDebugProbe: () => void;
  relocate(): void;
  updateAdapter(adapter: VideoAdapter): void;
  dispose(): void;
}

const LOCAL_CONTENT_SCRIPT_MATCHES = [
  "http://127.0.0.1/*",
  "http://localhost/*",
  "http://*/*",
  "https://*/*",
  "file:///*",
];

const STORE_CONTENT_SCRIPT_MATCHES = [
  "https://youtube.com/*",
  "https://*.youtube.com/*",
  "https://youtu.be/*",
  "https://*.youtu.be/*",
  "https://*.youtube-nocookie.com/*",
  "https://crunchyroll.com/*",
  "https://*.crunchyroll.com/*",
];

const USE_STORE_CONTENT_SCRIPT_MATCHES =
  import.meta.env.WXT_EXTENSION_CHANNEL === "production" ||
  (import.meta.env.WXT_EXTENSION_CHANNEL === "staging" &&
    import.meta.env.WXT_BROAD_HOST_PERMISSIONS !== "true");

const CONTENT_SCRIPT_MATCHES =
  USE_STORE_CONTENT_SCRIPT_MATCHES
    ? STORE_CONTENT_SCRIPT_MATCHES
    : LOCAL_CONTENT_SCRIPT_MATCHES;

export default defineContentScript({
  matches: CONTENT_SCRIPT_MATCHES,
  allFrames: true,
  runAt: "document_start",
  main() {
    let mounted: MountedOverlay | null = null;
    const stopKeyboardGuard = installMessageComposerKeyboardGuard();
    const stopCrunchyrollLauncher = startCrunchyrollLauncher();
    const stopCrunchyrollStudy = startCrunchyrollStudyIfEnabled();
    ensurePageStyles();

    const mountOrRelocate = () => {
      const adapter = findBestVideoAdapter();
      if (!adapter) {
        return;
      }

      const decision = getOverlayMountDecision(mounted?.adapter.video ?? null, adapter.video);
      if (decision === "relocate") {
        mounted?.relocate();
        return;
      }

      if (decision === "update") {
        logDebug("content", "update adapter", {
          adapterId: adapter.id,
          fingerprint: adapter.getFingerprint(),
          container: elementDebugSnapshot(adapter.container),
          video: videoDebugSnapshot(adapter.video),
        });
        mounted?.updateAdapter(adapter);
        return;
      }

      logDebug("content", "mount adapter", {
        adapterId: adapter.id,
        fingerprint: adapter.getFingerprint(),
        container: elementDebugSnapshot(adapter.container),
        video: videoDebugSnapshot(adapter.video),
      });
      mounted = mountOverlay(adapter);
    };

    mountOrRelocate();
    const interval = window.setInterval(mountOrRelocate, 1500);
    document.addEventListener("fullscreenchange", () => mounted?.relocate());
    window.addEventListener("pagehide", () => {
      window.clearInterval(interval);
      stopKeyboardGuard();
      stopCrunchyrollLauncher?.();
      stopCrunchyrollStudy?.();
      mounted?.dispose();
    });
  },
});

function installMessageComposerKeyboardGuard(): () => void {
  const isComposerOpen = () =>
    document.documentElement.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] !== undefined;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isMessageComposerShortcutEvent(event)) {
      setPageComposerGuard(true);
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent(ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT));
      return;
    }

    if (isComposerOpen() && event.key === "Enter" && !event.shiftKey) {
      setPageComposerGuard(true);
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent(ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT));
    }
  };

  window.addEventListener("keydown", handleKeyDown, true);

  return () => {
    window.removeEventListener("keydown", handleKeyDown, true);
  };
}

function setPageComposerGuard(active: boolean): void {
  const targets = document.querySelectorAll<HTMLElement>(
    '[data-anidachi-fullscreen-target="true"][data-anidachi-adapter="crunchyroll"]',
  );

  if (active) {
    document.documentElement.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] = "guard";
    for (const target of targets) {
      target.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] = "guard";
    }

    window.setTimeout(() => {
      if (document.documentElement.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] === "guard") {
        delete document.documentElement.dataset[ANIDACHI_COMPOSER_OPEN_ATTR];
      }

      for (const target of targets) {
        if (target.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] === "guard") {
          delete target.dataset[ANIDACHI_COMPOSER_OPEN_ATTR];
        }
      }
    }, 1400);
    return;
  }

  delete document.documentElement.dataset[ANIDACHI_COMPOSER_OPEN_ATTR];
  for (const target of targets) {
    delete target.dataset[ANIDACHI_COMPOSER_OPEN_ATTR];
  }
}

function mountOverlay(initialAdapter: VideoAdapter): MountedOverlay {
  let adapter = initialAdapter;
  let stopDebugProbe: () => void = () => undefined;
  const host = document.createElement("anidachi-overlay-root");
  host.style.position = "absolute";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
  host.style.display = "block";
  host.style.overflow = "hidden";

  const shadow = host.attachShadow({ mode: "open" });
  const appRoot = document.createElement("div");
  shadow.append(appRoot);
  const root = createRoot(appRoot);

  let animationFrame = 0;
  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          scheduleRelocate();
        });

  const renderOverlay = () => {
    root.render(<OverlayApp adapter={adapter} />);
  };

  const markAdapter = (nextAdapter: VideoAdapter) => {
    nextAdapter.video.dataset.anidachiVideo = "true";
    nextAdapter.container.dataset.anidachiFullscreenTarget = "true";
    nextAdapter.container.dataset.anidachiAdapter = nextAdapter.id;
  };

  const unmarkAdapter = (previousAdapter: VideoAdapter) => {
    delete previousAdapter.video.dataset.anidachiVideo;
    delete previousAdapter.container.dataset.anidachiFullscreenTarget;
    delete previousAdapter.container.dataset.anidachiAdapter;
  };

  const addAdapterListeners = (nextAdapter: VideoAdapter) => {
    nextAdapter.video.addEventListener("loadedmetadata", scheduleRelocate);
    nextAdapter.video.addEventListener("loadeddata", scheduleRelocate);
    nextAdapter.video.addEventListener("dblclick", handleVideoDoubleClick, true);
  };

  const removeAdapterListeners = (previousAdapter: VideoAdapter) => {
    previousAdapter.video.removeEventListener("loadedmetadata", scheduleRelocate);
    previousAdapter.video.removeEventListener("loadeddata", scheduleRelocate);
    previousAdapter.video.removeEventListener("dblclick", handleVideoDoubleClick, true);
  };

  const startAdapterDebugProbe = () => {
    stopDebugProbe = shouldStartDebugProbe() ? startDebugProbe(adapter) : () => undefined;
  };

  const relocate = () => {
    window.cancelAnimationFrame(animationFrame);
    if (document.fullscreenElement === adapter.video && adapter.container !== adapter.video) {
      logDebug("overlay", "reroute video fullscreen", {
        adapterId: adapter.id,
        fullscreenElement: elementDebugSnapshot(document.fullscreenElement),
      });
      rerouteVideoFullscreen(adapter);
      return;
    }

    const target = getOverlayTarget(adapter);
    ensureOverlayContainer(target);
    if (host.parentElement !== target) {
      target.append(host);
    }
    syncOverlayBounds(adapter, host, target);
    resizeObserver?.observe(adapter.video);
    resizeObserver?.observe(target);
    logDebug("overlay", "relocated", {
      adapterId: adapter.id,
      target: elementDebugSnapshot(target),
      host: elementDebugSnapshot(host),
      video: videoDebugSnapshot(adapter.video),
    });
  };

  const scheduleRelocate = () => {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = window.requestAnimationFrame(relocate);
  };

  markAdapter(adapter);
  startAdapterDebugProbe();
  renderOverlay();
  relocate();
  window.addEventListener("resize", scheduleRelocate);
  window.addEventListener("scroll", scheduleRelocate, true);
  addAdapterListeners(adapter);

  return {
    get adapter() {
      return adapter;
    },
    host,
    root,
    get stopDebugProbe() {
      return stopDebugProbe;
    },
    relocate: scheduleRelocate,
    updateAdapter(nextAdapter: VideoAdapter) {
      if (adapter.video === nextAdapter.video) {
        scheduleRelocate();
        return;
      }

      const previousAdapter = adapter;
      removeAdapterListeners(previousAdapter);
      unmarkAdapter(previousAdapter);
      resizeObserver?.disconnect();
      stopDebugProbe();

      adapter = nextAdapter;
      markAdapter(adapter);
      startAdapterDebugProbe();
      renderOverlay();
      scheduleRelocate();
    },
    dispose() {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleRelocate);
      window.removeEventListener("scroll", scheduleRelocate, true);
      removeAdapterListeners(adapter);
      resizeObserver?.disconnect();
      unmarkAdapter(adapter);
      stopDebugProbe();
      root.unmount();
      host.remove();
    },
  };

  function handleVideoDoubleClick(event: MouseEvent): void {
    if (shouldUseNativePlayerDoubleClick(adapter)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    togglePlayerFullscreen(adapter);
  }
}

function shouldStartDebugProbe(): boolean {
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  return (
    params.get("anidachiDebugProbe") === "1" ||
    hashParams.get("anidachiDebugProbe") === "1" ||
    localStorage.getItem("anidachiDebugProbe") === "1"
  );
}

function shouldUseNativePlayerDoubleClick(adapter: VideoAdapter): boolean {
  return adapter.id === "crunchyroll" || adapter.id === "youtube";
}

function getOverlayTarget(adapter: VideoAdapter): HTMLElement {
  if (adapter.id === "youtube" || adapter.id === "crunchyroll") {
    return adapter.container;
  }

  const fullscreenElement = document.fullscreenElement;
  if (fullscreenElement instanceof HTMLElement) {
    return fullscreenElement;
  }

  return adapter.container;
}

function ensureOverlayContainer(element: HTMLElement): void {
  const style = getComputedStyle(element);
  if (style.position === "static") {
    element.style.position = "relative";
  }
}

function ensurePageStyles(): void {
  if (document.getElementById("anidachi-page-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "anidachi-page-style";
  style.textContent = `
    [data-anidachi-adapter="generic-html5-video"] video[data-anidachi-video="true"]::-webkit-media-controls-fullscreen-button {
      display: none !important;
    }

    [data-anidachi-fullscreen-target="true"]:fullscreen {
      background: #000 !important;
    }

    [data-anidachi-adapter="youtube"] anidachi-overlay-root,
    [data-anidachi-adapter="crunchyroll"] anidachi-overlay-root {
      position: absolute !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    }

    [data-anidachi-adapter="crunchyroll"] [data-testid="settings-button"],
    [data-anidachi-adapter="crunchyroll"] [data-testid="player-settings-menu-button"],
    [data-anidachi-adapter="crunchyroll"] [data-testid="fullscreen-button"] {
      translate: -92px 0 !important;
      transition: translate 180ms ease !important;
    }

    html[data-anidachi-composer-open] [data-anidachi-adapter="crunchyroll"] [data-testid="player-controls-root"],
    html[data-anidachi-composer-open] [data-anidachi-adapter="crunchyroll"] [data-testid="timeline-controls-container"],
    html[data-anidachi-composer-open] [data-anidachi-adapter="crunchyroll"] [data-testid="play-pause-button"],
    html[data-anidachi-composer-open] [data-anidachi-adapter="crunchyroll"] [data-testid="timestamp"],
    html[data-anidachi-composer-open] [data-anidachi-adapter="crunchyroll"] [data-testid="settings-button"],
    html[data-anidachi-composer-open] [data-anidachi-adapter="crunchyroll"] [data-testid="player-settings-menu-button"],
    html[data-anidachi-composer-open] [data-anidachi-adapter="crunchyroll"] [data-testid="audio-subtitle-button"],
    html[data-anidachi-composer-open] [data-anidachi-adapter="crunchyroll"] [data-testid="playback-speed-button"],
    html[data-anidachi-composer-open] [data-anidachi-adapter="crunchyroll"] [data-testid="fullscreen-button"],
    [data-anidachi-adapter="crunchyroll"][data-anidachi-composer-open] [data-testid="player-controls-root"],
    [data-anidachi-adapter="crunchyroll"][data-anidachi-composer-open] [data-testid="timeline-controls-container"],
    [data-anidachi-adapter="crunchyroll"][data-anidachi-composer-open] [data-testid="play-pause-button"],
    [data-anidachi-adapter="crunchyroll"][data-anidachi-composer-open] [data-testid="timestamp"],
    [data-anidachi-adapter="crunchyroll"][data-anidachi-composer-open] [data-testid="settings-button"],
    [data-anidachi-adapter="crunchyroll"][data-anidachi-composer-open] [data-testid="player-settings-menu-button"],
    [data-anidachi-adapter="crunchyroll"][data-anidachi-composer-open] [data-testid="audio-subtitle-button"],
    [data-anidachi-adapter="crunchyroll"][data-anidachi-composer-open] [data-testid="playback-speed-button"],
    [data-anidachi-adapter="crunchyroll"][data-anidachi-composer-open] [data-testid="fullscreen-button"] {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: none !important;
    }

    [data-anidachi-fullscreen-target="true"][data-anidachi-adapter="generic-html5-video"]:fullscreen {
      width: 100vw !important;
      height: 100vh !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border-radius: 0 !important;
      display: grid !important;
      place-items: center !important;
      overflow: hidden !important;
    }

    [data-anidachi-fullscreen-target="true"][data-anidachi-adapter="generic-html5-video"]:fullscreen video[data-anidachi-video="true"] {
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      border-radius: 0 !important;
      object-fit: contain !important;
    }
  `;
  document.documentElement.append(style);
}

function rerouteVideoFullscreen(adapter: VideoAdapter): void {
  document
    .exitFullscreen()
    .then(() => adapter.enterFullscreen())
    .catch(() => {});
}

function togglePlayerFullscreen(adapter: VideoAdapter): void {
  adapter.video.dataset.anidachiVideo = "true";
  adapter.container.dataset.anidachiFullscreenTarget = "true";
  adapter.container.dataset.anidachiAdapter = adapter.id;
  logDebug("fullscreen", "toggle requested", {
    adapterId: adapter.id,
    currentlyFullscreen: Boolean(document.fullscreenElement),
    video: videoDebugSnapshot(adapter.video),
  });

  if (document.fullscreenElement) {
    adapter.exitFullscreen().catch(() => {});
    return;
  }

  adapter.enterFullscreen().catch(() => {});
}

function syncOverlayBounds(adapter: VideoAdapter, host: HTMLElement, target: HTMLElement): void {
  const videoStyle = getComputedStyle(adapter.video);

  if (adapter.isFullscreen()) {
    host.style.inset = "0";
    host.style.left = "0";
    host.style.top = "0";
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.borderRadius = "0";
    return;
  }

  const videoRect = adapter.video.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const left = videoRect.left - targetRect.left + target.scrollLeft;
  const top = videoRect.top - targetRect.top + target.scrollTop;

  host.style.inset = "auto";
  host.style.left = `${Math.max(0, left)}px`;
  host.style.top = `${Math.max(0, top)}px`;
  host.style.width = `${Math.max(0, videoRect.width)}px`;
  host.style.height = `${Math.max(0, videoRect.height)}px`;
  host.style.borderRadius = videoStyle.borderRadius;
}
