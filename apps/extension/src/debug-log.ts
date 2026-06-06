import type { ClientEvent, PlaybackState, ServerEvent } from "@anidachi/protocol";
import { ANIDACHI_BUILD_ID, API_HTTP_BASE, API_WS_BASE } from "./constants";

export interface DebugEntry {
  id: number;
  at: string;
  elapsedMs: number;
  scope: string;
  message: string;
  data?: unknown;
}

const STORAGE_KEY = "anidachi:debug-log:v1";
const CONSOLE_DEBUG_STORAGE_KEY = "anidachi:debug-console";
const MAX_ENTRIES = 1200;
const COMPACT_ENTRIES = 350;
const STARTED_AT = performance.now();

let sequence = 0;
let entries: DebugEntry[] = loadEntries();

export function logDebug(scope: string, message: string, data?: unknown): void {
  const entry: DebugEntry = {
    id: ++sequence,
    at: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - STARTED_AT),
    scope,
    message,
    ...(data === undefined ? {} : { data: sanitizeDebugData(data) }),
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES);
  }

  persistEntries();
  if (shouldPrintDebugToConsole()) {
    console.info("[Anidachi Debug]", entry.scope, entry.message, entry.data ?? "");
  }
}

export function getDebugEntries(): DebugEntry[] {
  return entries.slice();
}

export function clearDebugLog(): void {
  entries = [];
  sequence = 0;
  persistEntries();
  logDebug("debug", "cleared");
}

export function getDebugLogText(): string {
  return JSON.stringify(
    {
      app: "Anidachi",
      buildId: ANIDACHI_BUILD_ID,
      generatedAt: new Date().toISOString(),
      page: {
        url: redactUrl(location.href),
        title: document.title,
        visibilityState: document.visibilityState,
      },
      runtime: {
        apiHttpBase: API_HTTP_BASE,
        apiWsBase: API_WS_BASE,
        userAgent: navigator.userAgent,
      },
      entries,
    },
    null,
    2,
  );
}

export function getCompactDebugLogText(): string {
  const compactEntries = entries
    .filter(isUsefulCompactEntry)
    .slice(-COMPACT_ENTRIES)
    .map((entry) => ({
      id: entry.id,
      at: entry.at,
      elapsedMs: entry.elapsedMs,
      scope: entry.scope,
      message: entry.message,
      ...(entry.data === undefined ? {} : { data: compactDebugData(entry.data) }),
    }));

  return JSON.stringify(
    {
      app: "Anidachi",
      format: "compact-debug",
      buildId: ANIDACHI_BUILD_ID,
      generatedAt: new Date().toISOString(),
      page: {
        url: redactUrl(location.href),
        title: document.title,
        visibilityState: document.visibilityState,
      },
      runtime: {
        apiHttpBase: API_HTTP_BASE,
        apiWsBase: API_WS_BASE,
        userAgent: navigator.userAgent,
      },
      totalEntries: entries.length,
      entries: compactEntries,
    },
    null,
    2,
  );
}

export function playbackStateDebugSnapshot(state: PlaybackState): Record<string, unknown> {
  return {
    videoFingerprint: state.videoFingerprint,
    sourceUrl: state.sourceUrl ? redactUrl(state.sourceUrl) : undefined,
    playing: state.playing,
    hostTime: round(state.hostTime),
    updatedAt: state.updatedAt,
    playbackRate: round(state.playbackRate),
  };
}

export function roomEventDebugSnapshot(event: ClientEvent | ServerEvent): Record<string, unknown> {
  switch (event.type) {
    case "JOIN":
      return {
        type: event.type,
        roomId: event.roomId,
        lastSeenP2PServerSeq: event.lastSeenP2PServerSeq,
        participantId: event.participant.id,
        role: event.participant.role,
        videoFingerprint: event.videoFingerprint,
      };
    case "ROOM_SNAPSHOT":
      return {
        type: event.type,
        roomId: event.roomId,
        participants: event.participants.map((participant) => ({
          id: participant.id,
          role: participant.role,
          cameraEnabled: participant.cameraEnabled,
          syncStatus: participant.syncStatus,
        })),
        hostState: event.hostState ? playbackStateDebugSnapshot(event.hostState) : undefined,
      };
    case "HOST_STATE":
      return {
        type: event.type,
        roomId: "roomId" in event ? event.roomId : undefined,
        state: playbackStateDebugSnapshot(event.state),
      };
    case "PLAY":
      return {
        type: event.type,
        roomId: event.roomId,
        byUserId: event.byUserId,
        at: round(event.at),
      };
    case "PAUSE":
      return {
        type: event.type,
        roomId: event.roomId,
        byUserId: event.byUserId,
        at: round(event.at),
      };
    case "SEEK":
      return {
        type: event.type,
        roomId: event.roomId,
        byUserId: event.byUserId,
        to: round(event.to),
      };
    case "REACTION":
      return {
        type: event.type,
        roomId: "roomId" in event ? event.roomId : event.reaction.roomId,
        reaction: {
          userId: event.reaction.userId,
          emoji: event.reaction.emoji,
          text: event.reaction.text,
          videoTime: round(event.reaction.videoTime),
        },
      };
    case "PARTICIPANT_JOINED":
    case "PARTICIPANT_LEFT":
      return {
        type: event.type,
        participantId: event.participant.id,
        role: event.participant.role,
        cameraEnabled: event.participant.cameraEnabled,
      };
    case "CAMERA_ON":
    case "CAMERA_OFF":
      return { type: event.type, roomId: event.roomId, userId: event.userId };
    case "P2P_SIGNAL":
      return {
        type: event.type,
        roomId: event.roomId,
        clientSignalId: event.clientSignalId,
        fromUserId: event.fromUserId,
        senderConnectionId: event.senderConnectionId,
        serverSeq: event.serverSeq,
        toUserId: event.toUserId,
        signalKind: event.signal.kind,
      };
    case "ERROR":
      return { type: event.type, code: event.code, message: event.message };
  }
}

export function videoDebugSnapshot(video: HTMLVideoElement): Record<string, unknown> {
  return {
    currentTime: round(video.currentTime),
    duration: finiteOrNull(video.duration),
    paused: video.paused,
    ended: video.ended,
    seeking: video.seeking,
    readyState: video.readyState,
    networkState: video.networkState,
    playbackRate: round(video.playbackRate || 1),
    volume: round(video.volume),
    muted: video.muted,
    buffered: readBuffered(video),
    currentSrc: redactUrl(video.currentSrc || video.src || ""),
    rect: rectSnapshot(video),
    controls: video.controls,
  };
}

export function elementDebugSnapshot(element: Element | null): Record<string, unknown> | null {
  if (!element) {
    return null;
  }

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: cleanClassName(element.getAttribute("class")),
    testId: element.getAttribute("data-testid") ?? undefined,
    aria: element.getAttribute("aria-label") ?? undefined,
    role: element.getAttribute("role") ?? undefined,
    text: cleanText(element.textContent),
    rect: rectSnapshot(element),
  };
}

export function inputDebugSnapshot(input: HTMLInputElement | null): Record<string, unknown> | null {
  if (!input) {
    return null;
  }

  return {
    ...elementDebugSnapshot(input),
    value: input.value,
    min: input.min,
    max: input.max,
    step: input.step,
    ariaValueNow: input.getAttribute("aria-valuenow"),
    ariaValueMin: input.getAttribute("aria-valuemin"),
    ariaValueMax: input.getAttribute("aria-valuemax"),
  };
}

export function controlsDebugSnapshot(container: HTMLElement): Array<Record<string, unknown>> {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "[data-testid], button, [role='button'], [role='slider'], input[type='range']",
    ),
  )
    .map((element) =>
      element instanceof HTMLInputElement
        ? inputDebugSnapshot(element)
        : elementDebugSnapshot(element),
    )
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => {
      const key =
        `${item.testId ?? ""} ${item.aria ?? ""} ${item.role ?? ""} ${item.className ?? ""}`.toLowerCase();
      return /player|play|pause|seek|scrub|timeline|time|jump|full|control|slider|volume|speed|track|subtitle|audio/.test(
        key,
      );
    })
    .slice(0, 80);
}

function loadEntries(): DebugEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as DebugEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    sequence = parsed.reduce((max, entry) => Math.max(max, entry.id), 0);
    return parsed.slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

function persistEntries(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage pressure; debug export is best-effort in content scripts.
  }
}

function shouldPrintDebugToConsole(): boolean {
  const globalFlag = (globalThis as { __ANIDACHI_DEBUG_CONSOLE__?: unknown })
    .__ANIDACHI_DEBUG_CONSOLE__;
  if (globalFlag === true || globalFlag === "1" || globalFlag === "true") {
    return true;
  }

  try {
    const value = localStorage.getItem(CONSOLE_DEBUG_STORAGE_KEY);
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

function sanitizeDebugData(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === "string") {
        return redactUrl(item);
      }

      return item;
    }),
  );
}

function isUsefulCompactEntry(entry: DebugEntry): boolean {
  if (
    entry.scope.startsWith("room.") ||
    entry.scope.startsWith("sync.") ||
    entry.scope.startsWith("p2p.") ||
    entry.scope.startsWith("overlay.server") ||
    entry.scope.startsWith("adapter.") ||
    entry.scope.startsWith("video.event") ||
    entry.scope.startsWith("main.media-method") ||
    entry.scope.startsWith("main.video-event") ||
    entry.scope.startsWith("debug")
  ) {
    return true;
  }

  return /play|pause|seek|host_state|sync|catch|drift|fullscreen/i.test(entry.message);
}

function compactDebugData(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  const compact: Record<string, unknown> = {};
  copyDebugFields(source, compact, [
    "type",
    "roomId",
    "participantId",
    "localParticipantId",
    "byUserId",
    "fromUserId",
    "toUserId",
    "remoteUserId",
    "adapterId",
    "fingerprint",
    "kind",
    "summary",
    "iceServers",
    "connectionState",
    "iceConnectionState",
    "iceGatheringState",
    "signalingState",
    "candidateType",
    "localCandidateType",
    "remoteCandidateType",
    "protocol",
    "localProtocol",
    "remoteProtocol",
    "queued",
    "peerCount",
    "remoteIds",
    "hasVideoTrack",
    "hasAudioTrack",
    "videoDirection",
    "audioDirection",
    "polite",
    "mediaSyncing",
    "makingOffer",
    "readyState",
    "muted",
    "requested",
    "target",
    "method",
    "drift",
    "expectedTime",
    "wasPlaying",
    "shouldResume",
    "shouldSeek",
    "shouldChangePlayback",
    "suppressUntil",
    "now",
    "error",
    "code",
    "message",
  ]);

  if (source.event) {
    compact.event = compactDebugData(source.event);
  }
  if (source.state) {
    compact.state = compactDebugData(source.state);
  }
  if (source.correction) {
    compact.correction = compactDebugData(source.correction);
  }
  if (source.video) {
    compact.video = compactVideoData(source.video);
  }
  if (source.before) {
    compact.before = compactVideoData(source.before);
  }
  if (source.after) {
    compact.after = compactVideoData(source.after);
  }
  if (source.input) {
    compact.input = compactInputData(source.input);
  }
  if (source.timeline) {
    compact.timeline = compactInputData(source.timeline);
  }
  if (source.button) {
    compact.button = source.button;
  }
  if (Array.isArray(source.controls)) {
    compact.controlsCount = source.controls.length;
  }

  return Object.keys(compact).length ? compact : value;
}

function copyDebugFields(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  fields: string[],
): void {
  for (const field of fields) {
    if (source[field] !== undefined) {
      target[field] = source[field];
    }
  }
}

function compactVideoData(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  const compact: Record<string, unknown> = {};
  copyDebugFields(source, compact, [
    "currentTime",
    "duration",
    "paused",
    "ended",
    "seeking",
    "readyState",
    "networkState",
    "playbackRate",
    "volume",
    "muted",
    "buffered",
  ]);
  return compact;
}

function compactInputData(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  const compact: Record<string, unknown> = {};
  copyDebugFields(source, compact, [
    "tag",
    "className",
    "testId",
    "aria",
    "value",
    "min",
    "max",
    "step",
    "ariaValueNow",
    "ariaValueMin",
    "ariaValueMax",
  ]);
  return compact;
}

function rectSnapshot(element: Element): Record<string, number> {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function readBuffered(video: HTMLVideoElement): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let index = 0; index < video.buffered.length; index += 1) {
    ranges.push([round(video.buffered.start(index)), round(video.buffered.end(index))]);
  }
  return ranges;
}

function cleanClassName(className: string | null): string | undefined {
  return className?.trim().replace(/\s+/g, " ").slice(0, 140) || undefined;
}

function cleanText(text: string | null): string | undefined {
  return text?.trim().replace(/\s+/g, " ").slice(0, 90) || undefined;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? round(value) : null;
}

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

function redactUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    if (url.search) {
      return `${url.origin}${url.pathname}?<redacted>${url.hash}`;
    }
    return `${url.origin}${url.pathname}${url.hash}`;
  } catch {
    return value;
  }
}
