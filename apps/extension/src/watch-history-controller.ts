import type { WatchHistoryPreferences, WatchProgressEvent } from "@anidachi/protocol";
import type { HistoryObservation } from "./source-adapters/core/history-policy";

export const WATCH_HISTORY_HEARTBEAT_MS = 60_000;

type HistoryEventKind = WatchProgressEvent["kind"];

export type WatchHistoryControllerDependencies = {
  getObservation: (preferences: WatchHistoryPreferences | null) => HistoryObservation | null;
  getRoomActive: () => boolean;
  loadPreferences: () => Promise<{ accountGeneration: number; preferences: WatchHistoryPreferences } | null>;
  observeLocally: (event: WatchProgressEvent) => Promise<void> | void;
  enqueue: (event: WatchProgressEvent) => Promise<void> | void;
  onObservation?: (observation: HistoryObservation | null) => void;
  now?: () => number;
  createEventId?: () => string;
  createSessionKey?: () => string;
  isPlaying: () => boolean;
  isSeeking: () => boolean;
};

export type WatchHistoryController = {
  start(): Promise<void>;
  observe(kind: HistoryEventKind): Promise<void>;
  noteSeeking(): Promise<void>;
  setRoomActive(active: boolean): Promise<void>;
  dispose(): Promise<void>;
};

export function createWatchHistoryController(
  dependencies: WatchHistoryControllerDependencies,
): WatchHistoryController {
  const now = dependencies.now ?? Date.now;
  const createEventId = dependencies.createEventId ?? (() => crypto.randomUUID());
  const createSessionKey = dependencies.createSessionKey ?? (() => crypto.randomUUID());
  let preferences: WatchHistoryPreferences | null = null;
  let accountGeneration: number | null = null;
  let retained: HistoryObservation | null = null;
  let retainedIdentity: string | null = null;
  let clientSessionKey: string | null = null;
  let previousPlayingTime: number | null = null;
  let hasMeaningfulPlayback = false;
  let lastHeartbeatAt: number | null = null;
  let roomActive = dependencies.getRoomActive();
  let disposed = false;
  let lifecycle = 0;
  let queue: Promise<void> = Promise.resolve();
  let disposePromise: Promise<void> | null = null;

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

  function ensureSessionKey(): string {
    clientSessionKey ??= createSessionKey();
    return clientSessionKey;
  }

  async function start(): Promise<void> {
    const token = lifecycle;
    let loaded: { accountGeneration: number; preferences: WatchHistoryPreferences } | null;
    try {
      loaded = await dependencies.loadPreferences();
    } catch {
      return;
    }
    await serial(async () => {
      if (!isCurrent(token)) return;
      preferences = loaded?.preferences ?? null;
      accountGeneration = loaded?.accountGeneration ?? null;
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
    if (!observation || accountGeneration === null) return;

    const identity = observationIdentity(observation);
    if (retained && retainedIdentity !== identity) {
      await emitRetainedSourceChange(token);
      if (!isCurrent(token)) return;
      resetMeaningfulState();
      retained = observation;
      retainedIdentity = identity;
      clientSessionKey = createSessionKey();
    } else if (!retained) {
      retained = observation;
      retainedIdentity = identity;
      ensureSessionKey();
    } else {
      retained = observation;
    }

    await emitCurrent(observation, kind, token);
  }

  async function emitRetainedSourceChange(token: number): Promise<void> {
    if (!retained || !clientSessionKey || accountGeneration === null) return;
    const event = toEvent(retained, "source_change", accountGeneration, createEventId(), clientSessionKey, now());
    await persist(event, token);
    if (!isCurrent(token) || !hasMeaningfulPlayback || roomActive || dependencies.getRoomActive()) return;
    await dependencies.enqueue(event);
  }

  async function emitCurrent(
    observation: HistoryObservation,
    kind: HistoryEventKind,
    token: number,
  ): Promise<void> {
    if (accountGeneration === null) return;
    const event = toEvent(observation, kind, accountGeneration, createEventId(), ensureSessionKey(), now());
    await persist(event, token);
    if (!isCurrent(token)) return;

    const activeRoom = roomActive || dependencies.getRoomActive();
    const playing = dependencies.isPlaying();
    const seeking = dependencies.isSeeking();
    if (kind === "ended") {
      hasMeaningfulPlayback = true;
    } else if (playing && !seeking) {
      if (previousPlayingTime !== null && observation.currentTime > previousPlayingTime) {
        hasMeaningfulPlayback = true;
      }
      previousPlayingTime = observation.currentTime;
    } else {
      previousPlayingTime = null;
    }

    if (!hasMeaningfulPlayback || activeRoom) return;
    if (kind === "heartbeat") {
      if (!playing || seeking || (lastHeartbeatAt !== null && now() - lastHeartbeatAt < WATCH_HISTORY_HEARTBEAT_MS)) return;
      lastHeartbeatAt = now();
    }
    if (!isCurrent(token)) return;
    await dependencies.enqueue(event);
  }

  async function persist(event: WatchProgressEvent, token: number): Promise<boolean> {
    if (!isCurrent(token)) return false;
    try {
      await dependencies.observeLocally(event);
      return true;
    } catch {
      return false;
    }
  }

  function setRoomActive(active: boolean): Promise<void> {
    const token = lifecycle;
    return serial(async () => {
      if (!isCurrent(token) || active === roomActive) return;
      const previous = retained;
      const previousSessionKey = clientSessionKey;
      const previousGeneration = accountGeneration;
      roomActive = active;
      clientSessionKey = null;
      resetMeaningfulState();
      if (previous && previousSessionKey && previousGeneration !== null) {
        const kind: HistoryEventKind = active ? "source_change" : "room_leave";
        await persist(
          toEvent(previous, kind, previousGeneration, createEventId(), previousSessionKey, now()),
          token,
        );
      }
    });
  }

  function dispose(): Promise<void> {
    if (disposePromise) return disposePromise;
    const cleanup = retained;
    const cleanupSessionKey = clientSessionKey;
    const cleanupGeneration = accountGeneration;
    const shouldPublish = hasMeaningfulPlayback && !roomActive && !dependencies.getRoomActive();
    disposed = true;
    lifecycle += 1;
    disposePromise = serial(async () => {
      if (!cleanup || !cleanupSessionKey || cleanupGeneration === null) return;
      const event = toEvent(cleanup, "source_change", cleanupGeneration, createEventId(), cleanupSessionKey, now());
      await dependencies.observeLocally(event);
      if (shouldPublish) await dependencies.enqueue(event);
    });
    return disposePromise;
  }

  return { start, observe, noteSeeking, setRoomActive, dispose };
}

function observationIdentity(observation: HistoryObservation): string {
  return [observation.provider, observation.titleKey, observation.episodeKey, observation.sourceUrl].join("\u0000");
}

function toEvent(
  observation: HistoryObservation,
  kind: HistoryEventKind,
  accountGeneration: number,
  clientEventId: string,
  clientSessionKey: string,
  observedAt: number,
): WatchProgressEvent {
  return {
    schemaVersion: 2,
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
    sharedRoom: null,
  };
}
