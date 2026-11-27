import type { PlaybackState, WatchSourceDescriptor } from "@anidachi/protocol";
import { roomSessionIdentityMatches, type RoomSessionRecord } from "../../room-session-storage";
import { youtubePageWatchSource } from "./url";

type HostPlayback = PlaybackState & { hostSurface?: "player" | "catalog" };
type ViewingContext = {
  session(): RoomSessionRecord | null;
  href(): string;
  playerFingerprint(): string | null;
  apply(state: PlaybackState): void;
  suspend(): void;
  persist(record: RoomSessionRecord, fingerprint: string | null): Promise<boolean>;
  navigate(url: string): void;
  offer(url: string | null): void;
};

function watchSource(href: string) {
  try { return youtubePageWatchSource(new URL(href)); } catch { return null; }
}

/** The viewer chooses a video for this room tab. Receiving playback alone never opens a page. */
export class YouTubeGuestViewing {
  private room: RoomSessionRecord | null = null;
  private following: string | null | undefined;
  private target: { url: string; state: HostPlayback } | null = null;
  private navigating: object | null = null;
  private lastFollowed: string | null = null;
  private hostInCatalog = false;
  private offered: string | null = null;

  constructor(private readonly context: ViewingContext) {}

  bind(record: RoomSessionRecord | null) {
    if (record && this.room && roomSessionIdentityMatches(this.room, record)) return;
    this.room = record;
    this.following = record?.youtubeFollowing;
    this.lastFollowed = this.following ?? null;
    this.hostInCatalog = false;
    this.target = null;
    this.navigating = null;
    this.show(null);
  }

  catalog() {
    if (!this.active()) return;
    this.target = null;
    this.navigating = null;
    if (this.following === undefined && !watchSource(this.context.href())) {
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
    const target = watchSource(url);
    if (this.hostInCatalog || !target || target.videoFingerprint !== state.videoFingerprint) {
      this.catalog();
      return;
    }
    if (target.sourceUrl !== previous?.url) this.navigating = null;
    this.target = { url: target.sourceUrl, state };
    if (syncGuests) void this.join();
    else this.refresh();
  }

  refresh() {
    const target = this.target;
    if (!this.active() || !target || this.navigating) return;
    const fingerprint = target.state.videoFingerprint;
    const onTarget = this.onTarget();
    if (this.following === undefined || (this.following && (!onTarget || this.following !== fingerprint))) {
      const initialDirectJoin = this.following === undefined && onTarget;
      const next = initialDirectJoin ? fingerprint : null;
      this.following = next;
      if (next) this.lastFollowed = next;
      void this.context.persist(this.room!, next).catch(() => false);
    }
    if (this.together()) {
      this.show(null);
      this.context.apply(target.state);
    } else {
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
    const pending = {};
    this.navigating = pending;
    const previous = this.following;
    const fingerprint = target.state.videoFingerprint;
    this.following = fingerprint;
    try {
      const saved = previous === fingerprint || await this.context.persist(room, fingerprint);
      if (!this.active() || this.navigating !== pending || this.target?.url !== target.url) return;
      if (!saved) {
        this.following = previous;
      } else {
        this.lastFollowed = fingerprint;
        if (!this.onTarget() || !this.context.playerFingerprint()) {
          this.context.navigate(target.url);
          return;
        }
      }
    } catch {
      if (this.navigating === pending) this.following = previous;
    }
    if (this.navigating === pending) {
      this.navigating = null;
      this.refresh();
    }
  }

  private active() {
    const current = this.context.session();
    return !!current && !!this.room && roomSessionIdentityMatches(current, this.room);
  }

  private onTarget() {
    return !!this.target && watchSource(this.context.href())?.videoFingerprint === this.target.state.videoFingerprint;
  }

  private show(url: string | null) {
    if (this.offered === url) return;
    this.offered = url;
    this.context.offer(url);
  }
}
