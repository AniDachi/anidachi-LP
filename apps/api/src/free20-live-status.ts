import {
	Free20LiveStatusSchema,
	HostingTimeEventSchema,
	ConfirmedUnlimitedHostingTimeSchema,
	type HostingTimeEvent,
	type Free20LiveStatusRequest,
	type HostingTimeBinding,
} from "@anidachi/protocol";
import {
	type Free20AccountingState,
	parseFree20AccountingState,
} from "./free20-room-accounting";
import { readFree20RoomTime } from "./free20-room-budget";
import type { RoomMeterState } from "./room-metering";

export type HostingDisplayContext = Parameters<
	typeof readFree20LiveStatus
>[1] & {
	displayTime?: {
		checkpointSequence: number;
		ownerUserId: string;
		roomId: string;
		roomGeneration: number;
		access: unknown;
		validUntil: number;
	} | null;
};

/** No wall clock or projected remaining value belongs in this key. Ordinary
 * playback frames must not cause display writes or broadcast traffic. */
export function hostingTimeChangeKey(context: HostingDisplayContext): string {
	return JSON.stringify(context);
}

export function projectHostingTime(
	context: HostingDisplayContext,
	sequence: number,
	now: number,
): HostingTimeEvent | null {
	if (context.terminal || !context.accounting) return null;
	const { binding, accounting, meter } = context;
	const resetAt = (Math.floor(now / 86_400_000) + 1) * 86_400_000;
	let access: HostingTimeEvent["snapshot"]["access"] = { kind: "unknown" };
	let validUntil = Math.min(now + 5_000, resetAt);
	try {
		const finite = readFree20LiveStatus(binding, context, now);
		access = finite.access;
		validUntil = finite.validUntil;
	} catch {
		const checkpoint = accounting.unlimited;
		const display = context.displayTime;
		const parsed = ConfirmedUnlimitedHostingTimeSchema.safeParse(
			display?.access,
		);
		if (
			checkpoint &&
			checkpoint.serverTime <= now &&
			!accounting.pending &&
			!meter.accountingBlocked &&
			display &&
			parsed.success &&
			checkpoint.ownerUserId === binding.ownerUserId &&
			checkpoint.roomId === binding.roomId &&
			checkpoint.roomGeneration === binding.roomGeneration &&
			checkpoint.utcDay === binding.utcDay &&
			display.ownerUserId === binding.ownerUserId &&
			display.roomId === binding.roomId &&
			display.roomGeneration === binding.roomGeneration &&
			display.checkpointSequence === checkpoint.checkpointSequence
		) {
			const until = Math.min(
				context.validUntil,
				checkpoint.refreshBy,
				display.validUntil,
				resetAt,
				parsed.data.validUntil ?? Infinity,
			);
			if (until > now) {
				access = parsed.data;
				validUntil = until;
			}
		}
	}
	return HostingTimeEventSchema.parse({
		type: "HOSTING_TIME",
		roomId: binding.roomId,
		roomGeneration: binding.roomGeneration,
		serverTime: now,
		validUntil,
		snapshot: {
			hostingTimeVersion: 1,
			ownerUserId: binding.ownerUserId,
			roomId: binding.roomId,
			roomGeneration: binding.roomGeneration,
			snapshotSequence: sequence,
			serverTime: now,
			period: { utcDay: new Date(now).toISOString().slice(0, 10), resetAt },
			access,
		},
	});
}

/** Projection only. The caller serializes this read with room lifecycle work.
 * It must never refresh, settle, change presence, renew or schedule an alarm.
 */
export function readFree20LiveStatus(
	request: Free20LiveStatusRequest,
	context: {
		binding: HostingTimeBinding;
		accounting: Free20AccountingState | null;
		meter: RoomMeterState;
		validUntil: number;
		terminal: boolean;
	},
	now: number,
) {
	const { binding, meter } = context;
	if (
		context.terminal ||
		!context.accounting ||
		meter.accountingBlocked ||
		request.ownerUserId !== binding.ownerUserId ||
		request.roomId !== binding.roomId ||
		request.roomGeneration !== binding.roomGeneration
	)
		throw new Error("Live status unavailable");
	const accounting = parseFree20AccountingState(context.accounting, meter);
	const budget = accounting.budget;
	if (
		!budget ||
		accounting.unlimited ||
		accounting.pending ||
		budget.checkpoint.ownerUserId !== binding.ownerUserId ||
		budget.checkpoint.roomId !== binding.roomId ||
		budget.checkpoint.roomGeneration !== binding.roomGeneration ||
		budget.checkpoint.utcDay !== binding.utcDay
	)
		throw new Error("Live status requires confirmed finite authority");
	return Free20LiveStatusSchema.parse({
		liveStatusVersion: 1,
		...binding,
		serverTime: now,
		validUntil: Math.min(context.validUntil, budget.checkpoint.refreshBy),
		access: readFree20RoomTime(budget, meter, now),
	});
}
