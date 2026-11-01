import { acceptHostingTimeSnapshot, HostingTimeEventSchema, LegacyHostingTimeEventSchema, type HostingTimeBinding, type HostingTimeEvent, type HostingTimeSnapshot } from "@anidachi/protocol";

type Scope = Omit<HostingTimeBinding, "utcDay">;
export type HostingTimeDisplay = { remainingSeconds: number | null; resetSeconds: number; snapshot: HostingTimeSnapshot };

/** A display clock only. Binding is supplied by the authenticated ROOM_SNAPSHOT,
 * never by a HOSTING_TIME payload; ordering survives a transport interruption. */
export class RoomHostingTime {
  private scope: Scope | null = null;
  private ordered: HostingTimeSnapshot | null = null;
  private observation: { event: HostingTimeEvent; monotonic: number; ageAtReceipt: number } | null = null;
  private serverClock: { serverTime: number; monotonic: number } | null = null;
  private transportStartedAt: number | null = null;
  private pendingRecovery: { requestId: string; monotonic: number } | null = null;
  private requireCorrelatedRecovery = false;
  private clockSample: { monotonic: number; wall: number } | null = null;
  recoveryNeeded = false;
  private lastRequest = Number.NEGATIVE_INFINITY;
  private transportBound = false;
  observed = false;
  legacy = false;

  bind(scope: Scope): void {
    if (this.scope && (this.scope.ownerUserId !== scope.ownerUserId || this.scope.roomId !== scope.roomId || this.scope.roomGeneration !== scope.roomGeneration)) {
      this.ordered = null; this.observation = null; this.observed = false;
      this.legacy = false;
    }
    this.scope = scope;
    this.transportBound = true;
  }
  acceptLegacy(value: unknown): boolean {
    const parsed = LegacyHostingTimeEventSchema.safeParse(value);
    if (!parsed.success || !this.scope || !this.transportBound || this.observed ||
      parsed.data.roomId !== this.scope.roomId || parsed.data.roomGeneration !== this.scope.roomGeneration) return false;
    this.legacy = true;
    return true;
  }
  accept(value: unknown, monotonic = performance.now()): boolean {
    const parsed = HostingTimeEventSchema.safeParse(value);
    if (!this.scope || !this.transportBound || this.legacy || !parsed.success) return false;
    const event = parsed.data;
    const recovery = this.pendingRecovery && event.requestId === this.pendingRecovery.requestId ? this.pendingRecovery : null;
    const snapshot = acceptHostingTimeSnapshot({ ...this.scope, utcDay: new Date(event.serverTime).toISOString().slice(0, 10) }, this.ordered, event.snapshot);
    if (!snapshot) return false;
    // Seeing a valid scoped envelope proves support, even if it was buffered
    // while hidden. It must not become a display reading before recovery.
    this.observed = true;
    if ((this.requireCorrelatedRecovery && !recovery) || (event.requestId && !recovery)) {
      if (this.requireCorrelatedRecovery && !this.pendingRecovery) this.recoveryNeeded = true;
      return false;
    }
    this.ordered = snapshot;
    // JOIN/recovery start is a conservative upper bound on measurement age.
    // Later unsolicited events retain this trusted server/monotonic mapping;
    // delayed delivery must not restart their freshness window or refund time.
    const serverNow = recovery
      ? event.serverTime + Math.max(0, monotonic - recovery.monotonic)
      : this.serverClock
        ? Math.max(event.serverTime, this.serverClock.serverTime + Math.max(0, monotonic - this.serverClock.monotonic))
        : event.serverTime + Math.max(0, monotonic - (this.transportStartedAt ?? monotonic));
    this.serverClock = { serverTime: serverNow, monotonic };
    this.observation = { event, monotonic, ageAtReceipt: Math.max(0, serverNow - event.serverTime) };
    if (recovery) { this.pendingRecovery = null; this.requireCorrelatedRecovery = false; this.recoveryNeeded = false; }
    return true;
  }
  read(monotonic = performance.now()): HostingTimeDisplay | null {
    const observation = this.observation;
    if (!observation) return null;
    const { event } = observation;
    const elapsed = observation.ageAtReceipt + Math.max(0, monotonic - observation.monotonic);
    if (event.serverTime + elapsed >= event.validUntil) return null;
    const access = event.snapshot.access;
    return {
      remainingSeconds: access.kind === "daily_free" ? Math.max(0, access.remainingSeconds - (access.metering ? Math.floor(elapsed / 1000) : 0)) : null,
      resetSeconds: Math.max(0, Math.ceil((event.snapshot.period.resetAt - event.serverTime - elapsed) / 1000)),
      snapshot: event.snapshot,
    };
  }
  invalidate(): void { this.observation = null; }
  /** Wall time only detects suspension/clock changes. It never grants seconds. */
  checkContinuity(monotonic = performance.now(), wall = Date.now()): void {
    const previous = this.clockSample;
    this.clockSample = { monotonic, wall };
    if (previous && (monotonic < previous.monotonic || monotonic - previous.monotonic > 5_000 || Math.abs(wall - previous.wall - (monotonic - previous.monotonic)) > 2_000)) this.suspend();
  }
  suspend(): void {
    this.invalidate(); this.serverClock = null; this.pendingRecovery = null;
    this.requireCorrelatedRecovery = true; this.recoveryNeeded = this.observed;
  }
  needsExpiryRecovery(monotonic = performance.now()): boolean {
    return this.observation !== null && this.observation.event.snapshot.access.kind !== "unknown" && this.read(monotonic) === null;
  }
  beginTransport(monotonic = performance.now()): void {
    this.invalidate(); this.transportBound = false; this.serverClock = null;
    this.transportStartedAt = monotonic; this.pendingRecovery = null; this.requireCorrelatedRecovery = false;
    this.recoveryNeeded = false; this.clockSample = { monotonic, wall: Date.now() };
  }
  clear(): void {
    this.scope = null; this.ordered = null; this.observation = null; this.observed = false;
    this.legacy = false;
    this.transportBound = false; this.lastRequest = Number.NEGATIVE_INFINITY;
    this.serverClock = null; this.transportStartedAt = null; this.pendingRecovery = null;
    this.requireCorrelatedRecovery = false; this.recoveryNeeded = false; this.clockSample = null;
  }
  requestRecovery(monotonic = performance.now()): { type: "HOSTING_TIME_REQUEST"; roomId: string; requestId: string } | null {
    if (!this.observed || !this.scope || !this.transportBound || monotonic - this.lastRequest < 5_000) return null;
    this.lastRequest = monotonic;
    this.pendingRecovery = { requestId: crypto.randomUUID(), monotonic };
    this.recoveryNeeded = false;
    return { type: "HOSTING_TIME_REQUEST", roomId: this.scope.roomId, requestId: this.pendingRecovery.requestId };
  }
}
