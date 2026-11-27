import type { PlaybackState, WatchSourceDescriptor } from "@anidachi/protocol";
import { roomSessionIdentityMatches, type RoomSessionRecord } from "./room-session-storage";
import { roomWatchSource, type CatalogRoomProvider } from "./catalog-room-routes";

type HostPlayback = PlaybackState & { hostSurface?: "player" | "catalog" };
type ViewingContext = {
  session(): RoomSessionRecord | null;
  provider(): CatalogRoomProvider | null;
  href(): string;
  playerFingerprint(): string | null;
  apply(state: PlaybackState, source?: WatchSourceDescriptor): void;
  suspend(): void;
  persist(record: RoomSessionRecord, fingerprint: string | null): Promise<boolean>;
  navigate(url: string, room: RoomSessionRecord, signal: AbortSignal): void | Promise<boolean | void>;
  offer(url: string | null): void;
};

/** The viewer chooses a video for this room tab. Receiving playback alone never opens a page. */
export class GuestViewing {
  private room: RoomSessionRecord | null = null;
  private following: string | null | undefined;
  private target: { url: string; state: HostPlayback; source?: WatchSourceDescriptor } | null = null;
  private navigating: AbortController | null = null;
  private awaitingArrival = false;
  private playedHere = false;
  private lastFollowed: string | null = null;
  private hostInCatalog = false;
  private offered: string | null = null;

  constructor(private readonly context: ViewingContext) {}

  bind(record: RoomSessionRecord | null) {
    if (record && this.room && roomSessionIdentityMatches(this.room, record)) return;
    this.room = record;
    this.following = record?.followingFingerprint;
    this.playedHere = false;
    this.lastFollowed = this.following ?? null;
    this.hostInCatalog = false;
    this.target = null;
    this.cancelNavigation();
    this.show(null);
  }

  catalog() {
    if (!this.active()) return;
    this.target = null;
    this.cancelNavigation();
    if (this.following === undefined && !this.localFingerprint()) {
      this.following = null;
      void this.context.persist(this.room!, null).catch(() => false);
    }
    this.context.suspend();
    this.show(null);
  }

  receive(state: HostPlayback, source?: WatchSourceDescriptor, syncGuests = false) {
    if (!this.active()) return;
    if (state.hostSurface) this.hostInCatalog = state.hostSurface === "catalog";
    const previous = this.target;
    const url = state.sourceUrl ?? source?.sourceUrl ??
      (previous?.state.videoFingerprint === state.videoFingerprint ? previous.url : "");
    const target = roomWatchSource(this.context.provider(), url);
    if (this.hostInCatalog || !target || target.videoFingerprint !== state.videoFingerprint) {
      this.catalog();
      return;
    }
    if (target.sourceUrl !== previous?.url) this.cancelNavigation();
    const sameSource = previous?.state.videoFingerprint === target.videoFingerprint;
    const descriptor = source?.videoFingerprint === target.videoFingerprint ? source : sameSource ? previous.source : undefined;
    this.target = { url: target.sourceUrl, state, source: descriptor };
    if (syncGuests) void this.join();
    else this.refresh();
  }

  refresh() {
    const target = this.target;
    if (!this.active() || !target) return;
    if (this.navigating) {
      if (!this.awaitingArrival || !this.together()) return;
      this.cancelNavigation();
    }
    const fingerprint = target.state.videoFingerprint;
    const onTarget = this.onTarget();
    const leftPlayer = !onTarget && (this.playedHere || this.localFingerprint() !== null);
    if (this.following === undefined || (this.following && (leftPlayer || this.following !== fingerprint))) {
      const initialDirectJoin = this.following === undefined && onTarget;
      const next = initialDirectJoin ? fingerprint : null;
      this.following = next;
      if (next) this.lastFollowed = next;
      void this.context.persist(this.room!, next).catch(() => false);
    }
    if (this.together()) {
      this.playedHere = true;
      this.show(null);
      this.context.apply(target.state, target.source);
    } else {
      this.playedHere = false;
      this.context.suspend();
      this.show(target.url);
    }
  }

  get returning() {
    return !!this.target && this.lastFollowed === this.target.state.videoFingerprint;
  }

  together() {
    return this.active() && !!this.target && this.following === this.target.state.videoFingerprint &&
      this.onTarget() && this.context.playerFingerprint() === this.following;
  }

  async join() {
    const target = this.target;
    const room = this.room;
    if (!target || !room || !this.active() || this.navigating) return;
    const pending = new AbortController();
    this.navigating = pending;
    const previous = this.following;
    const lastFollowed = this.lastFollowed;
    let stored = false;
    const fingerprint = target.state.videoFingerprint;
    this.following = fingerprint;
    try {
      const saved = previous === fingerprint || await this.context.persist(room, fingerprint);
      stored = saved && previous !== fingerprint;
      if (!this.active() || this.navigating !== pending || this.target?.url !== target.url) return;
      if (saved) {
        this.lastFollowed = fingerprint;
        if (this.onTarget() && this.context.playerFingerprint()) {
          this.cancelNavigation();
          this.refresh();
          return;
        }
        this.awaitingArrival = true;
        if (await this.context.navigate(target.url, room, pending.signal) !== false) return;
      }
    } catch {
      // A rejected browser handoff leaves the original choice available for retry.
    }
    if (this.navigating !== pending || !this.active()) return;
    this.following = previous;
    this.lastFollowed = lastFollowed;
    if (stored) await this.context.persist(room, previous ?? null).catch(() => false);
    if (this.navigating !== pending) return;
    this.cancelNavigation();
    this.refresh();
  }

  private active() {
    const current = this.context.session();
    return !!current && !!this.room && roomSessionIdentityMatches(current, this.room);
  }

  private localFingerprint() {
    const provider = this.context.provider();
    // Prime can play an episode while its address still names the series or retail product.
    if (provider === "primevideo") return this.context.playerFingerprint();
    return roomWatchSource(provider, this.context.href())?.videoFingerprint ?? null;
  }

  private onTarget() {
    return !!this.target && this.localFingerprint() === this.target.state.videoFingerprint;
  }

  private cancelNavigation() {
    this.awaitingArrival = false;
    this.navigating?.abort();
    this.navigating = null;
  }

  private show(url: string | null) {
    if (this.offered === url) return;
    this.offered = url;
    this.context.offer(url);
  }
}
