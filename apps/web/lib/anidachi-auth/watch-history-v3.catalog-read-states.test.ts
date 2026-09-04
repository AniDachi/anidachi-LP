import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WatchHistoryResponseSchema,
  WatchHistoryTitleEpisodesResponseSchema,
} from "@anidachi/protocol";
import {
  buildWatchHistoryTitleEpisodesV3Response,
  buildWatchHistoryV3Response,
  parseBoundedWatchHistoryPage,
  parseWatchHistoryTitleEpisodesPage,
} from "./watch-history-v3";

const evidenceFile = process.env.WATCH_HISTORY_CATALOG_READ_STATES_JSON;
const required = process.env.WATCH_HISTORY_REQUIRE_CATALOG_READ_STATES === "1";
const GENERATED_AT = new Date("2026-09-05T00:00:00.000Z");

type EvidenceCase = {
  name: string;
  kind: "list" | "detail";
  page: unknown;
};

function parseEvidence(value: unknown): { userId: string; cases: EvidenceCase[] } {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  const record = value as Record<string, unknown>;
  assert.equal(typeof record.userId, "string");
  assert.ok(Array.isArray(record.cases));
  return { userId: record.userId as string, cases: record.cases as EvidenceCase[] };
}

test("actual SQL catalog read states pass production parsers, builders, and shared schemas", {
  skip: evidenceFile || required ? false : "catalog read-state JSON is not configured",
}, async () => {
  assert.ok(evidenceFile, "catalog read-state JSON is required for this run");
  const evidence = parseEvidence(JSON.parse(await readFile(evidenceFile, "utf8")));
  assert.deepEqual(evidence.cases.map(({ name }) => name), [
    "unavailable",
    "complete",
    "complete-detail-first",
    "complete-detail-next",
    "same-region-failed-locale",
    "region-pending",
    "region-pending-detail",
    "zero-available",
    "zero-available-detail",
  ]);

  const outputs = new Map<string, unknown>();
  for (const evidenceCase of evidence.cases) {
    if (evidenceCase.kind === "list") {
      const page = parseBoundedWatchHistoryPage(evidenceCase.page);
      const output = buildWatchHistoryV3Response({
        userId: evidence.userId,
        accountGeneration: page.accountGeneration,
        progressRows: page.progressRows,
        sessions: [],
        limit: 100,
        totalTitleCount: page.totalTitleCount,
        hasMore: page.hasMore,
        titleSummaries: page.titleSummaries,
        generatedAt: GENERATED_AT,
      });
      outputs.set(evidenceCase.name, WatchHistoryResponseSchema.parse(output));
    } else {
      const page = parseWatchHistoryTitleEpisodesPage(evidenceCase.page);
      const output = buildWatchHistoryTitleEpisodesV3Response({
        userId: evidence.userId,
        page: { ...page, sessions: [] },
        generatedAt: GENERATED_AT,
      });
      outputs.set(
        evidenceCase.name,
        WatchHistoryTitleEpisodesResponseSchema.parse(output),
      );
    }
  }

  const unavailable = WatchHistoryResponseSchema.parse(outputs.get("unavailable"));
  assert.equal(unavailable.items[0]?.catalogState, "unavailable");
  assert.equal(unavailable.items[0]?.title, "Observed title");
  assert.deepEqual(unavailable.items[0]?.aggregate, {
    completedEpisodes: 6,
    availableEpisodes: null,
    progress: null,
  });

  const complete = WatchHistoryResponseSchema.parse(outputs.get("complete"));
  assert.equal(complete.items[0]?.title, "Titre du catalogue");
  assert.equal(complete.items[0]?.completedEpisodeCount, 6);
  assert.equal(complete.items[0]?.aggregate.completedEpisodes, 5);
  assert.equal(complete.items[0]?.aggregate.availableEpisodes, 13);
  assert.ok(Math.abs((complete.items[0]?.aggregate.progress ?? 0) - 5 / 13) < 1e-12);
  const secondSeason = complete.items[0]?.seasons.find(
    (season) => season.seasonKey === "crunchyroll:season:RS1",
  );
  assert.equal(secondSeason?.seasonTitle, "Saison 2");
  assert.equal(secondSeason?.nextEpisode?.episodeTitle, "Episode du catalogue 6");

  const detailFirst = WatchHistoryTitleEpisodesResponseSchema.parse(
    outputs.get("complete-detail-first"),
  );
  const detailNext = WatchHistoryTitleEpisodesResponseSchema.parse(
    outputs.get("complete-detail-next"),
  );
  assert.equal(detailFirst.episodes.length, 6);
  assert.equal(detailFirst.complete, false);
  assert.equal(detailFirst.catalog.seasons[0]?.seasonKey, "crunchyroll:season:RS1");
  assert.equal(detailNext.episodes.length, 6);
  assert.equal(detailNext.complete, true);
  assert.equal(detailNext.catalog.seasons[0]?.seasonKey, "crunchyroll:season:RS0");

  const failedLocale = WatchHistoryResponseSchema.parse(
    outputs.get("same-region-failed-locale"),
  );
  assert.equal(failedLocale.items[0]?.catalogState, "complete");
  assert.equal(failedLocale.items[0]?.title, "Titre du catalogue");

  const pending = WatchHistoryResponseSchema.parse(outputs.get("region-pending"));
  assert.equal(pending.items[0]?.catalogState, "partial");
  assert.equal(pending.items[0]?.title, "Observed title");
  assert.equal(pending.items[0]?.aggregate.availableEpisodes, null);
  const pendingDetail = WatchHistoryTitleEpisodesResponseSchema.parse(
    outputs.get("region-pending-detail"),
  );
  assert.equal(pendingDetail.catalog.state, "partial");
  assert.equal(pendingDetail.episodes[0]?.episodeTitle, "Observed 11");

  const zeroAvailable = WatchHistoryResponseSchema.parse(outputs.get("zero-available"));
  assert.equal(zeroAvailable.items[0]?.completedEpisodeCount, 6);
  assert.deepEqual(zeroAvailable.items[0]?.aggregate, {
    completedEpisodes: 0,
    availableEpisodes: 0,
    progress: 0,
  });
  const zeroDetail = WatchHistoryTitleEpisodesResponseSchema.parse(
    outputs.get("zero-available-detail"),
  );
  assert.deepEqual(zeroDetail.catalog.aggregate, {
    completedEpisodes: 0,
    availableEpisodes: 0,
    progress: 0,
  });
});
