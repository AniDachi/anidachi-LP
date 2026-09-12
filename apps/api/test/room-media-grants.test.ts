import { it, expect } from "vitest";
import { RoomState } from "../src/room-state";
import { getPlanPolicy, type MediaIntent } from "@anidachi/protocol";
function room() {
	const r = new RoomState("room");
	const p = getPlanPolicy("pro");
	r.setMediaCapabilities({
		mediaProtocolVersion: 2,
		hostPlanCode: "pro",
		maxParticipants: 15,
		maxCameras: 4,
		maxMicrophones: 8,
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
it("counts host and independently grants four cameras and eight microphones without automatic capture", () => {
	const r = room();
	expect(
		r.mediaSnapshot?.participants.every(
			(p) => !p.cameraGranted && !p.microphoneGranted,
		),
	).toBe(true);
	for (let i = 0; i < 4; i++)
		expect(r.applyMediaIntent(`u${i}`, intent(i, "camera")).type).toBe(
			"MEDIA_INTENT_ACK",
		);
	expect(r.applyMediaIntent("u4", intent(4, "camera"))).toMatchObject({
		code: "MEDIA_LIMIT_REACHED",
	});
	for (let i = 0; i < 8; i++)
		expect(r.applyMediaIntent(`u${i}`, intent(i, "microphone")).type).toBe(
			"MEDIA_INTENT_ACK",
		);
	expect(r.applyMediaIntent("u8", intent(8, "microphone"))).toMatchObject({
		code: "MEDIA_LIMIT_REACHED",
	});
	expect(r.canSignal("u0", "u14")).toBe(true);
	expect(r.canSignal("u13", "u14")).toBe(false);
	expect(r.canAdmit("u15")).toBe(false);
});
it("fences replay, denied intent, sessions, and generation and survives hibernation", () => {
	let r = room();
	r.applyMediaIntent("u0", intent(0, "camera"));
	r.applyMediaIntent("u0", intent(0, "camera", false, 2));
	expect(r.applyMediaIntent("u0", intent(0, "camera"))).toMatchObject({
		code: "MEDIA_STALE_INTENT",
	});
	r = new RoomState("room", undefined, r.toSnapshot());
	expect(
		r.applyMediaIntent("u0", {
			...intent(0, "camera", true, 3),
			roomGeneration: 2,
		}),
	).toMatchObject({ code: "MEDIA_STALE_GENERATION" });
	r.join({ ...r.participants[0]!, participantSessionId: "replacement" });
	expect(r.applyMediaIntent("u0", intent(0, "camera", true, 3))).toMatchObject({
		code: "MEDIA_STALE_SESSION",
	});
	expect(
		r.mediaSnapshot?.participants.find(
			(p) => p.participantSessionId === "replacement",
		)?.cameraGranted,
	).toBe(false);
});

it("revoke fences arbitrary in-flight sequence, delayed disable and duplicate host retry", () => {
	let r = room();
	r.applyMediaIntent("u1", intent(1, "microphone"));
	const revoke = {
		type: "REVOKE_MEDIA_GRANT" as const,
		roomId: "room",
		roomGeneration: 1,
		targetParticipantSessionId: "s1",
		media: "microphone" as const,
		requestId: "revoke-1",
	};
	expect(r.revokeMediaGrant("u0", revoke)).toBe(true);
	expect(
		r.applyMediaIntent("u1", intent(1, "microphone", true, 50)),
	).toMatchObject({ code: "MEDIA_STALE_INTENT" });
	expect(
		r.applyMediaIntent("u1", {
			...intent(1, "microphone", true, 51),
			revocationEpoch: 1,
		}),
	).toMatchObject({ type: "MEDIA_INTENT_ACK" });
	r = new RoomState("room", undefined, r.toSnapshot());
	r.revokeMediaGrant("u0", revoke);
	expect(
		r.applyMediaIntent("u1", intent(1, "microphone", false, 52)),
	).toMatchObject({ code: "MEDIA_STALE_INTENT" });
	expect(r.mediaFor("u1")?.microphoneGranted).toBe(true);
});
