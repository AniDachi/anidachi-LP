import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { defineContentScript } from "wxt/utils/define-content-script";
import {
  elementDebugSnapshot,
  logDebug,
  videoDebugSnapshot,
} from "../src/debug-log";
import { startDebugProbe } from "../src/debug-probe";
import {
  ANIDACHI_COMPOSER_OPEN_ATTR,
  ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT,
  ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT,
  isMessageComposerShortcutEvent,
} from "../src/message-composer-events";
import { OverlayApp } from "../src/overlay-app";
import {
  getOverlayPageDecision,
  mutationsAffectVideo,
} from "../src/overlay-mount";
import {
  AdapterManager,
  type AdapterReconcileResult,
} from "../src/source-adapters/core/adapter-manager";
import type {
  AdapterDetectionResult,
  SourceProvider,
  VideoAdapter,
} from "../src/source-adapters/core/types";
import { startCrunchyrollStudyIfEnabled } from "../src/source-adapters/crunchyroll/study";
import { detectSourceAdapter } from "../src/source-adapters/registry";

export interface MountedOverlay {
  readonly adapter: VideoAdapter;
  relocate(): void;
  replaceAdapter(adapter: VideoAdapter): void;
  suspend(): void;
  dispose(): void;
}

export interface OverlayRenderer {
  render(adapter: VideoAdapter, active: boolean): void;
  unmount(): void;
}

interface ResizeObserverBinding {
  disconnect(): void;
  observe(target: Element): void;
}

interface MountOverlayOptions {
  createResizeObserver?: (
    callback: ResizeObserverCallback,
  ) => ResizeObserverBinding;
  renderer?: OverlayRenderer;
}

interface ContentLifecycleDependencies {
  detect(current: VideoAdapter | null): AdapterDetectionResult;
  ensureStyles(): void;
  installKeyboardGuard(): () => void;
  mount(adapter: VideoAdapter): MountedOverlay;
  startProviderStudy(): (() => void) | null | undefined;
}

export interface ContentLifecycleRuntime {
  reconcile(): AdapterReconcileResult;
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

const CONTENT_SCRIPT_MATCHES = USE_STORE_CONTENT_SCRIPT_MATCHES
  ? STORE_CONTENT_SCRIPT_MATCHES
  : LOCAL_CONTENT_SCRIPT_MATCHES;

export default defineContentScript({
  matches: CONTENT_SCRIPT_MATCHES,
  allFrames: true,
  runAt: "document_start",
  main() {
    startContentLifecycle();
  },
});

export function startContentLifecycle(
  overrides: Partial<ContentLifecycleDependencies> = {},
): ContentLifecycleRuntime {
  const dependencies: ContentLifecycleDependencies = {
    detect: detectLifecycleResult,
    ensureStyles: ensurePageStyles,
    installKeyboardGuard: installMessageComposerKeyboardGuard,
    mount: mountOverlay,
    startProviderStudy: startCrunchyrollStudyIfEnabled,
    ...overrides,
  };
  let mounted: MountedOverlay | null = null;
  let disposed = false;
  const stopKeyboardGuard = dependencies.installKeyboardGuard();
  const stopProviderStudy = dependencies.startProviderStudy();
  dependencies.ensureStyles();

  const manager = new AdapterManager({
    detached(previous) {
      logDebug("content", "detach adapter", {
        adapterId: previous.id,
        fingerprint: previous.getFingerprint(),
        url: location.href,
      });
      mounted?.dispose();
      mounted = null;
    },
    mounted(adapter) {
      logDebug("content", "mount adapter", {
        adapterId: adapter.id,
        fingerprint: adapter.getFingerprint(),
        container: elementDebugSnapshot(adapter.container),
        video: videoDebugSnapshot(adapter.video),
      });
      mounted = dependencies.mount(adapter);
    },
    relocated() {
      mounted?.relocate();
    },
    replaced(previous, next) {
      logDebug("content", "replace adapter", {
        adapterId: next.id,
        previousAdapterId: previous.id,
        previousFingerprint: previous.getFingerprint(),
        nextFingerprint: next.getFingerprint(),
        container: elementDebugSnapshot(next.container),
        video: videoDebugSnapshot(next.video),
      });
      mounted?.replaceAdapter(next);
    },
    suspended(previous) {
      logDebug("content", "suspend adapter", {
        adapterId: previous.id,
        fingerprint: previous.getFingerprint(),
        url: location.href,
      });
      mounted?.suspend();
    },
  });

  const reconcile = () =>
    manager.reconcile(dependencies.detect(manager.current));

  let mountCheckFrame: number | null = null;
  const scheduleMountCheck = () => {
    if (disposed || mountCheckFrame !== null) {
      return;
    }

    mountCheckFrame = window.requestAnimationFrame(() => {
      mountCheckFrame = null;
      reconcile();
    });
  };

  // DOM events do the immediate work. This backed-off poll only covers players
  // that become detectable without inserting or replacing a video node.
  const MOUNT_POLL_MIN_MS = 1000;
  const MOUNT_POLL_MAX_MS = 8000;
  let mountPollDelay = MOUNT_POLL_MIN_MS;
  let mountPollTimer: number | null = null;
  const scheduleNextMountPoll = () => {
    if (disposed || mountPollTimer !== null) {
      return;
    }

    mountPollDelay = manager.current
      ? MOUNT_POLL_MAX_MS
      : Math.min(Math.round(mountPollDelay * 1.5), MOUNT_POLL_MAX_MS);
    mountPollTimer = window.setTimeout(() => {
      mountPollTimer = null;
      reconcile();
      scheduleNextMountPoll();
    }, mountPollDelay);
  };

  reconcile();
  scheduleNextMountPoll();

  const handleVideoLifecycleEvent = (event: Event) => {
    if (event.target instanceof HTMLVideoElement) {
      scheduleMountCheck();
    }
  };
  const videoObserver = new MutationObserver((mutations) => {
    if (mountCheckFrame !== null) {
      return;
    }

    if (mutationsAffectVideo(mutations)) {
      scheduleMountCheck();
    }
  });
  videoObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  document.addEventListener("loadstart", handleVideoLifecycleEvent, true);
  document.addEventListener("loadedmetadata", handleVideoLifecycleEvent, true);
  document.addEventListener("emptied", handleVideoLifecycleEvent, true);
  const navigation = window.navigation;
  navigation?.addEventListener("currententrychange", scheduleMountCheck);
  window.addEventListener("popstate", scheduleMountCheck);
  window.addEventListener("hashchange", scheduleMountCheck);

  const handleFullscreenChange = () => mounted?.relocate();
  document.addEventListener("fullscreenchange", handleFullscreenChange);

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    if (mountPollTimer !== null) {
      window.clearTimeout(mountPollTimer);
      mountPollTimer = null;
    }
    if (mountCheckFrame !== null) {
      window.cancelAnimationFrame(mountCheckFrame);
      mountCheckFrame = null;
    }
    videoObserver.disconnect();
    document.removeEventListener("loadstart", handleVideoLifecycleEvent, true);
    document.removeEventListener(
      "loadedmetadata",
      handleVideoLifecycleEvent,
      true,
    );
    document.removeEventListener("emptied", handleVideoLifecycleEvent, true);
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    navigation?.removeEventListener("currententrychange", scheduleMountCheck);
    window.removeEventListener("popstate", scheduleMountCheck);
    window.removeEventListener("hashchange", scheduleMountCheck);
    window.removeEventListener("pagehide", dispose);
    stopKeyboardGuard();
    stopProviderStudy?.();
    manager.dispose();
  };

  window.addEventListener("pagehide", dispose);

  return { dispose, reconcile };
}

function detectLifecycleResult(
  current: VideoAdapter | null,
): AdapterDetectionResult {
  const pageDecision = getOverlayPageDecision(current !== null, location.href);
  if (pageDecision === "dispose") {
    return {
      status: "blocked",
      provider: current
        ? providerFromAdapter(current)
        : providerFromUrl(location.href),
    };
  }
  if (pageDecision === "idle") {
    return { status: "none" };
  }

  const adapter = detectSourceAdapter();
  if (adapter) {
    return { status: "ready", adapter };
  }

  return current
    ? { status: "waiting", provider: providerFromAdapter(current) }
    : { status: "none" };
}

function providerFromAdapter(adapter: VideoAdapter): SourceProvider {
  return adapter.provider;
}

function providerFromUrl(pageUrl: string): SourceProvider {
  try {
    const hostname = new URL(pageUrl).hostname.toLowerCase();
    if (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be"
    ) {
      return "youtube";
    }
    if (
      hostname === "crunchyroll.com" ||
      hostname.endsWith(".crunchyroll.com")
    ) {
      return "crunchyroll";
    }
  } catch {
    // Invalid URLs are treated as unowned generic pages.
  }
  return "generic";
}

function installMessageComposerKeyboardGuard(): () => void {
  const isComposerOpen = () =>
    document.documentElement.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] !== undefined;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isMessageComposerShortcutEvent(event)) {
      setPageComposerGuard(true);
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(
        new CustomEvent(ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT),
      );
      return;
    }

    if (isComposerOpen() && event.key === "Enter" && !event.shiftKey) {
      setPageComposerGuard(true);
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(
        new CustomEvent(ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT),
      );
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
      if (
        document.documentElement.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] ===
        "guard"
      ) {
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

export function mountOverlay(
  initialAdapter: VideoAdapter,
  options: MountOverlayOptions = {},
): MountedOverlay {
  let adapter = initialAdapter;
  let stopDebugProbe: () => void = () => undefined;
  let adapterBindingActive = false;
  let disposed = false;
  const host = document.createElement("anidachi-overlay-root");
  host.style.position = "absolute";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
  host.style.display = "block";
  host.style.overflow = "hidden";

  const shadow = host.attachShadow({ mode: "open" });
  const appRoot = document.createElement("div");
  shadow.append(appRoot);
  const renderer = options.renderer ?? createReactOverlayRenderer(appRoot);

  let animationFrame = 0;
  let fullscreenTransitionGeneration = 0;
  let observedTarget: Element | null = null;
  let positionedTarget: HTMLElement | null = null;
  let previousInlinePosition = "";
  const createResizeObserver =
    options.createResizeObserver ??
    (typeof ResizeObserver === "undefined"
      ? null
      : (callback: ResizeObserverCallback) => new ResizeObserver(callback));
  const resizeObserver =
    createResizeObserver?.(() => scheduleRelocate()) ?? null;

  const renderOverlay = (active: boolean) => {
    renderer.render(adapter, active);
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
    nextAdapter.video.addEventListener(
      "dblclick",
      handleVideoDoubleClick,
      true,
    );
  };

  const removeAdapterListeners = (previousAdapter: VideoAdapter) => {
    previousAdapter.video.removeEventListener(
      "loadedmetadata",
      scheduleRelocate,
    );
    previousAdapter.video.removeEventListener("loadeddata", scheduleRelocate);
    previousAdapter.video.removeEventListener(
      "dblclick",
      handleVideoDoubleClick,
      true,
    );
  };

  const startAdapterDebugProbe = () => {
    stopDebugProbe = shouldStartDebugProbe()
      ? startDebugProbe(adapter)
      : () => undefined;
  };

  const stopAdapterDebugProbe = () => {
    stopDebugProbe();
    stopDebugProbe = () => undefined;
  };

  const restoreOverlayContainerPosition = () => {
    if (positionedTarget?.style.position === "relative") {
      positionedTarget.style.position = previousInlinePosition;
    }
    positionedTarget = null;
    previousInlinePosition = "";
  };

  const prepareOverlayContainer = (target: HTMLElement) => {
    if (positionedTarget && positionedTarget !== target) {
      restoreOverlayContainerPosition();
    }
    if (getComputedStyle(target).position !== "static") {
      return;
    }

    positionedTarget = target;
    previousInlinePosition = target.style.position;
    target.style.position = "relative";
  };

  const relocate = () => {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (!adapterBindingActive || disposed) {
      return;
    }
    if (
      document.fullscreenElement === adapter.video &&
      adapter.container !== adapter.video
    ) {
      const fullscreenAdapter = adapter;
      const transitionGeneration = ++fullscreenTransitionGeneration;
      logDebug("overlay", "reroute video fullscreen", {
        adapterId: adapter.id,
        fullscreenElement: elementDebugSnapshot(document.fullscreenElement),
      });
      rerouteVideoFullscreen(fullscreenAdapter, () =>
        Boolean(
          !disposed &&
            adapterBindingActive &&
            adapter === fullscreenAdapter &&
            transitionGeneration === fullscreenTransitionGeneration,
        ),
      );
      return;
    }

    const overlayBinding = adapter.getOverlayBinding();
    const target = overlayBinding.mountTarget;
    prepareOverlayContainer(target);
    if (host.parentElement !== target) {
      target.append(host);
    }
    syncOverlayBounds(adapter, host, target, overlayBinding.fillMountTarget);
    if (observedTarget !== target) {
      if (observedTarget) {
        resizeObserver?.disconnect();
      }
      resizeObserver?.observe(adapter.video);
      resizeObserver?.observe(target);
      observedTarget = target;
    }
    logDebug("overlay", "relocated", {
      adapterId: adapter.id,
      target: elementDebugSnapshot(target),
      host: elementDebugSnapshot(host),
      video: videoDebugSnapshot(adapter.video),
    });
  };

  const scheduleRelocate = () => {
    if (!adapterBindingActive || disposed) {
      return;
    }
    window.cancelAnimationFrame(animationFrame);
    animationFrame = window.requestAnimationFrame(relocate);
  };

  const deactivateAdapterBinding = () => {
    if (!adapterBindingActive) {
      return;
    }

    adapterBindingActive = false;
    fullscreenTransitionGeneration += 1;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    removeAdapterListeners(adapter);
    resizeObserver?.disconnect();
    observedTarget = null;
    unmarkAdapter(adapter);
    restoreOverlayContainerPosition();
    stopAdapterDebugProbe();
  };

  const activateAdapterBinding = () => {
    if (disposed) {
      return;
    }

    adapterBindingActive = true;
    markAdapter(adapter);
    startAdapterDebugProbe();
    addAdapterListeners(adapter);
    renderOverlay(true);
    relocate();
  };

  window.addEventListener("resize", scheduleRelocate);
  window.addEventListener("scroll", scheduleRelocate, true);
  activateAdapterBinding();

  return {
    get adapter() {
      return adapter;
    },
    relocate: scheduleRelocate,
    replaceAdapter(nextAdapter: VideoAdapter) {
      if (disposed) {
        return;
      }
      deactivateAdapterBinding();
      renderOverlay(false);
      adapter = nextAdapter;
      activateAdapterBinding();
    },
    suspend() {
      if (disposed || !adapterBindingActive) {
        return;
      }
      deactivateAdapterBinding();
      renderOverlay(false);
    },
    dispose() {
      if (disposed) {
        return;
      }
      deactivateAdapterBinding();
      disposed = true;
      window.removeEventListener("resize", scheduleRelocate);
      window.removeEventListener("scroll", scheduleRelocate, true);
      renderer.unmount();
      host.remove();
    },
  };

  function handleVideoDoubleClick(event: MouseEvent): void {
    if (adapter.getOverlayBinding().useNativePlayerDoubleClick) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    togglePlayerFullscreen(adapter);
  }
}

function createReactOverlayRenderer(appRoot: HTMLElement): OverlayRenderer {
  const root: Root = createRoot(appRoot);
  return {
    render(adapter, active) {
      flushSync(() => {
        root.render(<OverlayApp adapter={adapter} adapterActive={active} />);
      });
    },
    unmount() {
      root.unmount();
    },
  };
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

function rerouteVideoFullscreen(
  adapter: VideoAdapter,
  isCurrentTransition: () => boolean,
): void {
  document
    .exitFullscreen()
    .then(() => {
      if (!isCurrentTransition()) {
        return;
      }
      return adapter.enterFullscreen();
    })
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

function syncOverlayBounds(
  adapter: VideoAdapter,
  host: HTMLElement,
  target: HTMLElement,
  fillMountTarget: boolean,
): void {
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

  if (fillMountTarget) {
    host.style.inset = "0";
    host.style.left = "0";
    host.style.top = "0";
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.borderRadius = getComputedStyle(target).borderRadius;
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
