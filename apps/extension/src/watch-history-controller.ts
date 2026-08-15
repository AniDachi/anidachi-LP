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
  createSessionKey?: (observation: HistoryObservation) => string;
  isPlaying: () => boolean;
  isSeeking: () => boolean;
};

export type WatchHistoryController = {
  start(): Promise<void>;
  observe(kind: HistoryEventKind): Promise<void>;
  noteSeeking(): void;
  setRoomActive(active: boolean): Promise<void>;
};

export function createWatchHistoryController(
  dependencies: WatchHistoryControllerDependencies,
): WatchHistoryController {
  const now = dependencies.now ?? Date.now;
  const createEventId = dependencies.createEventId ?? (() => crypto.randomUUID());
  const createSessionKey = dependencies.createSessionKey ?? ((observation) =>
    `solo:${observation.provider}:${observation.titleKey}:${observation.episodeKey}`);
  let preferences: WatchHistoryPreferences | null = null;
  let accountGeneration: number | null = null;
  let previousPlayingTime: number | null = null;
  let hasMeaningfulPlayback = false;
  let lastHeartbeatAt: number | null = null;
  let roomActive = dependencies.getRoomActive();

  async function start(): Promise<void> {
    const loaded = await dependencies.loadPreferences();
    preferences = loaded?.preferences ?? null;
    accountGeneration = loaded?.accountGeneration ?? null;
    await observe("heartbeat");
  }

  async function observe(kind: HistoryEventKind): Promise<void> {
    const observation = dependencies.getObservation(preferences);
    dependencies.onObservation?.(observation);
    if (!observation || accountGeneration === null) return;
    const event = toEvent(observation, kind, accountGeneration, createEventId(), createSessionKey(observation), now());
    await dependencies.observeLocally(event);

    const activeRoom = roomActive || dependencies.getRoomActive();
    const isPlaying = dependencies.isPlaying();
    const isSeeking = dependencies.isSeeking();
    if (kind === "ended") {
      hasMeaningfulPlayback = true;
    } else if (isPlaying && !isSeeking) {
      if (previousPlayingTime !== null && observation.currentTime > previousPlayingTime) {
        hasMeaningfulPlayback = true;
      }
      previousPlayingTime = observation.currentTime;
    } else {
      previousPlayingTime = null;
    }

    if (!hasMeaningfulPlayback || activeRoom) return;
    if (kind === "heartbeat") {
      if (!isPlaying || isSeeking || (lastHeartbeatAt !== null && now() - lastHeartbeatAt < WATCH_HISTORY_HEARTBEAT_MS)) return;
      lastHeartbeatAt = now();
    }
    await dependencies.enqueue(event);
  }

  async function setRoomActive(active: boolean): Promise<void> {
    if (active === roomActive) return;
    const wasActive = roomActive;
    roomActive = active;
    previousPlayingTime = null;
    hasMeaningfulPlayback = false;
    lastHeartbeatAt = null;
    if (wasActive || active) await observe(wasActive ? "room_leave" : "source_change");
  }

  function noteSeeking(): void {
    previousPlayingTime = null;
  }

  return { start, observe, noteSeeking, setRoomActive };
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
