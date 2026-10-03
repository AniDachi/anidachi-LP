import {
	RoomHostingCutoverSchema,
	RoomHostingCutoverReceiptSchema,
	type RoomHostingCutover,
	type RoomHostingCutoverReceipt,
} from "@anidachi/protocol";
import { db } from "./db";
import { syncRoomEndToWorker } from "./room-lifecycle";

type Receipt = RoomHostingCutoverReceipt;
export type CutoverClaim = { cutover: RoomHostingCutover; leaseToken: string };
type Completion = "completed" | "retry" | "stale";
export interface CutoverDeliveryDependencies {
	claim(limit: number, signal: AbortSignal): Promise<CutoverClaim[]>;
	deliver(job: CutoverClaim, signal: AbortSignal): Promise<unknown>;
	finish(
		job: CutoverClaim,
		receipt: Receipt | null,
		signal: AbortSignal,
	): Promise<Completion>;
}
const DATABASE_TIMEOUT_MS = 2000;
const DELIVERY_TIMEOUT_MS = 28_000;
const DRAIN_BUDGET_MS = 35_000; // Less than the scheduler's 40s HTTP deadline.

async function bounded<T>(
	timeoutMs: number,
	work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			Promise.resolve().then(() => work(controller.signal)),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					controller.abort();
					reject(new Error("Cutover delivery deadline"));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}

export async function drainRoomHostingCutover(
	options: {
		dependencies?: CutoverDeliveryDependencies;
		deliveryTimeoutMs?: number;
	} = {},
) {
	const dependencies = options.dependencies ?? defaultDependencies;
	const deliveryTimeoutMs = Math.max(
		1,
		Math.min(
			DELIVERY_TIMEOUT_MS,
			options.deliveryTimeoutMs ?? DELIVERY_TIMEOUT_MS,
		),
	);
	const deadline = performance.now() + DRAIN_BUDGET_MS;
	const summary = { claimed: 0, completed: 0, pending: 0, errors: 0 };
	// Reserve enough time for a full batch plus both DB operations. Leases live
	// for 60s; timeout/lost responses never remove the authoritative outbox row.
	while (
		deadline - performance.now() >=
		deliveryTimeoutMs + 2 * DATABASE_TIMEOUT_MS
	) {
		let jobs: CutoverClaim[];
		try {
			jobs = await bounded(DATABASE_TIMEOUT_MS, (signal) =>
				dependencies.claim(4, signal),
			);
		} catch {
			summary.errors++;
			break;
		}
		if (!jobs.length) break;
		summary.claimed += jobs.length;
		await Promise.all(
			jobs.map(async (job) => {
				let receipt: Receipt | null = null;
				try {
					const result = RoomHostingCutoverReceiptSchema.parse(
						await bounded(deliveryTimeoutMs, (signal) =>
							dependencies.deliver(job, signal),
						),
					);
					const target = result.cutover;
					if (
						target.roomId !== job.cutover.roomId ||
						target.revision !== job.cutover.revision ||
						target.roomGeneration !== job.cutover.roomGeneration ||
						target.closingAt !== job.cutover.closingAt
					)
						throw new Error("Cutover acknowledgement mismatch");
					receipt = result;
				} catch {
					summary.errors++;
				}
				try {
					const outcome = await bounded(DATABASE_TIMEOUT_MS, (signal) =>
						dependencies.finish(job, receipt, signal),
					);
					if (outcome === "completed") summary.completed++;
					else summary.pending++;
				} catch {
					summary.errors++;
				}
			}),
		);
		if (summary.errors || summary.pending) break;
	}
	return summary;
}

const defaultDependencies: CutoverDeliveryDependencies = {
	async claim(limit, signal) {
		const { data, error } = await db()
			.rpc("claim_room_hosting_cutover_v1", { p_limit: limit })
			.abortSignal(signal);
		if (error || !Array.isArray(data) || data.length > limit)
			throw new Error("Cutover claim unavailable");
		return data.map((row) => {
			const cutover = RoomHostingCutoverSchema.parse({
				revision: row.revision,
				roomId: row.room_id,
				roomGeneration: row.room_generation,
				closingAt: new Date(row.closing_at).getTime(),
			});
			if (
				typeof row.lease_token !== "string" ||
				!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					row.lease_token,
				)
			)
				throw new Error("Cutover lease invalid");
			return { cutover, leaseToken: row.lease_token };
		});
	},
	async deliver({ cutover }, signal) {
		return syncRoomEndToWorker(
			cutover.roomId,
			{ endedAt: cutover.closingAt, reason: "capability_expired", cutover },
			{ signal },
		);
	},
	async finish({ cutover, leaseToken }, receipt, signal) {
		const { data, error } = await db()
			.rpc("finish_room_hosting_cutover_v1", {
				p_revision: cutover.revision,
				p_room_id: cutover.roomId,
				p_room_generation: cutover.roomGeneration,
				p_lease_token: leaseToken,
				p_fenced_at: receipt ? new Date(receipt.fencedAt).toISOString() : null,
				p_finalized_at:
					receipt?.finalizedAt != null
						? new Date(receipt.finalizedAt).toISOString()
						: null,
			})
			.abortSignal(signal);
		if (error || !["completed", "retry", "stale"].includes(data))
			throw new Error("Cutover finish unavailable");
		return data as Completion;
	},
};
