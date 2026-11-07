import assert from "node:assert/strict";
import test from "node:test";
import type { Free20RoomBudgetResponse } from "@anidachi/protocol";
import { readFree20DisplayTime } from "./free20-display-time";

const owner = "11111111-1111-4111-8111-111111111111";
const at = Date.parse("2026-11-01T12:00:00Z");
const iso = (time: number) => new Date(time).toISOString();
const checkpoint = {
	roomTimeVersion: 1 as const,
	kind: "confirmed_unlimited" as const,
	authority: "account_entitlements_v1" as const,
	planCode: "plus" as const,
	ownerUserId: owner,
	roomId: "room-1",
	roomGeneration: 1,
	checkpointSequence: 3,
	utcDay: "2026-11-01",
	serverTime: at,
	refreshBy: at + 300_000,
	resetAt: Date.parse("2026-11-02T00:00:00Z"),
	acknowledged: [{ day: "2026-11-01", seconds: 180 }],
};
function authority() {
	return {
		enabled: true,
		ownerUserId: owner,
		planCode: "plus",
		serverTime: iso(at + 1000),
		refreshBy: iso(at + 240_000),
		resetAt: iso(checkpoint.resetAt),
		accountGeneration: 1,
		accessEpoch: 1,
		committedSeconds: 600,
		grant: { source: "paid", validUntil: iso(at + 3_600_000) },
		assignment: {
			roomId: "room-1",
			roomGeneration: 1,
			role: "host",
			sessionId: "host-tab",
			hostingTimeMode: "daily_free20",
			status: "live",
			hostUserId: owner,
		},
	};
}
test("display provenance preserves paid, trial and manual source and its exact grant expiry", async () => {
	for (const source of ["paid", "trial", "manual"]) {
		const validUntil = source === "manual" ? null : at + 3_600_000;
		const result = await readFree20DisplayTime(checkpoint, async (userId) => {
			assert.equal(userId, owner);
			return {
				...authority(),
				grant: {
					source,
					validUntil: validUntil === null ? null : iso(validUntil),
				},
			};
		});
		assert.deepEqual(result, {
			access: { kind: "confirmed_unlimited", source, validUntil },
			validUntil: at + 240_000,
		});
	}
});
test("display metadata never extends checkpoint freshness, source freshness or grant expiry", async () => {
	for (const [checkpointWindow, sourceWindow, grantWindow] of [
		[60_000, 240_000, 3_600_000],
		[300_000, 60_000, 3_600_000],
		[300_000, 60_000, 60_000],
	]) {
		const result = await readFree20DisplayTime(
			{ ...checkpoint, refreshBy: at + checkpointWindow },
			async () => ({
				...authority(),
				refreshBy: iso(at + sourceWindow),
				grant: { source: "trial", validUntil: iso(at + grantWindow) },
			}),
		);
		assert.equal(
			result?.validUntil,
			at + Math.min(checkpointWindow, sourceWindow, grantWindow),
		);
	}
});
test("finite checkpoint returns no metadata and performs no authority read", async () => {
	const {
		roomTimeVersion: _version,
		kind: _kind,
		authority: _authority,
		planCode: _plan,
		...context
	} = checkpoint;
	let reads = 0;
	const result = await readFree20DisplayTime(
		{
			...context,
			roomBudgetVersion: 1,
			budgetSeconds: 1200,
			committedSeconds: 600,
		},
		async () => {
			reads++;
			return authority();
		},
	);
	assert.equal(result, undefined);
	assert.equal(reads, 0);
});
test("missing, invalid, stale and differently bound authorities omit metadata", async () => {
	const source = authority();
	for (const raw of [
		null,
		undefined,
		{},
		{ enabled: false },
		{ enabled: false, grant: source.grant },
		{ ...source, ownerUserId: "22222222-2222-4222-8222-222222222222" },
		{ ...source, planCode: "pro" },
		{ ...source, grant: null },
		{ ...source, grant: { source: "paid", validUntil: null } },
		{ ...source, grant: { source: "paid", validUntil: iso(at) } },
		{
			...source,
			grant: { source: "unknown", validUntil: iso(at + 3_600_000) },
		},
		{ ...source, serverTime: iso(at - 1) },
		{ ...source, serverTime: iso(at + 300_000), refreshBy: iso(at + 360_000) },
		{
			...source,
			serverTime: iso(at - 86_400_000),
			refreshBy: iso(at - 86_340_000),
			resetAt: iso(checkpoint.resetAt - 86_400_000),
		},
		{ ...source, refreshBy: iso(at + 1000) },
		{ ...source, assignment: null },
		...[
			{ roomId: "other-room" },
			{ roomGeneration: 2 },
			{ role: "member" },
			{ hostingTimeMode: null },
			{ status: "lobby" },
			{ status: "ended" },
			{ hostUserId: "22222222-2222-4222-8222-222222222222" },
		].map((assignment) => ({
			...source,
			assignment: { ...source.assignment, ...assignment },
		})),
	]) {
		assert.equal(
			await readFree20DisplayTime(checkpoint, async () => raw),
			undefined,
			JSON.stringify(raw),
		);
	}
	assert.equal(
		await readFree20DisplayTime(checkpoint, async () => {
			throw new Error("private failure");
		}),
		undefined,
	);
});
test("a grant that expires during the source read is omitted", async (t) => {
	let clockCalls = 0;
	t.mock.method(performance, "now", () => (clockCalls++ === 0 ? 0 : 100));
	assert.equal(
		await readFree20DisplayTime(checkpoint, async () => ({
			...authority(),
			refreshBy: iso(at + 1050),
			grant: { source: "paid", validUntil: iso(at + 1050) },
		})),
		undefined,
	);
});
test("invalid unlimited checkpoint cannot gain display provenance", async () => {
	let reads = 0;
	const invalid = {
		...checkpoint,
		refreshBy: at,
	} as Free20RoomBudgetResponse["checkpoint"];
	assert.equal(
		await readFree20DisplayTime(invalid, async () => {
			reads++;
			return authority();
		}),
		undefined,
	);
	assert.equal(reads, 0);
});
