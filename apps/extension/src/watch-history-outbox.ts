import { WatchProgressEventSchema, type WatchHistoryDeleteScope, type WatchProgressEvent } from "@anidachi/protocol";

export type WatchHistoryLocalEvent = WatchProgressEvent & {
  identityPending?: { watchId: string; requestedLocale: string };
};

/** Local-only envelope. Unresolved events must never reach the HTTP boundary. */
export function parseWatchHistoryLocalEvent(value: unknown):
  { success: true; data: WatchHistoryLocalEvent } | { success: false } {
  const resolved = WatchProgressEventSchema.safeParse(value);
  if (resolved.success) return resolved;
  if (!value || typeof value !== "object" || Array.isArray(value)) return { success: false };
  const event = value as Record<string, unknown>;
  const pending = event.identityPending;
  if (!pending || typeof pending !== "object" || Array.isArray(pending)) return { success: false };
  const { watchId, requestedLocale } = pending as Record<string, unknown>;
  if (Object.keys(pending).some((key) => key !== "watchId" && key !== "requestedLocale") ||
    typeof watchId !== "string" || !/^[A-Za-z0-9_-]{1,190}$/.test(watchId) ||
    typeof requestedLocale !== "string" || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(requestedLocale) || requestedLocale.length > 35 ||
    event.provider !== "crunchyroll" || event.crunchyrollIdentity !== undefined || event.youtubeVideoId !== undefined ||
    event.sourceUrl !== `https://www.crunchyroll.com/watch/${watchId}` ||
    Object.keys(event).some((key) => key !== "identityPending" && !(key in WatchProgressEventSchema.shape))) return { success: false };
  for (const [key, schema] of Object.entries(WatchProgressEventSchema.shape)) {
    if (!schema.safeParse(event[key]).success) return { success: false };
  }
  return { success: true, data: event as WatchHistoryLocalEvent };
}

export type WatchHistoryOutboxSlot = "terminal" | "latest";

export type WatchHistoryOutboxEntry = {
  event: WatchHistoryLocalEvent;
  key: string;
  slot: WatchHistoryOutboxSlot;
  persistedAt: number;
};

export type WatchHistoryOutboxPartition = {
  ownerUserId: string;
  accountGeneration: number;
  entries: WatchHistoryOutboxEntry[];
};

const TERMINAL_KIND: WatchProgressEvent["kind"] = "ended";

export function watchHistoryOutboxKey(
  partition: Pick<WatchHistoryOutboxPartition, "ownerUserId" | "accountGeneration">,
  event: WatchProgressEvent,
): string {
  return [
    partition.ownerUserId,
    String(partition.accountGeneration),
    event.provider,
    event.titleKey,
    event.episodeKey,
    event.clientSessionKey,
  ].map(encodeURIComponent).join(":");
}

export function enqueueWatchHistoryEvent(
  partition: WatchHistoryOutboxPartition,
  event: WatchProgressEvent,
  persistedAt = Date.now(),
): WatchHistoryOutboxPartition {
  if (event.accountGeneration !== partition.accountGeneration) {
    throw new Error("Watch history event generation does not match its outbox partition");
  }
  const key = watchHistoryOutboxKey(partition, event);
  const slot: WatchHistoryOutboxSlot = event.kind === TERMINAL_KIND ? "terminal" : "latest";
  if (slot === "terminal" && partition.entries.some((candidate) => candidate.key === key && candidate.slot === slot)) {
    return partition;
  }
  const entry: WatchHistoryOutboxEntry = { event, key, slot, persistedAt };
  return {
    ...partition,
    entries: [...partition.entries.filter((candidate) => candidate.key !== key || candidate.slot !== slot), entry],
  };
}

export function acknowledgeWatchHistoryEvent(
  partition: WatchHistoryOutboxPartition,
  clientEventId: string,
): WatchHistoryOutboxPartition {
  const entries = partition.entries.filter((entry) => entry.event.clientEventId !== clientEventId);
  return entries.length === partition.entries.length ? partition : { ...partition, entries };
}

export function removeWatchHistoryEventsForDeletion(
  partition: WatchHistoryOutboxPartition,
  target: WatchHistoryDeleteScope,
): WatchHistoryOutboxPartition {
  const entries = partition.entries.filter((entry) => !eventMatchesDeletion(entry.event, target));
  return entries.length === partition.entries.length ? partition : { ...partition, entries };
}

export function orderWatchHistoryOutbox(
  partition: WatchHistoryOutboxPartition,
): WatchHistoryOutboxEntry[] {
  return [...partition.entries].sort((left, right) => {
    const slot = Number(right.slot === "terminal") - Number(left.slot === "terminal");
    if (slot !== 0) return slot;
    const observed = left.event.observedAt.localeCompare(right.event.observedAt);
    if (observed !== 0) return observed;
    return left.event.clientEventId.localeCompare(right.event.clientEventId);
  });
}

export function hasWatchHistoryOutboxEntries(partition: WatchHistoryOutboxPartition): boolean {
  return partition.entries.length > 0;
}

function eventMatchesDeletion(event: WatchProgressEvent, target: WatchHistoryDeleteScope): boolean {
  if (target.scope === "all") return true;
  if (event.provider !== target.provider || event.titleKey !== target.titleKey) return false;
  return target.scope === "title" || event.episodeKey === target.episodeKey;
}
