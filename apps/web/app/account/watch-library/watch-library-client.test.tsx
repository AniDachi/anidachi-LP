import assert from "node:assert/strict";
import test from "node:test";
import type {
  WatchHistoryItem,
  WatchHistoryPreferencesResponse,
  WatchHistoryResponse,
  WatchHistoryTitleEpisodesResponse,
} from "@anidachi/protocol";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  loadWatchHistoryTitleEpisodePage,
  mergeWatchHistoryTitleEpisodePage,
  WatchLibraryClient,
} from "./watch-library-client";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-08-21T12:00:00.000Z";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

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
      schemaVersion: 2,
      ownerUserId: OWNER_ID,
      accountGeneration: 1,
    },
    generatedAt: NOW,
    provider: "crunchyroll",
    titleKey: "series-one",
    observedEpisodeCount: 12,
    completedEpisodeCount: 3,
    episodes: [episode("episode-two", 2, 120), episode("episode-three", 3, 180)],
    complete: false,
    nextCursor: "cursor-two",
  };
}

function historyFixture(): WatchHistoryResponse {
  return {
    meta: {
      serverTime: NOW,
      schemaVersion: 2,
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
    schemaVersion: 2,
    ownerUserId: OWNER_ID,
    accountGeneration: 1,
  },
  preferences: { youtubeHistoryEnabled: false },
};

test("website keeps the bounded title slice collapsed until the user asks to see it", () => {
  const markup = renderToStaticMarkup(React.createElement(
    WatchLibraryClient,
    { initialHistory: historyFixture(), initialPreferences: preferencesFixture },
  ));

  assert.match(markup, /Show episodes/);
  assert.doesNotMatch(markup, /Episode 1/);
});

test("website detail pages merge by canonical episode identity and retain continuation", () => {
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

test("website detail request is owner-bound and a failure leaves the current slice untouched", async () => {
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
    "/api/watch-history/v2/title-episodes?provider=crunchyroll&titleKey=series-one&limit=50&cursor=cursor+one",
  ]);

  await assert.rejects(() => loadWatchHistoryTitleEpisodePage({
    ownerUserId: OWNER_ID,
    item,
    cursor: "cursor-one",
    request: async () => { throw new Error("offline"); },
  }));
  await assert.rejects(() => loadWatchHistoryTitleEpisodePage({
    ownerUserId: OWNER_ID,
    accountGeneration: 2,
    item,
    cursor: "cursor-one",
    request: async () => detailFixture(),
  }), /owner or title changed/);
  assert.deepEqual(item, before);
});
