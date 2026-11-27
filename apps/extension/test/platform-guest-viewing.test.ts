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

  const alignment = provider === "hbomax" ? [expect.objectContaining({ align: true })] : [];

  function setup() {
    let record: RoomSessionRecord = { version: 1, revision: 1, roomId: "room", ownerUserId: "guest",
      participantSessionId: "session", cameraEnabled: false, voiceMode: "push-to-talk" };
    const page = { href: home, fingerprint: null as string | null };
    const ctx = { provider: () => provider, session: () => record, href: () => page.href, playerFingerprint: () => page.fingerprint,
      apply: vi.fn(), suspend: vi.fn(), offer: vi.fn(), continueEpisode: vi.fn(async () => true), navigate: vi.fn(async () => true),
      persist: vi.fn(async (_room: RoomSessionRecord, followingFingerprint: string | null) => {
        record = { ...record, followingFingerprint };
        return true;
      }),
    };
    function mount() { const machine = new GuestViewing(ctx); machine.bind(record); return machine; }
    function play(href: string, fingerprint: string) {
      page.href = home.includes("amazon.com") ? "https://www.amazon.com/gp/video/detail/B0FX2ZCPFK" : href;
      page.fingerprint = fingerprint;
    }
    function leave() { page.href = home; page.fingerprint = null; }
    return { ctx, mount, play, leave, machine: mount() };
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
    play(watchUrl, host.videoFingerprint);
    const restored = mount();
    restored.receive(state, host);
    expect(restored.together()).toBe(true);
    expect(ctx.apply).toHaveBeenLastCalledWith(state, host, ...alignment);
    const later = { ...state, hostTime: 82 };
    restored.receive(later, undefined, true);
    expect(ctx.apply).toHaveBeenLastCalledWith(later, host, ...alignment);
    expect(ctx.navigate).toHaveBeenCalledTimes(1);

    play(personalUrl, personal.videoFingerprint);
    expect(restored.together()).toBe(false);
    restored.refresh();
    expect(ctx.offer).toHaveBeenLastCalledWith(host.sourceUrl);
    restored.receive({ ...state, hostSurface: "catalog" }, host, true);
    expect(ctx.offer).toHaveBeenLastCalledWith(null);
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
    expect(ctx.apply).toHaveBeenLastCalledWith(nextState, episode(personal), ...alignment);
  });

  it("synchronizes in place when both players have advanced to the exact same episode", async () => {
    const { ctx, machine, play } = setup();
    play(watchUrl, host.videoFingerprint);
    machine.receive(state, episode(host));
    play(personalUrl, personal.videoFingerprint);
    machine.receive(nextState, episode(personal));
    await Promise.resolve();
    expect(machine.together()).toBe(true);
    expect(ctx.apply).toHaveBeenLastCalledWith(nextState, episode(personal), ...alignment);
    expect(ctx.continueEpisode).not.toHaveBeenCalled();
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it.each(["different series", "unknown series", "guest left", "guest chose another episode"])("offers playback without moving the guest: %s", async mode => {
    const { ctx, machine, play, leave } = setup();
    play(watchUrl, host.videoFingerprint);
    machine.receive(state, episode(host));
    if (mode === "guest left") leave();
    if (mode === "guest chose another episode") { play(personalUrl, personal.videoFingerprint); machine.refresh(); }
    machine.receive(nextState, mode === "unknown series" ? personal : episode(personal, mode === "different series" ? second : first));
    await Promise.resolve();
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.continueEpisode).not.toHaveBeenCalled();
    expect(machine.together()).toBe(false);
    expect(ctx.offer).toHaveBeenLastCalledWith(personal.sourceUrl);
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
    expect(ctx.persist).toHaveBeenLastCalledWith(expect.anything(), null);
    play(watchUrl, host.videoFingerprint);
    const restored = mount();
    restored.receive(state, host);
    expect(restored.together()).toBe(false);
    expect(ctx.apply).not.toHaveBeenCalled();
  });
});
