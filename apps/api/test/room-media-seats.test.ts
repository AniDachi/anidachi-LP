import { it, expect } from "vitest";
import { RoomState } from "../src/room-state";
import {
	getPlanPolicy,
	type SetMediaSeat,
	type MediaIntent,
} from "@anidachi/protocol";
function room() {
	const r = new RoomState("room");
	const p = getPlanPolicy("pro");
	r.setMediaCapabilities({
		mediaProtocolVersion: 3,
		hostPlanCode: "pro",
		maxParticipants: 15,
		maxCameras: 4,
		maxMediaSeats: 8,
		capabilityRevision: 1,
		capabilitiesValidUntil: new Date(Date.now() + 1800000).toISOString(),
	});
	for (let i = 0; i < 15; i++)
		r.join({
			id: `u${i}`,
			participantSessionId: `s${i}`,
			displayName: `u${i}`,
			role: i === 0 ? "host" : "viewer",
			mediaSeat: "none",
			cameraEnabled: false,
			syncStatus: "unknown",
			lastSeenAt: 0,
		});
	return r;
}
function intent(
	i: number,
	media: "camera" | "microphone",
	enabled = true,
	seq = 1,
): MediaIntent {
	return {
		type: "SET_MEDIA_INTENT",
		roomId: "room",
		roomGeneration: 1,
		participantSessionId: `s${i}`,
		requestId: `r${i}-${media}-${seq}`,
		intentSequence: seq,
		revocationEpoch: 0,
		enabled,
		media,
	};
}
it("allocates eight seats in join order and retains a muted seat", () => {
	const r = room();
	expect(
		r.mediaSnapshot?.participants.filter(
			(p) => "mediaSeatGranted" in p && p.mediaSeatGranted,
		),
	).toHaveLength(8);
	expect(r.applyMediaIntent("u0", intent(0, "microphone"))).toMatchObject({
		type: "MEDIA_INTENT_ACK",
	});
	r.applyMediaIntent("u0", intent(0, "microphone", false, 2));
	expect(r.mediaFor("u0")).toMatchObject({
		mediaSeatGranted: true,
		microphoneGranted: false,
	});
	expect(r.applyMediaIntent("u8", intent(8, "microphone"))).toMatchObject({
		code: "MEDIA_SEAT_REQUIRED",
	});
	r.leave("u0");
	expect(r.mediaFor("u8")).toMatchObject({ mediaSeatGranted: false });
});

function command(
	i: number,
	enabled: boolean,
	revision = 0,
	requestId = `seat-${i}-${revision}`,
): SetMediaSeat {
	return {
		type: "SET_MEDIA_SEAT",
		roomId: "room",
		roomGeneration: 1,
		targetUserId: `u${i}`,
		targetParticipantSessionId: `s${i}`,
		expectedSeatRevision: revision,
		enabled,
		requestId,
	};
}
it("requires host/current session/revision and serializes the last free seat", () => {
	const r = room();
	expect(r.applyMediaSeatCommand("u1", command(0, false))).toMatchObject({
		code: "MEDIA_FORBIDDEN",
	});
	expect(
		r.applyMediaSeatCommand("u0", {
			...command(1, false),
			targetParticipantSessionId: "old",
		}),
	).toMatchObject({ code: "MEDIA_STALE_SESSION" });
	expect(
		r.applyMediaSeatCommand("u0", { ...command(1, false), roomGeneration: 2 }),
	).toMatchObject({ code: "MEDIA_STALE_GENERATION" });
	expect(r.applyMediaSeatCommand("u0", command(8, true))).toMatchObject({
		code: "MEDIA_LIMIT_REACHED",
	});
	expect(r.applyMediaSeatCommand("u0", command(0, false))).toEqual({
		accepted: true,
	});
	expect(r.applyMediaSeatCommand("u0", command(8, true))).toEqual({
		accepted: true,
	});
	expect(r.applyMediaSeatCommand("u0", command(9, true))).toMatchObject({
		code: "MEDIA_LIMIT_REACHED",
	});
	expect(r.applyMediaSeatCommand("u0", command(8, true))).toEqual({
		accepted: true,
	});
	expect(r.mediaFor("u8")).toMatchObject({
		seatRevision: 1,
		cameraGranted: false,
		microphoneGranted: false,
	});
	expect(
		r.applyMediaSeatCommand("u0", command(8, false, 0, "stale")),
	).toMatchObject({ code: "MEDIA_STALE_SEAT_REVISION" });
});
it("persists host denial through leave/new session and fences capture until a fresh user intent", () => {
	let r = room();
	r.applyMediaIntent("u1", intent(1, "microphone"));
	r.applyMediaIntent("u1", intent(1, "camera"));
	r.applyMediaSeatCommand("u0", command(1, false));
	expect(r.mediaFor("u1")).toMatchObject({
		mediaSeatGranted: false,
		cameraGranted: false,
		microphoneGranted: false,
		cameraRevocationEpoch: 1,
		microphoneRevocationEpoch: 1,
	});
	expect(r.applyMediaIntent("u1", intent(1, "camera", true, 99))).toMatchObject(
		{ code: "MEDIA_STALE_INTENT" },
	);
	const participant = r.leave("u1")!;
	r = new RoomState("room", undefined, r.toSnapshot());
	r.join({ ...participant, participantSessionId: "new" });
	expect(r.mediaFor("u1")).toMatchObject({ mediaSeatGranted: false });
	expect(
		r.applyMediaSeatCommand("u0", {
			...command(1, true),
			targetParticipantSessionId: "new",
 requestId: "grant-new-session",
		}),
	).toEqual({ accepted: true });
	expect(r.mediaFor("u1")).toMatchObject({
		mediaSeatGranted: true,
		cameraGranted: false,
		microphoneGranted: false,
	});
	expect(r.toSnapshot().mediaSeatDenials).toEqual([]);
	expect(JSON.stringify(r.mediaSnapshot)).not.toContain("mediaSeatDenials");
});
it("holds seats through disconnect and resets capture on replacement, without promoting listeners", () => {
	const r = room();
	r.applyMediaIntent("u1", intent(1, "microphone"));
	const member = r.disconnect("u1")!;
	expect(r.mediaFor("u1")).toMatchObject({
		mediaSeatGranted: true,
		microphoneGranted: true,
	});
	r.join({ ...member, participantSessionId: "replacement" });
	expect(r.mediaFor("u1")).toMatchObject({
		mediaSeatGranted: true,
		microphoneGranted: false,
	});
	r.leave("u1");
	expect(r.mediaFor("u8")).toMatchObject({ mediaSeatGranted: false });
	r.join({ ...member, participantSessionId: "returned" });
	expect(r.mediaFor("u1")).toMatchObject({ mediaSeatGranted: true });
});
it("reserves four cameras atomically, permits off at capacity, and camera failure preserves seat/audio", () => {
	const r = room();
	for (let i = 0; i < 3; i++) r.applyMediaIntent(`u${i}`, intent(i, "camera"));
	expect(r.applyMediaIntent("u3", intent(3, "camera"))).toMatchObject({
		type: "MEDIA_INTENT_ACK",
	});
	expect(r.applyMediaIntent("u4", intent(4, "camera"))).toMatchObject({
		code: "MEDIA_LIMIT_REACHED",
	});
	r.applyMediaIntent("u3", intent(3, "microphone"));
	expect(r.applyMediaIntent("u3", intent(3, "camera", false, 2))).toMatchObject(
		{ type: "MEDIA_INTENT_ACK" },
	);
	expect(r.mediaFor("u3")).toMatchObject({
		mediaSeatGranted: true,
		microphoneGranted: true,
		cameraGranted: false,
	});
	expect(r.applyMediaIntent("u4", intent(4, "camera", true, 2))).toMatchObject({
		type: "MEDIA_INTENT_ACK",
	});
	expect(r.canSignal("u0", "u14")).toBe(true);
	expect(
		r.revokeMediaGrant("u0", {
			type: "REVOKE_MEDIA_GRANT",
			roomId: "room",
			roomGeneration: 1,
			targetParticipantSessionId: "s0",
			media: "camera",
			requestId: "legacy",
		}),
	).toBe(false);
});
it("rejects reusing a host request id for a different command", () => {
	const r = room();
	r.applyMediaSeatCommand("u0", command(1, false, 0, "same"));
	expect(
		r.applyMediaSeatCommand("u0", command(1, true, 1, "same")),
	).toMatchObject({ code: "MEDIA_FORBIDDEN" });
});
