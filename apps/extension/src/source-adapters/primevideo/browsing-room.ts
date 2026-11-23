import { getExpectedHostTime, type ClientEvent, type PlaybackState, type WatchSourceDescriptor } from "@anidachi/protocol";

import { supportsCatalogReturn, supportsCatalogRoom } from "../../catalog-room-routes";

type Launch = (source: WatchSourceDescriptor, roomId: string, signal: AbortSignal) => Promise<boolean>;
export type PrimeBrowsingBaseline = { fingerprint?: string; visit?: string; followFirstPlay?: boolean };

type HostEvent = Extract<ClientEvent, { type: "HOST_STATE" }>;

export class PrimeHostVisit {
  private visit: string | undefined;
  private last: HostEvent | null = null;
  constructor(private waitingForPlay = false) {}

  playback(event: HostEvent): HostEvent | null {
    if (this.waitingForPlay && (!event.state.playing || !event.source)) return null;
    if (!supportsCatalogRoom(event.source?.provider)) return event;
    this.waitingForPlay = false;
    this.visit ??= crypto.randomUUID();
    this.last = { ...event, state: { ...event.state, primePlayerVisit: this.visit,
      ...(supportsCatalogReturn(event.source?.provider) && { hostSurface: "player" as const }) } };
    return this.last;
  }

  close(roomId: string | null): HostEvent | null {
    const last = this.last;
    this.last = null;
    this.visit = undefined;
    this.waitingForPlay = true;
    if (!last || last.roomId !== roomId) return null;
    const updatedAt = Date.now();
    const hostTime = Math.min(last.source?.duration ?? Infinity, getExpectedHostTime(last.state, updatedAt));
    return { ...last, state: { ...last.state, hostTime, playing: false, updatedAt,
      ...(supportsCatalogReturn(last.source?.provider) && { hostSurface: "catalog" as const }) } };
  }
}

/** Only authoritative host playback can take a browsing guest to a title. */
export class PrimeBrowsingRoom {
  private roomId: string | null = null;
  private source: WatchSourceDescriptor | undefined;
  private visit: string | undefined;
  private baseline: PrimeBrowsingBaseline | null = null;
  private pending: { key: string; abort: AbortController } | null = null;

  setRoom(roomId: string | null) {
    if (roomId === this.roomId) return;
    this.setBrowsing(false);
    this.roomId = roomId;
    this.source = undefined;
    this.visit = undefined;
  }

  getBaseline(): PrimeBrowsingBaseline {
    return { ...(this.baseline ?? { fingerprint: this.source?.videoFingerprint, visit: this.visit }) };
  }

  setBrowsing(browsing: boolean, restored?: PrimeBrowsingBaseline) {
    if (browsing && !this.baseline) {
      this.baseline = restored ? { ...restored } : this.getBaseline();
    } else if (!browsing) {
      this.pending?.abort.abort();
      this.pending = null;
      this.baseline = null;
    }
  }

  receive(state: PlaybackState, source: WatchSourceDescriptor | undefined, launch: Launch) {
    if (!this.roomId) return;
    if (source && supportsCatalogRoom(source.provider) && source.videoFingerprint === state.videoFingerprint) this.source = source;
    if (state.primePlayerVisit) this.visit = state.primePlayerVisit;
    const target = this.source;
    const baseline = this.baseline;
    if (!baseline || !target || target.videoFingerprint !== state.videoFingerprint) return;
    // A first snapshot establishes the baseline even if it arrives late.
    if (!baseline.fingerprint && !baseline.followFirstPlay) {
      baseline.fingerprint = target.videoFingerprint;
      baseline.visit = state.primePlayerVisit;
    }
    const key = target.videoFingerprint + "/" + (state.primePlayerVisit ?? "");
    if (this.pending && this.pending.key !== key) {
      this.pending.abort.abort();
      this.pending = null;
    }
    if (!state.playing || this.pending || (baseline.fingerprint === target.videoFingerprint &&
      (!state.primePlayerVisit || baseline.visit === state.primePlayerVisit))) return;
    const attempt = { key, abort: new AbortController() };
    this.pending = attempt;
    void launch(target, this.roomId, attempt.abort.signal).catch(() => false).then(started => {
      if (!started && this.pending === attempt) this.pending = null;
    });
  }
}
