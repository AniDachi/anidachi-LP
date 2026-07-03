import { ANIDACHI_BUILD_ID, API_HTTP_BASE, API_WS_BASE, WEB_HTTP_BASE } from "./constants";
import { AUTH_TOKENS_STORAGE_KEY } from "./auth-tokens";

export type DiagnosticSeverity = "info" | "warn" | "error";

export interface DiagnosticEntry {
  at: string;
  elapsedMs: number;
  scope: string;
  event: string;
  severity: DiagnosticSeverity;
  data?: unknown;
}

export interface DiagnosticPageSnapshot {
  mode: DiagnosticMode;
  url?: string;
  title?: string;
  visibilityState?: string;
  adapterId?: string;
  roomId?: string | null;
  status?: string;
  hasParticipant?: boolean;
  participantId?: string;
  participantPlan?: string;
  video?: unknown;
  pageDebug?: unknown;
}

export type DiagnosticMessage =
  | {
      type: typeof DIAGNOSTIC_MESSAGE_TYPE;
      command: "save";
      mode: DiagnosticMode;
      page: DiagnosticPageSnapshot;
    }
  | {
      type: typeof DIAGNOSTIC_MESSAGE_TYPE;
      command: "clear";
    };

export type DiagnosticMessageResponse =
  | {
      ok: true;
      action: "downloaded" | "cleared";
      filename?: string;
      downloadId?: number;
    }
  | { ok: false; error: string };

const DIAGNOSTIC_MESSAGE_TYPE = "ANIDACHI_DIAGNOSTICS";
const DIAGNOSTIC_STORAGE_KEY = "anidachi:diagnostic-log:v1";
export type DiagnosticMode = "light" | "full";

const MAX_STORED_DIAGNOSTIC_ENTRIES = 600;
const MAX_STORED_DIAGNOSTIC_ENTRY_AGE_MS = 15 * 60_000;
const MAX_DIAGNOSTIC_ENTRIES_BY_MODE: Record<DiagnosticMode, number> = {
  light: 160,
  full: 500,
};
const MAX_PAGE_DEBUG_ENTRIES_BY_MODE: Record<DiagnosticMode, number> = {
  light: 140,
  full: 500,
};
const EXPORT_WINDOW_MS_BY_MODE: Record<DiagnosticMode, number> = {
  light: 2 * 60_000,
  full: 2 * 60_000,
};
const STARTED_AT = performance.now();

const SECRET_FIELD_RE = /token|secret|cookie|authorization|password/i;
const HASH_ID_FIELDS = new Set([
  "userId",
  "participantId",
  "localParticipantId",
  "remoteUserId",
  "fromUserId",
  "toUserId",
  "byUserId",
]);

export function createSaveDiagnosticsMessage(
  mode: DiagnosticMode,
  page: DiagnosticPageSnapshot,
): DiagnosticMessage {
  return { type: DIAGNOSTIC_MESSAGE_TYPE, command: "save", mode, page };
}

export function createClearDiagnosticsMessage(): DiagnosticMessage {
  return { type: DIAGNOSTIC_MESSAGE_TYPE, command: "clear" };
}

export function isDiagnosticMessage(value: unknown): value is DiagnosticMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<DiagnosticMessage>;
  return (
    message.type === DIAGNOSTIC_MESSAGE_TYPE &&
    (message.command === "save" || message.command === "clear")
  );
}

export async function saveDiagnosticsFromPage(
  mode: DiagnosticMode,
  page: DiagnosticPageSnapshot,
): Promise<DiagnosticMessageResponse> {
  return chrome.runtime.sendMessage(createSaveDiagnosticsMessage(mode, page));
}

export async function clearDiagnosticsFromPage(): Promise<DiagnosticMessageResponse> {
  return chrome.runtime.sendMessage(createClearDiagnosticsMessage());
}

export async function handleDiagnosticMessage(
  message: DiagnosticMessage,
): Promise<DiagnosticMessageResponse> {
  try {
    if (message.command === "clear") {
      await clearDiagnosticEntries();
      return { ok: true, action: "cleared" };
    }

    return await saveDiagnosticBundle(message.mode, message.page);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to save diagnostics",
    };
  }
}

export function recordDiagnosticEvent(
  scope: string,
  event: string,
  data?: unknown,
  severity: DiagnosticSeverity = "info",
): void {
  void appendDiagnosticEntry({ scope, event, data, severity }).catch(() => undefined);
}

async function appendDiagnosticEntry(input: {
  scope: string;
  event: string;
  data?: unknown;
  severity: DiagnosticSeverity;
}): Promise<void> {
  const entries = pruneDiagnosticEntries(await readDiagnosticEntries());
  entries.push({
    at: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - STARTED_AT),
    scope: input.scope,
    event: input.event,
    severity: input.severity,
    ...(input.data === undefined ? {} : { data: sanitizeDiagnosticData(input.data) }),
  });

  await chrome.storage.local.set({
    [DIAGNOSTIC_STORAGE_KEY]: pruneDiagnosticEntries(entries).slice(
      -MAX_STORED_DIAGNOSTIC_ENTRIES,
    ),
  });
}

async function readDiagnosticEntries(): Promise<DiagnosticEntry[]> {
  const value = await chrome.storage.local.get(DIAGNOSTIC_STORAGE_KEY);
  const entries = value[DIAGNOSTIC_STORAGE_KEY];
  return Array.isArray(entries) ? entries.filter(isDiagnosticEntry) : [];
}

async function clearDiagnosticEntries(): Promise<void> {
  await chrome.storage.local.remove(DIAGNOSTIC_STORAGE_KEY);
}

async function saveDiagnosticBundle(
  mode: DiagnosticMode,
  page: DiagnosticPageSnapshot,
): Promise<DiagnosticMessageResponse> {
  recordDiagnosticEvent("diagnostics", "save requested", {
    mode,
    pageUrl: page.url,
    roomId: page.roomId,
    status: page.status,
  });

  const [entries, storageSnapshot] = await Promise.all([
    readDiagnosticEntries(),
    readSafeStorageSnapshot(),
  ]);
  const pageDebug = compactPageDebug(page.pageDebug, mode);
  const diagnosticEntries = entries
    .filter((entry) => isWithinExportWindow(entry.at, mode))
    .slice(-MAX_DIAGNOSTIC_ENTRIES_BY_MODE[mode]);
  const pageDebugEntries = extractPageDebugTimelineEntries(pageDebug, mode);
  const timelineEntries = mergeTimelineEntries(
    diagnosticEntries,
    pageDebugEntries,
    mode,
  );
  const bundle = JSON.stringify(
    {
      app: "Anidachi",
      format: "diagnostics",
      mode,
      generatedAt: new Date().toISOString(),
      buildId: ANIDACHI_BUILD_ID,
      runtime: {
        webHttpBase: WEB_HTTP_BASE,
        apiHttpBase: API_HTTP_BASE,
        apiWsBase: API_WS_BASE,
        userAgent: navigator.userAgent,
      },
      limits: {
        windowSeconds: EXPORT_WINDOW_MS_BY_MODE[mode] / 1000,
        maxDiagnosticEntries: MAX_DIAGNOSTIC_ENTRIES_BY_MODE[mode],
        maxPageDebugEntries: MAX_PAGE_DEBUG_ENTRIES_BY_MODE[mode],
        retainedDiagnosticWindowSeconds: MAX_STORED_DIAGNOSTIC_ENTRY_AGE_MS / 1000,
      },
      page: sanitizeDiagnosticData({
        ...page,
        pageDebug,
      }),
      storage: storageSnapshot,
      entries: timelineEntries,
      diagnosticEntries,
      pageDebugEntries,
    },
    null,
    2,
  );

  const filename = createDiagnosticsFilename(mode);
  const downloaded = await downloadTextFile(bundle, filename);
  return {
    ok: true,
    action: "downloaded",
    filename,
    downloadId: downloaded,
  };
}

async function readSafeStorageSnapshot(): Promise<Record<string, unknown>> {
  const storage = await chrome.storage.local.get(null);
  const authTokens = storage[AUTH_TOKENS_STORAGE_KEY] as
    | {
        user?: {
          id?: unknown;
          displayName?: unknown;
          plan?: unknown;
          avatarUrl?: unknown;
        };
        accessToken?: unknown;
        refreshToken?: unknown;
      }
    | undefined;

  return {
    keys: Object.keys(storage).sort(),
    auth: authTokens
      ? {
          hasAccessToken: typeof authTokens.accessToken === "string",
          hasRefreshToken: typeof authTokens.refreshToken === "string",
          user: authTokens.user
            ? {
                id: typeof authTokens.user.id === "string" ? hashDebugId(authTokens.user.id) : null,
                displayName:
                  typeof authTokens.user.displayName === "string"
                    ? authTokens.user.displayName
                    : null,
                plan: typeof authTokens.user.plan === "string" ? authTokens.user.plan : null,
                hasAvatar: typeof authTokens.user.avatarUrl === "string",
              }
            : null,
        }
      : null,
  };
}

function compactPageDebug(value: unknown, mode: DiagnosticMode): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as { entries?: unknown; totalEntries?: unknown };
  if (!Array.isArray(source.entries)) {
    return source;
  }

  const maxEntries = MAX_PAGE_DEBUG_ENTRIES_BY_MODE[mode];
  const entries = source.entries
    .filter((entry) => isWithinPageDebugExportWindow(entry, mode))
    .filter((entry) => shouldKeepPageDebugEntry(entry, mode))
    .slice(-maxEntries)
    .map((entry) => compactPageDebugEntry(entry, mode));

  return {
    ...source,
    entries,
  };
}

function extractPageDebugTimelineEntries(
  value: unknown,
  mode: DiagnosticMode,
): DiagnosticEntry[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const source = value as { entries?: unknown };
  if (!Array.isArray(source.entries)) {
    return [];
  }

  return source.entries
    .filter((entry) => isWithinPageDebugExportWindow(entry, mode))
    .map((entry) => normalizePageDebugEntry(entry))
    .filter((entry): entry is DiagnosticEntry => Boolean(entry))
    .slice(-MAX_PAGE_DEBUG_ENTRIES_BY_MODE[mode]);
}

function normalizePageDebugEntry(value: unknown): DiagnosticEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as {
    at?: unknown;
    data?: unknown;
    elapsedMs?: unknown;
    message?: unknown;
    scope?: unknown;
  };
  if (typeof entry.at !== "string") {
    return null;
  }

  return {
    at: entry.at,
    elapsedMs: typeof entry.elapsedMs === "number" ? entry.elapsedMs : 0,
    scope: typeof entry.scope === "string" ? `page.${entry.scope}` : "page",
    event: typeof entry.message === "string" ? entry.message : "event",
    severity: "info",
    ...(entry.data === undefined
      ? {}
      : { data: sanitizeDiagnosticData(entry.data) }),
  };
}

function mergeTimelineEntries(
  diagnosticEntries: DiagnosticEntry[],
  pageDebugEntries: DiagnosticEntry[],
  mode: DiagnosticMode,
): DiagnosticEntry[] {
  return [...diagnosticEntries, ...pageDebugEntries]
    .sort((left, right) => {
      const leftAt = Date.parse(left.at);
      const rightAt = Date.parse(right.at);
      const leftTime = Number.isNaN(leftAt) ? 0 : leftAt;
      const rightTime = Number.isNaN(rightAt) ? 0 : rightAt;
      return leftTime - rightTime || left.elapsedMs - right.elapsedMs;
    })
    .slice(
      -(
        MAX_DIAGNOSTIC_ENTRIES_BY_MODE[mode] +
        MAX_PAGE_DEBUG_ENTRIES_BY_MODE[mode]
      ),
    );
}

function pruneDiagnosticEntries(entries: DiagnosticEntry[]): DiagnosticEntry[] {
  const cutoff = Date.now() - MAX_STORED_DIAGNOSTIC_ENTRY_AGE_MS;
  return entries.filter((entry) => {
    const timestamp = Date.parse(entry.at);
    return Number.isNaN(timestamp) || timestamp >= cutoff;
  });
}

function isWithinExportWindow(at: unknown, mode: DiagnosticMode): boolean {
  if (typeof at !== "string") return true;
  const timestamp = Date.parse(at);
  if (Number.isNaN(timestamp)) return true;
  return timestamp >= Date.now() - EXPORT_WINDOW_MS_BY_MODE[mode];
}

function isWithinPageDebugExportWindow(value: unknown, mode: DiagnosticMode): boolean {
  if (!value || typeof value !== "object") return true;
  return isWithinExportWindow((value as { at?: unknown }).at, mode);
}

async function downloadTextFile(text: string, filename: string): Promise<number> {
  if (!chrome.downloads?.download) {
    throw new Error("Chrome downloads permission is unavailable");
  }

  return chrome.downloads.download({
    url: createJsonDataUrl(text),
    filename,
    conflictAction: "uniquify",
    saveAs: true,
  });
}

function createJsonDataUrl(text: string): string {
  return `data:application/json;charset=utf-8,${encodeURIComponent(text)}`;
}

function createDiagnosticsFilename(mode: DiagnosticMode): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `anidachi-logs/anidachi-diagnostics-${mode}-${timestamp}.json`;
}

function shouldKeepPageDebugEntry(value: unknown, mode: DiagnosticMode): boolean {
  if (!value || typeof value !== "object") return false;
  const entry = value as { scope?: unknown; message?: unknown };
  const scope = typeof entry.scope === "string" ? entry.scope : "";
  const message = typeof entry.message === "string" ? entry.message : "";

  if (mode === "light") {
    return (
      scope.startsWith("identity") ||
      scope.startsWith("overlay.room") ||
      scope.startsWith("overlay.status") ||
      scope.startsWith("room.http") ||
      scope.startsWith("room.ws") ||
      scope.startsWith("room.recv") ||
      scope.startsWith("room.send") ||
      scope.startsWith("p2p.state") ||
      scope.startsWith("p2p.ice") ||
      scope.startsWith("p2p.network") ||
      scope.startsWith("p2p.audio") ||
      scope.startsWith("p2p.camera") ||
      scope.startsWith("debug") ||
      /failed|error|closed|timeout|reconnect|clearing|mismatch|signed out|adopted/i.test(message)
    );
  }

  if (scope === "probe" && message === "interval") return false;
  if (scope === "overlay" && message === "relocated") return false;
  if (scope === "video.event" && /^(timeupdate|progress|durationchange|volumechange)$/i.test(message)) {
    return false;
  }
  if (scope === "sync.hostState" && message === "send") return false;
  return true;
}

function compactPageDebugEntry(value: unknown, mode: DiagnosticMode): unknown {
  if (!value || typeof value !== "object") return value;
  const entry = value as { data?: unknown };
  if (mode === "full") return value;

  const compact = { ...(value as Record<string, unknown>) };
  if (entry.data && typeof entry.data === "object") {
    compact.data = compactDiagnosticPageData(entry.data);
  }
  return compact;
}

function compactDiagnosticPageData(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const compact: Record<string, unknown> = {};
  for (const key of [
    "type",
    "roomId",
    "status",
    "code",
    "message",
    "statusCode",
    "roomGeneration",
    "sourceGeneration",
    "serverSeq",
    "connectionState",
    "iceConnectionState",
    "direct",
    "usedTurn",
    "localCandidateType",
    "remoteCandidateType",
    "protocol",
    "localProtocol",
    "remoteProtocol",
    "iceRestartCount",
    "reason",
    "error",
  ]) {
    if (source[key] !== undefined) compact[key] = source[key];
  }
  return Object.keys(compact).length ? compact : source;
}

function isDiagnosticEntry(value: unknown): value is DiagnosticEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<DiagnosticEntry>;
  return (
    typeof entry.at === "string" &&
    typeof entry.elapsedMs === "number" &&
    typeof entry.scope === "string" &&
    typeof entry.event === "string" &&
    (entry.severity === "info" || entry.severity === "warn" || entry.severity === "error")
  );
}

function sanitizeDiagnosticData(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, item) => {
      if (SECRET_FIELD_RE.test(key)) {
        if (typeof item === "boolean" || typeof item === "number" || item === null) {
          return item;
        }
        return item === undefined ? item : "<redacted>";
      }

      if (HASH_ID_FIELDS.has(key) && typeof item === "string") {
        return hashDebugId(item);
      }

      if (typeof item === "string") {
        return redactUrl(item);
      }

      return item;
    }),
  );
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.search ? "?<redacted>" : ""}${
      url.hash ? "#<redacted>" : ""
    }`;
  } catch {
    return value;
  }
}

function hashDebugId(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `id_${(hash >>> 0).toString(36)}`;
}
