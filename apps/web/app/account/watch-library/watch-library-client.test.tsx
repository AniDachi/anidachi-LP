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
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import {
  getWatchHistoryAggregateLabel,
  loadWatchHistoryTitleEpisodePage,
  mergeWatchHistoryTitleEpisodePage,
  removeWatchHistoryTarget,
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

it("website replaces a failed poster without retrying it on refresh and loads a changed URL", async () => {
  let history = historyFixture();
  history.items[0]!.artworkUrl = "https://www.crunchyroll.com/old-poster.jpg";
  history.items.push({ ...itemFixture(), titleKey: "series-two", title: "Series Two",
    artworkUrl: "https://www.crunchyroll.com/other-poster.jpg" });
  history.totalTitleCount = 2;
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/watch-history/v3?limit=24") return Response.json(history);
    if (String(input) === "/api/watch-history/v3/preferences") return Response.json(preferencesFixture);
    throw new Error(`Unexpected request: ${input}`);
  };
  const view = await renderClient(history);
  try {
    const poster = view.container.querySelector('img[src="https://www.crunchyroll.com/old-poster.jpg"]');
    assert.ok(poster);
    const parent = poster.parentElement!;
    await act(async () => { poster.dispatchEvent(new Event("error")); });
    assert.equal(Boolean(parent.querySelector("img")), false);
    assert.ok(parent.querySelector("svg.lucide-film"));
    const otherPoster = view.container.querySelector('img[src="https://www.crunchyroll.com/other-poster.jpg"]');
    assert.ok(otherPoster, "one failed title must not hide another title's poster");
    await click(buttonByText(view.container, "Refresh"));
    assert.equal(Boolean(parent.querySelector("img")), false, "same URL must not retry on normal refresh");
    assert.ok(view.container.querySelector('img[src="https://www.crunchyroll.com/other-poster.jpg"]') === otherPoster);
    history = structuredClone(history);
    history.items[0]!.artworkUrl = "https://www.crunchyroll.com/new-poster.jpg";
    await click(buttonByText(view.container, "Refresh"));
    assert.equal(parent.querySelector("img")?.getAttribute("src"), history.items[0]!.artworkUrl);
    history.items[0]!.artworkUrl = null;
    await click(buttonByText(view.container, "Refresh"));
    assert.equal(Boolean(parent.querySelector("img")), false);
    assert.ok(parent.querySelector("svg.lucide-film"));
  } finally { await unmount(view.root); }
});

it("website catches a poster that failed before the server-rendered page became interactive", async () => {
  const history = historyFixture();
  history.items[0]!.artworkUrl = "https://www.crunchyroll.com/broken-before-hydration.jpg";
  const element = React.createElement(WatchLibraryClient, { initialHistory: history, initialPreferences: preferencesFixture });
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  document.body.append(container);
  const poster = container.querySelector("img");
  assert.ok(poster);
  // Model an actual browser download failure before React attaches onError.
  Object.defineProperties(poster, { complete: { value: true }, naturalWidth: { value: 0 } });
  let root!: Root;
  await act(async () => { root = hydrateRoot(container, element); });
  try {
    assert.equal(Boolean(container.querySelector("img")), false);
    assert.ok(container.querySelector("span.h-16 svg.lucide-film"));
  } finally { await unmount(root); }
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

it("website detail pages adopt canonical catalog metadata without replacing the intersection aggregate", () => {
  const item = itemFixture();
  item.observedEpisodeCount = 7;
  item.completedEpisodeCount = 6;
  item.episodePage = { complete: false, nextCursor: "cursor-one" };
  const page = detailFixture();
  page.observedEpisodeCount = 7;
  page.completedEpisodeCount = 6;
  page.episodes = [{
    ...episode("episode-three", 1, 180),
    seasonKey: "season-two",
    seasonTitle: "Observed label that must not win",
    seasonNumber: 2,
  }];
  page.catalog = {
    state: "complete",
    title: "عنوان عربي طويل من المزود",
    aggregate: { completedEpisodes: 5, availableEpisodes: 13, progress: 5 / 13 },
    seasons: [
      {
        seasonKey: "season-two",
        seasonTitle: "الموسم الثاني",
        seasonNumber: 2,
        order: 20,
        aggregate: { completedEpisodes: 2, availableEpisodes: 5, progress: 2 / 5 },
        nextEpisode: {
          episodeKey: "episode-four",
          episodeTitle: "الحلقة التالية",
          seasonKey: "season-two",
          seasonTitle: "الموسم الثاني",
          seasonNumber: 2,
          episodeNumber: 2,
          sourceUrl: "https://www.crunchyroll.com/watch/episode-four/demo",
          releasedAt: NOW,
        },
      },
      {
        seasonKey: "season-one",
        seasonTitle: "الموسم الأول",
        seasonNumber: 1,
        order: 10,
        aggregate: { completedEpisodes: 3, availableEpisodes: 8, progress: 3 / 8 },
        nextEpisode: null,
      },
      {
        seasonKey: "season-three",
        seasonTitle: "الموسم الثالث غير المشاهد",
        seasonNumber: 3,
        order: 30,
        aggregate: { completedEpisodes: 0, availableEpisodes: 4, progress: 0 },
        nextEpisode: null,
      },
    ],
  };

  const merged = mergeWatchHistoryTitleEpisodePage(item, page);

  assert.equal(merged.title, "عنوان عربي طويل من المزود");
  assert.equal(merged.catalogState, "complete");
  assert.deepEqual(merged.aggregate, {
    completedEpisodes: 5,
    availableEpisodes: 13,
    progress: 5 / 13,
  });
  assert.equal(merged.completedEpisodeCount, 6);
  assert.deepEqual(merged.seasons.map((season) => [season.seasonKey, season.seasonTitle, season.order]), [
    ["season-one", "الموسم الأول", 10],
    ["season-two", "الموسم الثاني", 20],
  ]);
  assert.equal(merged.seasons[1]?.nextEpisode?.episodeKey, "episode-four");
  assert.deepEqual(merged.seasons[1]?.aggregate, {
    completedEpisodes: 2,
    availableEpisodes: 5,
    progress: 2 / 5,
  });
  assert.deepEqual(
    merged.seasons[1]?.episodes.map((value) => value.episodeKey),
    ["episode-three"],
  );
});

it("website detail pages retain represented seasons omitted by bounded catalog metadata", () => {
  const item = itemFixture();
  const priorSeasonOne = item.seasons[0]!;
  item.catalogState = "complete";
  item.aggregate = { completedEpisodes: 5, availableEpisodes: 13, progress: 5 / 13 };
  item.seasons = [
    {
      ...priorSeasonOne,
      seasonKey: "season-zero",
      seasonTitle: "Earlier Season Zero",
      order: 10,
      episodes: [{
        ...episode("episode-zero", 0),
        seasonKey: "season-zero",
        seasonTitle: "Earlier Season Zero",
        seasonNumber: 0,
      }],
    },
    {
      ...priorSeasonOne,
      seasonTitle: "Canonical Season One",
      order: 20,
    },
  ];
  const page = detailFixture();
  page.episodes = [{
    ...episode("episode-three", 3, 180),
    seasonKey: "season-zero",
    seasonTitle: "Observed label that must not win",
    seasonNumber: 0,
  }];
  page.catalog = {
    state: "complete",
    title: "Canonical Series One",
    aggregate: { completedEpisodes: 6, availableEpisodes: 13, progress: 6 / 13 },
    seasons: [{
      seasonKey: "season-zero",
      seasonTitle: "Canonical Season Zero",
      seasonNumber: 0,
      order: 10,
      aggregate: { completedEpisodes: 2, availableEpisodes: 5, progress: 2 / 5 },
      nextEpisode: null,
    }],
  };

  const merged = mergeWatchHistoryTitleEpisodePage(item, page);

  assert.deepEqual(merged.seasons.map((season) => season.seasonKey), [
    "season-zero",
    "season-one",
  ]);
  assert.equal(merged.seasons[0]?.seasonTitle, "Canonical Season Zero");
  assert.deepEqual(merged.seasons[0]?.episodes.map((value) => value.episodeKey), [
    "episode-zero",
    "episode-three",
  ]);
  assert.equal(merged.seasons[1]?.seasonTitle, "Canonical Season One");
  assert.deepEqual(merged.seasons[1]?.episodes.map((value) => value.episodeKey), [
    "episode-one",
    "episode-two",
  ]);
});

it("website optimistic episode deletion preserves the last canonical aggregate", () => {
  const history = historyFixture();
  const item = history.items[0]!;
  item.observedEpisodeCount = 7;
  item.completedEpisodeCount = 6;
  item.episodePage = { complete: false, nextCursor: "cursor-one" };
  item.catalogState = "complete";
  item.aggregate = { completedEpisodes: 5, availableEpisodes: 13, progress: 5 / 13 };
  item.seasons[0]!.aggregate = {
    completedEpisodes: 5,
    availableEpisodes: 13,
    progress: 5 / 13,
  };

  const next = removeWatchHistoryTarget(history, {
    scope: "episode",
    provider: item.provider,
    titleKey: item.titleKey,
    episodeKey: item.seasons[0]!.episodes[0]!.episodeKey,
  });

  assert.deepEqual(next.items[0]?.aggregate, item.aggregate);
  assert.deepEqual(next.items[0]?.seasons[0]?.aggregate, item.seasons[0]!.aggregate);
});

it("website renders complete, observed-only, and zero-available title states honestly", () => {
  const render = (item: WatchHistoryItem) => renderToStaticMarkup(React.createElement(
    WatchLibraryClient,
    {
      initialHistory: { ...historyFixture(), items: [item] },
      initialPreferences: preferencesFixture,
    },
  ));
  const exact = itemFixture();
  exact.title = "عنوان عربي طويل من المزود";
  exact.observedEpisodeCount = 7;
  exact.completedEpisodeCount = 6;
  exact.episodePage = { complete: false, nextCursor: "cursor-one" };
  exact.catalogState = "complete";
  exact.aggregate = { completedEpisodes: 5, availableEpisodes: 13, progress: 5 / 13 };
  exact.seasons[0]!.aggregate = {
    completedEpisodes: 5,
    availableEpisodes: 13,
    progress: 5 / 13,
  };
  const exactMarkup = render(exact);
  assert.match(exactMarkup, /عنوان عربي طويل من المزود/);
  assert.match(exactMarkup, /<h3[^>]*dir="auto"[^>]*>عنوان عربي طويل من المزود<\/h3>/);
  assert.match(exactMarkup, /5 \/ 13 episodes/);
  assert.match(exactMarkup, /38\.46%/);
  assert.match(exactMarkup, /aria-hidden="true" class="watch-library-overall-track/);
  assert.equal(getWatchHistoryAggregateLabel(exact), "5 / 13 episodes · 38.46%");

  for (const state of ["partial", "unavailable"] as const) {
    const nonExact = structuredClone(exact);
    nonExact.catalogState = state;
    nonExact.aggregate = { completedEpisodes: 6, availableEpisodes: null, progress: null };
    nonExact.seasons[0]!.aggregate = {
      completedEpisodes: 6,
      availableEpisodes: null,
      progress: null,
    };
    const markup = render(nonExact);
    assert.match(markup, /7 observed episodes/);
    assert.doesNotMatch(markup, /watch-library-overall-track/);
    assert.doesNotMatch(markup, /0%/);
  }

  const zero = structuredClone(exact);
  zero.aggregate = { completedEpisodes: 0, availableEpisodes: 0, progress: 0 };
  zero.seasons[0]!.aggregate = { completedEpisodes: 0, availableEpisodes: 0, progress: 0 };
  const zeroMarkup = render(zero);
  assert.match(zeroMarkup, /Not currently available/);
  assert.doesNotMatch(zeroMarkup, /0 \/ 0/);
  assert.doesNotMatch(zeroMarkup, /watch-library-overall-track/);
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
  it("renders canonical header updates from each accepted detail page", async () => {
    const initial = historyFixture();
    const initialItem = initial.items[0]!;
    initialItem.title = "Observed Series One";
    initialItem.observedEpisodeCount = 7;
    initialItem.completedEpisodeCount = 6;
    initialItem.catalogState = "partial";
    initialItem.aggregate = { completedEpisodes: 6, availableEpisodes: null, progress: null };
    const exactPage = detailFixture();
    exactPage.observedEpisodeCount = 7;
    exactPage.completedEpisodeCount = 6;
    exactPage.catalog = {
      state: "complete",
      title: "عنوان عربي محدث من المزود",
      aggregate: { completedEpisodes: 5, availableEpisodes: 13, progress: 5 / 13 },
      seasons: [{
        seasonKey: "season-one",
        seasonTitle: "الموسم الأول",
        seasonNumber: 1,
        order: 10,
        aggregate: { completedEpisodes: 5, availableEpisodes: 13, progress: 5 / 13 },
        nextEpisode: null,
      }],
    };
    exactPage.complete = false;
    exactPage.nextCursor = "cursor-two";
    const partialPage = detailFixture();
    partialPage.observedEpisodeCount = 8;
    partialPage.completedEpisodeCount = 6;
    partialPage.catalog = { state: "partial", title: null, aggregate: null, seasons: [] };
    partialPage.complete = true;
    partialPage.nextCursor = null;
    let detailReads = 0;
    globalThis.fetch = async (input: string | URL | Request) => {
      const path = String(input);
      if (!path.includes("/api/watch-history/v3/title-episodes")) {
        throw new Error(`Unexpected request: ${path}`);
      }
      detailReads += 1;
      return Response.json(detailReads === 1 ? exactPage : partialPage);
    };
    const view = await renderClient(initial);
    await click(buttonByText(view.container, "Show episodes"));

    await click(buttonByText(view.container, "Load more episodes"));
    await waitFor(() => {
      assert.equal(view.container.querySelector("h3")?.textContent, "عنوان عربي محدث من المزود");
      assert.equal(
        view.container.querySelector(".watch-library-overall-label")?.textContent,
        "5 / 13 episodes · 38.46%",
      );
      assert.ok(view.container.querySelector(".watch-library-overall-track"));
    });

    await click(buttonByText(view.container, "Load more episodes"));
    await waitFor(() => {
      assert.equal(
        view.container.querySelector(".watch-library-overall-label")?.textContent,
        "8 observed episodes",
      );
      assert.equal(view.container.querySelector(".watch-library-overall-track"), null);
    });
    assert.equal(view.container.querySelector("h3")?.textContent, "عنوان عربي محدث من المزود");
    assert.equal(detailReads, 2);
    await unmount(view.root);
  });

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

describe("website root history request fences", () => {
  for (const [kind, label] of [["delete", "Clear history"], ["preferences", "YouTube history: Off"]] as const) {
    it(`binds rendered owner to ${kind} intent through cookie refresh`, async () => {
      testWindow.confirm = () => true;
      const intents: (string | null)[] = [];
      let refreshes = 0;
      globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input) === "/api/auth/refresh") { refreshes++; return Response.json({ ok: true }); }
        assert.equal(String(input), `/api/watch-history/v3/${kind}`);
        intents.push(new Headers(init?.headers).get("x-anidachi-history-owner"));
        return intents.length === 1
          ? Response.json({}, { status: 401 })
          : Response.json({ error: "Watch history owner changed" }, { status: 409 });
      };
      const view = await renderClient();
      try {
        await click(buttonByText(view.container, label));
        await waitFor(() => assert.match(view.container.textContent ?? "", /Watch history owner changed/));
        assert.deepEqual(intents, [OWNER_ID, OWNER_ID]);
        assert.equal(refreshes, 1);
        assert.match(view.container.textContent ?? "", /Series One/);
      } finally { await unmount(view.root); }
    });
  }
  it("does not let a pre-delete refresh restore removed rows or stale aggregates", async () => {
    let resolveOldRefresh: ((response: Response) => void) | undefined;
    let rootReads = 0;
    testWindow.confirm = () => true;
    const canonical = historyFixture();
    canonical.items = [];
    canonical.totalTitleCount = 0;
    globalThis.fetch = async (input: string | URL | Request) => {
      const path = String(input);
      if (path === "/api/watch-history/v3?limit=24") {
        rootReads += 1;
        if (rootReads === 1) {
          return new Promise<Response>((resolve) => { resolveOldRefresh = resolve; });
        }
        return Response.json(canonical);
      }
      if (path === "/api/watch-history/v3/preferences") return Response.json(preferencesFixture);
      if (path === "/api/watch-history/v3/delete") return Response.json(deletionAck({
        scope: "title",
        provider: "crunchyroll",
        titleKey: "series-one",
      }));
      throw new Error(`Unexpected request: ${path}`);
    };
    const view = await renderClient();

    await click(buttonByText(view.container, "Refresh"));
    await waitFor(() => assert.equal(typeof resolveOldRefresh, "function"));
    await click(buttonByText(view.container, "Delete title"));
    await waitFor(() => assert.doesNotMatch(view.container.textContent ?? "", /Series One/));
    assert.equal(rootReads, 2);
    assert.equal(buttonByText(view.container, "Refresh").disabled, false);
    await act(async () => { resolveOldRefresh?.(Response.json(historyFixture())); });
    await waitFor(() => assert.doesNotMatch(view.container.textContent ?? "", /Series One/));
    await unmount(view.root);
  });

  it("does not let an older root pagination response resurrect a deleted title", async () => {
    let resolvePage: ((response: Response) => void) | undefined;
    testWindow.confirm = () => true;
    const initial = historyFixture();
    initial.nextCursor = "older-titles";
    const canonical = { ...historyFixture(), items: [], totalTitleCount: 0 };
    globalThis.fetch = async (input: string | URL | Request) => {
      const path = String(input);
      if (path.includes("cursor=older-titles")) {
        return new Promise<Response>((resolve) => { resolvePage = resolve; });
      }
      if (path === "/api/watch-history/v3?limit=24") return Response.json(canonical);
      if (path === "/api/watch-history/v3/delete") return Response.json(deletionAck({
        scope: "title",
        provider: "crunchyroll",
        titleKey: "series-one",
      }));
      throw new Error(`Unexpected request: ${path}`);
    };
    const view = await renderClient(initial);

    await click(buttonByText(view.container, "Load more"));
    await waitFor(() => assert.equal(typeof resolvePage, "function"));
    await click(buttonByText(view.container, "Delete title"));
    await waitFor(() => assert.doesNotMatch(view.container.textContent ?? "", /Series One/));
    await act(async () => { resolvePage?.(Response.json(historyFixture())); });
    await waitFor(() => assert.doesNotMatch(view.container.textContent ?? "", /Series One/));
    await unmount(view.root);
  });

  it("rekeys state on owner change and ignores the previous owner's late deletion", async () => {
    const ownerTwo = "22222222-2222-4222-8222-222222222222";
    let resolveDelete: ((response: Response) => void) | undefined;
    testWindow.confirm = () => true;
    globalThis.fetch = async (input: string | URL | Request) => {
      const path = String(input);
      if (path === "/api/watch-history/v3/delete") {
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      throw new Error(`Unexpected request: ${path}`);
    };
    const view = await renderClient();
    await click(buttonByText(view.container, "Delete title"));
    await waitFor(() => assert.equal(typeof resolveDelete, "function"));
    const nextHistory = historyFixture();
    nextHistory.meta.ownerUserId = ownerTwo;
    nextHistory.items[0]!.title = "Owner Two Series";
    const nextPreferences = structuredClone(preferencesFixture);
    nextPreferences.meta.ownerUserId = ownerTwo;

    await act(async () => {
      view.root.render(React.createElement(WatchLibraryClient, {
        initialHistory: nextHistory,
        initialPreferences: nextPreferences,
      }));
    });
    assert.match(view.container.textContent ?? "", /Owner Two Series/);
    assert.doesNotMatch(view.container.textContent ?? "", /Series One/);
    await act(async () => {
      resolveDelete?.(Response.json(deletionAck({
        scope: "title",
        provider: "crunchyroll",
        titleKey: "series-one",
      })));
    });
    await waitFor(() => assert.match(view.container.textContent ?? "", /Owner Two Series/));
    await unmount(view.root);
  });
});

async function renderClient(
  initialHistory = historyFixture(),
  initialPreferences = preferencesFixture,
): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(WatchLibraryClient, {
      initialHistory,
      initialPreferences,
    }));
  });
  return { container, root };
}

function deletionAck(target: {
  scope: "title";
  provider: "crunchyroll";
  titleKey: string;
}) {
  return {
    meta: {
      serverTime: NOW,
      schemaVersion: 3,
      ownerUserId: OWNER_ID,
      accountGeneration: 1,
    },
    schemaVersion: 3,
    clientMutationId: "33333333-3333-4333-8333-333333333333",
    accountGeneration: 1,
    target,
    deletedAt: NOW,
  };
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
