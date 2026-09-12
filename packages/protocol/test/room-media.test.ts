import { expect, it } from "vitest";
import {
	MediaIntentSchema,
	MediaIntentAckSchema,
	MediaIntentErrorSchema,
	RoomMediaSnapshotSchema,
	RoomMediaCapabilitiesSchema,
	RoomMediaCapabilityLeaseSchema,
	HostMediaRevokeSchema,
	isRoomMediaPairAllowed,
} from "../src/room-media";
const state = {
	cameraGranted: false,
	microphoneGranted: false,
	cameraIntentSequence: 0,
	microphoneIntentSequence: 0,
};
const scope = {
	roomId: "room-1",
	roomGeneration: 1,
	participantSessionId: "session-1",
};
const capabilities = {
	mediaProtocolVersion: 2,
	hostPlanCode: "pro",
	maxParticipants: 15,
	maxCameras: 4,
	maxMicrophones: 8,
	capabilityRevision: 1,
	capabilitiesValidUntil: "2026-09-08T12:30:00Z",
};
const intent = {
	type: "SET_MEDIA_INTENT",
	...scope,
	media: "microphone",
	enabled: true,
	requestId: "request-1",
	intentSequence: 1,
};
it("requires generation/session/sequence and strict independent intent grants", () => {
	expect(MediaIntentSchema.safeParse(intent).success).toBe(true);
	for (const patch of [
		{ roomGeneration: 0 },
		{ intentSequence: 0 },
		{ participantSessionId: "" },
		{ media: "both" },
		{ cameraGranted: true },
	])
		expect(MediaIntentSchema.safeParse({ ...intent, ...patch }).success).toBe(
			false,
		);
	expect(
		HostMediaRevokeSchema.safeParse({
			type: "REVOKE_MEDIA_GRANT",
			roomId: "room-1",
			roomGeneration: 1,
			requestId: "r1",
			targetParticipantSessionId: "session-1",
			media: "camera",
		}).success,
	).toBe(true);
	const ack = {
		type: "MEDIA_INTENT_ACK",
		...scope,
		media: "microphone",
		requestId: "request-1",
		intentSequence: 1,
		snapshotSequence: 1,
		state: { ...state, microphoneGranted: true, microphoneIntentSequence: 1 },
	};
	expect(MediaIntentAckSchema.safeParse(ack).success).toBe(true);
	expect(MediaIntentAckSchema.safeParse({ ...ack, state }).success).toBe(false);
	expect(
		MediaIntentErrorSchema.safeParse({
			type: "MEDIA_INTENT_ERROR",
			...scope,
			media: "camera",
			requestId: "r1",
			intentSequence: 2,
			snapshotSequence: 1,
			code: "MEDIA_LIMIT_REACHED",
			state,
		}).success,
	).toBe(true);
});
it("bounds capability leases and disallows invented cap matrices", () => {
	expect(RoomMediaCapabilitiesSchema.safeParse(capabilities).success).toBe(
		true,
	);
	for (const patch of [
		{ mediaProtocolVersion: 3 },
		{ maxCameras: 5 },
		{ maxMicrophones: 6 },
		{ capabilityRevision: 0 },
	])
		expect(
			RoomMediaCapabilitiesSchema.safeParse({ ...capabilities, ...patch })
				.success,
		).toBe(false);
	const lease = {
		roomId: "room-1",
		roomGeneration: 1,
		issuedAt: "2026-09-08T12:00:00Z",
		paidUntil: null,
		capabilities,
	};
	expect(RoomMediaCapabilityLeaseSchema.safeParse(lease).success).toBe(true);
	expect(
		RoomMediaCapabilityLeaseSchema.safeParse({
			...lease,
			paidUntil: "2026-09-08T12:29:59Z",
		}).success,
	).toBe(false);
	expect(
		RoomMediaCapabilityLeaseSchema.safeParse({
			...lease,
			issuedAt: "2026-09-08T11:59:59Z",
		}).success,
	).toBe(false);
});
it("rejects duplicate sessions, excess grants and stale generation pairing", () => {
	const p = { ...scope, ...state };
	const snapshot = {
		type: "ROOM_MEDIA_SNAPSHOT",
		roomId: "room-1",
		roomGeneration: 1,
		snapshotSequence: 0,
		capabilities,
		participants: [{ participantSessionId: "s1", ...state }],
		closingAt: null,
	};
	expect(RoomMediaSnapshotSchema.safeParse(snapshot).success).toBe(true);
	expect(
		RoomMediaSnapshotSchema.safeParse({
			...snapshot,
			participants: [...snapshot.participants, ...snapshot.participants],
		}).success,
	).toBe(false);
	expect(
		RoomMediaSnapshotSchema.safeParse({
			...snapshot,
			participants: Array.from({ length: 5 }, (_, i) => ({
				participantSessionId: `s${i}`,
				...state,
				cameraGranted: true,
			})),
		}).success,
	).toBe(false);
	expect(isRoomMediaPairAllowed(p, { ...p, participantSessionId: "s2" })).toBe(
		false,
	);
	expect(
		isRoomMediaPairAllowed(
			{ ...p, cameraGranted: true },
			{ ...p, participantSessionId: "s2" },
		),
	).toBe(true);
	expect(
		isRoomMediaPairAllowed(
			{ ...p, cameraGranted: true },
			{ ...p, roomGeneration: 2, participantSessionId: "s2" },
		),
	).toBe(false);
	expect(isRoomMediaPairAllowed({ ...p, cameraGranted: true }, p)).toBe(false);
});
