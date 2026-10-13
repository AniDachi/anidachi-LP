import {
	RoomUsageSummarySchema,
	type RoomUsageSummary,
} from "@anidachi/protocol";
import { parseEndRoomCommand, type EndRoomCommand } from "./room-lifecycle";

export const ROOM_TERMINAL_STORAGE_KEY = "room_terminal_intent_v1";
export const ROOM_TERMINAL_RETRY_MS = 30_000;
export interface RoomTerminalIntent extends EndRoomCommand {
	schemaVersion: 1;
	fencedAt: number;
	finalizedAt: number | null;
	runtimeFinalized?: boolean;
	attempts?: number;
	nextAttemptAt: number;
	usage?: RoomUsageSummary;
}

// Invalid persisted terminal authority must fail closed, never reopen a room.
export function parseRoomTerminalIntent(
	value: unknown,
): RoomTerminalIntent | null {
	if (value === undefined) return null;
	const command = parseEndRoomCommand(value);
	const record = value as Partial<RoomTerminalIntent> | null;
	const timestamp = (n: unknown): n is number =>
		Number.isSafeInteger(n) && (n as number) >= 0;
	const usage =
		record?.usage === undefined
			? undefined
			: RoomUsageSummarySchema.safeParse(record.usage);
	if (
		!command ||
		record?.schemaVersion !== 1 ||
		!timestamp(record.fencedAt) ||
		!timestamp(record.nextAttemptAt) ||
		!(
			record.finalizedAt === null ||
			(timestamp(record.finalizedAt) && record.finalizedAt >= record.fencedAt)
		) ||
		(record.runtimeFinalized !== undefined &&
			typeof record.runtimeFinalized !== "boolean") ||
		(record.runtimeFinalized === true && record.finalizedAt === null) ||
		(record.attempts !== undefined && !timestamp(record.attempts)) ||
		(usage && !usage.success)
	)
		throw new Error("Invalid durable terminal intent");
	return {
		...command,
		schemaVersion: 1,
		fencedAt: record.fencedAt,
		finalizedAt: record.finalizedAt,
		nextAttemptAt: record.nextAttemptAt,
		runtimeFinalized: record.runtimeFinalized === true,
		...(record.attempts !== undefined ? { attempts: record.attempts } : {}),
		...(usage?.success ? { usage: usage.data } : {}),
	};
}

/** Claimed once, before I/O; callers persist the resulting positive-jitter deadline. */
export function roomTerminalRetryAt(attempts: number, now: number, random = Math.random()): number {
    const delay = Math.min(300000, ROOM_TERMINAL_RETRY_MS * 2 ** Math.max(0, Math.min(4, attempts - 1)));
    return Math.min(Number.MAX_SAFE_INTEGER, now + delay + Math.floor(delay * 0.1 * Math.max(0, Math.min(1, random))));
}
