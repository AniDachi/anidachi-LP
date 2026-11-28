import { describe, expect, it, vi } from "vitest";
import { WatchSourceDescriptorSchema, canonicalizeRoomSourceUrl, primeVideoSourceUrl } from "@anidachi/protocol";
import { catalogRoomProvider, type CatalogRoomProvider } from "../src/catalog-room-routes";
import { GuestViewing } from "../src/guest-viewing";
import type { RoomSessionRecord } from "../src/room-session-storage";

const first = "120ae1e6-2240-4924-a4ce-f8de6e28b0b1";
const second = "4d269596-6871-4419-892a-ca2b801d447d";
const prime = primeVideoSourceUrl("0AAAAAAAAAAAAAAAAAAAAAAAAA");
const otherPrime = primeVideoSourceUrl("0BBBBBBBBBBBBBBBBBBBBBBBBB");
const platforms: [string, CatalogRoomProvider, string, string, string][] = [
  ["Netflix", "netflix", "https://www.netflix.com/browse", "https://www.netflix.com/watch/81234567", "https://www.netflix.com/watch/81234568"],
  ["Crunchyroll", "crunchyroll", "https://www.crunchyroll.com/de", "https://www.crunchyroll.com/de/watch/G8WUNM123/pilot", "https://www.crunchyroll.com/de/watch/G8WUNM124/second"],
  ["Disney+", "disneyplus", "https://www.disneyplus.com/fr/home", "https://www.disneyplus.com/fr/play/" + first, "https://www.disneyplus.com/fr/play/" + second],
  ["Hulu on Disney+", "disneyplus", "https://www.disneyplus.com/pt-br/browse/hulu", "https://www.disneyplus.com/pt-br/play/" + first, "https://www.disneyplus.com/pt-br/play/" + second],
  ["HBO Max", "hbomax", "https://play.max.com/br/pt-br/home", "https://play.max.com/br/pt-br/video/watch/" + first, "https://play.max.com/br/pt-br/video/watch/" + second],
  ["Prime Video", "primevideo", "https://www.primevideo.com/", prime, otherPrime],
  ["Amazon retail", "primevideo", "https://www.amazon.com/gp/video/storefront", prime, otherPrime],
];

function descriptor(url: string, provider: CatalogRoomProvider) {
  const result = canonicalizeRoomSourceUrl(url, provider);
  if (!result.ok) throw new Error(result.code);
  return { ...result.source, title: "Episode" };
}

describe.each(platforms)("%s guest playback choice", (_, provider, home, watchUrl, personalUrl) => {
  const host = descriptor(watchUrl, provider);
  const personal = descriptor(personalUrl, provider);
  const state = { hostSurface: "player" as const, playing: false, playbackRate: 1, updatedAt: 3000,
    hostTime: 47, sourceUrl: host.sourceUrl, videoFingerprint: host.videoFingerprint };

  function setup() {
    let record: RoomSessionRecord = { version: 1, revision: 1, roomId: "room", ownerUserId: "guest",
      participantSessionId: "session", cameraEnabled: false, voiceMode: "push-to-talk" };
    const page = { href: home, fingerprint: null as string | null };
    const ctx = { provider: () => provider, session: () => record, href: () => page.href, playerFingerprint: () => page.fingerprint,
      episodeSuccessor: vi.fn<() => { fingerprint: string; creditsStart: number } | undefined>(),
      apply: vi.fn(), suspend: vi.fn(), offer: vi.fn(), targetChanged: vi.fn(), continueEpisode: vi.fn(async () => true), navigate: vi.fn(async () => true),
      persist: vi.fn(async (_room: RoomSessionRecord, followingFingerprint: string | null) => {
        record = { ...record, followingFingerprint };
        return true;
      }),
    };
    const timingSamples = vi.fn();
    function mount() {
      const machine = new GuestViewing({ ...ctx, apply: (sample, source, timing) => {
        timingSamples(timing);
        ctx.apply(sample, source);
      } });
      machine.bind(record);
      return machine;
    }
    function play(href: string, fingerprint: string) {
      page.href = home.includes("amazon.com") ? "https://www.amazon.com/gp/video/detail/B0FX2ZCPFK" : href;
      page.fingerprint = fingerprint;
    }
    function leave() { page.href = home; page.fingerprint = null; }
    return { ctx, mount, play, leave, page, timingSamples, machine: mount() };
  }

  it.each(["sleeve", "host sync"])("stays independent until %s, returns to the exact episode and syncs in place", async action => {
    expect(catalogRoomProvider(home)).toBe(provider);
    const { ctx, mount, play, machine } = setup();
    machine.catalog();
    machine.receive({ ...state, playing: true }, host);
    play(personalUrl, personal.videoFingerprint);
    machine.refresh();
    machine.receive(state);
    expect(ctx.offer).toHaveBeenLastCalledWith(host.sourceUrl);
    expect(ctx.apply).not.toHaveBeenCalled();
    expect(ctx.navigate).not.toHaveBeenCalled();

    if (action === "sleeve") await machine.join();
    else { machine.receive(state, host, true); await Promise.resolve(); }
    expect(ctx.navigate).toHaveBeenCalledExactlyOnceWith(host.sourceUrl, expect.anything(), expect.any(AbortSignal));
    const restored = mount();
    if (provider === "primevideo") {
      // The new document can receive the host's pause before Prime identifies the episode.
      play(watchUrl, "primevideo|unknown");
      restored.receive(state, host);
      expect(ctx.persist).toHaveBeenLastCalledWith(expect.anything(), host.videoFingerprint);
      expect(ctx.apply).not.toHaveBeenCalled();
    }
    play(watchUrl, host.videoFingerprint);
    restored.receive(state, host);
    expect(restored.together()).toBe(true);
    expect(ctx.apply).toHaveBeenLastCalledWith(state, host);
    if (provider === "primevideo") expect(ctx.offer).toHaveBeenLastCalledWith(null);
    const later = { ...state, hostTime: 82 };
    restored.receive(later, undefined, true);
    expect(ctx.apply).toHaveBeenLastCalledWith(later, host);
    expect(ctx.navigate).toHaveBeenCalledTimes(1);

    play(personalUrl, personal.videoFingerprint);
    expect(restored.together()).toBe(false);
    restored.refresh();
    expect(ctx.offer).toHaveBeenLastCalledWith(host.sourceUrl);
    restored.receive({ ...state, hostSurface: "catalog" }, host, true);
    expect(ctx.offer).toHaveBeenLastCalledWith(null);
  });

  if (provider === "hbomax") it("requests precise alignment on return and gather, once per action", async () => {
    const { play, machine, timingSamples } = setup();
    machine.catalog();
    machine.receive(state, host);
    await machine.join();
    play(watchUrl, host.videoFingerprint);
    machine.refresh();
    expect(timingSamples).toHaveBeenLastCalledWith({ align: true, receivedAt: expect.any(Number) });
    machine.receive(state, host);
    expect(timingSamples).toHaveBeenLastCalledWith({ align: false, receivedAt: expect.any(Number) });
    machine.receive(state, host, true);
    expect(timingSamples).toHaveBeenLastCalledWith({ align: true, receivedAt: expect.any(Number) });
  });

  if (provider === "hbomax") it("keeps the original receipt time when a room snapshot replays the preceding heartbeat", () => {
    const now = vi.spyOn(Date, "now");
    try {
      const { machine, play, timingSamples } = setup();
      play(watchUrl, host.videoFingerprint);
      let sample = { ...state, playing: true, hostTime: 285.168 };
      let arrival = 10_000;
      now.mockReturnValue(arrival);
      machine.receive(sample, host);
      for (let i = 0; i < 6; i++) {
        now.mockReturnValue(arrival + 1498);
        machine.receive({ ...sample }, host);
        expect(timingSamples).toHaveBeenLastCalledWith({ align: false, receivedAt: arrival });
        arrival += 1500;
        now.mockReturnValue(arrival);
        sample = { ...sample, hostTime: sample.hostTime + 1.5, updatedAt: sample.updatedAt + 1500 };
        machine.receive(sample);
        expect(timingSamples).toHaveBeenLastCalledWith({ align: false, receivedAt: arrival });
      }
      now.mockReturnValue(arrival + 100);
      machine.receive({ ...sample, playing: false }, host, true);
      expect(timingSamples).toHaveBeenLastCalledWith({ align: true, receivedAt: arrival + 100 });
    } finally {
      now.mockRestore();
    }
  });

  const nextState = { ...state, hostTime: 12, sourceUrl: personal.sourceUrl, videoFingerprint: personal.videoFingerprint };
  function episode(source: typeof host, series = first) {
    const identity = { kind: "episode", providerSeriesId: series, providerEpisodeIdentifier: source.sourceUrl.split("/").at(-1) };
    const ids = provider === "disneyplus" ? { disneyplusIdentity: identity } :
      provider === "hbomax" ? { hbomaxIdentity: identity } : { episodeSeriesId: series };
    return WatchSourceDescriptorSchema.parse({ ...source, ...ids });
  }

  it.each(["autoplay", "manual via catalog", "late identity"])("follows the same series once on %s", async mode => {
    const { ctx, machine, play } = setup();
    play(watchUrl, host.videoFingerprint);
    machine.receive(state, episode(host));
    expect(machine.together()).toBe(true);
    if (mode === "manual via catalog") machine.receive({ ...state, hostSurface: "catalog" }, host);
    if (mode === "late identity") {
      machine.receive(nextState, personal);
      expect(ctx.continueEpisode).not.toHaveBeenCalled();
    }
    machine.receive(nextState, episode(personal));
    machine.receive(nextState);
    await Promise.resolve();
    expect(ctx.continueEpisode).toHaveBeenCalledExactlyOnceWith(episode(personal), expect.anything(), expect.any(AbortSignal));
    play(personalUrl, personal.videoFingerprint);
    machine.refresh();
    expect(machine.together()).toBe(true);
    expect(ctx.apply).toHaveBeenLastCalledWith(nextState, episode(personal));
    expect(ctx.offer).not.toHaveBeenCalled();
  });

  if (provider === "netflix" || provider === "disneyplus") {
    it.each(["guest advances first", "host player announced first", "host metadata arrives late"])(
      "keeps watching together during native autoplay when %s", async order => {
        const { machine, ctx, play, page } = setup();
        ctx.episodeSuccessor.mockReturnValue({ fingerprint: personal.videoFingerprint, creditsStart: 3080 });
        play(watchUrl, host.videoFingerprint);
        machine.receive(state, episode(host));
        if (order === "host player announced first") {
          page.fingerprint = null;
          machine.receive(nextState, episode(personal));
        }
        page.href = personalUrl;
        page.fingerprint = null;
        machine.refresh();
        if (order === "host metadata arrives late") machine.receive(nextState, personal);
        if (order === "guest advances first") {
          play(personalUrl, personal.videoFingerprint);
          machine.refresh();
          machine.receive(state, episode(host));
        }
        machine.receive(nextState, episode(personal));
        await Promise.resolve();
        play(personalUrl, personal.videoFingerprint);
        machine.refresh();
        expect(machine.together()).toBe(true);
        expect(ctx.apply).toHaveBeenLastCalledWith(nextState, episode(personal));
        expect(ctx.offer).not.toHaveBeenCalled();
        expect(ctx.navigate).not.toHaveBeenCalled();
        expect(ctx.continueEpisode).not.toHaveBeenCalled();
      }
    );

    it.each(["host advances", "guest leaves", "host rewinds"])(
      "preserves the shared choice on native credits beyond ten seconds until %s", async outcome => {
        vi.useFakeTimers();
        try {
          const { machine, ctx, play, leave } = setup();
          ctx.episodeSuccessor.mockReturnValue({ fingerprint: personal.videoFingerprint, creditsStart: 3080 });
          play(watchUrl, host.videoFingerprint);
          const credits = { ...state, hostTime: 3110 };
          const previous = { ...episode(host), duration: 3207.666666 };
          machine.receive(credits, previous);
          play(personalUrl, personal.videoFingerprint);
          machine.refresh();
          await vi.advanceTimersByTimeAsync(45_000);
          machine.receive(credits, previous);
          expect(ctx.offer).not.toHaveBeenCalled();
          expect(ctx.persist).not.toHaveBeenCalledWith(expect.anything(), null);
          if (outcome === "guest leaves") {
            leave();
            machine.refresh();
            expect(ctx.offer).toHaveBeenLastCalledWith(host.sourceUrl);
          } else if (outcome === "host rewinds") {
            machine.receive(state, previous);
            await vi.advanceTimersByTimeAsync(10_001);
            machine.refresh();
            expect(ctx.offer).toHaveBeenLastCalledWith(host.sourceUrl);
          }
          machine.receive(nextState, episode(personal));
          await Promise.resolve();
          expect(machine.together()).toBe(outcome === "host advances");
          if (outcome === "host advances") {
            expect(ctx.apply).toHaveBeenLastCalledWith(nextState, episode(personal));
            machine.receive({ ...nextState, playing: true });
            machine.receive({ ...nextState, playing: false });
            expect(ctx.apply).toHaveBeenLastCalledWith({ ...nextState, playing: false }, episode(personal));
            expect(ctx.offer).not.toHaveBeenCalled();
          }
          expect(ctx.continueEpisode).not.toHaveBeenCalled();
        } finally { vi.useRealTimers(); }
      }
    );

    it.each(["host stays", "guest browses"])("ends the pending autoplay choice if %s", async reason => {
      vi.useFakeTimers();
      try {
        const { ctx, machine, play, leave } = setup();
        ctx.episodeSuccessor.mockReturnValue({ fingerprint: personal.videoFingerprint, creditsStart: 3080 });
        play(watchUrl, host.videoFingerprint);
        machine.receive(state, episode(host));
        play(personalUrl, personal.videoFingerprint);
        machine.refresh();
        expect(ctx.offer).not.toHaveBeenCalled();
        if (reason === "host stays") await vi.advanceTimersByTimeAsync(10_001);
        else { leave(); machine.refresh(); }
        expect(ctx.offer).toHaveBeenLastCalledWith(host.sourceUrl);
        machine.receive(nextState, episode(personal));
        expect(machine.together()).toBe(false);
        expect(ctx.continueEpisode).not.toHaveBeenCalled();
      } finally { vi.useRealTimers(); }
    });
  }

  if (provider === "disneyplus") it("continues direct playback using the native sequential episode before series metadata arrives", async () => {
    const { machine, ctx, play, page } = setup();
    ctx.episodeSuccessor.mockReturnValue({ fingerprint: personal.videoFingerprint, creditsStart: 700 });
    play(watchUrl, host.videoFingerprint);
    machine.receive({ ...state, hostTime: 710 }, host);
    page.href = personalUrl;
    page.fingerprint = null;
    machine.refresh();
    machine.receive(nextState, personal);
    await Promise.resolve();
    play(personalUrl, personal.videoFingerprint);
    machine.refresh();
    expect(machine.together()).toBe(true);
    expect(ctx.apply).toHaveBeenLastCalledWith(nextState, personal);
    expect(ctx.offer).not.toHaveBeenCalled();
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.continueEpisode).not.toHaveBeenCalled();
  });

  it("synchronizes in place when both players have advanced to the exact same episode", async () => {
    const { ctx, machine, play } = setup();
    play(watchUrl, host.videoFingerprint);
    machine.receive(state, episode(host));
    play(personalUrl, personal.videoFingerprint);
    machine.receive(nextState, episode(personal));
    await Promise.resolve();
    expect(machine.together()).toBe(true);
    expect(ctx.apply).toHaveBeenLastCalledWith(nextState, episode(personal));
    expect(ctx.continueEpisode).not.toHaveBeenCalled();
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  if (provider !== "primevideo") it("keeps the offer hidden while the old player reattaches during a host episode change", async () => {
    const { ctx, machine, play, page } = setup();
    play(watchUrl, host.videoFingerprint);
    machine.receive(state, episode(host));
    page.fingerprint = null;
    machine.receive(nextState, episode(personal));
    expect(ctx.continueEpisode).not.toHaveBeenCalled();
    page.fingerprint = host.videoFingerprint;
    machine.refresh();
    await Promise.resolve();
    expect(ctx.continueEpisode).toHaveBeenCalledOnce();
    play(personalUrl, personal.videoFingerprint);
    machine.refresh();
    expect(machine.together()).toBe(true);
    expect(ctx.offer).not.toHaveBeenCalled();
  });

  it.each(["different series", "guest left", "guest chose another episode"])("offers playback without moving the guest: %s", async mode => {
    const { ctx, machine, play, leave } = setup();
    play(watchUrl, host.videoFingerprint);
    machine.receive(state, episode(host));
    if (mode === "guest left") leave();
    if (mode === "guest chose another episode") { play(personalUrl, personal.videoFingerprint); machine.refresh(); }
    machine.receive(nextState, episode(personal, mode === "different series" ? second : first));
    await Promise.resolve();
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.continueEpisode).not.toHaveBeenCalled();
    expect(machine.together()).toBe(false);
    expect(ctx.offer).toHaveBeenLastCalledWith(personal.sourceUrl);
  });

  it.each(["click", "host sync"])("hides the offer immediately on %s and through player restoration", async action => {
    const { ctx, machine, page, mount, play } = setup();
    machine.receive(state, host);
    expect(ctx.offer).toHaveBeenLastCalledWith(host.sourceUrl);
    if (action === "click") void machine.join();
    else machine.receive(state, host, true);
    expect(ctx.offer).toHaveBeenLastCalledWith(null);
    ctx.offer.mockClear();
    machine.receive(state, host);
    await Promise.resolve();
    expect(ctx.navigate).toHaveBeenCalledOnce();
    machine.bind(null);
    page.href = watchUrl;
    const restored = mount();
    restored.receive(state, host);
    expect(ctx.targetChanged).toHaveBeenLastCalledWith(host.sourceUrl);
    expect(restored.together()).toBe(false);
    play(watchUrl, host.videoFingerprint);
    restored.refresh();
    expect(restored.together()).toBe(true);
    expect(ctx.offer).not.toHaveBeenCalled();
  });

  if (provider === "netflix") it.each(["/title/80057918", "/browse/genre/83", "/search?q=Lucifer"])(
    "offers the current Netflix episode immediately after Back to Browse restores the session at %s",
    async path => {
      const { ctx, machine, mount, page, play } = setup();
      play(watchUrl, host.videoFingerprint);
      machine.receive(state, episode(host));
      machine.bind(null);
      page.href = new URL(path, home).href;
      page.fingerprint = null;
      const restored = mount();
      restored.receive(state, episode(host));
      expect(ctx.offer).toHaveBeenLastCalledWith(host.sourceUrl);
      expect(restored.returning).toBe(true);
      expect(ctx.persist).toHaveBeenLastCalledWith(expect.anything(), null);
      restored.receive(nextState, episode(personal));
      expect(ctx.continueEpisode).not.toHaveBeenCalled();
      expect(ctx.navigate).not.toHaveBeenCalled();
      await restored.join();
      expect(ctx.navigate).toHaveBeenCalledExactlyOnceWith(personal.sourceUrl, expect.anything(), expect.any(AbortSignal));
      expect(ctx.offer).toHaveBeenLastCalledWith(null);
      play(personalUrl, personal.videoFingerprint);
      restored.refresh();
      expect(restored.together()).toBe(true);
    },
  );

  if (provider === "disneyplus" || provider === "netflix") it.each(["same document", "new document"])(
    "restores the return button immediately when the guest switches catalog pages in the %s",
    async transition => {
      const { ctx, machine, mount, page } = setup();
      machine.receive(state, host);
      await machine.join();
      machine.refresh();
      expect(ctx.offer).toHaveBeenLastCalledWith(null);
      page.href = provider === "netflix" ? new URL("/title/80057918", home).href : new URL("../browse/movies", watchUrl).href;
      if (transition === "new document") {
        machine.bind(null);
        mount().receive(state, host);
      } else machine.refresh();
      expect(ctx.navigate).toHaveBeenCalledWith(host.sourceUrl, expect.anything(), expect.objectContaining({ aborted: true }));
      expect(ctx.offer).toHaveBeenLastCalledWith(host.sourceUrl);
      expect(ctx.navigate).toHaveBeenCalledTimes(1);
      expect(ctx.apply).not.toHaveBeenCalled();
    },
  );

  it("offers an unresolved title after the metadata wait, unless the room has ended", () => {
    vi.useFakeTimers();
    try {
      const { ctx, machine, play } = setup();
      play(watchUrl, host.videoFingerprint);
      machine.receive(state, episode(host));
      machine.receive(nextState, personal);
      vi.advanceTimersByTime(6000);
      machine.receive(nextState, personal);
      expect(ctx.offer).not.toHaveBeenCalled();
      vi.advanceTimersByTime(4000);
      expect(ctx.offer).toHaveBeenLastCalledWith(personal.sourceUrl);
      expect(ctx.continueEpisode).not.toHaveBeenCalled();
      machine.receive(state, episode(host));
      machine.receive(nextState, personal);
      machine.bind(null);
      ctx.offer.mockClear();
      vi.runAllTimers();
      expect(ctx.offer).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("allows retry when the browser accepts the return but never opens the video", async () => {
    vi.useFakeTimers();
    try {
      const { machine, ctx } = setup();
      machine.receive(state, host);
      await machine.join();
      expect(ctx.offer).toHaveBeenLastCalledWith(null);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(ctx.offer).toHaveBeenLastCalledWith(host.sourceUrl);
      await machine.join();
      expect(ctx.navigate).toHaveBeenCalledTimes(2);
      machine.bind(null);
    } finally { vi.useRealTimers(); }
  });

  it("respects a guest leaving while the new episode choice is being saved", async () => {
    const { ctx, machine, play, leave } = setup();
    play(watchUrl, host.videoFingerprint);
    machine.receive(state, episode(host));
    let finish!: () => void;
    ctx.persist.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(true); }));
    machine.receive(nextState, episode(personal));
    leave();
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.continueEpisode).not.toHaveBeenCalled();
    expect(ctx.persist).toHaveBeenLastCalledWith(expect.anything(), null);
  });

  it("restores independent playback after an unsuccessful handoff", async () => {
    const { ctx, machine, mount, play } = setup();
    machine.catalog();
    machine.receive(state, host);
    ctx.navigate.mockResolvedValueOnce(false);
    await machine.join();
    expect(ctx.offer.mock.calls).toEqual([[host.sourceUrl], [null], [host.sourceUrl]]);
    expect(ctx.persist).toHaveBeenLastCalledWith(expect.anything(), null);
    play(watchUrl, host.videoFingerprint);
    const restored = mount();
    restored.receive(state, host);
    expect(restored.together()).toBe(false);
    expect(ctx.apply).not.toHaveBeenCalled();
  });
});
