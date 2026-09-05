export type WatchHistoryDatePreset =
	| "all-time"
	| "today"
	| "last-7-days"
	| "this-month"
	| "custom";

export type WatchHistoryDateRange = {
	from: string;
	until: string;
};

export type WatchHistoryDateRangeResult =
	| { ok: true; range: WatchHistoryDateRange | null }
	| { ok: false; error: "invalid-date" | "reversed-range" };

export function createWatchHistoryDateRange(input: {
	preset: WatchHistoryDatePreset;
	now?: Date;
	fromDate?: string;
	throughDate?: string;
}): WatchHistoryDateRangeResult {
	if (input.preset === "all-time") return { ok: true, range: null };

	if (input.preset === "custom") {
		const from = parseLocalDate(input.fromDate);
		const through = parseLocalDate(input.throughDate);
		if (!from || !through) return { ok: false, error: "invalid-date" };
		if (from.getTime() > through.getTime()) {
			return { ok: false, error: "reversed-range" };
		}
		const until = new Date(through);
		until.setDate(until.getDate() + 1);
		return isoRange(from, until);
	}

	const now = input.now ?? new Date();
	if (Number.isNaN(now.getTime())) return { ok: false, error: "invalid-date" };
	const today = new Date(now);
	today.setHours(0, 0, 0, 0);
	const until = new Date(today);
	until.setDate(until.getDate() + 1);
	const from = new Date(today);
	if (input.preset === "last-7-days") from.setDate(from.getDate() - 6);
	if (input.preset === "this-month") from.setDate(1);
	return isoRange(from, until);
}

function parseLocalDate(value: string | undefined): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(year, month - 1, day, 0, 0, 0, 0);
	if (year >= 0 && year <= 99) date.setFullYear(year);
	return date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
		? date
		: null;
}

function isoRange(from: Date, until: Date): WatchHistoryDateRangeResult {
	return {
		ok: true,
		range: { from: from.toISOString(), until: until.toISOString() },
	};
}
