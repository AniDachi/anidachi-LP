import { defineContentScript } from "wxt/utils/define-content-script";
import {
  CRUNCHYROLL_CONTROL_RESULT_SOURCE,
  CRUNCHYROLL_CONTROL_SOURCE,
  getCrunchyrollTimelineValueForTime,
  type CrunchyrollControlRequest,
  type CrunchyrollControlResult,
  type CrunchyrollTimelineSnapshot,
  type CrunchyrollVideoSnapshot,
} from "../src/crunchyroll-control";
import {
  getCrunchyrollRelatedSeriesId,
  selectCrunchyrollPosterTall,
} from "../src/crunchyroll-artwork-select";

export default defineContentScript({
  matches: ["https://*.crunchyroll.com/*"],
  allFrames: false,
  runAt: "document_start",
  world: "MAIN",
  main() {
    startCrunchyrollControlBridge();
  },
});

const ANIDACHI_BITMOVIN_ISSUER = "anidachi";
const BITMOVIN_PATCH_FLAG = "__anidachiBitmovinPatched";
const BITMOVIN_CAPTURE_WINDOW_MS = 20_000;
const CRUNCHYROLL_AUTH_CLIENT_ID = "noaihdevm_6iyg0a8l0q";

let contentToken: { value: string; expiresAt: number } | null = null;

type BitmovinPlayerMethod = (...args: unknown[]) => unknown;

interface BitmovinLikePlayer {
  getContainer?: () => HTMLElement | null;
  getCurrentTime?: () => number;
  getVideoElement?: () => HTMLVideoElement | null;
  isPaused?: () => boolean;
  isPlaying?: () => boolean;
  pause?: (issuer?: string) => void;
  play?: (issuer?: string) => Promise<void>;
  seek?: (time: number, issuer?: string) => boolean;
}

interface CrunchyrollKatamariPlayer {
  pause?: () => void;
  play?: () => Promise<void> | void;
  seek?: (time: number) => void;
  seekToContentTime?: (time: number) => void;
  seekToStreamTime?: (time: number) => void;
  seekToTimelineTime?: (time: number) => void;
  playerOrchestrator?: {
    seekOrchestrator?: {
      playerStateMachine?: {
        getCurrentState?: () => string;
      };
    };
  };
}

interface BitmovinPlayerConstructor {
  new (...args: unknown[]): BitmovinLikePlayer;
  prototype: Record<string, unknown>;
  [BITMOVIN_PATCH_FLAG]?: boolean;
}

interface BitmovinNamespace {
  player?: {
    Player?: BitmovinPlayerConstructor;
  };
}

function startCrunchyrollControlBridge(): void {
  if (window.__anidachiCrunchyrollControlBridgeStarted) {
    return;
  }
  window.__anidachiCrunchyrollControlBridgeStarted = true;
  startBitmovinPlayerCapture();

  window.addEventListener("message", (event: MessageEvent) => {
    if ((event.source && event.source !== window) || !isControlRequest(event.data)) {
      return;
    }

    void handleControlRequest(event.data);
  });
}

async function handleControlRequest(request: CrunchyrollControlRequest): Promise<void> {
  if (request.action === "navigate") {
    await handleNavigateRequest(request);
    return;
  }

  if (request.action === "seriesPoster") {
    await handleSeriesPosterRequest(request);
    return;
  }

  const video = findBestVideo();
  if (!video) {
    postResult({
      action: request.action,
      error: "NO_VIDEO",
      id: request.id,
      ok: false,
      source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
    });
    return;
  }

  try {
    let method: string | undefined;
    let timeline: CrunchyrollTimelineSnapshot | null = null;
    const katamariPlayer = findKatamariPlayer(video);
    const player = findCapturedBitmovinPlayer(video);

    if (request.action === "play") {
      let playResult = playWithKatamariPlayer(katamariPlayer);
      if (!playResult.ok) {
        playResult = playWithBitmovinPlayer(player);
      }
      method = playResult.method;
      if (playResult.ok) {
        playResult.promise?.catch((error) => {
          postResult({
            action: request.action,
            error: error instanceof Error ? error.message : String(error),
            id: request.id,
            method,
            ok: false,
            source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
            video: videoSnapshot(video),
          });
        });
      } else {
        const playPromise = video.play();
        method = "media-element-play";
        playPromise.catch((error) => {
          postResult({
            action: request.action,
            error: error instanceof Error ? error.message : String(error),
            id: request.id,
            method,
            ok: false,
            source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
            video: videoSnapshot(video),
          });
        });
      }
    } else if (request.action === "pause") {
      let pauseResult = pauseWithKatamariPlayer(katamariPlayer);
      if (!pauseResult.ok) {
        pauseResult = pauseWithBitmovinPlayer(player);
      }
      method = pauseResult.method;
      if (!pauseResult.ok) {
        video.pause();
        method = "media-element-pause";
      }
    } else if (request.action === "seek") {
      const target = clampMediaTime(request.time ?? 0, video.duration);
      let seekResult = await seekWithKatamariPlayer(katamariPlayer, video, target);
      if (!seekResult.ok) {
        seekResult = await seekWithBitmovinPlayer(player, video, target);
      }
      if (!seekResult.ok) {
        const timelineSeekResult = await seekWithTimelineInput(video, target);
        seekResult = {
          ...(timelineSeekResult.error ? { error: timelineSeekResult.error } : {}),
          method: `${seekResult.method}+${timelineSeekResult.method}`,
          ok: timelineSeekResult.ok,
        };
      }
      if (!seekResult.ok) {
        seekResult = {
          error: seekResult.error ?? "CRUNCHYROLL_SEEK_DID_NOT_APPLY",
          method: `${seekResult.method}+media-element-disabled`,
          ok: false,
        };
      }
      method = seekResult.method;
      timeline = snapshotTimelineInput();
      if (!seekResult.ok) {
        postResult({
          action: request.action,
          error: seekResult.error,
          id: request.id,
          method,
          ok: false,
          source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
          timeline,
          video: videoSnapshot(video),
        });
        return;
      }
    }

    postResult({
      action: request.action,
      id: request.id,
      method,
      ok: true,
      source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
      timeline,
      video: videoSnapshot(video),
    });
  } catch (error) {
    postResult({
      action: request.action,
      error: error instanceof Error ? error.message : String(error),
      id: request.id,
      ok: false,
      source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
      video: videoSnapshot(video),
    });
  }
}

function isControlRequest(value: unknown): value is CrunchyrollControlRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CrunchyrollControlRequest>;
  return (
    candidate.source === CRUNCHYROLL_CONTROL_SOURCE &&
    typeof candidate.id === "string" &&
    (candidate.action === "play" ||
      candidate.action === "pause" ||
      candidate.action === "seek" ||
      candidate.action === "snapshot" ||
      candidate.action === "navigate" ||
      candidate.action === "seriesPoster")
  );
}

function postResult(result: CrunchyrollControlResult): void {
  window.postMessage(result, "*");
}

async function handleSeriesPosterRequest(request: CrunchyrollControlRequest): Promise<void> {
  const primaryObjectId = request.seriesId ?? request.contentId;
  if (!primaryObjectId) {
    postResult({
      action: request.action,
      error: "INVALID_POSTER_OBJECT_ID",
      id: request.id,
      ok: false,
      source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
    });
    return;
  }

  try {
    const token = await getCrunchyrollContentToken();
    if (!token) {
      postResult({
        action: request.action,
        error: "NO_CONTENT_TOKEN",
        id: request.id,
        ok: false,
        source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
      });
      return;
    }

    const primaryObject = await loadCrunchyrollCmsObject(
      primaryObjectId,
      token,
      request.locale || getCrunchyrollLocale(),
    );
    if (!primaryObject.ok) {
      postResult({
        action: request.action,
        error: primaryObject.error,
        id: request.id,
        ok: false,
        source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
      });
      return;
    }

    const directPosterUrl = selectCrunchyrollPosterTall(primaryObject.value);
    const relatedSeriesId = directPosterUrl
      ? null
      : getCrunchyrollRelatedSeriesId(primaryObject.value);
    const posterUrl =
      directPosterUrl ??
      (relatedSeriesId
        ? selectCrunchyrollPosterTall(
            (
              await loadCrunchyrollCmsObject(
                relatedSeriesId,
                token,
                request.locale || getCrunchyrollLocale(),
              )
            ).value,
          )
        : null);
    postResult({
      action: request.action,
      ...(posterUrl ? {} : { error: "NO_POSTER_TALL" }),
      id: request.id,
      ok: Boolean(posterUrl),
      posterUrl,
      source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
    });
  } catch (error) {
    postResult({
      action: request.action,
      error: error instanceof Error ? error.message : String(error),
      id: request.id,
      ok: false,
      source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
    });
  }
}

async function loadCrunchyrollCmsObject(
  objectId: string,
  token: string,
  locale: string,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string; value?: undefined }> {
  const response = await fetch(
    getCrunchyrollApiUrl(
      `/content/v2/cms/objects/${encodeURIComponent(
        objectId,
      )}?ratings=true&preferred_audio_language=en-US&locale=${encodeURIComponent(locale)}`,
    ),
    {
      credentials: "include",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
  if (!response.ok) {
    return { error: `CMS_${response.status}`, ok: false };
  }

  return { ok: true, value: await response.json() };
}

async function getCrunchyrollContentToken(): Promise<string | null> {
  const now = Date.now();
  if (contentToken && contentToken.expiresAt > now + 30_000) {
    return contentToken.value;
  }

  const response = await fetch(getCrunchyrollApiUrl("/auth/v1/token"), {
    method: "POST",
    credentials: "include",
    headers: {
      authorization: `Basic ${btoa(`${CRUNCHYROLL_AUTH_CLIENT_ID}:`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_id" }),
  });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof data.access_token !== "string") {
    return null;
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  contentToken = {
    value: data.access_token,
    expiresAt: now + Math.max(60, expiresIn - 60) * 1000,
  };
  return contentToken.value;
}

function getCrunchyrollLocale(): string {
  if (document.documentElement.lang) {
    return document.documentElement.lang;
  }

  return navigator.language || "en-US";
}

function getCrunchyrollApiUrl(path: string): string {
  return new URL(path, location.origin).toString();
}

async function handleNavigateRequest(request: CrunchyrollControlRequest): Promise<void> {
  const target = parseCrunchyrollTarget(request.url);
  if (!target) {
    postResult({
      action: request.action,
      currentUrl: location.href,
      error: "INVALID_TARGET_URL",
      id: request.id,
      ok: false,
      source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
      video: maybeVideoSnapshot(),
    });
    return;
  }

  if (isSameCrunchyrollRoute(target)) {
    postResult({
      action: request.action,
      currentUrl: location.href,
      id: request.id,
      method: "already-at-target",
      ok: true,
      source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
      video: maybeVideoSnapshot(),
    });
    return;
  }

  const beforeUrl = location.href;
  const beforeVideo = findBestVideo();
  const beforeCurrentSrc = beforeVideo?.currentSrc ?? "";
  const routeLink = findCrunchyrollRouteLink(target);
  if (routeLink) {
    clickElement(routeLink);
    const ok = await waitForCrunchyrollRoute(
      target,
      beforeUrl,
      beforeVideo,
      beforeCurrentSrc,
      4800,
    );
    postResult({
      action: request.action,
      currentUrl: location.href,
      id: request.id,
      method: "route-link-click",
      ok,
      source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
      ...(ok ? {} : { error: "ROUTE_LINK_DID_NOT_NAVIGATE" }),
      video: maybeVideoSnapshot(),
    });
    return;
  }

  const nextButton = findCrunchyrollNextEpisodeButton();
  if (nextButton) {
    clickElement(nextButton);
    const ok = await waitForCrunchyrollRoute(
      target,
      beforeUrl,
      beforeVideo,
      beforeCurrentSrc,
      4800,
    );
    postResult({
      action: request.action,
      currentUrl: location.href,
      id: request.id,
      method: "next-episode-click",
      ok,
      source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
      ...(ok ? {} : { error: "NEXT_BUTTON_DID_NOT_REACH_TARGET" }),
      video: maybeVideoSnapshot(),
    });
    return;
  }

  postResult({
    action: request.action,
    currentUrl: location.href,
    error: "NO_SEAMLESS_NAVIGATION_TARGET",
    id: request.id,
    ok: false,
    source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
    video: maybeVideoSnapshot(),
  });
}

function parseCrunchyrollTarget(url: string | undefined): URL | null {
  if (!url) {
    return null;
  }

  try {
    const target = new URL(url, location.href);
    if (target.origin !== location.origin || !target.hostname.endsWith("crunchyroll.com")) {
      return null;
    }

    if (!target.pathname.includes("/watch/")) {
      return null;
    }

    return target;
  } catch {
    return null;
  }
}

function isSameCrunchyrollRoute(target: URL): boolean {
  return location.pathname === target.pathname && location.search === target.search;
}

function findCrunchyrollRouteLink(target: URL): HTMLAnchorElement | null {
  const targetPath = normalizeRoutePath(target.pathname);
  const targetSearch = target.search;
  const targetWatchId = getCrunchyrollWatchId(target.pathname);
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));

  return (
    links.find((link) => {
      const href = parseAnchorHref(link);
      return (
        href && normalizeRoutePath(href.pathname) === targetPath && href.search === targetSearch
      );
    }) ??
    links.find((link) => {
      const href = parseAnchorHref(link);
      return Boolean(
        href && targetWatchId && getCrunchyrollWatchId(href.pathname) === targetWatchId,
      );
    }) ??
    null
  );
}

function parseAnchorHref(link: HTMLAnchorElement): URL | null {
  try {
    const url = new URL(link.href, location.href);
    return url.origin === location.origin ? url : null;
  } catch {
    return null;
  }
}

function normalizeRoutePath(pathname: string): string {
  return pathname.replace(/\/$/, "");
}

function getCrunchyrollWatchId(pathname: string): string | null {
  return pathname.match(/\/watch\/([^/?#]+)/)?.[1] ?? null;
}

function findCrunchyrollNextEpisodeButton(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    [
      "[data-testid='next-episode-button']",
      "[aria-label*='Next Episode' i]",
      "[aria-label*='Следующая' i]",
      "[aria-label*='следующ' i]",
      "button[class*='next' i]",
    ].join(", "),
  );
}

function clickElement(element: HTMLElement): void {
  element.dispatchEvent(
    new MouseEvent("mouseover", { bubbles: true, cancelable: true, composed: true }),
  );
  element.dispatchEvent(
    new MouseEvent("mousemove", { bubbles: true, cancelable: true, composed: true }),
  );
  element.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      button: 0,
      buttons: 1,
      cancelable: true,
      composed: true,
    }),
  );
  element.dispatchEvent(
    new MouseEvent("mouseup", {
      bubbles: true,
      button: 0,
      buttons: 0,
      cancelable: true,
      composed: true,
    }),
  );
  element.click();
}

async function waitForCrunchyrollRoute(
  target: URL,
  beforeUrl: string,
  beforeVideo: HTMLVideoElement | null,
  beforeCurrentSrc: string,
  timeoutMs: number,
  options: { requireMediaTransition?: boolean } = {},
): Promise<boolean> {
  const startedAt = Date.now();
  let sawMediaTransition = false;

  while (Date.now() - startedAt < timeoutMs) {
    const video = findBestVideo();
    const currentUrl = location.href;
    const routeMatches = isSameCrunchyrollRoute(target);
    const urlChanged = currentUrl !== beforeUrl;
    const videoChanged = Boolean(video && beforeVideo && video !== beforeVideo);
    const currentSrcChanged = Boolean(
      video && beforeCurrentSrc && video.currentSrc && video.currentSrc !== beforeCurrentSrc,
    );
    const mediaTransitioning = Boolean(
      video &&
        (video.readyState < HTMLMediaElement.HAVE_METADATA ||
          video.networkState === video.NETWORK_LOADING),
    );

    sawMediaTransition ||=
      videoChanged || currentSrcChanged || (routeMatches && mediaTransitioning);
    if (
      routeMatches &&
      urlChanged &&
      (sawMediaTransition || (!options.requireMediaTransition && Date.now() - startedAt > 1400))
    ) {
      return true;
    }

    await delay(80);
  }

  return isSameCrunchyrollRoute(target) && (!options.requireMediaTransition || sawMediaTransition);
}

function maybeVideoSnapshot(): CrunchyrollVideoSnapshot | undefined {
  const video = findBestVideo();
  return video ? videoSnapshot(video) : undefined;
}

function startBitmovinPlayerCapture(): void {
  if (window.__anidachiCrunchyrollBitmovinCaptureStarted) {
    return;
  }

  window.__anidachiCrunchyrollBitmovinCaptureStarted = true;
  window.__anidachiCrunchyrollBitmovinPlayers ??= [];

  installBitmovinNamespaceSetter();
  patchBitmovinNamespace(window.bitmovin);

  const startedAt = Date.now();
  const interval = window.setInterval(() => {
    patchBitmovinNamespace(window.bitmovin);
    if (Date.now() - startedAt > BITMOVIN_CAPTURE_WINDOW_MS) {
      window.clearInterval(interval);
    }
  }, 100);
}

function installBitmovinNamespaceSetter(): void {
  const descriptor = Object.getOwnPropertyDescriptor(window, "bitmovin");
  if (descriptor && (!descriptor.configurable || descriptor.get || descriptor.set)) {
    return;
  }

  let currentNamespace = window.bitmovin;
  try {
    Object.defineProperty(window, "bitmovin", {
      configurable: true,
      enumerable: true,
      get() {
        return currentNamespace;
      },
      set(value: BitmovinNamespace | undefined) {
        currentNamespace = value;
        patchBitmovinNamespace(value);
      },
    });
  } catch {
    // Polling below still gives us a chance to patch before player construction.
  }
}

function patchBitmovinNamespace(namespace: BitmovinNamespace | undefined): void {
  const playerNamespace = namespace?.player;
  const Player = playerNamespace?.Player;
  if (!Player || Player[BITMOVIN_PATCH_FLAG]) {
    return;
  }

  patchBitmovinPrototype(Player.prototype);

  const WrappedPlayer = new Proxy(Player, {
    construct(target, args, newTarget) {
      const player = Reflect.construct(target, args, newTarget) as BitmovinLikePlayer;
      rememberBitmovinPlayer(player);
      return player;
    },
  }) as BitmovinPlayerConstructor;

  WrappedPlayer[BITMOVIN_PATCH_FLAG] = true;
  try {
    playerNamespace.Player = WrappedPlayer;
  } catch {
    Player[BITMOVIN_PATCH_FLAG] = true;
  }
}

function patchBitmovinPrototype(prototype: Record<string, unknown>): void {
  for (const methodName of ["play", "pause", "seek"] as const) {
    const original = prototype[methodName];
    if (typeof original !== "function") {
      continue;
    }

    const originalMethod = original as BitmovinPlayerMethod & {
      [BITMOVIN_PATCH_FLAG]?: boolean;
    };
    if (originalMethod[BITMOVIN_PATCH_FLAG]) {
      continue;
    }

    const wrappedMethod = function bitmovinMethodCapture(
      this: BitmovinLikePlayer,
      ...args: unknown[]
    ) {
      rememberBitmovinPlayer(this);
      return originalMethod.apply(this, args);
    } as BitmovinPlayerMethod & { [BITMOVIN_PATCH_FLAG]?: boolean };

    wrappedMethod[BITMOVIN_PATCH_FLAG] = true;
    try {
      prototype[methodName] = wrappedMethod;
    } catch {
      // Constructor capture still covers the normal Crunchyroll player boot path.
    }
  }
}

function rememberBitmovinPlayer(player: BitmovinLikePlayer): void {
  window.__anidachiCrunchyrollBitmovinPlayers ??= [];
  const players = window.__anidachiCrunchyrollBitmovinPlayers;
  if (!players.includes(player)) {
    players.unshift(player);
  }

  if (players.length > 8) {
    players.length = 8;
  }
}

function findCapturedBitmovinPlayer(video: HTMLVideoElement): BitmovinLikePlayer | null {
  const players = window.__anidachiCrunchyrollBitmovinPlayers ?? [];

  for (const player of players) {
    if (getBitmovinVideoElement(player) === video) {
      return player;
    }
  }

  for (const player of players) {
    const container = getBitmovinContainer(player);
    if (container?.contains(video)) {
      return player;
    }
  }

  return players.find(isUsableBitmovinPlayer) ?? null;
}

function isUsableBitmovinPlayer(player: BitmovinLikePlayer): boolean {
  return (
    typeof player.play === "function" ||
    typeof player.pause === "function" ||
    typeof player.seek === "function"
  );
}

function playWithKatamariPlayer(player: CrunchyrollKatamariPlayer | null): {
  method: string;
  ok: boolean;
  promise?: Promise<void>;
} {
  if (typeof player?.play !== "function") {
    return { method: "katamari-player-unavailable", ok: false };
  }

  try {
    const result = player.play();
    return {
      method: "katamari-player-play",
      ok: true,
      promise: result instanceof Promise ? result : undefined,
    };
  } catch {
    return { method: "katamari-player-play-error", ok: false };
  }
}

function playWithBitmovinPlayer(player: BitmovinLikePlayer | null): {
  method: string;
  ok: boolean;
  promise?: Promise<void>;
} {
  if (typeof player?.play !== "function") {
    return { method: "bitmovin-player-unavailable", ok: false };
  }

  try {
    const promise = player.play(ANIDACHI_BITMOVIN_ISSUER);
    return { method: "bitmovin-player-play", ok: true, promise };
  } catch {
    return { method: "bitmovin-player-play-error", ok: false };
  }
}

function pauseWithKatamariPlayer(player: CrunchyrollKatamariPlayer | null): {
  method: string;
  ok: boolean;
} {
  if (typeof player?.pause !== "function") {
    return { method: "katamari-player-unavailable", ok: false };
  }

  try {
    player.pause();
    return { method: "katamari-player-pause", ok: true };
  } catch {
    return { method: "katamari-player-pause-error", ok: false };
  }
}

function pauseWithBitmovinPlayer(player: BitmovinLikePlayer | null): {
  method: string;
  ok: boolean;
} {
  if (typeof player?.pause !== "function") {
    return { method: "bitmovin-player-unavailable", ok: false };
  }

  try {
    player.pause(ANIDACHI_BITMOVIN_ISSUER);
    return { method: "bitmovin-player-pause", ok: true };
  } catch {
    return { method: "bitmovin-player-pause-error", ok: false };
  }
}

async function seekWithKatamariPlayer(
  player: CrunchyrollKatamariPlayer | null,
  video: HTMLVideoElement,
  target: number,
): Promise<{ error?: string; method: string; ok: boolean }> {
  if (!player) {
    return { error: "NO_KATAMARI_PLAYER", method: "katamari-player-unavailable", ok: false };
  }

  const state = getKatamariPlayerState(player);
  if (state && !isKatamariSeekingAllowed(state)) {
    return {
      error: `KATAMARI_SEEK_NOT_ALLOWED:${state}`,
      method: "katamari-player-seek-not-allowed",
      ok: false,
    };
  }

  try {
    if (typeof player.seekToStreamTime === "function") {
      player.seekToStreamTime(target);
      const ok = await waitForMediaTime(video, target, 900);
      return ok
        ? { method: "katamari-player-seek-stream", ok: true }
        : {
            error: "KATAMARI_STREAM_SEEK_DID_NOT_APPLY",
            method: "katamari-player-seek-stream",
            ok: false,
          };
    }

    if (typeof player.seek === "function") {
      player.seek(target);
      const ok = await waitForMediaTime(video, target, 900);
      return ok
        ? { method: "katamari-player-seek-content", ok: true }
        : {
            error: "KATAMARI_CONTENT_SEEK_DID_NOT_APPLY",
            method: "katamari-player-seek-content",
            ok: false,
          };
    }

    return { error: "NO_KATAMARI_SEEK_METHOD", method: "katamari-player-unavailable", ok: false };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      method: "katamari-player-seek-error",
      ok: false,
    };
  }
}

async function seekWithBitmovinPlayer(
  player: BitmovinLikePlayer | null,
  video: HTMLVideoElement,
  target: number,
): Promise<{ error?: string; method: string; ok: boolean }> {
  if (typeof player?.seek !== "function") {
    return { error: "NO_BITMOVIN_PLAYER", method: "bitmovin-player-unavailable", ok: false };
  }

  try {
    const ok = player.seek(target, ANIDACHI_BITMOVIN_ISSUER);
    const applied = ok && (await waitForMediaTime(video, target, 900));
    return applied
      ? { method: "bitmovin-player-seek", ok }
      : { error: "BITMOVIN_SEEK_REJECTED", method: "bitmovin-player-seek", ok: false };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      method: "bitmovin-player-seek-error",
      ok: false,
    };
  }
}

function getBitmovinVideoElement(player: BitmovinLikePlayer): HTMLVideoElement | null {
  try {
    return player.getVideoElement?.() ?? null;
  } catch {
    return null;
  }
}

function getBitmovinContainer(player: BitmovinLikePlayer): HTMLElement | null {
  try {
    return player.getContainer?.() ?? null;
  } catch {
    return null;
  }
}

async function seekWithTimelineInput(
  video: HTMLVideoElement,
  target: number,
): Promise<{ error?: string; method: string; ok: boolean }> {
  const input = findTimelineInput();
  if (!input) {
    return { error: "NO_TIMELINE_INPUT", method: "timeline-input-unavailable", ok: false };
  }

  const beforeTime = video.currentTime;
  const beforeSeeking = video.seeking;
  const beforeTimeline = timelineSnapshot(input);
  const min = Number(input.min || input.getAttribute("aria-valuemin") || 0);
  const max = Number(input.max || input.getAttribute("aria-valuemax") || 0);
  const timelineValue = getCrunchyrollTimelineValueForTime(
    target,
    Number.isFinite(video.duration) ? video.duration : null,
    min,
    max,
  );

  try {
    dispatchTimelinePointerGesture(input, timelineValue, min, max);
    setNativeInputValue(input, String(timelineValue));
    input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      method: "timeline-input-error",
      ok: false,
    };
  }

  await delay(320);

  const currentTimeMoved = !isNearMediaTime(video.currentTime, beforeTime, 0.15);
  const movedTowardTarget =
    Math.abs(video.currentTime - target) < Math.abs(beforeTime - target) - 0.25;
  const newSeekStarted = !beforeSeeking && video.seeking;
  const ok =
    isNearMediaTime(video.currentTime, target, 1.25) ||
    (newSeekStarted && currentTimeMoved && movedTowardTarget);
  const timelineChanged = !isNearMediaTime(Number(input.value), Number(beforeTimeline.value), 0.15);
  const method = timelineChanged ? "timeline-input" : "timeline-input-noop";

  return ok
    ? { method, ok }
    : {
        error: currentTimeMoved
          ? "TIMELINE_SEEK_MOVED_TO_WRONG_TIME"
          : "TIMELINE_SEEK_DID_NOT_APPLY",
        method,
        ok,
      };
}

function dispatchTimelinePointerGesture(
  input: HTMLInputElement,
  timelineValue: number,
  min: number,
  max: number,
): void {
  const rect = input.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(max) || max <= min) {
    return;
  }

  const ratio = Math.max(0, Math.min(1, (timelineValue - min) / (max - min)));
  const clientX = rect.left + rect.width * ratio;
  const clientY = rect.top + rect.height / 2;
  const target = input.closest("[data-testid='timeline-controls-container']") ?? input;
  const baseMouseEvent = {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    composed: true,
  };

  if (typeof PointerEvent === "function") {
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        ...baseMouseEvent,
        button: 0,
        buttons: 1,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    target.dispatchEvent(
      new PointerEvent("pointermove", {
        ...baseMouseEvent,
        button: 0,
        buttons: 1,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  }

  target.dispatchEvent(new MouseEvent("mousedown", { ...baseMouseEvent, button: 0, buttons: 1 }));
  target.dispatchEvent(new MouseEvent("mousemove", { ...baseMouseEvent, button: 0, buttons: 1 }));
  target.dispatchEvent(new MouseEvent("mouseup", { ...baseMouseEvent, button: 0, buttons: 0 }));

  if (typeof PointerEvent === "function") {
    target.dispatchEvent(
      new PointerEvent("pointerup", {
        ...baseMouseEvent,
        button: 0,
        buttons: 0,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  }

  target.dispatchEvent(new MouseEvent("click", { ...baseMouseEvent, button: 0, buttons: 0 }));
}

function findTimelineInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(
    [
      "input.timeline-slider[type='range']",
      "[data-testid='timeline-controls-container'] input[type='range']",
      "[data-testid='player-controls-root'] input[type='range']",
      "input[type='range'][aria-valuemax]",
    ].join(", "),
  );
}

function snapshotTimelineInput(): CrunchyrollTimelineSnapshot | null {
  const input = findTimelineInput();
  return input ? timelineSnapshot(input) : null;
}

function timelineSnapshot(input: HTMLInputElement): CrunchyrollTimelineSnapshot {
  return {
    ariaValueMax: input.getAttribute("aria-valuemax"),
    ariaValueMin: input.getAttribute("aria-valuemin"),
    ariaValueNow: input.getAttribute("aria-valuenow"),
    max: input.max,
    min: input.min,
    value: input.value,
  };
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(input, value);
    return;
  }

  input.value = value;
}

function findKatamariPlayer(video: HTMLVideoElement): CrunchyrollKatamariPlayer | null {
  const roots = [
    findAncestor(video, "#player-container"),
    findAncestor(video, ".video-player-wrapper"),
    document.querySelector("[data-testid='player-controls-root']"),
    video,
  ].filter((root): root is Element => root instanceof Element);

  for (const root of roots) {
    const player = findKatamariPlayerFromReactNode(root);
    if (player) {
      return player;
    }
  }

  return null;
}

function findKatamariPlayerFromReactNode(root: Element): CrunchyrollKatamariPlayer | null {
  for (const key of Reflect.ownKeys(root)) {
    const keyName = String(key);
    if (!keyName.startsWith("__reactFiber") && !keyName.startsWith("__reactProps")) {
      continue;
    }

    let node = readObjectProperty(root, key);
    const seen = new Set<object>();
    for (let depth = 0; isRecord(node) && depth < 40 && !seen.has(node); depth += 1) {
      seen.add(node);
      const player =
        readKatamariPlayer(node) ??
        readKatamariPlayer(readObjectProperty(node, "stateNode")) ??
        readKatamariPlayer(readObjectProperty(node, "memoizedProps")) ??
        readKatamariPlayer(readObjectProperty(node, "memoizedState"));
      if (player) {
        return player;
      }

      node = readObjectProperty(node, "return");
    }
  }

  return null;
}

function readKatamariPlayer(value: unknown): CrunchyrollKatamariPlayer | null {
  if (!isRecord(value)) {
    return null;
  }

  const direct = readObjectProperty(value, "_katamariPlayer");
  if (isKatamariPlayer(direct)) {
    return direct;
  }

  const nestedPlayer = readObjectProperty(value, "player");
  if (isRecord(nestedPlayer)) {
    const nested = readObjectProperty(nestedPlayer, "_katamariPlayer");
    if (isKatamariPlayer(nested)) {
      return nested;
    }
  }

  return isKatamariPlayer(value) ? value : null;
}

function isKatamariPlayer(value: unknown): value is CrunchyrollKatamariPlayer {
  return (
    isRecord(value) &&
    typeof value.play === "function" &&
    typeof value.pause === "function" &&
    (typeof value.seekToStreamTime === "function" || typeof value.seek === "function")
  );
}

function getKatamariPlayerState(player: CrunchyrollKatamariPlayer): string | null {
  try {
    return (
      player.playerOrchestrator?.seekOrchestrator?.playerStateMachine?.getCurrentState?.() ?? null
    );
  } catch {
    return null;
  }
}

function isKatamariSeekingAllowed(state: string): boolean {
  return state === "playing" || state === "paused" || state === "rebuffering";
}

async function waitForMediaTime(
  video: HTMLVideoElement,
  target: number,
  timeoutMs: number,
): Promise<boolean> {
  if (isNearMediaTime(video.currentTime, target, 1.25)) {
    return true;
  }

  return new Promise((resolve) => {
    let completed = false;
    let timeout = 0;
    const events = ["seeking", "seeked", "timeupdate", "canplay", "playing"] as const;
    const complete = (ok: boolean) => {
      if (completed) {
        return;
      }

      completed = true;
      window.clearTimeout(timeout);
      for (const event of events) {
        video.removeEventListener(event, onProgress);
      }
      resolve(ok);
    };
    const onProgress = () => {
      if (isNearMediaTime(video.currentTime, target, 1.25)) {
        complete(true);
      }
    };

    timeout = window.setTimeout(() => complete(false), timeoutMs);
    for (const event of events) {
      video.addEventListener(event, onProgress);
    }
  });
}

function findBestVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll("video")).filter(isUsableVideo);
  return (
    videos
      .map((video) => ({ video, score: scoreVideo(video) }))
      .sort((a, b) => b.score - a.score)[0]?.video ?? null
  );
}

function isUsableVideo(video: HTMLVideoElement): boolean {
  const rect = video.getBoundingClientRect();
  const style = getComputedStyle(video);
  return (
    rect.width >= 160 &&
    rect.height >= 90 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function scoreVideo(video: HTMLVideoElement): number {
  const rect = video.getBoundingClientRect();
  const durationBonus = Number.isFinite(video.duration) && video.duration > 60 ? 50000 : 0;
  const playbackBonus = video.paused ? 0 : 100000;
  return rect.width * rect.height + durationBonus + playbackBonus;
}

function clampMediaTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) {
    return 0;
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, time);
  }

  return Math.max(0, Math.min(time, Math.max(0, duration - 0.25)));
}

function isNearMediaTime(actual: number, target: number, toleranceSeconds: number): boolean {
  return Number.isFinite(actual) && Math.abs(actual - target) <= toleranceSeconds;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function videoSnapshot(video: HTMLVideoElement): CrunchyrollVideoSnapshot {
  return {
    buffered: readBuffered(video),
    currentTime: round(video.currentTime),
    duration: Number.isFinite(video.duration) ? round(video.duration) : null,
    ended: video.ended,
    muted: video.muted,
    networkState: video.networkState,
    paused: video.paused,
    playbackRate: round(video.playbackRate || 1),
    readyState: video.readyState,
    seeking: video.seeking,
    volume: round(video.volume),
  };
}

function readBuffered(video: HTMLVideoElement): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let index = 0; index < video.buffered.length; index += 1) {
    ranges.push([round(video.buffered.start(index)), round(video.buffered.end(index))]);
  }
  return ranges;
}

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

function findAncestor(element: Element, selector: string): Element | null {
  return element.closest(selector);
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === "object" || typeof value === "function") && value !== null;
}

function readObjectProperty(value: unknown, key: PropertyKey): unknown {
  if (!isRecord(value)) {
    return undefined;
  }

  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

declare global {
  interface Window {
    bitmovin?: BitmovinNamespace;
    __anidachiCrunchyrollBitmovinCaptureStarted?: boolean;
    __anidachiCrunchyrollBitmovinPlayers?: BitmovinLikePlayer[];
    __anidachiCrunchyrollControlBridgeStarted?: boolean;
  }
}
