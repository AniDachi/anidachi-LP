import {
	Free20RoomRefreshRequestSchema,
	Free20RoomRefreshReceiptSchema,
	type Free20RoomRefreshRequest,
	type Free20RoomRefreshReceipt,
} from "@anidachi/protocol";
import { db } from "./db";
import { internalServiceAuthorization } from "../internal-service-auth";

export type Free20RefreshClaim = {
	request: Free20RoomRefreshRequest;
	leaseToken: string;
};
type Completion = "completed" | "retry" | "superseded" | "stale";
export interface Free20RefreshDeliveryDependencies {
	claim(
		limit: number,
		ownerUserId: string | undefined,
		signal: AbortSignal,
	): Promise<Free20RefreshClaim[]>;
	deliver(job: Free20RefreshClaim, signal: AbortSignal): Promise<unknown>;
	finish(
		job: Free20RefreshClaim,
		receipt: Free20RoomRefreshReceipt | null,
		signal: AbortSignal,
	): Promise<Completion>;
}
const DATABASE_TIMEOUT_MS = 2000;
const DELIVERY_TIMEOUT_MS = 28_000;
const DRAIN_BUDGET_MS = 35_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function bounded<T>(
	ms: number,
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
					reject(new Error("Free20 delivery deadline"));
				}, ms);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
export type Free20DeliverySummary = {
	claimed: number;
	completed: number;
	pending: number;
	errors: number;
};
export type Free20DeliveryOptions = {
	ownerUserId?: string;
	dependencies?: Free20RefreshDeliveryDependencies;
	deliveryTimeoutMs?: number;
};
/** At-least-once processing requests only. SQL retains work through any lost ACK. */
export async function drainFree20PurchaseDelivery(
	options: Free20DeliveryOptions = {},
): Promise<Free20DeliverySummary> {
	const dependencies = options.dependencies ?? defaultDependencies;
	const timeout = Math.max(
		1,
		Math.min(
			DELIVERY_TIMEOUT_MS,
			options.deliveryTimeoutMs ?? DELIVERY_TIMEOUT_MS,
		),
	);
	const deadline = performance.now() + DRAIN_BUDGET_MS;
	const summary = { claimed: 0, completed: 0, pending: 0, errors: 0 };
	while (deadline - performance.now() >= timeout + 2 * DATABASE_TIMEOUT_MS) {
		let jobs: Free20RefreshClaim[];
		try {
			jobs = await bounded(DATABASE_TIMEOUT_MS, (s) =>
				dependencies.claim(4, options.ownerUserId, s),
			);
			if (!Array.isArray(jobs) || jobs.length > 4)
				throw new Error("Free20 claim invalid");
		} catch {
			summary.errors++;
			break;
		}
		if (!jobs.length) break;
		summary.claimed += jobs.length;
		await Promise.all(
			jobs.map(async (job) => {
				let receipt: Free20RoomRefreshReceipt | null = null;
				try {
					const result = Free20RoomRefreshReceiptSchema.parse(
						await bounded(timeout, (s) => dependencies.deliver(job, s)),
					);
					const target = result.request,
						expected = job.request;
					if (
						target.refreshVersion !== expected.refreshVersion ||
						target.ownerUserId !== expected.ownerUserId ||
						target.roomId !== expected.roomId ||
						target.roomGeneration !== expected.roomGeneration ||
						target.revision !== expected.revision
					)
						throw new Error("Free20 acknowledgement mismatch");
					receipt = result;
				} catch {
					summary.errors++;
				}
				try {
					const outcome = await bounded(DATABASE_TIMEOUT_MS, (s) =>
						dependencies.finish(job, receipt, s),
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
/** Called only AFTER durable subscription commit. Registration itself is best effort. */
export function deferFree20PurchaseDelivery(
	ownerUserId: string,
	defer: (task: () => Promise<void>) => void,
	options: {
		drain?: typeof drainFree20PurchaseDelivery;
		reportError?: (message: string) => void;
	} = {},
): boolean {
	const report =
		options.reportError ??
		((message: string) =>
			console.error(`[anidachi/free20-refresh] ${message}`));
	try {
		defer(async () => {
			try {
				const summary = await (options.drain ?? drainFree20PurchaseDelivery)({
					ownerUserId,
				});
				if (summary.errors || summary.pending)
					report("Deferred drain retained pending work");
			} catch {
				report("Deferred drain unavailable");
			}
		});
		return true;
	} catch {
		report("Deferred scheduling unavailable");
		return false;
	}
}
export async function deliverFree20RefreshToWorker(
	{ request }: Free20RefreshClaim,
	signal: AbortSignal,
): Promise<unknown> {
	const baseUrl = process.env.ANIDACHI_API_INTERNAL_BASE_URL,
		secret = process.env.ANIDACHI_INTERNAL_API_SECRET;
	if (!baseUrl || !secret) throw new Error("Free20 delivery is not configured");
	const response = await fetch(
		new URL(
			`/internal/rooms/${encodeURIComponent(request.roomId)}/free20-refresh`,
			baseUrl,
		),
		{
			method: "POST",
			headers: {
				Authorization: internalServiceAuthorization(secret),
				"Content-Type": "application/json",
			},
			body: JSON.stringify(request),
			signal,
			redirect: "error",
		},
	);
	if (!response.ok) throw new Error("Free20 delivery unavailable");
	return response.json();
}
const defaultDependencies: Free20RefreshDeliveryDependencies = {
	async claim(limit, ownerUserId, signal) {
		const { data, error } = await db()
			.rpc("claim_free20_room_refresh_v1", {
				p_limit: limit,
				p_owner_user_id: ownerUserId ?? null,
			})
			.abortSignal(signal);
		if (error || !Array.isArray(data) || data.length > limit)
			throw new Error("Free20 claim unavailable");
		return data.map((row) => {
			const request = Free20RoomRefreshRequestSchema.parse({
				refreshVersion: 1,
				ownerUserId: row.owner_user_id,
				roomId: row.room_id,
				roomGeneration: row.room_generation,
				revision: row.lease_revision,
			});
			if (
				row.revision !== row.lease_revision ||
				typeof row.lease_token !== "string" ||
				!UUID.test(row.lease_token)
			)
				throw new Error("Free20 lease invalid");
			return { request, leaseToken: row.lease_token };
		});
	},
	deliver: deliverFree20RefreshToWorker,
	async finish({ request, leaseToken }, receipt, signal) {
		const { data, error } = await db()
			.rpc("finish_free20_room_refresh_v1", {
				p_owner_user_id: request.ownerUserId,
				p_room_id: request.roomId,
				p_room_generation: request.roomGeneration,
				p_revision: request.revision,
				p_lease_token: leaseToken,
				p_outcome: receipt?.outcome ?? null,
			})
			.abortSignal(signal);
		if (error || !["completed", "retry", "superseded", "stale"].includes(data))
			throw new Error("Free20 finish unavailable");
		return data as Completion;
	},
};
