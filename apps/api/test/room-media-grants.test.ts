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

// A camera publication report is separate from the permission to capture.
it.each([2, 3] as const)("preserves a reported camera across v%s wake and subsequent microphone intent", (version) => {
  let r = room();
  if (version === 3) {
    const snapshot = r.toSnapshot();
    const {maxMicrophones, ...caps} = snapshot.media!.capabilities as Extract<import("@anidachi/protocol").RoomMediaCapabilities, {mediaProtocolVersion: 2}>;
    snapshot.media!.capabilities = {...caps, mediaProtocolVersion: 3, maxMediaSeats: 8};
    snapshot.media!.participants = snapshot.media!.participants.map((p, i) => ({...p, mediaSeatGranted: i < 8, seatRevision: 0}));
    r = new RoomState("room", undefined, snapshot);
  }
  r.applyMediaIntent("u0", intent(0, "camera"));
  r.setCamera("u0", true);
  const sequence = r.toSnapshot().serverSeq;
  r = new RoomState("room", undefined, r.toSnapshot());
  expect(r.participants.find(p => p.id === "u0")?.cameraEnabled).toBe(true);
  expect(r.toSnapshot().serverSeq).toBe(sequence);
  r.applyMediaIntent("u0", intent(0, "microphone"));
  r.applyMediaIntent("u0", intent(0, "microphone", false, 2));
  expect(r.participants.find(p => p.id === "u0")?.cameraEnabled).toBe(true);
  r.setCamera("u0", false);
  r = new RoomState("room", undefined, r.toSnapshot());
  expect(r.participants.find(p => p.id === "u0")?.cameraEnabled).toBe(false);
});

it.each(["no-report", "no-grant", "disconnected", "stale-session"])("does not invent a camera publication on wake: %s", (condition) => {
  const r = room();
  r.applyMediaIntent("u0", intent(0, "camera"));
  if (condition !== "no-report") r.setCamera("u0", true);
  const snapshot = r.toSnapshot();
  if (condition === "no-grant") snapshot.media!.participants[0]!.cameraGranted = false;
  if (condition === "disconnected") snapshot.participants[0]!.connected = false;
  if (condition === "stale-session") snapshot.media!.participants[0]!.participantSessionId = "old-session";
  const restored = new RoomState("room", undefined, snapshot);
  expect(restored.participants.find(p => p.id === "u0")?.cameraEnabled).toBe(false);
});
