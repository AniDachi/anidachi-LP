import type { WatchHistoryDeleteScope, WatchProgressEvent } from "@anidachi/protocol";

export type WatchHistoryOutboxSlot = "terminal" | "latest";

export type WatchHistoryOutboxEntry = {
  event: WatchProgressEvent;
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
