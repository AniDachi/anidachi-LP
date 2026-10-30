import assert from "node:assert/strict";
import test from "node:test";
import type { Free20RoomBudgetRequest } from "@anidachi/protocol";
import {
	readFree20RoomTime,
	reconcileFree20RoomBudget,
} from "../../../api/src/free20-room-budget";
import {
	createRoomMeterState,
	parseRoomMeterState,
	reconcileRoomMeter,
	roomUsageBuckets,
} from "../../../api/src/room-metering";
import { settleFree20RoomBudget } from "./free20-room-budget";

const owner = "11111111-1111-4111-8111-111111111111";
const at = Date.parse("2026-10-30T12:00:00Z");
const day = "2026-10-30";
function request(seconds?: number): Free20RoomBudgetRequest {
	return {
		roomId: "free20-room",
		roomGeneration: 1,
		checkpointSequence: 1,
		usage: seconds === undefined ? [] : [{ day, seconds }],
	};
}
function fixture() {
	let clock = at;
	let plan: "free" | "plus" = "free";
	let status: "live" | "ended" = "live";
	let failAfterCommit = false;
	const calls: string[] = [];
	const committed = new Map([[day, 420]]);
	const roomUsage = new Map<string, number>();
	const room = {
		room_id: "free20-room",
		host_user_id: owner,
		host_plan_code: "free" as const,
	};
	const deps = {
		readRoom: async (roomId: string) => {
			assert.equal(roomId, room.room_id);
			calls.push("room");
			return { ...room, status };
		},
		commitUsage: async (
			roomId: string,
			usage: { day: string; seconds: number },
		) => {
			assert.equal(roomId, room.room_id);
			calls.push(`commit:${usage.day}:${usage.seconds}`);
			// External DB boundary double: existing SQL uses greatest(old, cumulative).
			// These tests exercise orchestration, not a real SQL concurrency guarantee.
			const old = roomUsage.get(usage.day) ?? 0;
			const accepted = Math.max(old, usage.seconds);
			roomUsage.set(usage.day, accepted);
			committed.set(
				usage.day,
				(committed.get(usage.day) ?? 0) + accepted - old,
			);
			if (failAfterCommit) throw new Error("ACK lost after DB commit");
			return { day: usage.day, seconds: accepted };
		},
		resolveAuthority: async (userId: string) => {
			assert.equal(userId, owner);
			calls.push("authority");
			const until = new Date(clock + 300_000).toISOString();
			return {
				planCode: plan,
				paidUntil: plan === "free" ? null : until,
				selectedPlanExpiresAt: plan === "free" ? null : until,
				hosting: {
					hostingPolicyVersion: 2,
					hostingActivationAt: "2026-09-28T00:00:00Z",
					canHost: plan !== "free",
					trialEligibility: plan === "free" ? "eligible" : "unavailable",
					trialEndsAt: null,
				},
				history: {
					accessVersion: 1,
					ownerUserId: owner,
					accountGeneration: 3,
					accessEpoch: 4,
					youtubeConsentEpoch: 2,
					state: plan === "free" ? "plan_required" : "allowed",
					serverTime: new Date(clock).toISOString(),
					captureNotBefore: "2026-09-08T10:00:00Z",
					validUntil: until,
					youtubeHistoryEnabled: true,
				},
			};
		},
		readUsage: async (userId: string, utcDay: string) => {
			assert.equal(userId, owner);
			calls.push(`read:${utcDay}`);
			return committed.get(utcDay) ?? 0;
		},
	};
	return {
		deps,
		calls,
		room,
		committed,
		roomUsage,
		setClock: (value: number) => {
			clock = value;
		},
		setPaid: () => {
			plan = "plus";
		},
		setEnded: () => {
			status = "ended";
		},
		loseAck: (value: boolean) => {
			failAfterCommit = value;
		},
	};
}

test("Free20 commits requested room usage before reading the authoritative account day", async () => {
	const f = fixture();
	const result = await settleFree20RoomBudget(
		request(180),
		new Date(at),
		f.deps,
	);
	assert.deepEqual(f.calls, [
		"room",
		`commit:${day}:180`,
		"authority",
		`read:${day}`,
		"room",
	]);
	assert.deepEqual(result, {
		roomBudgetVersion: 1,
		ownerUserId: owner,
		roomId: "free20-room",
		roomGeneration: 1,
		checkpointSequence: 1,
		utcDay: day,
		serverTime: at,
		resetAt: Date.parse("2026-10-31T00:00:00Z"),
		refreshBy: at + 300_000,
		budgetSeconds: 1200,
		committedSeconds: 600,
		acknowledged: [{ day, seconds: 180 }],
	});
});

test("Free20 producer and existing Worker meter keep 7+3 minutes at 10 through lost ACK and restart", async () => {
	const f = fixture();
	const binding = {
		ownerUserId: owner,
		roomId: "free20-room",
		roomGeneration: 1,
		utcDay: day,
	};
	const firstRequest = request();
	const first = await settleFree20RoomBudget(
		firstRequest,
		new Date(at),
		f.deps,
	);
	const initial = reconcileFree20RoomBudget(first, {
		binding,
		request: firstRequest,
		previous: null,
		meter: reconcileRoomMeter(createRoomMeterState(), true, at),
		now: at,
	});
	const later = at + 180_000;
	assert.equal(
		readFree20RoomTime(initial.budget, initial.meter, later).remainingSeconds,
		600,
	);
	const durable = reconcileRoomMeter(
		reconcileRoomMeter(initial.meter, false, later),
		true,
		later,
	);
	const secondRequest = {
		...request(),
		checkpointSequence: 2,
		usage: roomUsageBuckets(durable),
	};
	f.setClock(later);
	f.loseAck(true);
	await assert.rejects(
		settleFree20RoomBudget(secondRequest, new Date(later), f.deps),
		/ACK lost/,
	);
	assert.equal(f.committed.get(day), 600);
	f.loseAck(false);
	const retry = { ...secondRequest, checkpointSequence: 3 };
	const paired = await settleFree20RoomBudget(retry, new Date(later), f.deps);
	assert.equal(f.committed.get(day), 600);
	const restored = parseRoomMeterState(JSON.parse(JSON.stringify(durable)));
	assert.ok(restored);
	const saved = reconcileFree20RoomBudget(paired, {
		binding,
		request: retry,
		previous: JSON.parse(JSON.stringify(initial.budget)),
		meter: restored,
		now: later,
	});
	assert.equal(
		readFree20RoomTime(saved.budget, saved.meter, later).remainingSeconds,
		600,
	);
	assert.deepEqual(roomUsageBuckets(saved.meter), []);
	// Repeated renewal with all usage acknowledged performs no usage write.
	f.calls.length = 0;
	const again = await settleFree20RoomBudget(
		{ ...request(), checkpointSequence: 4 },
		new Date(later),
		f.deps,
	);
	assert.equal(again.committedSeconds, 600);
	assert.equal(
		f.calls.some((value) => value.startsWith("commit:")),
		false,
	);
	const renewed = reconcileFree20RoomBudget(again, {
		binding,
		request: { ...request(), checkpointSequence: 4 },
		meter: saved.meter,
		previous: saved.budget,
		now: later,
	});
	assert.equal(
		readFree20RoomTime(renewed.budget, renewed.meter, later).remainingSeconds,
		600,
	);
});

test("Free20 settles old UTC buckets without subtracting them from the new day", async () => {
	const f = fixture();
	const midnight = Date.parse("2026-10-31T00:00:00Z");
	f.setClock(midnight + 180_000);
	const result = await settleFree20RoomBudget(
		{
			...request(),
			usage: [
				{ day, seconds: 120 },
				{ day: "2026-10-31", seconds: 180 },
			],
		},
		new Date("2030-01-01Z"),
		f.deps,
	);
	assert.equal(result.utcDay, "2026-10-31");
	assert.equal(result.committedSeconds, 180);
	assert.equal(result.resetAt, Date.parse("2026-11-01T00:00:00Z"));
	assert.equal(f.committed.get(day), 540);
	assert.deepEqual(result.acknowledged, [
		{ day, seconds: 120 },
		{ day: "2026-10-31", seconds: 180 },
	]);
});

test("Free20 partial multi-day commit failure returns no budget and safely retries", async () => {
	const f = fixture();
	const submit = {
		...request(),
		usage: [
			{ day: "2026-10-29", seconds: 120 },
			{ day, seconds: 180 },
		],
	};
	const commit = f.deps.commitUsage;
	let fail = true;
	f.deps.commitUsage = async (roomId, usage) => {
		if (usage.day === day && fail) throw new Error("second bucket unavailable");
		return commit(roomId, usage);
	};
	await assert.rejects(
		settleFree20RoomBudget(submit, new Date(at), f.deps),
		/second bucket/,
	);
	assert.equal(f.calls.includes("authority"), false);
	fail = false;
	const result = await settleFree20RoomBudget(submit, new Date(at), f.deps);
	assert.equal(result.committedSeconds, 600);
	assert.equal(f.committed.get("2026-10-29"), 120);
});

test("Free20 rejects unsupported generation and ambiguous requests before any DB call", async () => {
	for (const change of [
		{ roomGeneration: 2 },
		{ checkpointSequence: -1 },
		{ usage: [request(180).usage[0], request(180).usage[0]] },
	]) {
		const f = fixture();
		await assert.rejects(
			settleFree20RoomBudget(
				{ ...request(), ...change } as Free20RoomBudgetRequest,
				new Date(at),
				f.deps,
			),
		);
		assert.deepEqual(f.calls, []);
	}
});

test("Free20 requires the immutable active Free room owner before committing", async () => {
	for (const room of [
		null,
		{
			room_id: "wrong",
			host_user_id: owner,
			host_plan_code: "free",
			status: "live",
		},
		{
			room_id: "free20-room",
			host_user_id: owner,
			host_plan_code: "free",
			status: "ended",
		},
		{
			room_id: "free20-room",
			host_user_id: owner,
			host_plan_code: "plus",
			status: "live",
		},
	]) {
		const f = fixture();
		await assert.rejects(
			settleFree20RoomBudget(request(180), new Date(at), {
				...f.deps,
				readRoom: async () =>
					room as Awaited<ReturnType<typeof f.deps.readRoom>>,
			}),
		);
		assert.equal(f.committed.get(day), 420);
	}
});

test("Free20 does not return a daily budget after room termination, owner change or paid transition", async () => {
	for (const transition of ["ended", "owner", "paid"] as const) {
		const f = fixture();
		const read = f.deps.readUsage;
		f.deps.readUsage = async (...args) => {
			const result = await read(...args);
			if (transition === "ended") f.setEnded();
			if (transition === "owner")
				f.room.host_user_id = "22222222-2222-4222-8222-222222222222";
			return result;
		};
		if (transition === "paid") f.setPaid();
		await assert.rejects(
			settleFree20RoomBudget(request(180), new Date(at), f.deps),
		);
		assert.equal(f.committed.get(day), 600);
	}
});

test("Free20 rejects missing or invalid commit ACK before reading an account balance", async () => {
	for (const ack of [
		{ day: "2026-10-29", seconds: 180 },
		{ day, seconds: 179 },
		{ day, seconds: 86_401 },
	]) {
		const f = fixture();
		await assert.rejects(
			settleFree20RoomBudget(request(180), new Date(at), {
				...f.deps,
				commitUsage: async () => ack,
			}),
		);
		assert.equal(f.calls.includes("authority"), false);
	}
});

test("Free20 authority and ledger failures never become a full balance", async () => {
	for (const failure of ["authority", "ledger"] as const) {
		const f = fixture();
		if (failure === "authority")
			f.deps.resolveAuthority = async () => {
				throw new Error("authority unavailable");
			};
		else
			f.deps.readUsage = async () => {
				throw new Error("ledger unavailable");
			};
		await assert.rejects(
			settleFree20RoomBudget(request(180), new Date(at), f.deps),
			/unavailable/i,
		);
		assert.equal(f.committed.get(day), 600);
	}
});
