import assert from "node:assert/strict";
import { test } from "node:test";
import { parseInternalRoomEndCommand } from "./room-lifecycle";
import {
	clientMediaProtocolVersion,
	supportsRoomMediaProtocol,
	negotiateRoomMediaLease,
} from "./room-media-negotiation";
import { signRoomToken, verifyRoomToken } from "./jwt";
import { RoomMediaCapabilityLeaseSchema } from "@anidachi/protocol";

test("nonterminal policy payload is rejected by preserved legacy terminal validator", async () => {
	const payload = {
		operation: "room_policy_v2",
		roomGeneration: 1,
		usage: [{ day: "2026-09-08", seconds: 120 }],
		settleOnly: false,
	};
	assert.equal(await parseInternalRoomEndCommand("room", payload), null);
	assert.equal(
		await parseInternalRoomEndCommand("room", { ...payload, settleOnly: true }),
		null,
	);
});

test("media negotiation treats v3 as supporting both pinned contracts", () => {
	assert.equal(clientMediaProtocolVersion("3"), 3);
	assert.equal(clientMediaProtocolVersion("2"), 2);
	assert.equal(clientMediaProtocolVersion(null), 1);
	for (const header of ["1", "4", "03", "2,3", "", "v3"])
		assert.equal(clientMediaProtocolVersion(header), null);
	for (const [client, room, supported] of [
		[3, 3, true],
		[3, 2, true],
		[2, 2, true],
		[2, 3, false],
		[1, 2, false],
		[1, 3, false],
		[4, 2, false],
		[3, 4, false],
	] as const)
		assert.equal(supportsRoomMediaProtocol(client, room), supported);
});

function mediaLease(version: 2 | 3) {
	return RoomMediaCapabilityLeaseSchema.parse({
		roomId: "room-protocol-test",
		roomGeneration: 1,
		issuedAt: "2026-09-14T00:00:00.000Z",
		paidUntil: "2026-09-14T02:00:00.000Z",
		capabilities: {
			mediaProtocolVersion: version,
			hostPlanCode: "pro",
			maxParticipants: 15,
			maxCameras: 4,
			...(version === 3 ? { maxMediaSeats: 8 } : { maxMicrophones: 8 }),
			capabilityRevision: 1,
			capabilitiesValidUntil: "2026-09-14T00:30:00.000Z",
		},
	});
}

test("negotiation preserves durable lease, and rejects v2 into v3 or malformed authority", () => {
	for (const version of [2, 3] as const) {
		const lease = mediaLease(version);
		assert.deepEqual(negotiateRoomMediaLease(lease, 3), lease);
		if (version === 2)
			assert.deepEqual(negotiateRoomMediaLease(lease, 2), lease);
		else
			assert.throws(
				() => negotiateRoomMediaLease(lease, 2),
				/ROOM_UPDATE_REQUIRED/,
			);
		assert.throws(
			() =>
				negotiateRoomMediaLease(
					{
						...lease,
						capabilities: { ...lease.capabilities, mediaProtocolVersion: 4 },
					},
					3,
				),
			/ROOM_UPDATE_REQUIRED/,
		);
	}
	assert.throws(
		() =>
			negotiateRoomMediaLease({ capabilities: { mediaProtocolVersion: 3 } }, 3),
		/ROOM_UPDATE_REQUIRED/,
	);
	assert.throws(() => negotiateRoomMediaLease(null, 4), /ROOM_UPDATE_REQUIRED/);
	assert.equal(negotiateRoomMediaLease(null, 3), undefined);
});

test("signed token readers roundtrip both pinned contracts without substituting caller capacity", async () => {
	const previous = process.env.ANIDACHI_JWT_SECRET;
	process.env.ANIDACHI_JWT_SECRET =
		"room-negotiation-synthetic-test-secret-only";
	try {
		for (const version of [2, 3] as const) {
			const lease = mediaLease(version);
			const token = await signRoomToken({
				sub: "test-host",
				roomId: lease.roomId,
				role: "host",
				participantSessionId: "test-session",
				hostUserId: "test-host",
				mediaLease: lease,
			});
			assert.deepEqual((await verifyRoomToken(token))?.mediaLease, lease);
		}
	} finally {
		if (previous === undefined) delete process.env.ANIDACHI_JWT_SECRET;
		else process.env.ANIDACHI_JWT_SECRET = previous;
	}
});
