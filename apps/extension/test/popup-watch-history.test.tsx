import type {
  WatchHistoryPreferencesResponse,
  WatchHistoryResponse,
  WatchProgressEvent,
} from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PopupWatchHistoryPanel,
  type PopupWatchHistoryClient,
  type PopupWatchHistorySnapshot,
} from "../src/popup-watch-history";
import {
  createListWatchHistoryMessage,
  type WatchHistoryMessageResponse,
} from "../src/watch-history-client";

const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const NOW = "2026-08-15T03:00:00.000Z";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Popup Watch History v2", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("paints the confirmed current-owner cache, overlays matching pending progress, then accepts canonical refresh", async () => {
    let resolveList: ((value: WatchHistoryMessageResponse) => void) | undefined;
    const cached = historyFixture({ title: "Cached Frieren", currentTime: 420, progress: 0.2 });
    const refreshed = historyFixture({ title: "Canonical Frieren", currentTime: 1_260, progress: 0.6 });
    const client = clientFixture({
      cached: snapshotFixture(cached, [pendingEvent({ currentTime: 840, progress: 0.4 })]),
      request: vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
        if (message.command === "list") {
          return new Promise<WatchHistoryMessageResponse>((resolve) => {
            resolveList = resolve;
          });
        }
        if (message.command === "get-preferences") {
          return { ok: true, data: preferencesFixture(false) };
        }
        if (message.command === "other-owner-pending") {
          return { ok: true, hasPendingWork: false, byteUse: 0 };
        }
        return { ok: true };
      }),
    });

    const view = await renderPanel(client);
    await waitFor(() => expect(view.container.textContent).toContain("Cached Frieren"));
    expect(view.container.textContent).toContain("Pending sync");
    expect(view.container.textContent).toContain("14:00");

    await act(async () => {
      resolveList?.({ ok: true, data: refreshed });
      await Promise.resolve();
    });

    await waitFor(() => expect(view.container.textContent).toContain("Canonical Frieren"));
    expect(view.container.textContent).toContain("21:00");
    expect(view.container.textContent).not.toContain("Cached Frieren");
    expect(client.request).toHaveBeenCalledWith(createListWatchHistoryMessage({ limit: 100 }));

    await unmount(view.root);
  });

  it("treats YouTube as disabled until preferences are confirmed by the current refresh", async () => {
    let resolvePreferences: ((value: WatchHistoryMessageResponse) => void) | undefined;
    const client = clientFixture({
      cached: snapshotFixture(historyFixture(), [], true),
      request: vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
        if (message.command === "list") return { ok: true, data: historyFixture() };
        if (message.command === "get-preferences") {
          return new Promise<WatchHistoryMessageResponse>((resolve) => {
            resolvePreferences = resolve;
          });
        }
        if (message.command === "other-owner-pending") {
          return { ok: true, hasPendingWork: false, byteUse: 0 };
        }
        return { ok: true };
      }),
    });

    const view = await renderPanel(client);
    const toggle = await findButton(view.container, "Track YouTube history");
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      resolvePreferences?.({ ok: true, data: preferencesFixture(true) });
      await Promise.resolve();
    });

    await waitFor(() => expect(toggle.disabled).toBe(false));
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    await unmount(view.root);
  });

  it("patches the account YouTube preference and applies only the confirmed acknowledgement", async () => {
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: historyFixture() };
      if (message.command === "get-preferences") {
        return { ok: true, data: preferencesFixture(false) };
      }
      if (message.command === "update-preferences") {
        return { ok: true, data: preferencesFixture(true) };
      }
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: null, request }));
    const toggle = await findButton(view.container, "Track YouTube history");
    await waitFor(() => expect(toggle.disabled).toBe(false));

    await click(toggle);

    await waitFor(() => expect(toggle.getAttribute("aria-pressed")).toBe("true"));
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      command: "update-preferences",
      input: { youtubeHistoryEnabled: true },
    }));
    await unmount(view.root);
  });

  it("deletes one episode with the current generation and keeps unrelated canonical history", async () => {
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: twoEpisodeHistoryFixture() };
      if (message.command === "get-preferences") {
        return { ok: true, data: preferencesFixture(false) };
      }
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      if (message.command === "delete") {
        const input = message.input as {
          clientMutationId: string;
          accountGeneration: number;
          target: { scope: "episode"; provider: "crunchyroll"; titleKey: string; episodeKey: string };
        };
        return {
          ok: true,
          data: {
            meta: {
              schemaVersion: 2,
              ownerUserId: OWNER_ID,
              accountGeneration: 1,
              serverTime: NOW,
            },
            schemaVersion: 2,
            clientMutationId: input.clientMutationId,
            accountGeneration: input.accountGeneration,
            target: input.target,
            deletedAt: NOW,
          },
        };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: null, request }));
    const deleteFirst = await findButton(view.container, "Delete Episode 1 - The Journey");

    await click(deleteFirst);

    await waitFor(() => expect(view.container.textContent).not.toContain("Episode 1 - The Journey"));
    expect(view.container.textContent).toContain("Episode 2 - The Promise");
    const deletion = request.mock.calls.find(([message]) => message.command === "delete")?.[0];
    expect(deletion).toEqual(expect.objectContaining({
      command: "delete",
      input: expect.objectContaining({
        schemaVersion: 2,
        accountGeneration: 1,
        clientMutationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        target: {
          scope: "episode",
          provider: "crunchyroll",
          titleKey: "crunchyroll:frieren",
          episodeKey: "crunchyroll:episode-1",
        },
      }),
    }));
    await unmount(view.root);
  });

  it("shows only an aggregate old-account warning and discards it only after confirmation", async () => {
    const confirmDiscard = vi.fn(() => true);
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: historyFixture() };
      if (message.command === "get-preferences") {
        return { ok: true, data: preferencesFixture(false) };
      }
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: true, byteUse: 1_024 };
      }
      return { ok: true };
    });
    const client: PopupWatchHistoryClient = {
      ...clientFixture({ cached: null, request }),
      confirmDiscard,
    };
    const view = await renderPanel(client);
    const discard = await findButton(view.container, "Discard pending history from another account");
    expect(view.container.textContent).toContain("Pending history from another account");
    expect(view.container.textContent).not.toContain("00000000-");

    await click(discard);

    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      command: "discard-old-owner-work",
      confirmed: true,
    }));
    await unmount(view.root);
  });

  it("accepts an all-history acknowledgement that advances the account generation", async () => {
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: historyFixture() };
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") return { ok: true, hasPendingWork: false, byteUse: 0 };
      if (message.command === "delete") {
        const input = message.input as { clientMutationId: string; target: { scope: "all" } };
        return {
          ok: true,
          data: {
            meta: { schemaVersion: 2, ownerUserId: OWNER_ID, accountGeneration: 2, serverTime: NOW },
            schemaVersion: 2,
            clientMutationId: input.clientMutationId,
            accountGeneration: 2,
            target: input.target,
            deletedAt: NOW,
          },
        };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: null, request }));
    const clear = await findButton(view.container, "Clear all watch history");

    await click(clear);

    await waitFor(() => expect(view.container.textContent).toContain("Progress will appear"));
    expect(view.container.textContent).not.toContain("Frieren");
    await unmount(view.root);
  });

  it("recreates a room from a canonical session and opens the source with its room id", async () => {
    const openUrl = vi.fn(async () => undefined);
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: historyFixture() };
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") return { ok: true, hasPendingWork: false, byteUse: 0 };
      if (message.command === "create-room") {
        return {
          ok: true,
          data: {
            roomId: "room-popup-1",
            roomToken: "signed-room-token",
            shareableLink: "https://staging.anidachi.app/room/room-popup-1",
            reused: false,
            capabilities: {
              hostPlanCode: "free",
              maxParticipants: 4,
              maxMediaSeats: 2,
              canNameRoom: false,
              canSendPushInvites: false,
            },
            quota: null,
          },
        };
      }
      return { ok: true };
    });
    const client = { ...clientFixture({ cached: null, request }), openUrl };
    const view = await renderPanel(client);
    const createRoom = await findButton(view.container, "Create room from Solo session");

    await click(createRoom);

    await waitFor(() => expect(openUrl).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ command: "create-room", sessionId: SESSION_ID }));
    expect(openUrl).toHaveBeenCalledWith("https://www.crunchyroll.com/watch/EPISODE1#anidachiRoom=room-popup-1");
    await unmount(view.root);
  });

  it("renders a YouTube movie-like item without inventing a catalog denominator", async () => {
    const history = youtubeMovieHistoryFixture();
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: history };
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(true) };
      if (message.command === "other-owner-pending") return { ok: true, hasPendingWork: false, byteUse: 0 };
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: null, request }));

    await waitFor(() => expect(view.container.textContent).toContain("YouTube Movie"));
    expect(view.container.textContent).toContain("1 observed episode");
    expect(view.container.textContent).toContain("5:00");
    expect(view.container.textContent).not.toContain("0/");
    await unmount(view.root);
  });

  it("searches canonical v2 history by title and episode without mutating the response", async () => {
    const history = twoEpisodeHistoryFixture();
    const request = requestForHistory(history);
    const view = await renderPanel(clientFixture({ cached: null, request }));
    const search = await findInput(view.container, "Search watch history");

    await setInputValue(search, "Promise");
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    expect(view.container.textContent).toContain("Episode 2 - The Promise");

    await setInputValue(search, "missing");
    expect(view.container.textContent).toContain("No titles match your search.");
    expect(history.items[0]?.seasons[0]?.episodes).toHaveLength(2);
    await unmount(view.root);
  });

  it("switches between Mine and Together while keeping provider identity visible", async () => {
    const history = mixedSessionHistoryFixture();
    const view = await renderPanel(
      clientFixture({ cached: null, request: requestForHistory(history) }),
    );
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");

    expect(mode.dataset.mode).toBe("mine");
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    expect(view.container.textContent).not.toContain("Episode 2 - The Promise");
    expect(view.container.querySelector(".resource-provider-logo.crunchyroll svg")).not.toBeNull();

    await click(mode);

    await waitFor(() => expect(mode.dataset.mode).toBe("together"));
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    expect(view.container.textContent).toContain("Episode 2 - The Promise");
    await unmount(view.root);
  });

  it("keeps observed progress without a session in Mine and excludes it from Together", async () => {
    const history = observedOnlyHistoryFixture();
    const view = await renderPanel(
      clientFixture({ cached: null, request: requestForHistory(history) }),
    );
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");

    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    await click(mode);

    await waitFor(() => expect(mode.dataset.mode).toBe("together"));
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    expect(view.container.textContent).toContain("Shared sessions will appear after watching together.");
    await unmount(view.root);
  });

  it("projects mixed episode sessions to the selected mode", async () => {
    const history = sameEpisodeMixedSessionHistoryFixture();
    const view = await renderPanel(
      clientFixture({ cached: null, request: requestForHistory(history) }),
    );
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");

    expect(view.container.textContent).toContain("Solo session");
    expect(view.container.textContent).not.toContain("Shared session");
    expect(view.container.textContent).toContain("10:00");
    await click(mode);

    await waitFor(() => expect(mode.dataset.mode).toBe("together"));
    expect(view.container.textContent).not.toContain("Solo session");
    expect(view.container.textContent).toContain("Shared session");
    expect(view.container.textContent).toContain("15:00");
    await unmount(view.root);
  });

  it("applies pending progress only to its Mine or Together mode", async () => {
    const history = sameEpisodeMixedSessionHistoryFixture();
    const sharedPending = pendingEvent({ currentTime: 840, progress: 0.4, shared: true });
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: false, status: "retryable" };
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({
      cached: snapshotFixture(history, [sharedPending]),
      request,
    }));
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");

    expect(view.container.textContent).not.toContain("Pending sync");
    expect(view.container.textContent).toContain("10:00");
    await click(mode);

    await waitFor(() => expect(mode.dataset.mode).toBe("together"));
    expect(view.container.textContent).toContain("Pending sync");
    expect(view.container.textContent).toContain("14:00");
    await unmount(view.root);
  });

  it("retries a transient list failure from the Watch controls", async () => {
    let listAttempts = 0;
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") {
        listAttempts += 1;
        return listAttempts === 1
          ? { ok: false, status: "retryable" }
          : { ok: true, data: historyFixture() };
      }
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: null, request }));

    await waitFor(() => expect(view.container.textContent).toContain("Could not refresh watch history."));
    const retry = await findButton(view.container, "Retry watch history");
    await click(retry);

    await waitFor(() => expect(view.container.textContent).toContain("Frieren"));
    expect(listAttempts).toBe(2);
    expect(view.container.textContent).not.toContain("Could not refresh watch history.");
    await unmount(view.root);
  });

  it("keeps cached rows visible and marks a failed canonical refresh as retryable", async () => {
    const cached = snapshotFixture(historyFixture({ title: "Cached Frieren" }));
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: false, status: "retryable" };
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached, request }));

    await waitFor(() => expect(view.container.textContent).toContain("Could not refresh watch history."));
    expect(view.container.textContent).toContain("Cached Frieren");
    await findButton(view.container, "Retry watch history");
    await unmount(view.root);
  });

  it("recovers full storage before refreshing Watch History", async () => {
    let listAttempts = 0;
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") {
        listAttempts += 1;
        return { ok: true, data: historyFixture() };
      }
      if (message.command === "recover-storage") {
        return { ok: true, data: { capturePaused: false, capturePausedPersisted: false } };
      }
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const cached = snapshotFixture(historyFixture());
    cached.capturePaused = true;
    let cacheReads = 0;
    const client = clientFixture({ cached, request });
    client.loadCached = vi.fn(async () => {
      cacheReads += 1;
      return cacheReads === 1 ? cached : { ...cached, capturePaused: false };
    });
    const view = await renderPanel(client);

    await waitFor(() => expect(view.container.textContent).toContain("browser storage is full"));
    const retry = await findButton(view.container, "Retry watch history");
    await click(retry);

    await waitFor(() => expect(view.container.textContent).not.toContain("browser storage is full"));
    const recoveryCall = request.mock.calls.findIndex(([message]) => message.command === "recover-storage");
    const secondListCall = request.mock.calls.findIndex(
      ([message], index) => message.command === "list" && index > recoveryCall,
    );
    expect(recoveryCall).toBeGreaterThan(-1);
    expect(secondListCall).toBeGreaterThan(recoveryCall);
    expect(listAttempts).toBe(2);
    await unmount(view.root);
  });

  it("keeps recovered cached rows but returns to retry when the next drain is still storage-full", async () => {
    let listAttempts = 0;
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") {
        listAttempts += 1;
        return listAttempts === 1
          ? { ok: true, data: historyFixture({ title: "Cached Frieren" }) }
          : { ok: false, status: "storage-full" };
      }
      if (message.command === "recover-storage") {
        return { ok: true, data: { capturePaused: false, capturePausedPersisted: false } };
      }
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const cached = snapshotFixture(historyFixture({ title: "Cached Frieren" }));
    cached.capturePaused = true;
    let cacheReads = 0;
    const client = clientFixture({ cached, request });
    client.loadCached = vi.fn(async () => {
      cacheReads += 1;
      return cacheReads === 1 ? cached : { ...cached, capturePaused: false };
    });
    const view = await renderPanel(client);
    const retry = await findButton(view.container, "Retry watch history");

    await click(retry);

    await waitFor(() => expect(view.container.textContent).toContain("Browser storage is full."));
    expect(view.container.textContent).toContain("Cached Frieren");
    await findButton(view.container, "Retry watch history");
    expect(listAttempts).toBe(2);
    await unmount(view.root);
  });

  it("preserves the selected mode and search query across a manual refresh", async () => {
    const history = sameEpisodeMixedSessionHistoryFixture();
    const view = await renderPanel(clientFixture({
      cached: null,
      request: requestForHistory(history),
    }));
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");
    const search = await findInput(view.container, "Search watch history");
    await click(mode);
    await setInputValue(search, "Journey");
    const refresh = await findButton(view.container, "Refresh watch history");

    await click(refresh);

    await waitFor(() => expect(view.container.textContent).toContain("Shared session"));
    expect(mode.dataset.mode).toBe("together");
    expect(search.value).toBe("Journey");
    await unmount(view.root);
  });

  it("keeps each redesigned provider section independently collapsible", async () => {
    const view = await renderPanel(
      clientFixture({ cached: null, request: requestForHistory(historyFixture()) }),
    );
    const provider = await findButton(view.container, "Toggle Crunchyroll history");

    expect(provider.getAttribute("aria-expanded")).toBe("true");
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    await click(provider);
    expect(provider.getAttribute("aria-expanded")).toBe("false");
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    await unmount(view.root);
  });
});

function clientFixture(overrides: {
  cached: PopupWatchHistorySnapshot | null;
  request: PopupWatchHistoryClient["request"];
}): PopupWatchHistoryClient {
  return {
    loadCached: vi.fn(async () => overrides.cached),
    request: overrides.request,
    confirmDiscard: vi.fn(() => true),
    openUrl: vi.fn(async () => undefined),
  };
}

function snapshotFixture(
  history: WatchHistoryResponse,
  pendingEvents: WatchProgressEvent[] = [],
  youtubeHistoryEnabled = false,
): PopupWatchHistorySnapshot {
  return {
    history,
    accountGeneration: 1,
    preferences: { youtubeHistoryEnabled },
    pendingEvents,
    capturePaused: false,
  };
}

function historyFixture(overrides: {
  title?: string;
  currentTime?: number;
  progress?: number;
} = {}): WatchHistoryResponse {
  const currentTime = overrides.currentTime ?? 600;
  const progress = overrides.progress ?? 0.5;
  const episode = {
    episodeKey: "crunchyroll:episode-1",
    episodeTitle: "Episode 1 - The Journey",
    seasonKey: "crunchyroll:season-1",
    seasonTitle: "Season 1",
    seasonNumber: 1,
    episodeNumber: 1,
    sourceUrl: "https://www.crunchyroll.com/watch/EPISODE1",
    currentTime,
    duration: 2_100,
    progress,
    completedAt: null,
    lastWatchedAt: NOW,
    sessions: [sessionFixture(currentTime, progress)],
  };
  return {
    meta: {
      schemaVersion: 2,
      ownerUserId: OWNER_ID,
      accountGeneration: 1,
      serverTime: NOW,
    },
    generatedAt: NOW,
    totalTitleCount: 1,
    nextCursor: null,
    items: [
      {
        provider: "crunchyroll",
        titleKey: "crunchyroll:frieren",
        itemKind: "series",
        title: overrides.title ?? "Frieren",
        sourceUrl: episode.sourceUrl,
        artworkUrl: null,
        catalogState: "unavailable",
        aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null },
        seasons: [
          {
            seasonKey: "crunchyroll:season-1",
            seasonTitle: "Season 1",
            seasonNumber: 1,
            order: 0,
            aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null },
            episodes: [episode],
            nextEpisode: null,
          },
        ],
        sessions: [sessionFixture(currentTime, progress)],
        latestActivity: {
          episodeKey: episode.episodeKey,
          currentTime,
          duration: episode.duration,
          progress,
          completedAt: null,
          lastWatchedAt: NOW,
        },
        lastWatchedAt: NOW,
      },
    ],
  };
}

function twoEpisodeHistoryFixture(): WatchHistoryResponse {
  const history = historyFixture();
  const first = history.items[0]?.seasons[0]?.episodes[0];
  if (!first) throw new Error("fixture episode missing");
  const second = {
    ...first,
    episodeKey: "crunchyroll:episode-2",
    episodeTitle: "Episode 2 - The Promise",
    episodeNumber: 2,
    sourceUrl: "https://www.crunchyroll.com/watch/EPISODE2",
  };
  return {
    ...history,
    items: history.items.map((item) => ({
      ...item,
      seasons: item.seasons.map((season) => ({ ...season, episodes: [first, second] })),
    })),
  };
}

function mixedSessionHistoryFixture(): WatchHistoryResponse {
  const history = twoEpisodeHistoryFixture();
  const item = history.items[0];
  const season = item?.seasons[0];
  const first = season?.episodes[0];
  const second = season?.episodes[1];
  if (!item || !season || !first || !second) throw new Error("mixed history fixture missing");
  const shared = sharedSessionFixture(second.currentTime, second.progress);
  return {
    ...history,
    items: [{
      ...item,
      seasons: [{
        ...season,
        episodes: [first, { ...second, sessions: [shared] }],
      }],
      sessions: [...item.sessions, shared],
    }],
  };
}

function observedOnlyHistoryFixture(): WatchHistoryResponse {
  const history = historyFixture();
  return {
    ...history,
    items: history.items.map((item) => ({
      ...item,
      sessions: [],
      seasons: item.seasons.map((season) => ({
        ...season,
        episodes: season.episodes.map((episode) => ({ ...episode, sessions: [] })),
      })),
    })),
  };
}

function sameEpisodeMixedSessionHistoryFixture(): WatchHistoryResponse {
  const history = historyFixture();
  const item = history.items[0];
  const season = item?.seasons[0];
  const episode = season?.episodes[0];
  if (!item || !season || !episode) throw new Error("mixed episode fixture missing");
  const shared = sharedSessionFixture(900, 0.75);
  return {
    ...history,
    items: [{
      ...item,
      sessions: [...item.sessions, shared],
      seasons: [{
        ...season,
        episodes: [{ ...episode, sessions: [...episode.sessions, shared] }],
      }],
    }],
  };
}

function youtubeMovieHistoryFixture(): WatchHistoryResponse {
  const history = historyFixture();
  return {
    ...history,
    items: [{
      ...history.items[0]!,
      provider: "youtube",
      titleKey: "youtube:movie-one",
      itemKind: "movie",
      title: "YouTube Movie",
      sourceUrl: "https://www.youtube.com/watch?v=movie-one",
      seasons: [],
      aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null },
      latestActivity: {
        episodeKey: "youtube:movie-one",
        currentTime: 300,
        duration: 600,
        progress: 0.5,
        completedAt: null,
        lastWatchedAt: NOW,
      },
      sessions: [sessionFixture(300, 0.5)],
    }],
  };
}

function sessionFixture(currentTime: number, progress: number) {
  return {
    id: SESSION_ID,
    roomId: null,
    roomGeneration: null,
    hostUserId: OWNER_ID,
    kind: "solo" as const,
    sourceGeneration: null,
    currentTime,
    duration: 2_100,
    progress,
    startedAt: NOW,
    endedAt: null,
    lastWatchedAt: NOW,
    participants: [],
  };
}

function sharedSessionFixture(currentTime: number, progress: number) {
  return {
    ...sessionFixture(currentTime, progress),
    id: "00000000-0000-4000-8000-000000000004",
    roomId: "room-popup-shared",
    roomGeneration: 1,
    kind: "shared" as const,
    sourceGeneration: 1,
  };
}

function requestForHistory(history: WatchHistoryResponse): PopupWatchHistoryClient["request"] {
  return vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
    if (message.command === "list") return { ok: true, data: history };
    if (message.command === "get-preferences") {
      return { ok: true, data: preferencesFixture(false) };
    }
    if (message.command === "other-owner-pending") {
      return { ok: true, hasPendingWork: false, byteUse: 0 };
    }
    return { ok: true };
  });
}

function pendingEvent(overrides: {
  currentTime: number;
  progress: number;
  shared?: boolean;
}): WatchProgressEvent {
  return {
    schemaVersion: 2,
    clientEventId: "00000000-0000-4000-8000-000000000003",
    clientSessionKey: "popup-test-session",
    accountGeneration: 1,
    provider: "crunchyroll",
    titleKey: "crunchyroll:frieren",
    itemKind: "series",
    title: "Cached Frieren",
    artworkUrl: null,
    episodeKey: "crunchyroll:episode-1",
    episodeTitle: "Episode 1 - The Journey",
    seasonKey: "crunchyroll:season-1",
    seasonTitle: "Season 1",
    seasonNumber: 1,
    episodeNumber: 1,
    sourceUrl: "https://www.crunchyroll.com/watch/EPISODE1",
    currentTime: overrides.currentTime,
    duration: 2_100,
    progress: overrides.progress,
    observedAt: NOW,
    kind: "pause",
    sharedRoom: overrides.shared ? {
      roomId: "room-popup-shared",
      participantSessionId: "participant-popup-shared",
      roomGeneration: 1,
      sourceGeneration: 1,
      attestation: "room-attestation-proof",
    } : null,
  };
}

function preferencesFixture(youtubeHistoryEnabled: boolean): WatchHistoryPreferencesResponse {
  return {
    meta: {
      schemaVersion: 2,
      ownerUserId: OWNER_ID,
      accountGeneration: 1,
      serverTime: NOW,
    },
    preferences: { youtubeHistoryEnabled },
  };
}

async function renderPanel(client: PopupWatchHistoryClient) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<PopupWatchHistoryPanel client={client} ownerUserId={OWNER_ID} />);
  });
  return { container, root };
}

async function findButton(container: HTMLElement, name: string): Promise<HTMLButtonElement> {
  let button: HTMLButtonElement | null = null;
  await waitFor(() => {
    button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.getAttribute("aria-label") === name,
    ) ?? null;
    expect(button).not.toBeNull();
  });
  if (!button) throw new Error(`Button not found: ${name}`);
  return button;
}

async function findInput(container: HTMLElement, name: string): Promise<HTMLInputElement> {
  let input: HTMLInputElement | null = null;
  await waitFor(() => {
    input = container.querySelector(`input[aria-label="${name}"]`);
    expect(input).not.toBeNull();
  });
  if (!input) throw new Error(`Input not found: ${name}`);
  return input;
}

async function setInputValue(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => button.click());
}

async function waitFor(assertion: () => void, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
  throw lastError;
}

async function unmount(root: Root): Promise<void> {
  await act(async () => root.unmount());
}
