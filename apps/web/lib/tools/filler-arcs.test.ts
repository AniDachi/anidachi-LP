import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { episodesOfKind, FILLER_SERIES, rangeLength, skipRanges, watchRanges } from "./filler-arcs";
import {
  ONE_PIECE_EPISODE_COUNT,
  ONE_PIECE_SEASONS,
  watchHours,
  weeksAtPace,
} from "./one-piece-count";

describe("filler arc totals", () => {
  it("counts the usual Naruto skip list as 90 filler episodes", () => {
    assert.equal(episodesOfKind(FILLER_SERIES.naruto.arcs, "filler"), 90);
    assert.equal(episodesOfKind(FILLER_SERIES.naruto.arcs, "mixed"), 1);
  });

  it("counts the usual Shippuden filler list as 203 episodes", () => {
    assert.equal(episodesOfKind(FILLER_SERIES["naruto-shippuden"].arcs, "filler"), 203);
  });

  it("counts 163 Bleach and 18 Black Clover filler episodes", () => {
    assert.equal(episodesOfKind(FILLER_SERIES.bleach.arcs, "filler"), 163);
    assert.equal(episodesOfKind(FILLER_SERIES["black-clover"].arcs, "filler"), 18);
  });

  it("keeps every arc inside its series", () => {
    for (const series of Object.values(FILLER_SERIES)) {
      for (const arc of series.arcs) {
        assert.ok(
          arc.start >= 1 && arc.end <= series.totalEpisodes && arc.end >= arc.start,
          series.id,
        );
      }
    }
  });

  it("keeps One Piece filler arcs inside the aired episode count", () => {
    const series = FILLER_SERIES["one-piece"];
    const filler = episodesOfKind(series.arcs, "filler");
    assert.ok(filler > 0);
    assert.ok(filler < series.totalEpisodes);
    for (const arc of series.arcs) {
      assert.ok(arc.start >= 1 && arc.end <= series.totalEpisodes && arc.end >= arc.start);
    }
  });
});

describe("watch ranges", () => {
  it("watch and skip ranges cover every episode exactly once", () => {
    for (const series of Object.values(FILLER_SERIES)) {
      const watched = watchRanges(series).reduce((sum, r) => sum + rangeLength(r), 0);
      const skipped = skipRanges(series).reduce((sum, r) => sum + rangeLength(r), 0);
      assert.equal(watched + skipped, series.totalEpisodes, series.id);
    }
  });

  it("keeps Naruto episode 220 and mixed episode 141 on the watch list", () => {
    const ranges = watchRanges(FILLER_SERIES.naruto);
    assert.deepEqual(ranges.at(-1), { start: 220, end: 220 });
    assert.ok(ranges.some((r) => r.start <= 141 && r.end >= 141));
  });

  it("merges touching One Piece filler arcs", () => {
    assert.ok(skipRanges(FILLER_SERIES["one-piece"]).some((r) => r.start === 131 && r.end === 143));
  });
});

describe("watch pace", () => {
  it("season table adds up to the episode count", () => {
    const sum = ONE_PIECE_SEASONS.reduce((total, season) => total + season.episodes, 0);
    assert.equal(sum, ONE_PIECE_EPISODE_COUNT);
    assert.equal(FILLER_SERIES["one-piece"].totalEpisodes, ONE_PIECE_EPISODE_COUNT);
  });

  it("rounds hours and weeks", () => {
    assert.equal(watchHours(1180, 24), 472);
    assert.equal(weeksAtPace(1180, 2), 590);
  });
});
