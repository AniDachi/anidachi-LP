import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWatchHistoryDateRange } from "../src/watch-history-browse";

describe.sequential("watch history local calendar date ranges", () => {
	const originalTimezone = process.env.TZ;

	afterAll(() => {
		if (originalTimezone === undefined) delete process.env.TZ;
		else process.env.TZ = originalTimezone;
	});

	describe("in UTC", () => {
		beforeAll(() => {
			process.env.TZ = "UTC";
		});

		it("uses inclusive local dates and the next local midnight as the exclusive end", () => {
			const now = new Date("2026-03-08T16:30:00.000Z");
			expect(createWatchHistoryDateRange({ preset: "all-time", now })).toEqual({
				ok: true,
				range: null,
			});
			expect(createWatchHistoryDateRange({ preset: "today", now })).toEqual({
				ok: true,
				range: {
					from: "2026-03-08T00:00:00.000Z",
					until: "2026-03-09T00:00:00.000Z",
				},
			});
			expect(
				createWatchHistoryDateRange({ preset: "last-7-days", now }),
			).toEqual({
				ok: true,
				range: {
					from: "2026-03-02T00:00:00.000Z",
					until: "2026-03-09T00:00:00.000Z",
				},
			});
			expect(
				createWatchHistoryDateRange({ preset: "this-month", now }),
			).toEqual({
				ok: true,
				range: {
					from: "2026-03-01T00:00:00.000Z",
					until: "2026-03-09T00:00:00.000Z",
				},
			});
		});

		it("accepts leap day and a one-day custom range", () => {
			expect(
				createWatchHistoryDateRange({
					preset: "custom",
					now: new Date("2024-02-29T12:00:00.000Z"),
					fromDate: "2024-02-29",
					throughDate: "2024-02-29",
				}),
			).toEqual({
				ok: true,
				range: {
					from: "2024-02-29T00:00:00.000Z",
					until: "2024-03-01T00:00:00.000Z",
				},
			});
		});

		it.each([
			{ fromDate: "", throughDate: "2026-03-08" },
			{ fromDate: "2026-3-01", throughDate: "2026-03-08" },
			{ fromDate: "2026-02-29", throughDate: "2026-03-08" },
			{ fromDate: "2026-02-30", throughDate: "2026-03-08" },
			{ fromDate: "2026-03-01T00:00:00Z", throughDate: "2026-03-08" },
			{ fromDate: "2026-03-01", throughDate: undefined },
		])("rejects strict invalid custom dates: $fromDate through $throughDate", (dates) => {
			expect(
				createWatchHistoryDateRange({
					preset: "custom",
					now: new Date("2026-03-08T12:00:00.000Z"),
					...dates,
				}),
			).toEqual({ ok: false, error: "invalid-date" });
		});

		it("rejects a reversed custom range", () => {
			expect(
				createWatchHistoryDateRange({
					preset: "custom",
					now: new Date("2026-03-08T12:00:00.000Z"),
					fromDate: "2026-03-08",
					throughDate: "2026-03-01",
				}),
			).toEqual({ ok: false, error: "reversed-range" });
		});
	});

	describe("in America/New_York", () => {
		beforeAll(() => {
			process.env.TZ = "America/New_York";
		});

		it("crosses spring daylight saving with calendar methods instead of a 24-hour duration", () => {
			const now = new Date("2026-03-08T16:30:00.000Z");
			expect(createWatchHistoryDateRange({ preset: "today", now })).toEqual({
				ok: true,
				range: {
					from: "2026-03-08T05:00:00.000Z",
					until: "2026-03-09T04:00:00.000Z",
				},
			});
			expect(
				createWatchHistoryDateRange({ preset: "last-7-days", now }),
			).toEqual({
				ok: true,
				range: {
					from: "2026-03-02T05:00:00.000Z",
					until: "2026-03-09T04:00:00.000Z",
				},
			});
			expect(
				createWatchHistoryDateRange({ preset: "this-month", now }),
			).toEqual({
				ok: true,
				range: {
					from: "2026-03-01T05:00:00.000Z",
					until: "2026-03-09T04:00:00.000Z",
				},
			});
		});
	});

	describe("in America/Santiago", () => {
		beforeAll(() => {
			process.env.TZ = "America/Santiago";
		});

		it("rebases a preset end onto the destination day's own midnight after a skipped midnight", () => {
			expect(
				createWatchHistoryDateRange({
					preset: "today",
					now: new Date("2026-09-06T16:00:00.000Z"),
				}),
			).toEqual({
				ok: true,
				range: {
					from: "2026-09-06T04:00:00.000Z",
					until: "2026-09-07T03:00:00.000Z",
				},
			});
		});

		it("rebases a custom inclusive end onto the next date's own midnight", () => {
			expect(
				createWatchHistoryDateRange({
					preset: "custom",
					fromDate: "2026-09-05",
					throughDate: "2026-09-06",
				}),
			).toEqual({
				ok: true,
				range: {
					from: "2026-09-05T04:00:00.000Z",
					until: "2026-09-07T03:00:00.000Z",
				},
			});
		});
	});
});
