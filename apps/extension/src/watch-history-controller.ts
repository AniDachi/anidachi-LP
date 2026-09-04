import type {
  RoomHistoryAuthority,
  WatchHistoryPreferences,
  WatchProgressEvent,
} from "@anidachi/protocol";
import type { HistoryObservation } from "./source-adapters/core/history-policy";
import type { WatchHistoryCaptureResult } from "./watch-history-client";
import type { WatchHistoryObservationDisplayMode } from "./watch-history-storage";
import type { WatchHistoryLocalEvent } from "./watch-history-outbox";

export const WATCH_HISTORY_HEARTBEAT_MS = 60_000;

type HistoryEventKind = WatchProgressEvent["kind"];

export type WatchHistoryControllerDependencies = {
  onPersisted?: (event: WatchHistoryLocalEvent, owner: string, options: { refreshCatalog: boolean }) => Promise<void> | void;
  getObservation: (preferences: WatchHistoryPreferences | null) => HistoryObservation | null;
  getRoomActive: () => boolean;
  loadCachedPreferences?: () => Promise<{
    ownerUserId: string;
    accountGeneration: number;
    preferences: WatchHistoryPreferences;
    capturePaused?: boolean;
  } | null>;
  loadPreferences: () => Promise<{
    ownerUserId: string;
    accountGeneration: number;
    preferences: WatchHistoryPreferences;
    capturePaused?: boolean;
  } | null>;
  recoverCapture?: () => Promise<{
    ownerUserId: string;
    accountGeneration: number;
    preferences: WatchHistoryPreferences;
    capturePaused: boolean;
  } | null>;
  observeLocally: (
    event: WatchProgressEvent,
    expectedOwnerUserId: string,
    meaningfulSolo: boolean,
    displayMode: WatchHistoryObservationDisplayMode | null,
    queueForSync: boolean,
    flushNow: boolean,
  ) => Promise<WatchHistoryCaptureResult | void> | WatchHistoryCaptureResult | void;
  onObservation?: (observation: HistoryObservation | null) => void;
  onRoomHistoryAuthorityState?: (state: "solo" | "waiting" | "ready") => void;
  now?: () => number;
  createEventId?: () => string;
  createSessionKey?: () => string;
  isPlaying: () => boolean;
  isSeeking: () => boolean;
};

export type WatchHistoryController = {
  notePlaybackInteraction(): Promise<void>;
  start(): Promise<void>;
  observe(kind: HistoryEventKind): Promise<void>;
  noteSeeking(): Promise<void>;
  applyLocalPreferences(input: {
    ownerUserId: string;
    accountGeneration: number;
    preferences: WatchHistoryPreferences;
    capturePaused: boolean;
  }): Promise<void>;
  setRoomActive(active: boolean): Promise<void>;
  setRoomHistoryAuthority(authority: RoomHistoryAuthority | null): Promise<void>;
  refreshAuthority(): Promise<void>;
  recover(): Promise<void>;
  dispose(): Promise<void>;
};

export function createWatchHistoryController(
  dependencies: WatchHistoryControllerDependencies,
): WatchHistoryController {
  const now = dependencies.now ?? Date.now;
  const createEventId = dependencies.createEventId ?? (() => crypto.randomUUID());
  const createSessionKey = dependencies.createSessionKey ?? (() => crypto.randomUUID());
  let preferences: WatchHistoryPreferences | null = null;
  let ownerUserId: string | null = null;
  let accountGeneration: number | null = null;
  let retained: HistoryObservation | null = null;
  let retainedIdentity: string | null = null;
  let clientSessionKey: string | null = null;
  let previousPlayingTime: number | null = null;
  let hasMeaningfulPlayback = false;
  let lastHeartbeatAt: number | null = null;
  let roomActive = dependencies.getRoomActive();
  let roomActiveIntent = roomActive;
  let roomHistoryAuthority: RoomHistoryAuthority | null = null;
  let awaitingRoomSourceIdentity: string | null = null;
  let capturePaused = false;
  let authorityReady = false;
  let authorityRefreshPending = false;
  let authorityRevision = 0;
  let disposed = false;
  let lifecycle = 0;
  let queue: Promise<void> = Promise.resolve();
  let disposePromise: Promise<void> | null = null;
  let interactionPending = dependencies.isPlaying();
  let roomExitPromise: Promise<void> | null = null;

  function serial(operation: () => Promise<void>): Promise<void> {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  }

  function isCurrent(token: number): boolean {
    return !disposed && token === lifecycle;
  }

  function resetMeaningfulState(): void {
    previousPlayingTime = null;
    hasMeaningfulPlayback = false;
    lastHeartbeatAt = null;
  }

  function publishRoomHistoryAuthorityState(): void {
    dependencies.onRoomHistoryAuthorityState?.(
      roomActive
        ? roomHistoryAuthority && awaitingRoomSourceIdentity === null
          ? "ready"
          : "waiting"
        : "solo",
    );
  }

  function ensureSessionKey(): string {
    clientSessionKey ??= createSessionKey();
    return clientSessionKey;
  }

  async function start(): Promise<void> {
    const token = lifecycle;
    if (dependencies.loadCachedPreferences) {
      const cachedAuthorityToken = ++authorityRevision;
      let cached: Awaited<ReturnType<NonNullable<typeof dependencies.loadCachedPreferences>>>;
      try {
        cached = await dependencies.loadCachedPreferences();
      } catch {
        cached = null;
      }
      if (!isCurrent(token) || cachedAuthorityToken !== authorityRevision) return;
      if (cached) {
        await serial(async () => {
          if (!isCurrent(token) || cachedAuthorityToken !== authorityRevision) return;
          ownerUserId = cached.ownerUserId;
          // Cached authority is enough for immediate Crunchyroll presentation,
          // but YouTube remains fail-closed until this startup's canonical
          // preference refresh succeeds.
          preferences = { ...cached.preferences, youtubeHistoryEnabled: false };
          accountGeneration = cached.accountGeneration;
          capturePaused = cached.capturePaused === true;
          authorityReady = true;
          await capture("heartbeat", token);
        });
        if (isCurrent(token) && cachedAuthorityToken === authorityRevision) {
          void refreshAuthorityFromNetwork(true).catch(() => undefined);
        }
        return;
      }
    }

    const authorityToken = ++authorityRevision;
    authorityReady = false;
    let loaded: {
      ownerUserId: string;
      accountGeneration: number;
      preferences: WatchHistoryPreferences;
      capturePaused?: boolean;
    } | null;
    try {
      loaded = await dependencies.loadPreferences();
    } catch {
      return;
    }
    await serial(async () => {
      if (!isCurrent(token) || authorityToken !== authorityRevision) return;
      ownerUserId = loaded?.ownerUserId ?? null;
      preferences = loaded?.preferences ?? null;
      accountGeneration = loaded?.accountGeneration ?? null;
      capturePaused = loaded?.capturePaused === true;
      authorityReady = loaded !== null;
      await capture("heartbeat", token);
    });
  }

  function observe(kind: HistoryEventKind): Promise<void> {
    const token = lifecycle;
    return serial(async () => {
      if (!isCurrent(token)) return;
      await capture(kind, token);
    });
  }

  function applyLocalPreferences(input: {
    ownerUserId: string;
    accountGeneration: number;
    preferences: WatchHistoryPreferences;
    capturePaused: boolean;
  }): Promise<void> {
    const token = lifecycle;
    if (ownerUserId !== null && ownerUserId !== input.ownerUserId) return Promise.resolve();
    const authorityToken = ++authorityRevision;
    return serial(async () => {
      if (!isCurrent(token) || authorityToken !== authorityRevision ||
        ownerUserId !== null && ownerUserId !== input.ownerUserId) {
        return;
      }
      const boundaryChanged = !authorityReady ||
        ownerUserId !== input.ownerUserId ||
        accountGeneration !== input.accountGeneration;
      const previousObservation = authorityReady ? dependencies.getObservation(preferences) : null;
      const previousEnabled = preferences?.youtubeHistoryEnabled;
      const changed = previousEnabled !== input.preferences.youtubeHistoryEnabled;
      if (boundaryChanged) {
        retained = null;
        retainedIdentity = null;
        clientSessionKey = null;
        resetMeaningfulState();
        dependencies.onObservation?.(null);
      }
      ownerUserId = input.ownerUserId;
      accountGeneration = input.accountGeneration;
      preferences = input.preferences;
      capturePaused = input.capturePaused;
      authorityReady = true;
      authorityRefreshPending = false;
      if (capturePaused || !boundaryChanged && !changed) return;
      const nextObservation = dependencies.getObservation(preferences);
      if (boundaryChanged) {
        if (nextObservation) await capture("heartbeat", token);
        return;
      }
      const affectsYouTube = retained?.provider === "youtube" ||
        previousObservation?.provider === "youtube" ||
        nextObservation?.provider === "youtube";
      if (!affectsYouTube) return;
      if (previousEnabled === true && !preferences.youtubeHistoryEnabled) {
        retained = null;
        retainedIdentity = null;
        clientSessionKey = null;
        resetMeaningfulState();
        dependencies.onObservation?.(null);
        return;
      }
      await capture("heartbeat", token);
    });
  }

  function noteSeeking(): Promise<void> {
    const token = lifecycle;
    return serial(async () => {
      if (isCurrent(token)) previousPlayingTime = null;
    });
  }

  async function capture(kind: HistoryEventKind, token: number): Promise<void> {
    const observation = dependencies.getObservation(preferences);
    if (!isCurrent(token)) return;
    dependencies.onObservation?.(observation);
    if (!observation) {
      if (authorityRefreshPending && retained?.provider === "youtube") return;
      if (!authorityReady || ownerUserId === null || accountGeneration === null ||
        capturePaused || !retained) return;
      const previousIdentity = retainedIdentity;
      await emitRetainedSourceChange(token);
      if (!isCurrent(token)) return;
      if (roomActive && roomHistoryAuthority) {
        awaitingRoomSourceIdentity = previousIdentity;
        roomHistoryAuthority = null;
        publishRoomHistoryAuthorityState();
      }
      retained = null;
      retainedIdentity = null;
      clientSessionKey = null;
      resetMeaningfulState();
      return;
    }
    if (!authorityReady ||
      ownerUserId === null ||
      accountGeneration === null ||
      capturePaused) return;

    const identity = observationIdentity(observation);
    if (retained && retainedIdentity !== identity) {
      const awaitingIdentityTransition = roomActive && awaitingRoomSourceIdentity !== null;
      if (!awaitingIdentityTransition) {
        await emitRetainedSourceChange(token);
        if (!isCurrent(token)) return;
      }
      if (roomActive && roomHistoryAuthority && !awaitingIdentityTransition) {
        awaitingRoomSourceIdentity = retainedIdentity;
        roomHistoryAuthority = null;
        publishRoomHistoryAuthorityState();
      }
      resetMeaningfulState();
      retained = observation;
      interactionPending = true;
      retainedIdentity = identity;
      clientSessionKey = createSessionKey();
      if (awaitingRoomSourceIdentity !== null && identity !== awaitingRoomSourceIdentity) {
        awaitingRoomSourceIdentity = null;
        publishRoomHistoryAuthorityState();
      }
    } else if (!retained) {
      retained = observation;
      retainedIdentity = identity;
      ensureSessionKey();
      if (awaitingRoomSourceIdentity !== null && identity !== awaitingRoomSourceIdentity) {
        awaitingRoomSourceIdentity = null;
        publishRoomHistoryAuthorityState();
      }
    } else {
      retained = observation;
    }

    await emitCurrent(observation, kind, token);
  }

  async function emitRetainedSourceChange(token: number): Promise<void> {
    if (!retained || !clientSessionKey || accountGeneration === null) return;
    const sharedRoom = roomActive ? roomHistoryAuthority : null;
    const event = toEvent(
      retained,
      "source_change",
      accountGeneration,
      createEventId(),
      clientSessionKey,
      now(),
      sharedRoom,
    );
    const meaningfulSolo = hasMeaningfulPlayback &&
      !roomActive &&
      !dependencies.getRoomActive();
    const shouldQueue = hasMeaningfulPlayback &&
      (!roomActive && !dependencies.getRoomActive() || sharedRoom !== null);
    await persist(event, token, meaningfulSolo, null, shouldQueue, shouldQueue);
  }

  async function emitCurrent(
    observation: HistoryObservation,
    kind: HistoryEventKind,
    token: number,
  ): Promise<void> {
    if (accountGeneration === null) return;
    const activeRoom = roomActive || dependencies.getRoomActive();
    const sharedRoom = activeRoom &&
      roomHistoryAuthority &&
      awaitingRoomSourceIdentity === null
      ? roomHistoryAuthority
      : null;
    const event = toEvent(
      observation,
      kind,
      accountGeneration,
      createEventId(),
      ensureSessionKey(),
      now(),
      sharedRoom,
    );
    const playing = dependencies.isPlaying();
    const seeking = dependencies.isSeeking();
    let nextMeaningfulPlayback = hasMeaningfulPlayback;
    let nextPreviousPlayingTime = previousPlayingTime;
    if (kind === "ended") {
      nextMeaningfulPlayback = true;
    } else if (playing && !seeking) {
      if (previousPlayingTime !== null && observation.currentTime > previousPlayingTime) {
        nextMeaningfulPlayback = true;
      }
      nextPreviousPlayingTime = observation.currentTime;
    } else {
      nextPreviousPlayingTime = null;
    }

    const meaningfulSolo = nextMeaningfulPlayback && !activeRoom;
    const shouldQueue = nextMeaningfulPlayback &&
      (!activeRoom || sharedRoom !== null) &&
      (kind !== "heartbeat" || playing && !seeking);
    const flushNow = shouldQueue && (kind !== "heartbeat" ||
      lastHeartbeatAt === null || now() - lastHeartbeatAt >= WATCH_HISTORY_HEARTBEAT_MS);
    if (!await persist(
      event,
      token,
      meaningfulSolo,
      isActivePresentationKind(kind) ? activeRoom ? "together" : "mine" : null,
      shouldQueue,
      flushNow,
    )) return;
    if (!isCurrent(token)) return;
    hasMeaningfulPlayback = nextMeaningfulPlayback;
    previousPlayingTime = nextPreviousPlayingTime;

    if (kind === "heartbeat" && flushNow) {
      lastHeartbeatAt = now();
    }
  }

  async function persist(
    event: WatchProgressEvent,
    token: number,
    meaningfulSolo: boolean,
    displayMode: WatchHistoryObservationDisplayMode | null,
    queueForSync = false,
    flushNow = false,
  ): Promise<boolean> {
    if (!isCurrent(token) || !authorityReady) return false;
    const persistedAuthorityRevision = authorityRevision;
    try {
      if (ownerUserId === null) return false;
      const result = await dependencies.observeLocally(
        event,
        ownerUserId,
        meaningfulSolo,
        displayMode,
        queueForSync,
        flushNow,
      );
      if (isFailedCapture(result)) {
        if (persistedAuthorityRevision === authorityRevision) handleCaptureFailure(result);
        return false;
      }
      if (queueForSync && dependencies.onPersisted) {
        const refreshCatalog = interactionPending && event.kind !== "source_change" && event.kind !== "pagehide";
        if (refreshCatalog) interactionPending = false;
        void Promise.resolve(dependencies.onPersisted(event, ownerUserId, { refreshCatalog })).catch(() => undefined);
      }
      return true;
    } catch {
      return false;
    }
  }

  function handleCaptureFailure(result: Extract<WatchHistoryCaptureResult, { ok: false }>): void {
    if (result.status === "storage-full") {
      capturePaused = true;
      return;
    }
    if (result.status === "unauthenticated" ||
      result.status === "rejected" ||
      result.status === "generation-mismatch" ||
      result.status === "invalid-response" ||
      result.status === "upgrade-required") {
      ownerUserId = null;
      preferences = null;
      accountGeneration = null;
      authorityReady = false;
    }
  }

  function refreshAuthority(): Promise<void> {
    return refreshAuthorityFromNetwork(false);
  }

  function refreshAuthorityFromNetwork(preserveCurrent: boolean): Promise<void> {
    const token = lifecycle;
    const authorityToken = ++authorityRevision;
    const previousAuthority = {
      ready: authorityReady,
      ownerUserId,
      accountGeneration,
      youtubeHistoryEnabled: preferences?.youtubeHistoryEnabled,
    };
    if (!preserveCurrent) {
      if (previousAuthority.ready && preferences) {
        preferences = { ...preferences, youtubeHistoryEnabled: false };
        authorityRefreshPending = true;
      } else {
        authorityReady = false;
      }
    }
    const load = async () => {
      let loaded: Awaited<ReturnType<WatchHistoryControllerDependencies["loadPreferences"]>>;
      try {
        loaded = await dependencies.loadPreferences();
      } catch {
        loaded = null;
      }
      return loaded;
    };
    const apply = (loaded: NonNullable<Awaited<ReturnType<
      WatchHistoryControllerDependencies["loadPreferences"]
    >>>): void => {
      if (!isCurrent(token) || authorityToken !== authorityRevision || !loaded) return;
      const authorityUnchanged = previousAuthority.ready &&
        previousAuthority.ownerUserId === loaded.ownerUserId &&
        previousAuthority.accountGeneration === loaded.accountGeneration &&
        previousAuthority.youtubeHistoryEnabled === loaded.preferences.youtubeHistoryEnabled;
      ownerUserId = loaded.ownerUserId;
      accountGeneration = loaded.accountGeneration;
      preferences = loaded.preferences;
      capturePaused = loaded.capturePaused === true;
      authorityReady = true;
      authorityRefreshPending = false;
      if (authorityUnchanged) return;
      retained = null;
      retainedIdentity = null;
      clientSessionKey = null;
      resetMeaningfulState();
    };
    if (preserveCurrent) {
      return load().then(async (loaded) => {
        if (!loaded) return;
        await serial(async () => { apply(loaded); });
      });
    }
    return load().then(async (loaded) => {
      await serial(async () => {
        if (!isCurrent(token) || authorityToken !== authorityRevision) return;
        if (loaded) {
          apply(loaded);
          return;
        }
        authorityRefreshPending = false;
        if (previousAuthority.ready) {
          authorityReady = true;
          if (retained?.provider === "youtube") {
            retained = null;
            retainedIdentity = null;
            clientSessionKey = null;
            resetMeaningfulState();
            dependencies.onObservation?.(null);
          }
        }
      });
    });
  }

  function setRoomActive(active: boolean): Promise<void> {
    const token = lifecycle;
    if (!isCurrent(token)) return Promise.resolve();
    roomActiveIntent = active;
    if (!active) return leaveRoom(token);
    if (roomActive) return roomExitPromise ?? Promise.resolve();
    const previous = retained;
    const previousSessionKey = clientSessionKey;
    const previousGeneration = accountGeneration;
    const previousAuthorityReady = authorityReady;
    const previousWasMeaningfulSolo = previousAuthorityReady && hasMeaningfulPlayback && !roomActive;
    roomActive = true;
    clientSessionKey = null;
    resetMeaningfulState();
    publishRoomHistoryAuthorityState();
    return serial(async () => {
      if (!isCurrent(token) ||
        !previousAuthorityReady ||
        !previous ||
        !previousSessionKey ||
        previousGeneration === null) return;
      const event = toEvent(
        previous,
        "source_change",
        previousGeneration,
        createEventId(),
        previousSessionKey,
        now(),
        null,
      );
      await persist(
        event,
        token,
        false,
        null,
        previousWasMeaningfulSolo,
        previousWasMeaningfulSolo,
      );
    });
  }

  function setRoomHistoryAuthority(authority: RoomHistoryAuthority | null): Promise<void> {
    const token = lifecycle;
    return serial(async () => {
      if (!isCurrent(token)) return;
      const previous = roomHistoryAuthority;
      if (authority && previous && sameRoomHistoryBoundary(authority, previous)) {
        roomHistoryAuthority = authority;
        publishRoomHistoryAuthorityState();
        return;
      }

      if (previous && roomActive) {
        await emitRetainedSourceChange(token);
        if (!isCurrent(token)) return;
        awaitingRoomSourceIdentity = retainedIdentity;
      }

      roomHistoryAuthority = authority;
      if (authority &&
        awaitingRoomSourceIdentity !== null &&
        retainedIdentity !== awaitingRoomSourceIdentity) {
        awaitingRoomSourceIdentity = null;
      }
      resetMeaningfulState();
      publishRoomHistoryAuthorityState();
    });
  }

  function leaveRoom(token: number): Promise<void> {
    if (!roomActive) return Promise.resolve();
    if (roomExitPromise) return roomExitPromise;
    const leaving = serial(async () => {
      if (!isCurrent(token) || !roomActive || roomActiveIntent) return;
      const previous = retained;
      const previousSessionKey = clientSessionKey;
      const previousGeneration = accountGeneration;
      const previousRoomHistoryAuthority = roomHistoryAuthority;
      const previousWasMeaningfulShared = hasMeaningfulPlayback &&
        previousRoomHistoryAuthority !== null;
      roomActive = false;
      roomHistoryAuthority = null;
      awaitingRoomSourceIdentity = null;
      clientSessionKey = null;
      resetMeaningfulState();
      publishRoomHistoryAuthorityState();
      if (!previous || !previousSessionKey || previousGeneration === null) return;
      const event = toEvent(
        previous,
        "room_leave",
        previousGeneration,
        createEventId(),
        previousSessionKey,
        now(),
        previousRoomHistoryAuthority,
      );
      await persist(
        event,
        token,
        false,
        null,
        previousWasMeaningfulShared,
        previousWasMeaningfulShared,
      );
    });
    roomExitPromise = leaving;
    void leaving.then(() => {
      if (roomExitPromise === leaving) roomExitPromise = null;
    }, () => {
      if (roomExitPromise === leaving) roomExitPromise = null;
    });
    return leaving;
  }

  function recover(): Promise<void> {
    const token = lifecycle;
    return serial(async () => {
      if (!isCurrent(token) || !capturePaused || !dependencies.recoverCapture) return;
      let recovered: Awaited<ReturnType<NonNullable<typeof dependencies.recoverCapture>>>;
      try {
        recovered = await dependencies.recoverCapture();
      } catch {
        return;
      }
      if (!isCurrent(token) || !recovered || recovered.capturePaused) return;
      preferences = recovered.preferences;
      ownerUserId = recovered.ownerUserId;
      accountGeneration = recovered.accountGeneration;
      capturePaused = false;
      authorityReady = true;
      clientSessionKey = null;
      resetMeaningfulState();
    });
  }

  function dispose(): Promise<void> {
    if (disposePromise) return disposePromise;
    let cleanup = retained;
    try {
      const latest = dependencies.getObservation(preferences);
      if (latest && observationIdentity(latest) === retainedIdentity) cleanup = latest;
    } catch {
      // Cleanup keeps the last valid observation when the provider is already gone.
    }
    const cleanupSessionKey = clientSessionKey;
    const cleanupGeneration = accountGeneration;
    const cleanupOwnerUserId = ownerUserId;
    const cleanupAuthorityReady = authorityReady;
    const shouldPublish = cleanupAuthorityReady &&
      hasMeaningfulPlayback &&
      !roomActive &&
      !dependencies.getRoomActive();
    disposed = true;
    lifecycle += 1;
    disposePromise = serial(async () => {
      if (!cleanupAuthorityReady ||
        !cleanup ||
        !cleanupSessionKey ||
        cleanupGeneration === null ||
        cleanupOwnerUserId === null) return;
      const event = toEvent(cleanup, "source_change", cleanupGeneration, createEventId(), cleanupSessionKey, now());
      const result = await dependencies.observeLocally(
        event,
        cleanupOwnerUserId,
        shouldPublish,
        null,
        shouldPublish,
        shouldPublish,
      );
      if (isFailedCapture(result)) return;
    });
    return disposePromise;
  }

  return {
    notePlaybackInteraction: () => { interactionPending = true; return Promise.resolve(); },
    start,
    observe,
    noteSeeking,
    applyLocalPreferences,
    setRoomActive,
    setRoomHistoryAuthority,
    refreshAuthority,
    recover,
    dispose,
  };
}

function isActivePresentationKind(kind: HistoryEventKind): boolean {
  return kind !== "source_change" &&
    kind !== "pagehide" &&
    kind !== "room_leave" &&
    kind !== "room_end" &&
    kind !== "ended";
}

function isFailedCapture(
  result: WatchHistoryCaptureResult | void,
): result is Extract<WatchHistoryCaptureResult, { ok: false }> {
  return result !== undefined && !result.ok;
}

function observationIdentity(observation: HistoryObservation): string {
  return [observation.provider, observation.titleKey, observation.episodeKey, observation.sourceUrl].join("\u0000");
}

function sameRoomHistoryBoundary(
  left: RoomHistoryAuthority,
  right: RoomHistoryAuthority,
): boolean {
  return left.roomId === right.roomId &&
    left.participantSessionId === right.participantSessionId &&
    left.roomGeneration === right.roomGeneration &&
    left.sourceGeneration === right.sourceGeneration;
}

function toEvent(
  observation: HistoryObservation,
  kind: HistoryEventKind,
  accountGeneration: number,
  clientEventId: string,
  clientSessionKey: string,
  observedAt: number,
  sharedRoom: RoomHistoryAuthority | null = null,
): WatchHistoryLocalEvent {
  return {
    schemaVersion: 3,
    clientEventId,
    clientSessionKey,
    accountGeneration,
    provider: observation.provider,
    titleKey: observation.titleKey,
    itemKind: observation.itemKind,
    title: observation.title,
    artworkUrl: observation.artworkUrl,
    episodeKey: observation.episodeKey,
    episodeTitle: observation.episodeTitle,
    seasonKey: observation.seasonKey,
    seasonTitle: observation.seasonTitle,
    seasonNumber: observation.seasonNumber,
    episodeNumber: observation.episodeNumber,
    sourceUrl: observation.sourceUrl,
    currentTime: observation.currentTime,
    duration: observation.duration,
    progress: observation.progress,
    observedAt: new Date(observedAt).toISOString(),
    kind,
    sharedRoom,
    ...(observation.identityPending ? { identityPending: observation.identityPending } : {}),
    ...(observation.crunchyrollIdentity ? { crunchyrollIdentity: observation.crunchyrollIdentity } : {}),
    ...(observation.provider === "youtube" ? { youtubeVideoId: observation.youtubeVideoId ?? new URL(observation.sourceUrl).searchParams.get("v") ?? undefined } : {}),
  };
}
