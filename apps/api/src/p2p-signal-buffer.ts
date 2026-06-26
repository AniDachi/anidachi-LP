import type { ServerEvent } from "@anidachi/protocol";

export type BufferedP2PSignalEvent = Extract<ServerEvent, { type: "P2P_SIGNAL" }> & {
  serverReceivedAt: number;
  serverSeq: number;
};

export interface P2PSignalReplayScope {
  roomGeneration?: number;
  sourceGeneration?: number;
}

export interface AddP2PSignalResult {
  duplicate: boolean;
  event: BufferedP2PSignalEvent;
}

export class RecentP2PSignalBuffer {
  private readonly events: BufferedP2PSignalEvent[] = [];
  private readonly seenKeys = new Set<string>();

  constructor(
    private readonly maxEvents = 80,
    private readonly ttlMs = 45_000,
  ) {}

  add(event: BufferedP2PSignalEvent, now = Date.now()): AddP2PSignalResult {
    this.prune(now);

    const key = getDedupeKey(event);
    const existing = this.events.find((item) => getDedupeKey(item) === key);
    if (existing) {
      return { duplicate: true, event: existing };
    }

    this.events.push(event);
    this.seenKeys.add(key);
    while (this.events.length > this.maxEvents) {
      const removed = this.events.shift();
      if (removed) {
        this.seenKeys.delete(getDedupeKey(removed));
      }
    }

    return { duplicate: false, event };
  }

  replayFor(
    toUserId: string,
    afterServerSeq = 0,
    now = Date.now(),
    scope: P2PSignalReplayScope = {},
  ): BufferedP2PSignalEvent[] {
    this.prune(now);
    return this.events.filter(
      (event) =>
        event.toUserId === toUserId &&
        event.serverSeq > afterServerSeq &&
        matchesGenerationScope(event, scope),
    );
  }

  prune(now = Date.now()): void {
    let removed = false;
    while (this.events.length > 0) {
      const first = this.events[0];
      if (!first || now - first.serverReceivedAt <= this.ttlMs) {
        break;
      }

      this.events.shift();
      this.seenKeys.delete(getDedupeKey(first));
      removed = true;
    }

    if (removed) {
      this.rebuildDedupeKeys();
    }
  }

  hasSeen(event: Pick<BufferedP2PSignalEvent, "clientSignalId" | "fromUserId" | "roomId" | "toUserId">): boolean {
    return this.seenKeys.has(getDedupeKey(event));
  }

  get size(): number {
    return this.events.length;
  }

  private rebuildDedupeKeys(): void {
    this.seenKeys.clear();
    for (const event of this.events) {
      this.seenKeys.add(getDedupeKey(event));
    }
  }
}

function getDedupeKey(
  event: Pick<BufferedP2PSignalEvent, "clientSignalId" | "fromUserId" | "roomId" | "toUserId">,
): string {
  return `${event.roomId}:${event.fromUserId}:${event.toUserId}:${event.clientSignalId}`;
}

function matchesGenerationScope(
  event: BufferedP2PSignalEvent,
  scope: P2PSignalReplayScope,
): boolean {
  if (scope.roomGeneration !== undefined && event.roomGeneration !== scope.roomGeneration) {
    return false;
  }

  if (scope.sourceGeneration !== undefined && event.sourceGeneration !== scope.sourceGeneration) {
    return false;
  }

  return true;
}
