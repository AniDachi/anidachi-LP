import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
	drainRoomHostingCutover,
	type CutoverDeliveryDependencies,
} from "./room-hosting-cutover";
const cutover = {
	revision: 2,
	roomId: "free-room",
	roomGeneration: 1,
	closingAt: 1000,
};
const job = { cutover, leaseToken: "lease" };
const receipt = {
	cutover,
	fencedAt: 2000,
	finalizedAt: 3000,
	webFinalized: true,
};
function fixture(
	options: {
		result?: unknown;
		failDelivery?: boolean;
		hang?: boolean;
		failFinish?: boolean;
		batches?: number[];
		outcome?: "completed" | "retry";
	} = {},
) {
	const batches = options.batches ?? [1];
	let claimed = 0;
	const deps = {
		claim: mock.fn(async (_limit: number, _signal: AbortSignal) =>
			Array.from({ length: batches[claimed++] ?? 0 }, () => job),
		),
		deliver: mock.fn(
			async (_job: typeof job, _signal: AbortSignal): Promise<unknown> => {
				if (options.failDelivery) throw new Error("offline");
				if (options.hang) return new Promise(() => {});
				return options.result ?? receipt;
			},
		),
		finish: mock.fn(
			async (_job: typeof job, _receipt: Parameters<CutoverDeliveryDependencies["finish"]>[1], _signal: AbortSignal) => {
				if (options.failFinish) throw new Error("lost ACK");
				return options.outcome ?? "completed";
			},
		),
	} satisfies CutoverDeliveryDependencies;
	return deps;
}
test("delivers exact database targets and acknowledges observed finalization", async () => {
	const deps = fixture();
	assert.deepEqual(await drainRoomHostingCutover({ dependencies: deps }), {
		claimed: 1,
		completed: 1,
		pending: 0,
		errors: 0,
	});
	assert.deepEqual(deps.deliver.mock.calls[0].arguments[0], job);
	assert.deepEqual(deps.finish.mock.calls[0].arguments.slice(0, 2), [
		job,
		receipt,
	]);
});
test("partial fence remains pending and stops this pass without discarding the job", async () => {
	const partial = { ...receipt, finalizedAt: null, webFinalized: false };
	const deps = fixture({ result: partial, outcome: "retry" });
	assert.deepEqual(await drainRoomHostingCutover({ dependencies: deps }), {
		claimed: 1,
		completed: 0,
		pending: 1,
		errors: 0,
	});
	assert.deepEqual(deps.finish.mock.calls[0].arguments.slice(0, 2), [
		job,
		partial,
	]);
	assert.equal(deps.claim.mock.callCount(), 1);
});
test("unknown delivery is retried without inventing a fence or completion", async () => {
	const deps = fixture({ failDelivery: true, outcome: "retry" });
	assert.deepEqual(await drainRoomHostingCutover({ dependencies: deps }), {
		claimed: 1,
		completed: 0,
		pending: 1,
		errors: 1,
	});
	assert.deepEqual(deps.finish.mock.calls[0].arguments.slice(0, 2), [
		job,
		null,
	]);
});
test("bounds a delivery that ignores abort", async () => {
	const deps = fixture({ hang: true, outcome: "retry" });
	const result = await drainRoomHostingCutover({
		dependencies: deps,
		deliveryTimeoutMs: 5,
	});
	assert.equal(result.completed, 0);
	assert.equal(result.errors, 1);
	assert.equal(deps.deliver.mock.calls[0].arguments[1].aborted, true);
});
test("a receipt from another revision cannot complete the target", async () => {
	const deps = fixture({
		result: { ...receipt, cutover: { ...cutover, revision: 1 } },
		outcome: "retry",
	});
	assert.equal(
		(await drainRoomHostingCutover({ dependencies: deps })).completed,
		0,
	);
	assert.equal(deps.finish.mock.calls[0].arguments[1], null);
});
test("lost finish response leaves an unknown outcome without claiming completion", async () => {
	const deps = fixture({ failFinish: true });
	const result = await drainRoomHostingCutover({ dependencies: deps });
	assert.equal(result.completed, 0);
	assert.equal(result.errors, 1);
	assert.equal(deps.claim.mock.callCount(), 1);
});
test("healthy bounded batches can deliver more than four rooms in the same drain", async () => {
	const deps = fixture({ batches: [4, 1] });
	assert.deepEqual(await drainRoomHostingCutover({ dependencies: deps }), {
		claimed: 5,
		completed: 5,
		pending: 0,
		errors: 0,
	});
	assert.equal(deps.claim.mock.calls[0].arguments[0], 4);
});
