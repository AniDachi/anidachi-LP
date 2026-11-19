import { suppressedPrimeLaunch } from "../src/prime-launch-capture";
import { getLivePrimeRoomSession } from "../src/prime-room-client";
import type { LivePrimeRoomSession } from "../src/prime-room-contract";
import { PrimeVideoAdapter } from "../src/source-adapters/primevideo/adapter";
import { discardConflictingPrimeLaunch, preparePrimeRoomDismissal, recoverPrimeLaunch } from "../src/prime-launch-client";
import { PRIME_CONTENT_MATCHES, isPrimeRoomBrowsingPage, parsePrimePageUrl } from "../src/source-adapters/primevideo/url";
import { PRIME_COMPOSER_CHROME_STYLES } from "../src/source-adapters/primevideo/composer-chrome";
import { PRIME_BINDING_CHANGED, PRIME_PLAYER_STATE } from "../src/source-adapters/primevideo/contract";
import "../src/zod-csp";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { defineContentScript } from "wxt/utils/define-content-script";
import {
  elementDebugSnapshot,
  logDebug,
  removeLegacyPageDebugBufferOnce,
  videoDebugSnapshot,
} from "../src/debug-log";
import { startDebugProbe } from "../src/debug-probe";
import {
  ANIDACHI_COMPOSER_OPEN_ATTR,
  ANIDACHI_MESSAGE_COMPOSER_DISMISS_EVENT,
  ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT,
  ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT,
  isMessageComposerShortcutEvent,
} from "../src/message-composer-events";
import { OverlayApp } from "../src/overlay-app";
import { createPrimeLaunchCapture, type PrimeLaunchHandoff } from "../src/prime-launch-capture";
import { installOverlayKeyboardRouter } from "../src/overlay-keyboard-router";
import { installPlayerIntroductionKeyboardGuard } from "../src/player-onboarding-input";
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
import { NETFLIX_COMPOSER_CHROME_STYLES } from "../src/source-adapters/netflix/composer-chrome";
import { YOUTUBE_COMPOSER_CHROME_STYLES } from "../src/source-adapters/youtube/composer-chrome";

export interface MountedOverlay {
  readonly adapter: VideoAdapter;
  hasPrimeRoom?(): boolean;
  isPrimeDocked?(): boolean;
  dockPrimeRoom?(): void;
  relocate(): void;
  replaceAdapter(adapter: VideoAdapter): void;
  suspend(): void;
  dispose(leavingDocument?: boolean): void;
}

export interface OverlayRenderer {
  render(adapter: VideoAdapter, active: boolean, browsing?: boolean): void;
  unmount(leavingDocument?: boolean): void;
}

interface ResizeObserverBinding {
  disconnect(): void;
  observe(target: Element): void;
}

interface MountOverlayOptions {
  initialLaunch?: PrimeLaunchHandoff | null;
  initialPrimeRoom?: LivePrimeRoomSession;
  initiallyDocked?: boolean;
  createResizeObserver?: (
    callback: ResizeObserverCallback,
  ) => ResizeObserverBinding;
  renderer?: OverlayRenderer;
}

interface ContentLifecycleDependencies {
  detect(current: VideoAdapter | null): AdapterDetectionResult;
  ensureStyles(): void;
  installKeyboardGuard(): () => void;
  lookupPrimeRoom(): Promise<LivePrimeRoomSession | null>;
  mount(adapter: VideoAdapter, initialLaunch?: PrimeLaunchHandoff | null, initialPrimeRoom?: LivePrimeRoomSession, initiallyDocked?: boolean): MountedOverlay;
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
  "https://www.netflix.com/*",
  ...PRIME_CONTENT_MATCHES,
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
  main(context) {
    const runtime = startContentLifecycle();
    context.onInvalidated(runtime.dispose);
  },
});

export function startContentLifecycle(
  overrides: Partial<ContentLifecycleDependencies> = {},
): ContentLifecycleRuntime {
  let disposed = false;
  let session: ReturnType<typeof startContentLifecycleSession> | null = startContentLifecycleSession(overrides);
  const hide = (event: PageTransitionEvent) => {
    session?.dispose(true);
    session = null;
    if (!event.persisted) dispose();
  };
  const show = (event: PageTransitionEvent) => {
    if (event.persisted && !disposed && !session) {
      session = startContentLifecycleSession(overrides, true);
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("pagehide", hide);
    window.removeEventListener("pageshow", show);
    session?.dispose();
    session = null;
  };
  // A cached document does not rerun content scripts on Back/Forward. Release
  // live room/player resources while away, then discover a fresh player binding.
  window.addEventListener("pagehide", hide);
  window.addEventListener("pageshow", show);
  return { dispose, reconcile: () => session?.reconcile() ?? "idle" };
}

function startContentLifecycleSession(
  overrides: Partial<ContentLifecycleDependencies>,
  restoredFromCache = false,
): ContentLifecycleRuntime & { dispose(leavingDocument?: boolean): void } {
  const primeLaunch = createPrimeLaunchCapture(location.href);
  const restoredLaunch = restoredFromCache ? suppressedPrimeLaunch(location.href) : null;
  removeLegacyPageDebugBufferOnce();
  const dependencies: ContentLifecycleDependencies = {
    detect: detectLifecycleResult,
    ensureStyles: ensurePageStyles,
    installKeyboardGuard: installMessageComposerKeyboardGuard,
    lookupPrimeRoom: getLivePrimeRoomSession,
    mount: (adapter, initialLaunch, initialPrimeRoom, initiallyDocked) =>
      mountOverlay(adapter, { initialLaunch, initialPrimeRoom, initiallyDocked }),
    startProviderStudy: startCrunchyrollStudyIfEnabled,
    ...overrides,
  };
  let mounted: MountedOverlay | null = null;
  let checkingLiveRoom = false;
  let startupRoom: LivePrimeRoomSession | null = null;
  let catalogAdapter: VideoAdapter | null = null;
  let lastPrimePlayerRoute: string | undefined;
  let verifiedPrimePlayerPath: string | undefined;
  let waitingForPrimeLaunch = false;
  let retryPrimeRecovery: VideoAdapter | null = null;
  let mountedRoomIntent: string | undefined;
  let pendingDismissal: Promise<void> | null = null;
  let disposed = false;
  let leavingDocument = false;
  const stopKeyboardGuard = dependencies.installKeyboardGuard();
  const stopProviderStudy = dependencies.startProviderStudy();
  dependencies.ensureStyles();

  let acceptedResume: { fingerprint: string; handoff: PrimeLaunchHandoff; ready: Promise<boolean> } | null = null;
  const mountWithLaunch = (adapter: VideoAdapter) => {
    const href = location.href;
    retryPrimeRecovery = null;
    const mountWaiting = () => {
      if (mounted) return;
      waitingForPrimeLaunch = true;
      const dismiss = preparePrimeRoomDismissal();
      mounted = dependencies.mount(adapter, {
        ...suppressedPrimeLaunch(href), waiting: true, blocksFragment: () => true,
        consumeRoom() {
          primeLaunch.dispose();
          pendingDismissal = dismiss();
        },
      });
    };
    // Show the primary player while identity is pending, without consuming a
    // captured invitation/Resume or trusting the current address-bar episode.
    if (adapter.provider === "primevideo" && adapter.getFingerprint() === "primevideo|unknown") {
      mountWaiting();
      return;
    }
    // Returning to a cached document is not a new invitation/Resume. A valid
    // background pending intent may recover, but the old fragment must not replay.
    const capturedLaunch = () => adapter.provider === "primevideo" && restoredLaunch?.blocksFragment?.(location.href)
      ? restoredLaunch
      : primeLaunch.handoff(adapter, location.href);
    const dismissal = pendingDismissal;
    const current = () => !disposed && manager.current === adapter && pendingDismissal === dismissal;
    if (adapter.provider === "primevideo" && typeof chrome !== "undefined" && typeof chrome.runtime?.sendMessage === "function") {
      // Listen for native Close even when the first SDK or background reply is slow.
      mountWaiting();
      const recover = () => recoverPrimeLaunch(adapter, current);
      const recovery = dismissal ? dismissal.then(recover) : recover();
      void recovery.catch(() => undefined).then(async recovered => {
        if (!current()) return;
        if (recovered === undefined) {
          retryPrimeRecovery = adapter;
          mountWaiting();
          return;
        }
        const fingerprint = adapter.getFingerprint();
        // A personal Resume is claimed once even if Prime replaces its video.
        if (recovered && recovered.commit && (acceptedResume?.fingerprint !== fingerprint || acceptedResume.handoff.intentId !== recovered.intentId)) {
          acceptedResume = { fingerprint, handoff: recovered, ready: recovered.commit() };
        }
        if (acceptedResume?.fingerprint === fingerprint && (!recovered || recovered.intentId === acceptedResume.handoff.intentId)) {
          const { ready, handoff } = acceptedResume;
          const ok = await ready.catch(() => false);
          if (!current()) return;
          recovered = ok ? handoff : false;
        }
        if (recovered === false || recovered?.rejected) primeLaunch.dispose();
        const launch = recovered === false ? suppressedPrimeLaunch(href) : recovered ?? capturedLaunch();
        // Keep the same overlay and in-flight admission through a video replacement.
        if (mounted && launch?.verifyRoom && launch.intentId === mountedRoomIntent) return;
        if ((waitingForPrimeLaunch || (launch && !launch.rejected)) && mounted) { mounted.dispose(); mounted = null; }
        waitingForPrimeLaunch = false;
        if (!mounted) {
          mounted = dependencies.mount(adapter, launch);
          mountedRoomIntent = launch?.verifyRoom ? launch.intentId : undefined;
        }
      });
    } else {
      const launch = capturedLaunch();
      if ((waitingForPrimeLaunch || launch) && mounted) { mounted.dispose(); mounted = null; }
      waitingForPrimeLaunch = false;
      if (!mounted) mounted = dependencies.mount(adapter, launch);
    }
  };

  const manager = new AdapterManager({
    detached(previous) {
      logDebug("content", "detach adapter", {
        adapterId: previous.id,
        fingerprint: previous.getFingerprint(),
        url: location.href,
      });
      mounted?.dispose(leavingDocument);
      mounted = null;
      mountedRoomIntent = undefined;
    },
    mounted(adapter) {
      logDebug("content", "mount adapter", {
        adapterId: adapter.id,
        fingerprint: adapter.getFingerprint(),
        container: elementDebugSnapshot(adapter.container),
        video: videoDebugSnapshot(adapter.video),
      });
      if (startupRoom) {
        mounted = dependencies.mount(adapter, null, startupRoom, adapter === catalogAdapter);
        startupRoom = null;
      } else {
        mountWithLaunch(adapter);
      }
    },
    relocated(adapter) {
      // Prime can reopen the very same element before discovery observes its
      // intervening Close. Re-enable this binding even when the player ID is equal.
      if (mounted?.isPrimeDocked?.()) mounted.replaceAdapter(adapter);
      else mounted?.relocate();
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
      if (!mounted?.hasPrimeRoom?.()) mountWithLaunch(next);
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

  const reconcile = (retryLaunch = true) => {
    primeLaunch.observe(location.href);
    if (checkingLiveRoom) return "idle";
    const detection = dependencies.detect(manager.current);
    const catalogRoute = isPrimeRoomBrowsingPage(location.href);
    const path = location.origin + location.pathname;
    const route = parsePrimePageUrl(location.href)?.token;
    if (detection.status === "ready" && detection.adapter.provider === "primevideo" &&
        detection.adapter.container.getAttribute(PRIME_PLAYER_STATE) !== "closed") {
      lastPrimePlayerRoute = route;
      if (!catalogRoute && route && verifiedPrimePlayerPath !== path && detection.adapter.getSourceDescriptor()?.provider === "primevideo")
        verifiedPrimePlayerPath = path;
    }
    const allowed = catalogRoute || Boolean(mounted?.hasPrimeRoom?.() && route && verifiedPrimePlayerPath === path);
    if (startupRoom && allowed && (detection.status !== "ready" ||
        detection.adapter.container.getAttribute(PRIME_PLAYER_STATE) === "closed")) {
      // No page video is needed for room UI. This unbound adapter never receives
      // player listeners, history, or playback control and cannot select a preview.
      catalogAdapter = new PrimeVideoAdapter(document.createElement("video"), document.createElement("div"));
      return manager.reconcile({ status: "ready", adapter: catalogAdapter });
    }
    if (mounted?.isPrimeDocked?.() && !mounted.hasPrimeRoom?.()) {
      manager.reconcile({ status: "blocked", provider: "primevideo" });
    }
    const closed = manager.current?.container.getAttribute(PRIME_PLAYER_STATE) === "closed";
    const samePlayerTransition = route && route === lastPrimePlayerRoute && !closed && !mounted?.isPrimeDocked?.();
    if (!allowed && !samePlayerTransition && manager.current?.provider === "primevideo" && detection.status !== "ready") {
      return manager.reconcile({ status: "blocked", provider: "primevideo" });
    }
    const primeRoom = manager.current?.provider === "primevideo" && mounted?.hasPrimeRoom?.() && allowed;
    const otherDetail = route && lastPrimePlayerRoute && route !== lastPrimePlayerRoute &&
      !manager.current?.container.isConnected && document.getElementById("dv-web-player")?.getAttribute(PRIME_PLAYER_STATE) !== "open";
    const browsingRoom = primeRoom && (detection.status !== "ready"
      ? (manager.current === catalogAdapter || closed || !route || otherDetail)
      : detection.adapter.container.getAttribute(PRIME_PLAYER_STATE) === "closed");
    const result = manager.reconcile((primeRoom && detection.status === "blocked") || browsingRoom
      ? { status: "waiting", provider: "primevideo" } : detection);
    if (browsingRoom) mounted?.dockPrimeRoom?.();
    if (retryLaunch && result === "relocated" && retryPrimeRecovery && manager.current === retryPrimeRecovery) {
      mountWithLaunch(retryPrimeRecovery);
    }
    return result;
  };

  let mountCheckFrame: number | null = null;
  const scheduleMountCheck = () => {
    primeLaunch.observe(location.href);
    if (disposed || mountCheckFrame !== null) {
      return;
    }

    mountCheckFrame = window.requestAnimationFrame(() => {
      mountCheckFrame = null;
      // A transient SDK/background failure retries on the existing backed-off poll.
      // Ordinary DOM mutations should not turn a busy player into a retry loop.
      reconcile(false);
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

  if (window.top === window && isPrimeRoomBrowsingPage(location.href) &&
      (overrides.lookupPrimeRoom || (typeof chrome !== "undefined" && typeof chrome.runtime?.sendMessage === "function"))) {
    checkingLiveRoom = true;
    void dependencies.lookupPrimeRoom().catch(() => null).then(record => {
      if (disposed) return;
      checkingLiveRoom = false;
      if (record && isPrimeRoomBrowsingPage(location.href)) {
        startupRoom = record;
        primeLaunch.dispose();
        discardConflictingPrimeLaunch(record.roomId, location.href);
      }
      reconcile();
    });
  } else {
    reconcile();
  }
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
  document.addEventListener(PRIME_BINDING_CHANGED, scheduleMountCheck);
  document.addEventListener("loadstart", handleVideoLifecycleEvent, true);
  document.addEventListener("loadedmetadata", handleVideoLifecycleEvent, true);
  document.addEventListener("emptied", handleVideoLifecycleEvent, true);
  const navigation = window.navigation;
  navigation?.addEventListener("currententrychange", scheduleMountCheck);
  window.addEventListener("popstate", scheduleMountCheck);
  window.addEventListener("hashchange", scheduleMountCheck);

  const handleFullscreenChange = () => mounted?.relocate();
  document.addEventListener("fullscreenchange", handleFullscreenChange);

  const dispose = (pageHidden = false) => {
    if (disposed) {
      return;
    }
    disposed = true;
    leavingDocument = pageHidden;
    primeLaunch.dispose();
    if (mountPollTimer !== null) {
      window.clearTimeout(mountPollTimer);
      mountPollTimer = null;
    }
    if (mountCheckFrame !== null) {
      window.cancelAnimationFrame(mountCheckFrame);
      mountCheckFrame = null;
    }
    videoObserver.disconnect();
    document.removeEventListener(PRIME_BINDING_CHANGED, scheduleMountCheck);
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
    stopKeyboardGuard();
    stopProviderStudy?.();
    // Deactivate synchronously before unmount so tutorial cleanup cannot resume
    // playback while pagehide still reports a visible document.
    mounted?.suspend();
    manager.dispose();
  };

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
    if (hostname === "www.netflix.com") return "netflix";
    if (parsePrimePageUrl(pageUrl)) return "primevideo";
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
  const releaseIntroductionGuard = installPlayerIntroductionKeyboardGuard();
  const releaseKeyboardRouter = installOverlayKeyboardRouter();
  const consumedKeys = new Set<string>();
  const netflixTypingKeys = new Set<string>();
  const isIsolatedProviderComposer = () => (location.hostname === "www.netflix.com" || !!parsePrimePageUrl(location.href)) && isComposerOpen();
  let releasePageGuard: (() => void) | undefined;
  const isComposerOpen = () =>
    document.documentElement.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] === "true";
  const keyId = (event: KeyboardEvent) => event.code || event.key;
  const consume = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.repeat && consumedKeys.has(keyId(event))) {
      consume(event);
      return;
    }
    if (isMessageComposerShortcutEvent(event) && !event.isComposing) {
      consumedKeys.add(keyId(event));
      releasePageGuard?.();
      releasePageGuard = setPageComposerGuard();
      consume(event);
      window.dispatchEvent(
        new CustomEvent(ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT),
      );
      return;
    }
    // Chrome can consume fullscreen Escape before page handlers. Netflix can
    // dismiss when Escape is delivered, without requesting Keyboard Lock.
    if (
      isComposerOpen() &&
      (event.key === "Escape" || event.key === "Esc") &&
      (!document.fullscreenElement || location.hostname === "www.netflix.com") &&
      !event.isComposing && event.keyCode !== 229
    ) {
      consumedKeys.add(keyId(event));
      consume(event);
      if (!event.repeat) {
        window.dispatchEvent(new CustomEvent(ANIDACHI_MESSAGE_COMPOSER_DISMISS_EVENT));
      }
      return;
    }
    if (isComposerOpen() && event.key === "Enter" && !event.shiftKey) {
      consumedKeys.add(keyId(event));
      // Let the IME finish its composition without submitting the message.
      event.stopImmediatePropagation();
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (!event.repeat) {
        window.dispatchEvent(
          new CustomEvent(ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT),
        );
      }
      return;
    }
    if (isIsolatedProviderComposer()) {
      // Netflix installs capture handlers above the overlay. Preserve native
      // text editing/default shortcuts while keeping those handlers quiet.
      netflixTypingKeys.add(keyId(event));
      event.stopImmediatePropagation();
    }
  };
  const handleKeyPress = (event: KeyboardEvent) => { if (isIsolatedProviderComposer()) event.stopImmediatePropagation(); };
  const handleKeyUp = (event: KeyboardEvent) => {
    // Submission removes the input before keyup; its new target can be the player.
    const wasConsumed = consumedKeys.delete(keyId(event));
    if (wasConsumed || (isComposerOpen() && event.key === "Enter"))
      consume(event);
    else if (netflixTypingKeys.delete(keyId(event)) || isIsolatedProviderComposer()) event.stopImmediatePropagation();
  };
  const clearConsumedKeys = () => { consumedKeys.clear(); netflixTypingKeys.clear(); };
  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("keyup", handleKeyUp, true);
  window.addEventListener("keypress", handleKeyPress, true);
  window.addEventListener("blur", clearConsumedKeys);
  return () => {
    releaseIntroductionGuard();
    releaseKeyboardRouter();
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("keyup", handleKeyUp, true);
    window.removeEventListener("keypress", handleKeyPress, true);
    window.removeEventListener("blur", clearConsumedKeys);
    releasePageGuard?.();
    clearConsumedKeys();
  };
}

function setPageComposerGuard(): () => void {
  const targets = [
    document.documentElement,
    ...document.querySelectorAll<HTMLElement>(
      '[data-anidachi-fullscreen-target="true"][data-anidachi-adapter="crunchyroll"]',
    ),
  ];
  for (const target of targets)
    target.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] = "guard";
  const release = () => {
    for (const target of targets) {
      if (target.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] === "guard") {
        delete target.dataset[ANIDACHI_COMPOSER_OPEN_ATTR];
      }
    }
  };
  const timer = window.setTimeout(release, 1400);
  return () => {
    window.clearTimeout(timer);
    release();
  };
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

  const shadow = host.attachShadow({ mode: "closed" });
  const appRoot = document.createElement("div");
  shadow.append(appRoot);
  let primeRoomId: string | null = null;
  let restoringRoom = Boolean(options.initialPrimeRoom);
  let docked = false;
  const lostPrimeRoom = () => {
    restoringRoom = false;
    if (docked) {
      host.remove();
      document.dispatchEvent(new Event(PRIME_BINDING_CHANGED));
    }
  };
  const renderer = options.renderer ?? createReactOverlayRenderer(appRoot, options, room => {
    const previous = primeRoomId;
    primeRoomId = room;
    if (room) {
      restoringRoom = false;
      if (docked && !host.isConnected) document.documentElement.append(host);
    } else if (previous) lostPrimeRoom();
  }, () => dockPrimeRoom(), lostPrimeRoom);

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

    docked = false;
    host.style.position = "absolute";
    adapterBindingActive = true;
    markAdapter(adapter);
    startAdapterDebugProbe();
    addAdapterListeners(adapter);
    renderOverlay(true);
    relocate();
  };

  window.addEventListener("resize", scheduleRelocate);
  window.addEventListener("scroll", scheduleRelocate, true);
  if (options.initiallyDocked) dockPrimeRoom();
  else activateAdapterBinding();

  function dockPrimeRoom() {
    if (disposed || (!primeRoomId && !restoringRoom) || adapter.provider !== "primevideo" || docked) return;
    deactivateAdapterBinding();
    docked = true;
    Object.assign(host.style, { position: "fixed", inset: "0", width: "100%", height: "100%", borderRadius: "0" });
    if (primeRoomId) document.documentElement.append(host);
    renderer.render(adapter, false, true);
  }
  return {
    hasPrimeRoom: () => primeRoomId !== null || restoringRoom,
    isPrimeDocked: () => docked,
    dockPrimeRoom,
    get adapter() {
      return adapter;
    },
    relocate: scheduleRelocate,
    replaceAdapter(nextAdapter: VideoAdapter) {
      if (disposed) {
        return;
      }
      deactivateAdapterBinding();
      if (!docked) renderOverlay(false);
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
    dispose(leavingDocument = false) {
      if (disposed) {
        return;
      }
      deactivateAdapterBinding();
      disposed = true;
      window.removeEventListener("resize", scheduleRelocate);
      window.removeEventListener("scroll", scheduleRelocate, true);
      renderer.unmount(leavingDocument);
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

function createReactOverlayRenderer(appRoot: HTMLElement, options: MountOverlayOptions,
  onPrimeRoomChange: (room: string | null) => void, onPrimeClose: () => void, onPrimeRestoreLost: () => void): OverlayRenderer {
  const root: Root = createRoot(appRoot);
  let leavingDocument = false;
  const preservePrimeRoomOnUnmount = () => leavingDocument;
  return {
    render(adapter, active, browsing) {
      flushSync(() => {
        root.render(<OverlayApp adapter={adapter} adapterActive={active} primeBrowsing={browsing}
          onPrimeRoomChange={onPrimeRoomChange} onPrimeClose={onPrimeClose} onPrimeRestoreLost={onPrimeRestoreLost}
          initialPrimeLaunch={options.initialLaunch} initialPrimeRoom={options.initialPrimeRoom}
          preservePrimeRoomOnUnmount={preservePrimeRoomOnUnmount} />);
      });
    },
    unmount(pageHidden = false) {
      leavingDocument = pageHidden;
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
    ${YOUTUBE_COMPOSER_CHROME_STYLES}
    ${NETFLIX_COMPOSER_CHROME_STYLES}
    ${PRIME_COMPOSER_CHROME_STYLES}

    [data-anidachi-adapter="generic-html5-video"] video[data-anidachi-video="true"]::-webkit-media-controls-fullscreen-button {
      display: none !important;
    }

    [data-anidachi-fullscreen-target="true"]:fullscreen {
      background: #000 !important;
    }

    [data-anidachi-adapter="youtube"] anidachi-overlay-root,
    [data-anidachi-adapter="crunchyroll"] anidachi-overlay-root,
    [data-anidachi-adapter="netflix"] anidachi-overlay-root,
    [data-anidachi-adapter="primevideo"] anidachi-overlay-root {
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
