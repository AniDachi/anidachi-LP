import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { animeList } from "../anime-data";
import { CRUNCHYROLL_WEEK } from "./crunchyroll-schedule";
import {
  CRUNCHYROLL_DUB_WEEK,
  dubLagSummary,
  dubNote,
  ONE_PIECE_DUB,
  withDubNotes,
} from "./crunchyroll-dub-schedule";
import {
  presetForZone,
  slotAnchor,
  slotInstant,
  slotLocalLabel,
  weekRangeLabel,
  zoneOffsetMinutes,
} from "./schedule-time";

describe("dub schedule data", () => {
  it("covers the same week as the sub schedule", () => {
    assert.equal(CRUNCHYROLL_DUB_WEEK.weekStart, CRUNCHYROLL_WEEK.weekStart);
  });

  it("has valid times, unique anchors and a source plus check date on every row", () => {
    const anchors = new Set(CRUNCHYROLL_DUB_WEEK.slots.map(slotAnchor));
    assert.equal(anchors.size, CRUNCHYROLL_DUB_WEEK.slots.length);
    for (const slot of CRUNCHYROLL_DUB_WEEK.slots) {
      assert.ok(slot.utcDay >= 0 && slot.utcDay <= 6, slot.title);
      assert.match(slot.utcTime, /^([01]\d|2[0-3]):[0-5]\d$/, slot.title);
      assert.ok(slot.sources.some((s) => s.url.startsWith("https://www.crunchyroll.com/news/")), slot.title);
      assert.ok(slot.sources.some((s) => s.url.startsWith("https://animeschedule.net/")), slot.title);
      assert.ok(slot.checked, slot.title);
    }
  });

  it("matches each dub to a sub slot this week, and same-day dubs to the same episode and time", () => {
    for (const slot of CRUNCHYROLL_DUB_WEEK.slots) {
      if (!slot.subTitle) continue;
      const sub = CRUNCHYROLL_WEEK.slots.find((s) => s.title === slot.subTitle);
      assert.ok(sub, `no sub slot for ${slot.title}`);
      assert.notEqual(slot.episodesBehindSub, undefined, slot.title);
      if (slot.episodesBehindSub === 0) {
        assert.equal(sub.episode, slot.episode, slot.title);
        assert.equal(sub.utcDay, slot.utcDay, slot.title);
      }
    }
  });

  it("puts the One Piece dub at 9:00 a.m. Pacific on Tuesday", () => {
    const row = CRUNCHYROLL_DUB_WEEK.slots.find((s) => s.title === "One Piece");
    assert.ok(row);
    assert.equal(row.episode, `Ep ${ONE_PIECE_DUB.thisWeekEpisode}`);
    assert.equal(slotLocalLabel(CRUNCHYROLL_DUB_WEEK, row, "America/Los_Angeles"), "Tue 9:00 AM");
  });

  it("links only to watch pages that exist", () => {
    const slugs = new Set(animeList.map((a) => a.slug));
    for (const slot of [...CRUNCHYROLL_WEEK.slots, ...CRUNCHYROLL_DUB_WEEK.slots]) {
      if (slot.watchSlug) assert.ok(slugs.has(slot.watchSlug), slot.watchSlug);
    }
  });
});

describe("dub lag helpers", () => {
  it("labels same-day and trailing dubs", () => {
    const base = { title: "x", utcDay: 0, utcTime: "00:00", sources: [], checked: "" };
    assert.equal(dubNote({ ...base, episodesBehindSub: 0 }), "Same day as sub");
    assert.equal(dubNote({ ...base, episodesBehindSub: 1 }), "1 ep behind sub");
    assert.equal(dubNote({ ...base, episodesBehindSub: 2 }), "2 eps behind sub");
    assert.equal(dubNote({ ...base, episodesBehindSub: 2, note: "Finale" }), "Finale");
    assert.equal(dubNote(base), undefined);
  });

  it("summarises the week", () => {
    const week = {
      weekStart: "2026-10-19",
      checked: "",
      slots: [0, 0, 2, 2, 3, undefined].map((gap, i) => ({
        title: `s${i}`,
        utcDay: 0,
        utcTime: "00:00",
        episodesBehindSub: gap,
        sources: [],
        checked: "",
      })),
    };
    assert.deepEqual(dubLagSummary(week), { total: 6, sameDay: 2, behind: 3, typicalGap: 2 });
    const real = dubLagSummary(CRUNCHYROLL_DUB_WEEK);
    assert.equal(real.total, CRUNCHYROLL_DUB_WEEK.slots.length);
    assert.ok(real.sameDay + real.behind <= real.total);
  });

  it("keeps every row and only schedule fields for the client component", () => {
    const week = withDubNotes(CRUNCHYROLL_DUB_WEEK);
    assert.equal(week.slots.length, CRUNCHYROLL_DUB_WEEK.slots.length);
    assert.equal("sources" in week.slots[0], false);
  });
});

describe("time-zone switch", () => {
  it("reads UTC offsets across daylight-time changes", () => {
    assert.equal(zoneOffsetMinutes("America/New_York", new Date("2026-10-20T12:00:00Z")), -240);
    assert.equal(zoneOffsetMinutes("America/New_York", new Date("2026-11-03T12:00:00Z")), -300);
    assert.equal(zoneOffsetMinutes("Asia/Kolkata", new Date("2026-10-20T12:00:00Z")), 330);
    assert.equal(zoneOffsetMinutes("UTC", new Date("2026-10-20T12:00:00Z")), 0);
  });

  it("maps a device zone to the preset with the same clock", () => {
    assert.equal(presetForZone("America/Toronto", CRUNCHYROLL_WEEK)?.id, "et");
    assert.equal(presetForZone("Europe/Madrid", CRUNCHYROLL_WEEK)?.id, "cet");
    assert.equal(presetForZone("Europe/Dublin", CRUNCHYROLL_WEEK)?.id, "uk");
    assert.equal(presetForZone("Asia/Tokyo", CRUNCHYROLL_WEEK)?.id, "jst");
    assert.equal(presetForZone("Australia/Sydney", CRUNCHYROLL_WEEK), undefined);
  });

  it("formats week labels and local slot times", () => {
    assert.equal(weekRangeLabel({ weekStart: "2026-10-19" }, false).replace(/\s/g, " "), "Oct 19 – 25");
    const slot = { title: "x", utcDay: 4, utcTime: "15:00" };
    assert.equal(slotInstant(CRUNCHYROLL_WEEK, slot).toISOString(), "2026-10-23T15:00:00.000Z");
    assert.equal(slotLocalLabel(CRUNCHYROLL_WEEK, slot, "America/New_York"), "Fri 11:00 AM");
    assert.equal(slotLocalLabel(CRUNCHYROLL_WEEK, slot, "Asia/Tokyo"), "Sat 12:00 AM");
  });
});
