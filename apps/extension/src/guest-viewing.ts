import { disneyPlusEntityId, type PlaybackState, type WatchSourceDescriptor } from "@anidachi/protocol";
import { roomSessionIdentityMatches, type RoomSessionRecord } from "./room-session-storage";
import { catalogRoomProvider, roomWatchSource, type CatalogRoomProvider } from "./catalog-room-routes";

import type { EpisodeSuccessor } from "./source-adapters/core/types";

type HostPlayback = PlaybackState & { hostSurface?: "player" | "catalog" };
const EPISODE_IDENTITY_WAIT_MS = 10_000;
const PLAYER_ARRIVAL_WAIT_MS = 60_000;
export type GuestPlaybackTiming = { align: boolean; receivedAt: number };
type ViewingContext = {
  session(): RoomSessionRecord | null;
  provider(): CatalogRoomProvider | null;
  href(): string;
  playerFingerprint(): string | null;
  episodeSuccessor?(): EpisodeSuccessor | undefined;
  playerSource?(): WatchSourceDescriptor | undefined;
  continueEpisode?(source: WatchSourceDescriptor, room: RoomSessionRecord, signal: AbortSignal): Promise<boolean>;
  apply(state: PlaybackState, source?: WatchSourceDescriptor, timing?: GuestPlaybackTiming): void;
  suspend(): void;
  persist(record: RoomSessionRecord, fingerprint: string | null): Promise<boolean>;
  navigate(url: string, room: RoomSessionRecord, signal: AbortSignal): void | Promise<boolean | void>;
  targetChanged?(url: string | null): void;
  offer(url: string | null): void;
};

function episodeSeries(source?: WatchSourceDescriptor) {
  if (!source) return null;
  if (source.provider === "disneyplus" || source.provider === "hbomax") {
    const identity = source.provider === "disneyplus" ? source.disneyplusIdentity : source.hbomaxIdentity;
    return identity?.kind === "episode" ? identity.providerSeriesId : null;
  }
  if (source.provider === "netflix" || source.provider === "primevideo" || source.provider === "crunchyroll") {
    return source.episodeSeriesId ?? null;
  }
  return null;
}

/** Viewer opt-in belongs to this tab; it can continue between verified episodes of one series. */
export class GuestViewing {
  private room: RoomSessionRecord | null = null;
  private following: string | null | undefined;
  private target: { url: string; state: HostPlayback; receivedAt: number; source?: WatchSourceDescriptor } | null = null;
  private navigating: AbortController | null = null;
  private awaitingArrival = false;
  private navigationPath: string | null = null;
  private navigatingFrom: string | null = null;
  private playedHere = false;
  private episode: { fingerprint: string; series: string; pending?: string; successor?: EpisodeSuccessor; autoplayDeadline?: number } | null = null;
  private lastFollowed: string | null = null;
  private hostInCatalog = false;
  private offered: string | null = null;
  private deferredOffer: { url: string; timer: ReturnType<typeof setTimeout> } | null = null;

  constructor(private readonly context: ViewingContext) {}

  bind(record: RoomSessionRecord | null) {
    if (record && this.room && roomSessionIdentityMatches(this.room, record)) return;
    this.episode = null;
    this.room = record;
    this.following = record?.followingFingerprint;
    this.playedHere = false;
    this.lastFollowed = this.following ?? null;
    this.hostInCatalog = false;
    this.target = null;
    this.context.targetChanged?.(null);
    this.cancelNavigation();
    this.show(null);
  }

  catalog() {
    if (!this.active()) return;
    if (this.target) this.context.targetChanged?.(null);
    this.target = null;
    if (this.navigatingFrom) this.restoreOrigin();
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
    if (target.sourceUrl !== previous?.url) {
      // A second host switch can supersede a slow native episode handoff.
      if (this.navigatingFrom) this.restoreOrigin();
      this.cancelNavigation();
      this.context.targetChanged?.(target.sourceUrl);
    }
    const sameSource = previous?.state.videoFingerprint === target.videoFingerprint;
    const descriptor = source?.videoFingerprint === target.videoFingerprint ? source : sameSource ? previous.source : undefined;
    // A room snapshot may replay the last heartbeat. Its position still dates from the first receipt.
    const sameSample = sameSource && previous.state.updatedAt === state.updatedAt &&
      previous.state.hostTime === state.hostTime && previous.state.playing === state.playing &&
      previous.state.playbackRate === state.playbackRate;
    this.target = { url: target.sourceUrl, state, receivedAt: sameSample ? previous.receivedAt : Date.now(), source: descriptor };
    if (syncGuests) void this.join();
    else this.refresh();
  }

  refresh(align = false) {
    const target = this.target;
    if (!this.active()) return;
    const localFingerprint = this.localFingerprint();
    // Native autoplay can change the URL before the new adapter or the host heartbeat is ready.
    const origin = this.episode;
    if (origin && !this.navigating && this.following === origin.fingerprint && localFingerprint &&
        localFingerprint !== origin.fingerprint) {
      const netflix = this.context.provider() === "netflix";
      const onHostEpisode = target?.state.videoFingerprint === localFingerprint;
      const hostSeries = episodeSeries(target?.source);
      const withinHandoff = origin.autoplayDeadline === undefined || Date.now() < origin.autoplayDeadline;
      if (withinHandoff && onHostEpisode && hostSeries === origin.series &&
          (netflix || this.context.playerFingerprint() === localFingerprint)) {
        void this.join(origin.fingerprint);
        return;
      }
      // Only the next episode identified by Netflix may wait in place for host confirmation.
      if (netflix && localFingerprint === origin.successor?.fingerprint &&
          target?.state.videoFingerprint === origin.fingerprint && target.state.hostTime >= origin.successor.creditsStart) {
        // Netflix profiles can stay on the credits screen until a viewer chooses Next.
        // The guest is already on the verified successor; wait for the host's choice.
        origin.autoplayDeadline = undefined;
        this.context.suspend();
        this.show(null);
        return;
      }
      if (netflix && withinHandoff && localFingerprint === origin.successor?.fingerprint &&
          (!target || target.state.videoFingerprint === origin.fingerprint || (onHostEpisode && !hostSeries))) {
        origin.autoplayDeadline ??= Date.now() + EPISODE_IDENTITY_WAIT_MS;
        this.context.suspend();
        if (target) this.deferOffer(target.url, origin.autoplayDeadline - Date.now());
        return;
      }
    }
    if (this.episode && !this.navigating && localFingerprint !== this.episode.fingerprint) {
      this.episode = null;
      if (!target && this.following) {
        this.following = null;
        void this.context.persist(this.room!, null).catch(() => false);
      }
    }
    if (!target) return;
    const href = this.context.href();
    const provider = this.context.provider();
    // Netflix exits to title details. Disney can pass through details on the way *into* a player.
    const browsingCatalog = !localFingerprint && (provider === "netflix" || provider === "disneyplus") &&
      catalogRoomProvider(href) === provider && (provider === "netflix" || !disneyPlusEntityId(href));
    if (this.navigationPath !== null) {
      const path = new URL(href).pathname;
      if (browsingCatalog && path !== this.navigationPath) this.cancelNavigation();
      else this.navigationPath = path;
    }
    if (this.navigatingFrom && localFingerprint && !this.onTarget() &&
        localFingerprint !== this.navigatingFrom) {
      this.restoreOrigin();
      this.cancelNavigation();
    }
    if (this.navigating) {
      if (!this.awaitingArrival || !this.together()) return;
      align = true;
      this.cancelNavigation();
    }
    const fingerprint = target.state.videoFingerprint;
    const onTarget = this.onTarget();
    if (this.episode && this.following === this.episode.fingerprint && localFingerprint === this.following &&
        fingerprint !== this.following && !this.context.playerFingerprint()) {
      // The provider can unbind the previous player before it announces the new episode.
      this.context.suspend();
      this.deferOffer(target.url, EPISODE_IDENTITY_WAIT_MS);
      return;
    }
    // A guest may still be watching the old episode while the host passes through
    // the catalogue or while the provider resolves the new episode's series.
    if (this.following && this.following !== fingerprint &&
        localFingerprint === this.following && this.context.playerFingerprint() === this.following) {
      if (!this.episode && this.context.provider() !== "youtube") {
        const local = this.context.playerSource?.();
        const series = episodeSeries(local);
        if (series && local?.videoFingerprint === this.following) this.episode = { fingerprint: this.following, series };
      }
      const origin = this.episode;
      if (origin && origin.fingerprint === this.following && (!origin.pending || origin.pending === fingerprint)) {
        const series = episodeSeries(target.source);
        if (series === origin.series) {
          void this.join(origin.fingerprint);
          return;
        }
        if (!series && !target.source?.disneyplusIdentity && !target.source?.hbomaxIdentity) {
          origin.pending = fingerprint;
          this.context.suspend();
          this.deferOffer(target.url, EPISODE_IDENTITY_WAIT_MS);
          return;
        }
      }
    }
    const leftPlayer = !onTarget && (this.playedHere || localFingerprint !== null || browsingCatalog);
    if (this.following === undefined || (this.following && (leftPlayer || this.following !== fingerprint))) {
      const initialDirectJoin = this.following === undefined && onTarget;
      const next = initialDirectJoin ? fingerprint : null;
      this.episode = null;
      this.following = next;
      if (next) this.lastFollowed = next;
      void this.context.persist(this.room!, next).catch(() => false);
    }
    if (this.together()) {
      const series = episodeSeries(target.source);
      if (series) {
        const previous = this.episode?.fingerprint === fingerprint && this.episode.series === series ? this.episode : null;
        this.episode = { fingerprint, series, successor: this.context.episodeSuccessor?.() ?? previous?.successor };
      }
      const firstPlayback = !this.playedHere || this.deferredOffer?.url === target.url || this.offered === target.url;
      this.playedHere = true;
      this.show(null);
      if (this.context.provider() === "hbomax") {
        this.context.apply(target.state, target.source, { align: align || firstPlayback, receivedAt: target.receivedAt });
      } else {
        this.context.apply(target.state, target.source);
      }
    } else {
      this.context.suspend();
      // A fresh document can restore the follow choice before the native player attaches.
      if (this.following === fingerprint) this.deferOffer(target.url, PLAYER_ARRIVAL_WAIT_MS);
      else {
        this.playedHere = false;
        this.show(target.url);
      }
    }
  }

  get returning() {
    return !!this.target && this.lastFollowed === this.target.state.videoFingerprint;
  }

  together() {
    return this.active() && !!this.target && this.following === this.target.state.videoFingerprint &&
      this.onTarget() && this.context.playerFingerprint() === this.following;
  }

  async join(episodeOrigin?: string) {
    const target = this.target;
    const room = this.room;
    if (!target || !room || !this.active() || this.navigating) return;
    const pending = new AbortController();
    this.navigating = pending;
    const provider = this.context.provider();
    this.navigationPath = provider === "disneyplus" || provider === "netflix" ? new URL(this.context.href()).pathname : null;
    this.show(null);
    this.navigatingFrom = episodeOrigin ?? null;
    const previous = this.following;
    const lastFollowed = this.lastFollowed;
    let stored = false;
    const fingerprint = target.state.videoFingerprint;
    this.following = fingerprint;
    const retry = async () => {
      if (this.navigating !== pending || !this.active()) return;
      if (this.awaitingArrival && this.together()) {
        this.refresh(true);
        return;
      }
      this.episode = null;
      this.following = episodeOrigin ? null : previous;
      this.lastFollowed = lastFollowed;
      if (stored || episodeOrigin) await this.context.persist(room, this.following ?? null).catch(() => false);
      if (this.navigating !== pending) return;
      this.cancelNavigation();
      this.refresh();
      if (this.target?.url === target.url && !this.together()) this.show(target.url);
    };
    try {
      const saved = previous === fingerprint || await this.context.persist(room, fingerprint);
      stored = saved && previous !== fingerprint;
      if (!this.active() || this.navigating !== pending || this.target?.url !== target.url) return;
      const stillWatching = !episodeOrigin || (this.localFingerprint() === episodeOrigin &&
        this.context.playerFingerprint() === episodeOrigin) || this.onTarget();
      if (saved && stillWatching) {
        this.lastFollowed = fingerprint;
        if (this.together()) {
          this.cancelNavigation();
          this.refresh(true);
          return;
        }
        this.awaitingArrival = true;
        // The native Netflix player may already be loading the exact watch URL.
        const loadingInPlace = episodeOrigin && provider === "netflix" && this.onTarget();
        let arrived: boolean | void = true;
        if (!loadingInPlace) {
          arrived = episodeOrigin && target.source && this.context.continueEpisode
            ? await this.context.continueEpisode(target.source, room, pending.signal)
            : await this.context.navigate(target.url, room, pending.signal);
        }
        if (arrived !== false) {
          if (this.navigating === pending) {
            const timer = setTimeout(() => void retry(), PLAYER_ARRIVAL_WAIT_MS);
            pending.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
          }
          return;
        }
      }
    } catch {
      // A rejected browser handoff leaves the original choice available for retry.
    }
    await retry();
  }

  private active() {
    const current = this.context.session();
    return !!current && !!this.room && roomSessionIdentityMatches(current, this.room);
  }

  private localFingerprint() {
    const provider = this.context.provider();
    // Prime can play an episode while its address still names the series or retail product.
    if (provider === "primevideo") {
      const fingerprint = this.context.playerFingerprint();
      return fingerprint === "primevideo|unknown" ? null : fingerprint;
    }
    return roomWatchSource(provider, this.context.href())?.videoFingerprint ?? null;
  }

  private onTarget() {
    return !!this.target && this.localFingerprint() === this.target.state.videoFingerprint;
  }

  private restoreOrigin() {
    this.following = this.navigatingFrom === this.localFingerprint() ? this.navigatingFrom : null;
    if (this.episode) this.episode.pending = undefined;
    if (this.room) void this.context.persist(this.room, this.following).catch(() => false);
  }

  private cancelNavigation() {
    this.navigatingFrom = null;
    this.navigationPath = null;
    this.awaitingArrival = false;
    this.navigating?.abort();
    this.navigating = null;
  }

  private show(url: string | null) {
    if (this.deferredOffer) clearTimeout(this.deferredOffer.timer);
    this.deferredOffer = null;
    if (this.offered === url) return;
    this.offered = url;
    this.context.offer(url);
  }

  private deferOffer(url: string, wait: number) {
    if (this.offered === url || this.deferredOffer?.url === url) return;
    this.show(null);
    this.deferredOffer = { url, timer: setTimeout(() => {
      if (this.active() && this.target?.url === url) this.show(url);
    }, wait) };
  }
}
