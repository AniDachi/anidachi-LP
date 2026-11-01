import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Free20RoomRefreshRequest } from "@anidachi/protocol";
import * as delivery from "./free20-purchase-delivery";

const request: Free20RoomRefreshRequest = {
	refreshVersion: 1,
	ownerUserId: "f6260000-0000-4000-8000-000000000001",
	roomId: "room-1",
	roomGeneration: 17,
	revision: 3,
};
const claim = { request, leaseToken: "f6260000-0000-4000-8000-000000000002" };
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
afterEach(() => {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
});

function fixture(response: unknown = { request, outcome: "applied" }) {
	const finished: unknown[] = [];
	let claimed = false;
	const dependencies: delivery.Free20RefreshDeliveryDependencies = {
		async claim(limit: number, owner: string | undefined, signal: AbortSignal) {
			assert.equal(limit, 4);
			assert.equal(owner, request.ownerUserId);
			assert.ok(signal instanceof AbortSignal);
			if (claimed) return [];
			claimed = true;
			return [claim];
		},
		async deliver(job: delivery.Free20RefreshClaim) {
			assert.deepEqual(job, claim);
			return response;
		},
		async finish(job: delivery.Free20RefreshClaim, receipt: unknown) {
			assert.deepEqual(job, claim);
			finished.push(receipt);
			return receipt ? ("completed" as const) : ("retry" as const);
		},
	};
	return { finished, dependencies };
}
test("full processing receipt completes only its bound job", async () => {
	for (const outcome of ["applied", "terminal", "stale"] as const) {
		const f = fixture({ request, outcome });
		const summary = await delivery.drainFree20PurchaseDelivery({
			ownerUserId: request.ownerUserId,
			dependencies: f.dependencies,
		});
		assert.equal(summary.completed, 1);
		assert.equal(summary.pending, 0);
		assert.deepEqual(f.finished, [{ request, outcome }]);
	}
});
test("every receipt binding field, malformed responses and unknown outcome retain work", async () => {
	for (const response of [
		null,
		{ request, outcome: "paid" },
		{ request, outcome: "applied", paid: true },
		...Object.entries({
			ownerUserId: "f6260000-0000-4000-8000-000000000009",
			roomId: "other",
			roomGeneration: 18,
			revision: 4,
			refreshVersion: 2,
		}).map(([key, value]) => ({
			request: { ...request, [key]: value },
			outcome: "applied",
		})),
	]) {
		const f = fixture(response);
		const result = await delivery.drainFree20PurchaseDelivery({
			ownerUserId: request.ownerUserId,
			dependencies: f.dependencies,
		});
		assert.deepEqual(f.finished, [null]);
		assert.equal(result.pending, 1);
		assert.equal(result.errors, 1);
	}
});
test("a hung Worker has a deadline and records retry without waiting for the transport", async () => {
	const f = fixture();
	let signal: AbortSignal | undefined;
	f.dependencies.deliver = async (_job, s) => {
		signal = s;
		return new Promise(() => {});
	};
	const summary = await delivery.drainFree20PurchaseDelivery({
		ownerUserId: request.ownerUserId,
		dependencies: f.dependencies,
		deliveryTimeoutMs: 5,
	});
	assert.equal(signal?.aborted, true);
	assert.equal(summary.pending, 1);
	assert.deepEqual(f.finished, [null]);
});
test("lost finish response leaves lease recovery and reports bounded failure", async () => {
	const f = fixture();
	f.dependencies.finish = async () => {
		throw new Error("lost ACK");
	};
	const result = await delivery.drainFree20PurchaseDelivery({
		ownerUserId: request.ownerUserId,
		dependencies: f.dependencies,
	});
	assert.equal(result.completed, 0);
	assert.equal(result.errors, 1);
});
test("claim bounds reject an oversized batch before any delivery", async () => {
	let delivered = 0;
	const result = await delivery.drainFree20PurchaseDelivery({
		dependencies: {
			claim: async () => Array(5).fill(claim),
			deliver: async () => {
				delivered++;
			},
			finish: async () => "completed",
		},
	});
	assert.equal(delivered, 0);
	assert.equal(result.errors, 1);
});
test("deferred registration is owner scoped, does no eager I/O and scheduling failures stay best effort", async () => {
	const tasks: (() => Promise<void>)[] = [];
	const seen: string[] = [];
	assert.equal(
		delivery.deferFree20PurchaseDelivery(
			request.ownerUserId,
			(task) => tasks.push(task),
			{
				drain: async (options) => {
					seen.push(options!.ownerUserId!);
					return { claimed: 0, completed: 0, pending: 0, errors: 0 };
				},
			},
		),
		true,
	);
	assert.deepEqual(seen, []);
	await tasks[0]();
	assert.deepEqual(seen, [request.ownerUserId]);
	assert.equal(
		delivery.deferFree20PurchaseDelivery(
			request.ownerUserId,
			() => {
				throw new Error("outside request");
			},
			{ reportError: () => {} },
		),
		false,
	);
	delivery.deferFree20PurchaseDelivery(
		request.ownerUserId,
		(task) => tasks.push(task),
		{
			drain: async () => {
				throw new Error("offline");
			},
			reportError: () => {},
		},
	);
	await tasks[1]();
});
test("real transport uses existing service auth, full request, signal and no redirects; non-2xx never ACKs", async () => {
	Object.assign(process.env, {
		ANIDACHI_API_INTERNAL_BASE_URL: "https://worker.example",
		ANIDACHI_INTERNAL_API_SECRET: "synthetic-room-secret",
	});
	let status = 200;
	globalThis.fetch = async (url, init) => {
		assert.equal(
			String(url),
			"https://worker.example/internal/rooms/room-1/free20-refresh",
		);
		assert.equal(init?.method, "POST");
		assert.equal(
			new Headers(init?.headers).get("authorization"),
			"Bearer synthetic-room-secret",
		);
		assert.equal(init?.redirect, "error");
		assert.ok(init?.signal instanceof AbortSignal);
		assert.deepEqual(JSON.parse(String(init?.body)), request);
		return Response.json({ request, outcome: "applied" }, { status });
	};
	assert.deepEqual(
		await delivery.deliverFree20RefreshToWorker(
			claim,
			new AbortController().signal,
		),
		{ request, outcome: "applied" },
	);
	for (status of [401, 404, 429, 500, 503])
		await assert.rejects(
			delivery.deliverFree20RefreshToWorker(
				claim,
				new AbortController().signal,
			),
		);
});
