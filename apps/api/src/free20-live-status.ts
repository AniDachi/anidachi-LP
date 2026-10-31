import {
	Free20LiveStatusSchema,
	type Free20LiveStatusRequest,
	type HostingTimeBinding,
} from "@anidachi/protocol";
import {
	type Free20AccountingState,
	parseFree20AccountingState,
} from "./free20-room-accounting";
import { readFree20RoomTime } from "./free20-room-budget";
import type { RoomMeterState } from "./room-metering";

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
