import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CRUNCHYROLL_WEEK } from "./crunchyroll-schedule";
import { groupByLocalDay, slotAnchor, slotInstant } from "./schedule-time";
import { totalHours, WATCH_ORDERS } from "./watch-orders";

describe("release schedule", () => {
  it("places a slot at its UTC day and time", () => {
    const at = slotInstant(CRUNCHYROLL_WEEK, { title: "x", utcDay: 4, utcTime: "15:00" });
    assert.equal(at.toISOString(), "2026-10-16T15:00:00.000Z");
  });

  it("moves an early UTC slot to the previous local day in the Americas", () => {
    const week = { ...CRUNCHYROLL_WEEK, slots: [{ title: "x", utcDay: 6, utcTime: "00:30" }] };
    const [utc] = groupByLocalDay(week, "UTC");
    const [ny] = groupByLocalDay(week, "America/New_York");
    assert.equal(utc.key, "2026-10-18");
    assert.equal(ny.key, "2026-10-17");
    assert.equal(ny.rows[0].time, "8:30 PM");
  });

  it("keeps every slot inside the week with a unique anchor", () => {
    const anchors = new Set(CRUNCHYROLL_WEEK.slots.map(slotAnchor));
    assert.equal(anchors.size, CRUNCHYROLL_WEEK.slots.length);
    for (const slot of CRUNCHYROLL_WEEK.slots) {
      assert.ok(slot.utcDay >= 0 && slot.utcDay <= 6, slot.title);
      assert.match(slot.utcTime, /^([01]\d|2[0-3]):[0-5]\d$/, slot.title);
    }
  });

  it("shows every slot once whatever the timezone", () => {
    for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"]) {
      const rows = groupByLocalDay(CRUNCHYROLL_WEEK, zone).flatMap((day) => day.rows);
      assert.equal(rows.length, CRUNCHYROLL_WEEK.slots.length, zone);
    }
  });
});

describe("watch orders", () => {
  it("has unique titles and positive runtimes", () => {
    for (const order of Object.values(WATCH_ORDERS)) {
      const entries = [...order.firstWatch, ...order.later];
      assert.equal(new Set(entries.map((e) => e.title)).size, entries.length, order.id);
      assert.ok(
        entries.every((e) => e.minutes > 0),
        order.id,
      );
    }
  });

  it("puts Fate/Zero after Unlimited Blade Works and Kizumonogatari before Owarimonogatari II", () => {
    const fate = WATCH_ORDERS.fate.firstWatch.map((e) => e.title);
    assert.ok(fate.indexOf("Fate/Zero") > fate.indexOf("Fate/stay night: Unlimited Blade Works"));
    const mono = WATCH_ORDERS.monogatari.firstWatch.map((e) => e.title);
    const kizu = mono.findIndex((t) => t.startsWith("Kizumonogatari"));
    assert.ok(kizu > mono.indexOf("Owarimonogatari") && kizu < mono.indexOf("Owarimonogatari II"));
    assert.equal(totalHours([{ ...WATCH_ORDERS.fate.firstWatch[0], minutes: 90 }]), 2);
  });
});
