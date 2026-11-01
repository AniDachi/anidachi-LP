import type { HostingDisplayContext } from "./free20-live-status";

const sequenceKey = "room_hosting_display_sequence_v1";
const rightKey = "room_hosting_display_right_v1";
type Row = {
	value_json: string;
	[key: string]: ArrayBuffer | number | string | null;
};
function read(storage: DurableObjectStorage, key: string): unknown {
	const row = storage.sql
		.exec<Row>("SELECT value_json FROM room_meta WHERE key = ?", key)
		.toArray()[0];
	return row ? JSON.parse(row.value_json) : undefined;
}
function write(
	storage: DurableObjectStorage,
	key: string,
	value: unknown,
	now: number,
) {
	storage.sql.exec(
		"INSERT OR REPLACE INTO room_meta (key,value_json,updated_at) VALUES (?,?,?)",
		key,
		JSON.stringify(value),
		now,
	);
}
/** Independent display metadata. Prior marker-aware runtimes ignore these rows. */
export function nextHostingTimeSequence(
	storage: DurableObjectStorage,
	now: number,
): number {
	return storage.transactionSync(() => {
		const stored = read(storage, sequenceKey);
		const value = stored === undefined ? 0 : stored;
		if (
			typeof value !== "number" ||
			!Number.isSafeInteger(value) ||
			value < 0 ||
			value >= Number.MAX_SAFE_INTEGER
		)
			throw new Error("Display sequence unavailable");
		const next = value + 1;
		write(storage, sequenceKey, next, now);
		return next;
	});
}
export function readHostingTimeRight(
	storage: DurableObjectStorage,
): HostingDisplayContext["displayTime"] {
	try {
		const value = read(storage, rightKey);
		return value && typeof value === "object"
			? (value as HostingDisplayContext["displayTime"])
			: null;
	} catch {
		return null;
	}
}
export function writeHostingTimeRight(
	storage: DurableObjectStorage,
	value: HostingDisplayContext["displayTime"],
	now: number,
) {
	write(storage, rightKey, value ?? null, now);
}
