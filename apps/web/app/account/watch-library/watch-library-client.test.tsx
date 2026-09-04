import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type {
  WatchHistoryItem,
  WatchHistoryPreferencesResponse,
  WatchHistoryResponse,
  WatchHistoryTitleEpisodesResponse,
} from "@anidachi/protocol";
import { Window } from "happy-dom";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  loadWatchHistoryTitleEpisodePage,
  mergeWatchHistoryTitleEpisodePage,
  WatchLibraryClient,
} from "./watch-library-client";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-08-21T12:00:00.000Z";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const testWindow = new Window({
  url: "https://staging.anidachi.app/account/watch-library",
}) as Window & { confirm: (message?: string) => boolean };
testWindow.confirm = () => false;
const originalFetch = globalThis.fetch;
for (const [name, value] of Object.entries({
  window: testWindow,
  document: testWindow.document,
  navigator: testWindow.navigator,
  HTMLElement: testWindow.HTMLElement,
  HTMLButtonElement: testWindow.HTMLButtonElement,
  Node: testWindow.Node,
  Event: testWindow.Event,
  MouseEvent: testWindow.MouseEvent,
})) {
  Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
}

function episode(episodeKey: string, episodeNumber: number, currentTime = 60) {
  return {
    episodeKey,
    episodeTitle: `Episode ${episodeNumber}`,
    seasonKey: "season-one",
    seasonTitle: "Season One",
    seasonNumber: 1,
    episodeNumber,
    sourceUrl: `https://www.crunchyroll.com/watch/${episodeKey}/demo`,
    currentTime,
    duration: 1_200,
    progress: currentTime / 1_200,
    completedAt: null,
    lastWatchedAt: NOW,
    sessions: [],
  };
}

function itemFixture(): WatchHistoryItem {
  const first = episode("episode-one", 1);
  const second = episode("episode-two", 2);
  return {
    provider: "crunchyroll",
    titleKey: "series-one",
    observedEpisodeCount: 12,
    completedEpisodeCount: 3,
    episodePage: { complete: false, nextCursor: "cursor-one" },
    itemKind: "series",
    title: "Series One",
    sourceUrl: first.sourceUrl,
    artworkUrl: null,
    catalogState: "unavailable",
    aggregate: { completedEpisodes: 3, availableEpisodes: null, progress: null },
    seasons: [{
      seasonKey: "season-one",
      seasonTitle: "Season One",
      seasonNumber: 1,
      order: 0,
      aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null },
      episodes: [first, second],
      nextEpisode: null,
    }],
    sessions: [],
    latestActivity: {
      episodeKey: first.episodeKey,
      currentTime: first.currentTime,
      duration: first.duration,
      progress: first.progress,
      completedAt: null,
      lastWatchedAt: NOW,
    },
    lastWatchedAt: NOW,
  };
}

function detailFixture(): WatchHistoryTitleEpisodesResponse {
  return {
    meta: {
      serverTime: NOW,
      schemaVersion: 3,
      ownerUserId: OWNER_ID,
      accountGeneration: 1,
    },
    generatedAt: NOW,
    provider: "crunchyroll",
    titleKey: "series-one",
    observedEpisodeCount: 12,
    completedEpisodeCount: 3,
    episodes: [episode("episode-two", 2, 120), episode("episode-three", 3, 180)],
    catalog: {
      state: "unavailable",
      title: null,
      aggregate: null,
      seasons: [],
    },
    complete: false,
    nextCursor: "cursor-two",
  };
}

function historyFixture(): WatchHistoryResponse {
  return {
    meta: {
      serverTime: NOW,
      schemaVersion: 3,
      ownerUserId: OWNER_ID,
      accountGeneration: 1,
    },
    generatedAt: NOW,
    totalTitleCount: 1,
    items: [itemFixture()],
    nextCursor: null,
  };
}

const preferencesFixture: WatchHistoryPreferencesResponse = {
  meta: {
    serverTime: NOW,
    schemaVersion: 3,
    ownerUserId: OWNER_ID,
    accountGeneration: 1,
  },
  preferences: { youtubeHistoryEnabled: false },
};

afterEach(() => {
  document.body.replaceChildren();
  globalThis.fetch = originalFetch;
  testWindow.confirm = () => false;
});

it("website keeps the bounded title slice collapsed until the user asks to see it", () => {
  const markup = renderToStaticMarkup(React.createElement(
    WatchLibraryClient,
    { initialHistory: historyFixture(), initialPreferences: preferencesFixture },
  ));

  assert.match(markup, /Show episodes/);
  assert.doesNotMatch(markup, /Episode 1/);
});

it("website detail pages merge by canonical episode identity and retain continuation", () => {
  const merged = mergeWatchHistoryTitleEpisodePage(itemFixture(), detailFixture());
  const episodes = merged.seasons.flatMap((season) => season.episodes);
  assert.deepEqual(episodes.map((value) => value.episodeKey), [
    "episode-one",
    "episode-two",
    "episode-three",
  ]);
  assert.equal(episodes.find((value) => value.episodeKey === "episode-two")?.currentTime, 120);
  assert.deepEqual(merged.episodePage, { complete: false, nextCursor: "cursor-two" });
  assert.equal(merged.observedEpisodeCount, 12);
});

it("website detail request is owner-bound and a failure leaves the current slice untouched", async () => {
  const item = itemFixture();
  const before = structuredClone(item);
  const paths: string[] = [];
  const loaded = await loadWatchHistoryTitleEpisodePage({
    ownerUserId: OWNER_ID,
    item,
    cursor: "cursor one",
    request: async (path) => {
      paths.push(path);
      return detailFixture();
    },
  });
  assert.equal(loaded.nextCursor, "cursor-two");
  assert.deepEqual(paths, [
    "/api/watch-history/v3/title-episodes?provider=crunchyroll&titleKey=series-one&limit=50&cursor=cursor+one",
  ]);

  await assert.rejects(() => loadWatchHistoryTitleEpisodePage({
    ownerUserId: OWNER_ID,
    item,
    cursor: "cursor-one",
    request: async () => { throw new Error("offline"); },
  }), /offline/);
  await assert.rejects(() => loadWatchHistoryTitleEpisodePage({
    ownerUserId: OWNER_ID,
    accountGeneration: 2,
    item,
    cursor: "cursor-one",
    request: async () => detailFixture(),
  }), /owner or title changed/);
  assert.deepEqual(item, before);
});

describe("website detail interactions", () => {
  it("keeps visible rows on failure and retries only after the user asks", async () => {
    let attempts = 0;
    globalThis.fetch = async (input: string | URL | Request) => {
      if (!String(input).includes("/api/watch-history/v3/title-episodes")) {
        throw new Error(`Unexpected request: ${String(input)}`);
      }
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      return Response.json(detailFixture());
    };
    const view = await renderClient();
    await click(buttonByText(view.container, "Show episodes"));
    assert.match(view.container.textContent ?? "", /Episode 1/);

    await click(buttonByText(view.container, "Load more episodes"));
    await waitFor(() => {
      assert.match(view.container.textContent ?? "", /Retry loading episodes/);
      assert.match(view.container.textContent ?? "", /Episode 1/);
    });
    assert.equal(attempts, 1);

    await click(buttonByText(view.container, "Retry loading episodes"));
    await waitFor(() => assert.match(view.container.textContent ?? "", /Episode 3/));
    assert.equal(attempts, 2);
    await unmount(view.root);
  });

  it("ignores a deferred detail page after a newer canonical refresh", async () => {
    let resolveDetail: ((response: Response) => void) | undefined;
    const refreshed = historyFixture();
    const refreshedItem = refreshed.items[0];
    const refreshedSeason = refreshedItem?.seasons[0];
    if (!refreshedItem || !refreshedSeason) throw new Error("Refresh fixture missing");
    refreshed.items[0] = {
      ...refreshedItem,
      title: "Series One Refreshed",
      seasons: [{
        ...refreshedSeason,
        episodes: [episode("episode-one", 1, 900)],
      }],
    };
    globalThis.fetch = async (input: string | URL | Request) => {
      const path = String(input);
      if (path.includes("/api/watch-history/v3/title-episodes")) {
        return new Promise<Response>((resolve) => { resolveDetail = resolve; });
      }
      if (path === "/api/watch-history/v3?limit=24") return Response.json(refreshed);
      if (path === "/api/watch-history/v3/preferences") return Response.json(preferencesFixture);
      throw new Error(`Unexpected request: ${path}`);
    };
    const view = await renderClient();
    await click(buttonByText(view.container, "Show episodes"));
    await click(buttonByText(view.container, "Load more episodes"));
    await waitFor(() => assert.equal(typeof resolveDetail, "function"));

    await click(buttonByText(view.container, "Refresh"));
    await waitFor(() => assert.match(view.container.textContent ?? "", /Series One Refreshed/));
    await act(async () => { resolveDetail?.(Response.json(detailFixture())); });

    await waitFor(() => assert.doesNotMatch(view.container.textContent ?? "", /Episode 3/));
    assert.match(view.container.textContent ?? "", /15:00/);
    await unmount(view.root);
  });

  for (const scope of ["episode", "title"] as const) {
    it(`ignores a deferred detail page after ${scope} deletion`, async () => {
      let resolveDetail: ((response: Response) => void) | undefined;
      testWindow.confirm = () => true;
      globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
        const path = String(input);
        if (path.includes("/api/watch-history/v3/title-episodes")) {
          return new Promise<Response>((resolve) => { resolveDetail = resolve; });
        }
        if (path === "/api/watch-history/v3/delete") {
          const target = scope === "episode"
            ? { scope, provider: "crunchyroll", titleKey: "series-one", episodeKey: "episode-one" }
            : { scope, provider: "crunchyroll", titleKey: "series-one" };
          return Response.json({
            meta: {
              serverTime: NOW,
              schemaVersion: 3,
              ownerUserId: OWNER_ID,
              accountGeneration: 1,
            },
            schemaVersion: 3,
            clientMutationId: "22222222-2222-4222-8222-222222222222",
            accountGeneration: 1,
            target,
            deletedAt: NOW,
          });
        }
        throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
      };
      const view = await renderClient();
      await click(buttonByText(view.container, "Show episodes"));
      await click(buttonByText(view.container, "Load more episodes"));
      await waitFor(() => assert.equal(typeof resolveDetail, "function"));

      await click(scope === "episode"
        ? buttonByLabel(view.container, "Delete Episode 1")
        : buttonByText(view.container, "Delete title"));
      await waitFor(() => {
        if (scope === "episode") assert.doesNotMatch(view.container.textContent ?? "", /Episode 1/);
        else assert.doesNotMatch(view.container.textContent ?? "", /Series One/);
      });
      await act(async () => { resolveDetail?.(Response.json(detailFixture())); });
      await waitFor(() => assert.doesNotMatch(view.container.textContent ?? "", /Episode 3/));
      await unmount(view.root);
    });
  }
});

async function renderClient(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(WatchLibraryClient, {
      initialHistory: historyFixture(),
      initialPreferences: preferencesFixture,
    }));
  });
  return { container, root };
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => { button.click(); });
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")]
    .find((candidate) => candidate.textContent?.trim() === text);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${text}`);
  return button;
}

function buttonByLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const button = container.querySelector(`button[aria-label="${label}"]`);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return button;
}

async function waitFor(assertion: () => void, timeoutMs = 1_000): Promise<void> {
  const startedAt = Date.now();
  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - startedAt >= timeoutMs) throw error;
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
  }
}

async function unmount(root: Root): Promise<void> {
  await act(async () => { root.unmount(); });
}
