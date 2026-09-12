import { WATCH_HISTORY_OWNER_HEADER } from "../../../lib/watch-history-owner";
import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import type {
  WatchHistoryEditRequest,
  WatchHistoryDeleteScope,
  WatchHistoryItem,
  WatchHistoryPreferencesResponse,
  WatchHistoryResponse,
  WatchHistoryTitleEpisodesResponse,
} from "@anidachi/protocol";
import { loadWatchLibraryData } from "./watch-library-data";
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
function accessFixture(state: "allowed" | "plan_required" = "allowed", generation = 1, owner = OWNER_ID) {
  return { accessVersion: 1 as const, ownerUserId: owner, accountGeneration: generation, accessEpoch: 1, youtubeConsentEpoch: 1, state,
    serverTime: NOW, captureNotBefore: NOW, validUntil: "2026-08-21T12:05:00.000Z", youtubeHistoryEnabled: false };
}

function capacityFixture(crunchyroll = 200, owner = OWNER_ID, generation = 1) {
  return { capacityVersion: 1, ownerUserId: owner, accountGeneration: generation, serverTime: NOW,
    providers: { youtube: { used: 12, limit: 100 }, crunchyroll: { used: crunchyroll, limit: 200 } } };
}


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
  KeyboardEvent: testWindow.KeyboardEvent,
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
  assert.match(exactMarkup, /dir="auto"/);
  assert.match(exactMarkup, /5 \/ 13 episodes/);


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
    assert.match(markup, /6 watched · 7 saved/);
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

async function renderClient(
  initialHistory = historyFixture(),
  initialPreferences = preferencesFixture,
  initialAccess: "allowed" | "plan_required" = "allowed",
): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(WatchLibraryClient, {
      initialHistory,
      initialPreferences,
      initialAccess,
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


function editorFixture() {
  const base = { episodeKey: "episode-one", episodeTitle: "Episode 1", episodeNumber: 1, seasonKey: "season-one", seasonTitle: "Season One", seasonNumber: 1, seasonOrder: 0, order: 0,
    sourceUrl: "https://www.crunchyroll.com/watch/EPISODE1", available: true, watched: false, currentTime: 60, duration: 1200, progress: .05 };
  return { meta: { ...preferencesFixture.meta }, provider: "crunchyroll", titleKey: "series-one", revision: "a".repeat(32), catalogComplete: true,
    episodes: [base, { ...base, episodeKey: "episode-two", episodeTitle: "Episode 2", episodeNumber: 2, order: 1, sourceUrl: "https://www.crunchyroll.com/watch/EPISODE2", currentTime: 0, progress: 0 },
      { ...base, episodeKey: "episode-three", episodeTitle: "Episode 3", episodeNumber: 1, seasonKey: "season-two", seasonTitle: "Season Two", seasonNumber: 2, seasonOrder: 1, currentTime: 0, progress: 0 },
      { ...base, episodeKey: "special", episodeTitle: "A special", episodeNumber: 0, seasonKey: "specials", seasonTitle: "Specials", seasonNumber: 0, seasonOrder: 2, currentTime: 0, progress: 0 },
      { ...base, episodeKey: "future", episodeTitle: "Future episode", episodeNumber: 3, order: 2, available: false, currentTime: 0, progress: 0 }],
  };
}
function installServer(options: { plan?: "allowed" | "plan_required"; history?: WatchHistoryResponse; editor?: ReturnType<typeof editorFixture>;
  intercept?: (path: string, init?: RequestInit) => Promise<Response | undefined> | Response | undefined } = {}) {
  let history = options.history ?? historyFixture();
  let editor = options.editor ?? editorFixture();
  const calls: { path: string; body?: Record<string, unknown>; headers: Headers }[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input); calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: new Headers(init?.headers) });
    const override = await options.intercept?.(path, init); if (override) return override;
    if (path.includes("/editor?") && new URLSearchParams(path.split("?")[1]).get("titleKey") !== editor.titleKey) return Response.json({ error: "Not found" }, { status: 404 });
    if (path.includes("/editor?") ) return Response.json(editor);
    if (path.endsWith("/editor") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as WatchHistoryEditRequest;
      editor = { ...editor, revision: "b".repeat(32), episodes: editor.episodes.map(ep => {
        const change = body.changes.find(value => value.episodeKey === ep.episodeKey);
        return change ? { ...ep, watched: change.watched, currentTime: change.watched ? ep.duration : 0, progress: change.watched ? 1 : 0 } : ep;
      }) };
      return Response.json({ meta: editor.meta, revision: editor.revision, clientMutationId: body.clientMutationId });
    }
    if (path.endsWith("/access")) return Response.json(accessFixture(options.plan));
    if (path.endsWith("/preferences")) return Response.json({ ...preferencesFixture, preferences: { youtubeHistoryEnabled: init?.method === "PATCH" } });
    if (path.endsWith("/capacity")) return Response.json(capacityFixture(history.items.length ? 200 : 199, OWNER_ID, history.meta.accountGeneration));
    if (path.includes("?limit=24")) return Response.json(history);
    if (path.endsWith("/delete")) {
      const target = (JSON.parse(String(init?.body)) as { target: WatchHistoryDeleteScope }).target;
      const generation = history.meta.accountGeneration + (target.scope === "all" ? 1 : 0);
      history = { ...history, meta: { ...history.meta, accountGeneration: generation }, items: [], totalTitleCount: 0, nextCursor: null };
      return Response.json({ ...deletionAck({ scope: "title", provider: "crunchyroll", titleKey: "series-one" }), target,
        meta: { ...history.meta }, accountGeneration: generation });
    }
    throw Error(`Unexpected request: ${path}`);
  };
  return { calls, getEditor: () => editor };
}
async function openTitle(container: HTMLElement) {
  await click(buttonByLabel(container, "Manage Series One"));
  await waitFor(() => assert.ok(container.querySelector('[aria-label="Episodes"]')));
}
async function chooseSeason(container: HTMLElement, value: string) {
  const select = container.querySelector('select[aria-label="Season or specials"], .wh-season-row select') as HTMLSelectElement;
  assert.ok(select);
  await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
function episodeButton(container: HTMLElement, text: string) {
  return [...container.querySelectorAll<HTMLButtonElement>(".wh-episode")].find(button => button.getAttribute("aria-label")?.includes(text))!;
}

async function selectSeason(container: HTMLElement) {
  await act(async () => { container.querySelector<HTMLInputElement>(".wh-select-season input")!.click(); });
}
async function markFirstEpisode(container: HTMLElement) {
  await click([...container.querySelectorAll<HTMLButtonElement>(".wh-episode")].find(button => !button.disabled)!);
  await click(buttonByText(container, "Mark watched"));
}

it("SSR includes Free's saved covers with a recording notice and no open editor", () => {
  const html = renderToStaticMarkup(<WatchLibraryClient initialHistory={historyFixture()} initialPreferences={preferencesFixture} initialAccess="plan_required" />);
  assert.match(html, /Manage Series One/); assert.match(html, /Plus or Pro unlocks recording/);
  assert.doesNotMatch(html, /wh-inspector/); assert.match(html, /Clear all history/);
  assert.doesNotMatch(html, /YouTube history:|aria-label="Track YouTube history"/);
  assert.match(html, /aria-label="Library options"/);
});
it("SSR refuses unavailable access and an access change during the read", async () => {
  let reads = 0;
  await assert.rejects(loadWatchLibraryData(OWNER_ID, { access: async () => { throw Error("HISTORY_ACCESS_UNAVAILABLE"); }, preferences: async () => preferencesFixture, history: async () => { reads++; return historyFixture(); } }), /UNAVAILABLE/);
  assert.equal(reads, 0); let checks = 0;
  await assert.rejects(loadWatchLibraryData(OWNER_ID, { access: async () => accessFixture(++checks === 1 ? "allowed" : "plan_required"), preferences: async () => preferencesFixture, history: async () => historyFixture() }), /CHANGED/);
});
it("storage counts and full warnings follow the platform without refetching or counting visible cards", async () => {
  const server = installServer(); const view = await renderClient();
  try {
    const storage = () => view.container.querySelector('[aria-label="History storage"]')?.textContent ?? "";
    await waitFor(() => assert.match(storage(), /200 \/ 200/));
    await click(buttonByLabel(view.container, "YouTube"));
    assert.match(storage(), /YouTube 12 \/ 100 videos/);
    assert.doesNotMatch(storage(), /Crunchyroll|history is full/);
    assert.equal(view.container.querySelector(".wh-card"), null);
    await click(buttonByLabel(view.container, "Crunchyroll"));
    assert.match(storage(), /Crunchyroll 200 \/ 200 titles/);
    assert.match(storage(), /Crunchyroll history is full/);
    assert.doesNotMatch(storage(), /YouTube/);
    await click(buttonByLabel(view.container, "All platforms"));
    assert.match(storage(), /YouTube 12 \/ 100 videos/);
    assert.match(storage(), /Crunchyroll 200 \/ 200 titles/);
    assert.equal(server.calls.filter(call => call.path.endsWith("/capacity")).length, 1);
    assert.equal(server.calls.filter(call => call.body).length, 0);
  } finally { await unmount(view.root); }
});
it("bulk clearing stays in Library options and requires confirmation on Free", async () => {
  const server = installServer({ plan: "plan_required" });
  const view = await renderClient(historyFixture(), preferencesFixture, "plan_required");
  try {
    const options = view.container.querySelector<HTMLDetailsElement>('.wh-page-actions details')!;
    assert.equal(options.open, false);
    await act(async () => { options.querySelector("summary")!.click(); });
    assert.equal(options.open, true);
    let message = "";
    testWindow.confirm = value => { message = value ?? ""; return false; };
    await click(buttonByText(view.container, "Clear all history"));
    assert.match(message, /YouTube and Crunchyroll/);
    assert.equal(server.calls.filter(call => call.body).length, 0);
    assert.equal(options.open, false);
    await act(async () => { options.querySelector("summary")!.click(); });
    testWindow.confirm = () => true;
    await click(buttonByText(view.container, "Clear all history"));
    await waitFor(() => assert.equal(view.container.querySelector(".wh-card"), null));
    const writes = server.calls.filter(call => call.body);
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].body?.target, { scope: "all" });
    assert.equal(writes[0].headers.get(WATCH_HISTORY_OWNER_HEADER), OWNER_ID);
  } finally { await unmount(view.root); }
});
it("platform switching completes pagination and keeps the progress filter", async () => {
  const history = { ...historyFixture(), nextCursor: "next-page", totalTitleCount: 2 };
  const video = { ...itemFixture(), provider: "youtube" as const, itemKind: "movie" as const, titleKey: "video", title: "Video One",
    latestActivity: { ...itemFixture().latestActivity, progress: 1, completedAt: NOW } };
  const server = installServer({ history, intercept: path => path.includes("cursor=next-page")
    ? Response.json({ ...historyFixture(), items: [video], totalTitleCount: 2 }) : undefined });
  const view = await renderClient(history);
  try {
    const status = view.container.querySelector<HTMLSelectElement>('select[aria-label="Filter by progress"]')!;
    await act(async () => { status.value = "watched"; status.dispatchEvent(new Event("change", { bubbles: true })); });
    await click(buttonByLabel(view.container, "YouTube"));
    await waitFor(() => assert.ok(view.container.querySelector('[aria-label="Manage Video One"]')));
    assert.equal(view.container.querySelector('[aria-label="Manage Series One"]'), null);
    assert.equal(status.value, "watched");
    assert.equal(buttonByLabel(view.container, "YouTube").getAttribute("aria-checked"), "true");
    assert.equal(server.calls.filter(call => call.path.includes("cursor=next-page")).length, 1);
    await click(buttonByLabel(view.container, "Crunchyroll"));
    assert.equal(view.container.querySelector(".wh-card"), null);
    assert.match(view.container.textContent ?? "", /No titles match these filters/);
    assert.equal(server.calls.filter(call => call.body).length, 0);
  } finally { await unmount(view.root); }
});
it("keyboard platform selection preserves the open editor draft", async () => {
  const server = installServer(); const view = await renderClient();
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Edit"));
    await markFirstEpisode(view.container);
    assert.equal(view.container.querySelector('summary[aria-label="Library options"]')?.getAttribute("aria-disabled"), "true");
    const all = buttonByLabel(view.container, "All platforms"); all.focus();
    await act(async () => { all.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })); });
    assert.equal(document.activeElement, buttonByLabel(view.container, "YouTube"));
    assert.equal(buttonByLabel(view.container, "YouTube").getAttribute("aria-checked"), "true");
    assert.equal(view.container.querySelector(".wh-card"), null);
    assert.ok(buttonByLabel(view.container, "Save 1 change"));
    await act(async () => { buttonByLabel(view.container, "YouTube").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
    assert.equal(document.activeElement, all);
    assert.ok(view.container.querySelector('[aria-label="Manage Series One"]'));
    assert.ok(buttonByLabel(view.container, "Save 1 change"));
    assert.equal(view.container.querySelectorAll('.wh-platforms [tabindex="0"]').length, 1);
    await click(buttonByText(view.container, "Cancel"));
    assert.equal(server.calls.filter(call => call.body).length, 0);
  } finally { await unmount(view.root); }
});
it("a title and episode click only select; Cancel sends no write", async () => {
  const server = installServer(); const view = await renderClient();
  try {
    await openTitle(view.container);
    await click(episodeButton(view.container, "Episode 2"));
    assert.equal(server.calls.filter(call => call.body).length, 0);
    await click(buttonByText(view.container, "Edit"));
    await markFirstEpisode(view.container);
    assert.ok(buttonByLabel(view.container, "Save 1 change"));
    await click(buttonByText(view.container, "Cancel"));
    assert.equal(server.calls.filter(call => call.body).length, 0);
    assert.ok(buttonByText(view.container, "Edit"));
  } finally { await unmount(view.root); }
});
it("drafts survive season changes and Save sends one atomic owner-bound command", async () => {
  const server = installServer(); const view = await renderClient();
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Edit"));
    await markFirstEpisode(view.container);
    await chooseSeason(view.container, "season-two"); await markFirstEpisode(view.container);
    await chooseSeason(view.container, "season-one");
    assert.match(episodeButton(view.container, "Episode 1").className, /wh-watched/);
    await click(buttonByLabel(view.container, "Save 2 changes"));
    await waitFor(() => assert.match(view.container.textContent ?? "", /Progress saved/));
    const writes = server.calls.filter(call => call.path.endsWith("/editor") && call.body);
    assert.equal(writes.length, 1); assert.equal(writes[0].headers.get(WATCH_HISTORY_OWNER_HEADER), OWNER_ID);
    assert.deepEqual(writes[0].body?.changes, [{ episodeKey: "episode-one", watched: true }, { episodeKey: "episode-three", watched: true }]);
    assert.equal(server.getEditor().episodes.filter(ep => ep.watched).length, 2);
  } finally { await unmount(view.root); }
});
it("selection never changes progress; explicit actions create a draft and Undo restores partial progress", async () => {
  const server = installServer(); const view = await renderClient();
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Edit"));
    const cell = episodeButton(view.container, "Episode 1");
    assert.equal(cell.getAttribute("aria-checked"), "false");
    await click(cell);
    assert.equal(cell.getAttribute("aria-checked"), "true");
    assert.equal(buttonByLabel(view.container, "Save 0 changes").disabled, true);
    assert.doesNotMatch(cell.className, /wh-watched|wh-modified/);
    await click(cell);
    assert.equal(buttonByText(view.container, "Mark watched").disabled, true);
    await click(cell); await click(buttonByText(view.container, "Clear progress"));
    assert.ok(buttonByLabel(view.container, "Save 1 change"));
    assert.equal(cell.getAttribute("aria-checked"), "false");
    assert.match(cell.getAttribute("aria-label")!, /not watched, unsaved change/);
    await click(buttonByText(view.container, "Undo"));
    assert.equal(buttonByLabel(view.container, "Save 0 changes").disabled, true);
    assert.doesNotMatch(cell.className, /wh-modified/);
    await click(buttonByText(view.container, "Cancel"));
    assert.equal(view.container.querySelector('[aria-label="Episode progress"]')?.getAttribute("aria-valuenow"), "5");
    assert.equal(server.calls.filter(call => call.body).length, 0);
  } finally { await unmount(view.root); }
});
it("season selection is indeterminate, scoped to the current season and excludes future episodes", async () => {
  const server = installServer(); const view = await renderClient();
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Edit"));
    assert.equal(view.container.querySelector('.wh-inspector details'), null);
    assert.doesNotMatch(view.container.querySelector('.wh-inspector')!.textContent!, /Reset all title progress/);
    await click(episodeButton(view.container, "Episode 1"));
    assert.equal(view.container.querySelector<HTMLInputElement>(".wh-select-season input")!.indeterminate, true);
    await selectSeason(view.container);
    assert.equal(view.container.querySelector<HTMLInputElement>(".wh-select-season input")!.checked, true);
    assert.equal(episodeButton(view.container, "Future episode").getAttribute("aria-checked"), "false");
    await click(buttonByText(view.container, "Mark watched"));
    assert.ok(buttonByLabel(view.container, "Save 2 changes"));
    await click(episodeButton(view.container, "Episode 1"));
    await chooseSeason(view.container, "season-two");
    assert.match(view.container.textContent!, /0 selected/);
    assert.equal(buttonByText(view.container, "Mark watched").disabled, true);
    await markFirstEpisode(view.container);
    await click(buttonByText(view.container, "Undo"));
    assert.ok(buttonByLabel(view.container, "Save 2 changes"));
    await chooseSeason(view.container, "season-one");
    await selectSeason(view.container);
    await click(buttonByText(view.container, "Clear progress"));
    assert.ok(buttonByLabel(view.container, "Save 1 change"));
    assert.equal(server.calls.filter(call => call.body).length, 0);
    await click(buttonByLabel(view.container, "Save 1 change"));
    const write = server.calls.find(call => call.path.endsWith("/editor") && call.body);
    assert.deepEqual(write?.body?.changes, [{ episodeKey: "episode-one", watched: false }]);
  } finally { await unmount(view.root); }
});
it("Shift selects a range without changing progress; clearing selection is not clearing history", async () => {
  const server = installServer(); const view = await renderClient();
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Edit"));
    await click(episodeButton(view.container, "Episode 1"));
    await act(async () => { episodeButton(view.container, "Episode 2").dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })); });
    assert.match(view.container.textContent!, /2 selected/);
    assert.equal(buttonByLabel(view.container, "Save 0 changes").disabled, true);
    await click(buttonByLabel(view.container, "Clear selection"));
    assert.match(view.container.textContent!, /0 selected/);
    assert.equal(buttonByLabel(view.container, "Save 0 changes").disabled, true);
    assert.equal(server.calls.filter(call => call.body).length, 0);
  } finally { await unmount(view.root); }
});
it("single films use the same top controls and keep an unknown duration unknown", async () => {
  const history = historyFixture(); history.items[0].itemKind = "movie";
  const editor = editorFixture(); editor.episodes = [{ ...editor.episodes[0], duration: 0, currentTime: 60, progress: 0 }];
  const server = installServer({ history, editor }); const view = await renderClient(history);
  try {
    await click(buttonByLabel(view.container, "Manage Series One"));
    await waitFor(() => assert.ok(buttonByText(view.container, "Edit")));
    await click(buttonByText(view.container, "Edit"));
    assert.equal(view.container.querySelector(".wh-episodes"), null);
    await click(buttonByText(view.container, "Mark watched"));
    assert.match(view.container.textContent ?? "", /Marked as watched/);
    await click(buttonByLabel(view.container, "Save 1 change"));
    await waitFor(() => assert.match(view.container.textContent ?? "", /Progress saved/));
    assert.equal(server.getEditor().episodes[0].duration, 0);
    assert.equal(server.getEditor().episodes[0].watched, true);
  } finally { await unmount(view.root); }
});
it("unavailable entries with old progress may be selected for clearing, never for completion", async () => {
  const editor = editorFixture();
  editor.episodes[4] = { ...editor.episodes[4], watched: false, currentTime: 120, progress: .1 };
  const server = installServer({ editor }); const view = await renderClient();
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Edit"));
    const cell = episodeButton(view.container, "Future episode");
    assert.equal(cell.disabled, false); await click(cell);
    assert.equal(buttonByText(view.container, "Mark watched").disabled, true);
    assert.equal(buttonByText(view.container, "Clear progress").disabled, false);
    await click(buttonByText(view.container, "Clear progress"));
    await click(buttonByLabel(view.container, "Save 1 change"));
    assert.deepEqual(server.calls.find(call => call.path.endsWith("/editor") && call.body)?.body?.changes, [{ episodeKey: "future", watched: false }]);
  } finally { await unmount(view.root); }
});
it("season mark excludes future episodes; specials remain a named dropdown section", async () => {
  const server = installServer(); const view = await renderClient();
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Edit"));
    assert.equal(episodeButton(view.container, "Future episode").disabled, true);
    await selectSeason(view.container);
    await click(buttonByText(view.container, "Mark watched"));
    assert.ok(buttonByLabel(view.container, "Save 2 changes"));
    await chooseSeason(view.container, "specials");
    assert.equal(episodeButton(view.container, "A special").textContent, "E0");
    await click(buttonByLabel(view.container, "Save 2 changes"));
    await waitFor(() => assert.match(view.container.textContent ?? "", /Progress saved/));
    assert.equal(server.getEditor().episodes.find(ep => ep.episodeKey === "future")!.watched, false);
  } finally { await unmount(view.root); }
});
it("Free opens series and resumes its own saved position without edit or room creation", async () => {
  const server = installServer({ plan: "plan_required" }); const oldAssign = testWindow.location.assign;
  const launched: string[] = []; testWindow.location.assign = url => { launched.push(String(url)); };
  const view = await renderClient(historyFixture(), preferencesFixture, "plan_required");
  try {
    await openTitle(view.container); assert.equal(buttonByText(view.container, "Edit").disabled, true);
    await click(buttonByText(view.container, "Resume"));
    await waitFor(() => assert.equal(launched.length, 1));
    const intent = JSON.parse(new URLSearchParams(new URL(launched[0]).hash.slice(1)).get("anidachiResume")!);
    assert.equal(intent.currentTime, 60); assert.equal(intent.accountGeneration, 1);
    assert.equal(launched[0].includes("anidachiRoom"), false);
    assert.equal(server.calls.some(call => call.body), false);
  } finally { testWindow.location.assign = oldAssign; await unmount(view.root); }
});
it("a conflict preserves the draft and requires explicit review of latest progress", async () => {
  let conflicts = 0; const server = installServer({ intercept: (path, init) => path.endsWith("/editor") && init?.method === "POST" && conflicts++ === 0 ? Response.json({ error: "Progress changed elsewhere", code: "HISTORY_EDIT_CONFLICT" }, { status: 409 }) : undefined });
  const view = await renderClient();
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Edit")); await markFirstEpisode(view.container);
    await click(buttonByLabel(view.container, "Save 1 change"));
    await waitFor(() => assert.ok(buttonByText(view.container, "Load latest & review my changes")));
    assert.equal(buttonByLabel(view.container, "Save 1 change").disabled, true);
    assert.match(episodeButton(view.container, "Episode 1").className, /wh-modified/);
    await click(buttonByText(view.container, "Load latest & review my changes"));
    assert.equal(buttonByLabel(view.container, "Save 1 change").disabled, false);
    assert.doesNotMatch(view.container.querySelector(".wh-selection-feedback")?.textContent ?? "", /Undo/);
    assert.equal(server.calls.filter(call => call.path.endsWith("/editor")).length, 1);
  } finally { await unmount(view.root); }
});
it("network retry keeps the exact mutation id and payload", async () => {
  let attempts = 0; const server = installServer({ intercept: (path, init) => { if (path.endsWith("/editor") && init?.method === "POST" && attempts++ === 0) throw Error("Connection lost"); return undefined; } });
  const view = await renderClient();
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Edit")); await markFirstEpisode(view.container);
    await click(buttonByLabel(view.container, "Save 1 change")); await waitFor(() => assert.match(view.container.textContent ?? "", /Connection lost/));
    await click(buttonByText(view.container, "Retry")); await waitFor(() => assert.match(view.container.textContent ?? "", /Progress saved/));
    const writes = server.calls.filter(call => call.path.endsWith("/editor")); assert.equal(writes.length, 2); assert.deepEqual(writes[0].body, writes[1].body);
  } finally { await unmount(view.root); }
});
it("changing title asks Save/Discard/Stay and does not silently lose the draft", async () => {
  const history = historyFixture(); history.items.push({ ...itemFixture(), titleKey: "series-two", title: "Series Two" });
  installServer({ history }); const view = await renderClient(history);
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Edit")); await markFirstEpisode(view.container);
    await click(buttonByLabel(view.container, "Manage Series Two")); assert.ok(buttonByText(view.container, "Stay here"));
    await click(buttonByText(view.container, "Stay here")); assert.ok(buttonByLabel(view.container, "Save 1 change"));
    await click(buttonByLabel(view.container, "Manage Series Two")); await click(buttonByText(view.container, "Discard"));
    await waitFor(() => assert.ok(view.container.querySelector('dialog[aria-label="Series Two progress"]')));
  } finally { await unmount(view.root); }
});
it("deletion refreshes server capacity and retains privacy actions on Free", async () => {
  const server = installServer({ plan: "plan_required" }); testWindow.confirm = () => true;
  const view = await renderClient(historyFixture(), preferencesFixture, "plan_required");
  try {
    await openTitle(view.container); await click(buttonByText(view.container, "Remove from history"));
    await waitFor(() => assert.match(view.container.textContent ?? "", /199 \/ 200/));
    assert.doesNotMatch(view.container.textContent ?? "", /Series One/);
    assert.equal(server.calls.filter(call => call.path.endsWith("/delete")).length, 1);
    assert.equal(buttonByText(view.container, "Clear all history").disabled, false);
  } finally { await unmount(view.root); }
});
it("old root responses cannot resurrect a deleted title", async () => {
  let resolveOld: ((response: Response) => void) | undefined; let reads = 0;
  installServer({ intercept: path => path.includes("?limit=24") && ++reads === 1 ? new Promise(resolve => { resolveOld = resolve; }) : undefined });
  testWindow.confirm = () => true; const view = await renderClient();
  try {
    await openTitle(view.container); await click(buttonByLabel(view.container, "Refresh history"));
    await waitFor(() => assert.ok(resolveOld)); await click(buttonByText(view.container, "Remove from history"));
    await waitFor(() => assert.doesNotMatch(view.container.textContent ?? "", /Series One/));
    await act(async () => resolveOld!(Response.json(historyFixture())));
    assert.doesNotMatch(view.container.textContent ?? "", /Series One/);
  } finally { await unmount(view.root); }
});
it("an old editor response cannot reveal data after switching account", async () => {
  let resolveOld: ((response: Response) => void) | undefined;
  installServer({ intercept: path => path.includes("/editor?") ? new Promise(resolve => { resolveOld = resolve; }) : undefined });
  const view = await renderClient();
  try {
    await click(buttonByLabel(view.container, "Manage Series One")); await waitFor(() => assert.ok(resolveOld));
    const history = historyFixture(); history.meta.ownerUserId = "22222222-2222-4222-8222-222222222222"; history.items[0].title = "Another account";
    const preferences = structuredClone(preferencesFixture); preferences.meta.ownerUserId = history.meta.ownerUserId;
    await act(async () => view.root.render(<WatchLibraryClient initialHistory={history} initialPreferences={preferences} />));
    await act(async () => resolveOld!(Response.json(editorFixture())));
    assert.doesNotMatch(view.container.textContent ?? "", /Episode 1|Series One/); assert.match(view.container.textContent ?? "", /Another account/);
  } finally { await unmount(view.root); }
});
it("current access denial retires private cards while a transient editor failure stays retryable", async () => {
  for (const authority of [false,true]) {
    installServer({ intercept: path => path.includes("/editor?") ? Response.json({ error: "Try again", code: authority ? "HISTORY_ACCESS_CHANGED" : "HISTORY_UNAVAILABLE" }, { status: authority ? 409 : 503 }) : undefined });
    const view = await renderClient();
    try {
      await click(buttonByLabel(view.container, "Manage Series One"));
      if (authority) { await waitFor(() => assert.doesNotMatch(view.container.textContent ?? "", /Series One/)); assert.match(view.container.textContent ?? "", /temporarily unavailable/); }
      else { await waitFor(() => assert.ok(buttonByText(view.container,"Retry"))); assert.match(view.container.textContent ?? "", /Series One/); }
    } finally { await unmount(view.root); }
  }
});
it("poster failure before hydration has a fallback and a new URL can load", async () => {
  let history = historyFixture(); history.items[0].artworkUrl = "https://www.crunchyroll.com/old.jpg";
  installServer({ intercept: path => path.includes("?limit=24") ? Response.json(history) : undefined });
  const element = <WatchLibraryClient initialHistory={history} initialPreferences={preferencesFixture} />;
  const container = document.createElement("div"); container.innerHTML = renderToString(element); document.body.append(container);
  Object.defineProperties(container.querySelector("img"), { complete: { value: true }, naturalWidth: { value: 0 } });
  let root!: Root; await act(async () => { root = hydrateRoot(container, element); });
  try {
    assert.equal(container.querySelector("img"), null); assert.ok(container.querySelector(".wh-artwork-fallback"));
    history = structuredClone(history); history.items[0].artworkUrl = "https://www.crunchyroll.com/new.jpg";
    await click(buttonByLabel(container, "Refresh history")); await waitFor(() => assert.equal(container.querySelector("img")?.getAttribute("src"), history.items[0].artworkUrl));
  } finally { await unmount(root); }
});

it("sign-out waits for the editor decision before revoking the session", async () => {
  installServer(); const view = await renderClient(); let signedOut = false;
  try {
    await openTitle(view.container); await click(buttonByText(view.container,"Edit")); await markFirstEpisode(view.container);
    const request = new testWindow.CustomEvent("anidachi:before-sign-out",{cancelable:true,detail:async()=>{signedOut=true;}});
    await act(async()=>{ assert.equal(testWindow.dispatchEvent(request),false); });
    assert.equal(signedOut,false); await click(buttonByText(view.container,"Stay")); assert.equal(signedOut,false);
    await act(async()=>{testWindow.dispatchEvent(new testWindow.CustomEvent("anidachi:before-sign-out",{cancelable:true,detail:async()=>{signedOut=true;}}));});
    await click(buttonByText(view.container,"Discard")); assert.equal(signedOut,true);
  } finally { await unmount(view.root); }
});

it("joining from notifications waits for the history editor decision", async () => {
  installServer(); const view = await renderClient(); let joined = false;
  try {
    await openTitle(view.container); await click(buttonByText(view.container,"Edit")); await markFirstEpisode(view.container);
    const request = () => testWindow.dispatchEvent(new testWindow.CustomEvent("anidachi:before-account-navigation", {cancelable:true,detail:async()=>{joined=true;}}));
    await act(async()=>{ assert.equal(request(),false); });
    assert.equal(joined,false); await click(buttonByText(view.container,"Stay")); assert.equal(joined,false);
    await act(async()=>{ request(); });
    await click(buttonByText(view.container,"Discard")); assert.equal(joined,true);
  } finally { await unmount(view.root); }
});
