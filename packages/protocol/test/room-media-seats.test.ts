import { expect, it } from "vitest";
import { ClientEventSchema, ServerEventSchema } from "../src/types";
import {
	RoomMediaV3CapabilitiesSchema,
	ParticipantMediaV3StateSchema,
	SetMediaSeatSchema,
	MediaSeatResultSchema,
	RoomMediaV3SnapshotSchema,
	RoomMediaV3CapabilityLeaseSchema,
	RoomMediaV2CapabilitiesSchema,
	ParticipantMediaV2StateSchema,
	RoomMediaV2SnapshotSchema,
	shouldApplyRoomMediaSnapshot,
} from "../src/room-media";
const caps = {
	mediaProtocolVersion: 3,
	hostPlanCode: "pro",
	maxParticipants: 15,
	maxMediaSeats: 8,
	maxCameras: 4,
	capabilityRevision: 1,
	capabilitiesValidUntil: "2026-09-15T12:30:00Z",
};
const state = {
	mediaSeatGranted: true,
	seatRevision: 0,
	cameraGranted: false,
	microphoneGranted: false,
	cameraIntentSequence: 1,
	microphoneIntentSequence: 1,
	cameraRevocationEpoch: 0,
	microphoneRevocationEpoch: 0,
};
const snapshot = {
	type: "ROOM_MEDIA_SNAPSHOT",
	roomId: "room",
	roomGeneration: 1,
	snapshotSequence: 3,
	capabilities: caps,
	participants: [{ ...state, participantSessionId: "session" }],
	closingAt: null,
};
const command = {
	type: "SET_MEDIA_SEAT",
	roomId: "room",
	roomGeneration: 1,
	targetUserId: "user",
	targetParticipantSessionId: "session",
	expectedSeatRevision: 0,
	enabled: false,
	requestId: "request",
};
it.each([
	["free", 4, 4],
	["plus", 6, 6],
	["pro", 15, 8],
])("validates frozen %s seat limits", (hostPlanCode, maxParticipants, maxMediaSeats) => {
	const value = { ...caps, hostPlanCode, maxParticipants, maxMediaSeats };
	expect(RoomMediaV3CapabilitiesSchema.safeParse(value).success).toBe(true);
	for (const patch of [
		{ maxMediaSeats: Number(maxMediaSeats) + 1 },
		{ maxMediaSeats: maxMediaSeats === 4 ? 6 : 4 },
		{ maxParticipants: 14 },
		{ maxParticipants: maxParticipants === 4 ? 6 : 4 },
		{ maxCameras: 5 },
		{ maxMicrophones: 8 },
		{ capabilityRevision: 0 },
	])
		expect(
			RoomMediaV3CapabilitiesSchema.safeParse({ ...value, ...patch }).success,
		).toBe(false);
});
it("bounds host seat commands and parses the outer client union", () => {
	expect(ClientEventSchema.parse(command)).toEqual(command);
	for (const patch of [
		{ targetUserId: "" },
		{ targetUserId: "x".repeat(129) },
		{ targetParticipantSessionId: "" },
		{ roomId: "" },
		{ requestId: "" },
		{ roomGeneration: 0 },
		{ expectedSeatRevision: -1 },
		{ expectedSeatRevision: 0.5 },
		{ enabled: "yes" },
		{ extra: true },
	])
		expect(SetMediaSeatSchema.safeParse({ ...command, ...patch }).success).toBe(
			false,
		);
});
it("requires a seat for either publication and preserves strict v2 boundaries", () => {
	expect(ParticipantMediaV3StateSchema.safeParse(state).success).toBe(true);
	for (const field of ["cameraGranted", "microphoneGranted"])
		expect(
			ParticipantMediaV3StateSchema.safeParse({
				...state,
				mediaSeatGranted: false,
				[field]: true,
			}).success,
		).toBe(false);
	expect(
		ParticipantMediaV3StateSchema.safeParse({ ...state, seatRevision: -1 })
			.success,
	).toBe(false);
	expect(ParticipantMediaV2StateSchema.safeParse(state).success).toBe(false);
	expect(RoomMediaV2CapabilitiesSchema.safeParse(caps).success).toBe(false);
	expect(RoomMediaV2SnapshotSchema.safeParse(snapshot).success).toBe(false);
});
it("enforces seats, cameras, participants, unique sessions and version consistency in snapshots", () => {
	expect(RoomMediaV3SnapshotSchema.parse(snapshot)).toEqual(snapshot);
	expect(ServerEventSchema.parse(snapshot)).toEqual(snapshot);
	const participants = (
		n: number,
		cameraGranted = false,
		mediaSeatGranted = true,
	) =>
		Array.from({ length: n }, (_, i) => ({
			...state,
			participantSessionId: `s${i}`,
			microphoneGranted: mediaSeatGranted,
			cameraGranted,
			mediaSeatGranted,
		}));
	expect(
		RoomMediaV3SnapshotSchema.safeParse({
			...snapshot,
			participants: participants(8),
		}).success,
	).toBe(true);
	for (const ps of [
		participants(9),
		participants(5, true),
		participants(16, false, false),
		[snapshot.participants[0], snapshot.participants[0]],
	])
		expect(
			ServerEventSchema.safeParse({ ...snapshot, participants: ps }).success,
		).toBe(false);
	const { mediaSeatGranted, seatRevision, ...v2State } =
		snapshot.participants[0]!;
	expect(
		ServerEventSchema.safeParse({ ...snapshot, participants: [v2State] })
			.success,
	).toBe(false);
});
it("enforces the existing lease authority bounds for v3", () => {
	const lease = {
		roomId: "room",
		roomGeneration: 1,
		issuedAt: "2026-09-15T12:00:00Z",
		paidUntil: null,
		capabilities: caps,
	};
	expect(RoomMediaV3CapabilityLeaseSchema.safeParse(lease).success).toBe(true);
	for (const patch of [
		{ issuedAt: "2026-09-15T11:59:59Z" },
		{ issuedAt: caps.capabilitiesValidUntil },
		{ paidUntil: "2026-09-15T12:29:59Z" },
	])
		expect(
			RoomMediaV3CapabilityLeaseSchema.safeParse({ ...lease, ...patch })
				.success,
		).toBe(false);
});
it("parses both versions of nested ACK/error through the outer server union", () => {
	const reply = {
		roomId: "room",
		roomGeneration: 1,
		participantSessionId: "session",
		media: "camera",
		requestId: "r",
		intentSequence: 1,
		snapshotSequence: 3,
	};
	const { mediaSeatGranted, seatRevision, ...v2State } = state;
	for (const s of [state, v2State]) {
		expect(
			ServerEventSchema.safeParse({
				...reply,
				type: "MEDIA_INTENT_ACK",
				state: s,
			}).success,
		).toBe(true);
		expect(
			ServerEventSchema.safeParse({
				...reply,
				type: "MEDIA_INTENT_ERROR",
				state: s,
				code: "MEDIA_LIMIT_REACHED",
			}).success,
		).toBe(true);
		expect(
			ServerEventSchema.safeParse({
				...reply,
				type: "MEDIA_INTENT_ACK",
				state: { ...s, cameraIntentSequence: 0 },
			}).success,
		).toBe(false);
	}
	expect(
		ServerEventSchema.safeParse({
			...reply,
			type: "MEDIA_INTENT_ERROR",
			state: { ...state, mediaSeatGranted: false },
			code: "MEDIA_SEAT_REQUIRED",
		}).success,
	).toBe(true);
	expect(
		ServerEventSchema.safeParse({
			...reply,
			type: "MEDIA_INTENT_ERROR",
			state: v2State,
			code: "MEDIA_SEAT_REQUIRED",
		}).success,
	).toBe(false);
});
it("correlates stale revision denials and fences late result snapshots", () => {
	const result = {
		type: "MEDIA_SEAT_RESULT",
		requestId: command.requestId,
		targetParticipantSessionId: "session",
		code: "MEDIA_STALE_SEAT_REVISION",
		snapshot,
	};
	expect(MediaSeatResultSchema.parse(result)).toEqual(result);
	expect(ServerEventSchema.parse(result)).toEqual(result);
	expect(
		MediaSeatResultSchema.safeParse({ ...result, requestId: "" }).success,
	).toBe(false);
	expect(
		MediaSeatResultSchema.safeParse({ ...result, code: "UNKNOWN" }).success,
	).toBe(false);
	expect(
		shouldApplyRoomMediaSnapshot(
			snapshot,
			{ ...snapshot, snapshotSequence: 4 },
			snapshot,
		),
	).toBe(false);
	expect(shouldApplyRoomMediaSnapshot(snapshot, snapshot, snapshot)).toBe(
		false,
	);
	expect(
		shouldApplyRoomMediaSnapshot(snapshot, snapshot, {
			...snapshot,
			snapshotSequence: 4,
		}),
	).toBe(true);
	expect(
		shouldApplyRoomMediaSnapshot(
			{ ...snapshot, roomGeneration: 2 },
			{ ...snapshot, roomGeneration: 2 },
			snapshot,
		),
	).toBe(false);
	expect(
		shouldApplyRoomMediaSnapshot(snapshot, snapshot, {
			...snapshot,
			roomGeneration: 2,
			snapshotSequence: 0,
		}),
	).toBe(false);
	expect(
		shouldApplyRoomMediaSnapshot(snapshot, snapshot, {
			...snapshot,
			roomId: "other",
		}),
	).toBe(false);
	expect(shouldApplyRoomMediaSnapshot(snapshot, null, snapshot)).toBe(true);
	expect(
		shouldApplyRoomMediaSnapshot({ ...snapshot, roomGeneration: 2 }, snapshot, {
			...snapshot,
			roomGeneration: 2,
			snapshotSequence: 0,
		}),
	).toBe(true);
	for (const code of [
		"OK",
		"MEDIA_FORBIDDEN",
		"MEDIA_LIMIT_REACHED",
		"MEDIA_STALE_SESSION",
		"MEDIA_STALE_GENERATION",
		"MEDIA_STALE_SEAT_REVISION",
		"MEDIA_CAPABILITY_EXPIRED",
	])
		expect(MediaSeatResultSchema.safeParse({ ...result, code }).success).toBe(
			true,
		);
});

it("keeps v2 snapshot wire parsing and rejects mixed version fields", () => {
	const { maxMediaSeats, ...commonCaps } = caps;
	const v2Caps = {
		...commonCaps,
		mediaProtocolVersion: 2,
		maxMicrophones: maxMediaSeats,
	};
	const { mediaSeatGranted, seatRevision, ...v2Participant } =
		snapshot.participants[0]!;
	const v2Snapshot = {
		...snapshot,
		capabilities: v2Caps,
		participants: [v2Participant],
	};
	expect(ServerEventSchema.parse(v2Snapshot)).toEqual(v2Snapshot);
	expect(
		ServerEventSchema.safeParse({
			...v2Snapshot,
			participants: snapshot.participants,
		}).success,
	).toBe(false);
	expect(
		ServerEventSchema.safeParse({
			...snapshot,
			capabilities: { ...caps, maxMicrophones: 8 },
		}).success,
	).toBe(false);
	expect(
		MediaSeatResultSchema.safeParse({
			type: "MEDIA_SEAT_RESULT",
			requestId: "r",
			targetParticipantSessionId: "s",
			code: "OK",
			snapshot: v2Snapshot,
		}).success,
	).toBe(false);
});
