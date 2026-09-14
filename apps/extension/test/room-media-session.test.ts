import { describe, it, expect } from "vitest";
import { RoomMediaSession } from "../src/room-media-session";
import type { RoomMediaV2Snapshot } from "@anidachi/protocol";
const snapshot = (seq = 1, epoch = 0): RoomMediaV2Snapshot => ({
	type: "ROOM_MEDIA_SNAPSHOT",
	roomId: "room",
	roomGeneration: 1,
	snapshotSequence: seq,
	capabilities: {
		mediaProtocolVersion: 2,
		hostPlanCode: "pro",
		maxParticipants: 15,
		maxCameras: 4,
		maxMicrophones: 8,
		capabilityRevision: 1,
		capabilitiesValidUntil: "2026-09-08T20:00:00Z",
	},
	participants: [
		{
			participantSessionId: "session",
			cameraGranted: false,
			microphoneGranted: false,
			cameraIntentSequence: 0,
			microphoneIntentSequence: 0,
			cameraRevocationEpoch: epoch,
			microphoneRevocationEpoch: 0,
		},
	],
	closingAt: null,
});
describe("independent media session", () => {
	it.each([[true, true], [false, true], [true, false], [false, false]])("keeps a settled enabled=%s intent after a duplicate (ACK received=%s)", (enabled, acknowledged) => {
		const s = new RoomMediaSession("room", "session");
		s.bindRoomGeneration(1);
		s.consume(snapshot());
		const intent = s.intent("microphone", enabled)!;
		const state = {...snapshot().participants[0], microphoneGranted: enabled, microphoneIntentSequence: intent.intentSequence};
		if (acknowledged) s.consume({...intent, type: "MEDIA_INTENT_ACK", snapshotSequence: 2, state});
		s.consume({...intent, type: "MEDIA_INTENT_ERROR", code: "MEDIA_STALE_INTENT", snapshotSequence: 2, state});
		expect(s.error).toBeNull();
		expect(s.wants("microphone")).toBe(enabled);
		expect(s.canCapture("microphone")).toBe(enabled);
	});

	it.each(["MEDIA_STALE_INTENT", "MEDIA_CAPABILITY_EXPIRED"] as const)("never grants capture from a rejected enable with code %s", (code) => {
		const s = new RoomMediaSession("room", "session");
		s.bindRoomGeneration(1);
		s.consume(snapshot());
		const intent = s.intent("camera", true)!;
		s.consume({...intent, type: "MEDIA_INTENT_ERROR", code, snapshotSequence: 2,
			state: {...snapshot().participants[0], cameraIntentSequence: intent.intentSequence}});
		expect(s.canCapture("camera")).toBe(false);
		expect(s.wants("camera")).toBe(false);
		expect(s.error).not.toBeNull();
	});

	it.each(["snapshot", "reset"] as const)("does not retain an earlier media error after %s", (next) => {
		const s = new RoomMediaSession("room", "session");
		s.bindRoomGeneration(1);
		s.consume(snapshot());
		const intent = s.intent("camera", true)!;
		s.consume({...intent, type: "MEDIA_INTENT_ERROR", code: "MEDIA_LIMIT_REACHED", snapshotSequence: 2,
			state: {...snapshot().participants[0], cameraIntentSequence: intent.intentSequence}});
		expect(s.error).toBe("All 4 cameras are in use");
		if (next === "reset") s.reset(); else s.consume(snapshot(3));
		expect(s.error).toBeNull();
	});

	it("does not interpret a rejected request as an elapsed media lease", () => {
		const s = new RoomMediaSession("room", "session");
		s.bindRoomGeneration(1);
		s.consume(snapshot());
		const intent = s.intent("microphone", true)!;
		s.consume({...intent, type: "MEDIA_INTENT_ERROR", code: "MEDIA_STALE_INTENT", snapshotSequence: 2,
			state: {...snapshot().participants[0], microphoneIntentSequence: intent.intentSequence + 1}});
		expect(s.canCapture("microphone")).toBe(false);
		expect(s.wants("microphone")).toBe(false);
		expect(s.error).toBe("Media state changed. Try again.");
	});

	it("never captures on join/restored grants, requires matching explicit current intent", () => {
		const s = new RoomMediaSession("room", "session");
    s.bindRoomGeneration(1);
		const first = snapshot();
		first.participants[0].cameraGranted = true;
		s.consume(first);
		expect(s.canCapture("camera")).toBe(false);
		const intent = s.intent("camera", true)!;
		s.consume({
			...intent,
			state: {
				...first.participants[0],
				cameraIntentSequence: intent.intentSequence,
			},
			snapshotSequence: 2,
			type: "MEDIA_INTENT_ACK",
		});
		expect(s.canCapture("camera")).toBe(true);
		expect(s.canCapture("microphone")).toBe(false);
		const newer = snapshot(3);
		newer.participants[0] = {
			...first.participants[0],
			cameraIntentSequence: intent.intentSequence + 1,
		};
		s.consume(newer);
		expect(s.canCapture("camera")).toBe(false);
	});
	it("revoke epoch stops capture and late high-sequence ACK cannot revive intent", () => {
		const s = new RoomMediaSession("room", "session");
    s.bindRoomGeneration(1);
		s.consume(snapshot());
		const i = s.intent("camera", true)!;
		const revoked = snapshot(3, 1);
		s.consume(revoked);
		s.consume({
			...i,
			type: "MEDIA_INTENT_ACK",
			state: {
				...snapshot().participants[0],
				cameraGranted: true,
				cameraIntentSequence: i.intentSequence,
			},
			snapshotSequence: 2,
		});
		expect(s.canCapture("camera")).toBe(false);
		expect(s.intent("camera", true)?.revocationEpoch).toBe(1);
	});
	it("disable while an enable is in flight wins, and replacement/generation cannot reuse intent", () => {
		const s = new RoomMediaSession("room", "session");
    s.bindRoomGeneration(1);
		s.consume(snapshot());
		const i = s.intent("microphone", true)!;
		s.intent("microphone", false);
		s.consume({
			...i,
			type: "MEDIA_INTENT_ACK",
			state: {
				...snapshot().participants[0],
				microphoneGranted: true,
				microphoneIntentSequence: i.intentSequence,
			},
			snapshotSequence: 2,
		});
		expect(s.canCapture("microphone")).toBe(false);
		const next = snapshot(4);
		next.roomGeneration = 2;
    s.bindRoomGeneration(2);
		next.participants[0].microphoneGranted = true;
		s.consume(next);
		expect(s.canCapture("microphone")).toBe(false);
	});
	it("releases restored grants once without capture and fences a newer explicit enable", () => {
		const s = new RoomMediaSession("room", "session");
    s.bindRoomGeneration(1);
		const restored = snapshot(4, 2);
		restored.participants[0].cameraGranted = true;
		restored.participants[0].cameraIntentSequence = 7;
		s.consume(restored);
		const releases = s.releaseRestoredGrants();
		expect(releases).toHaveLength(1);
		expect(releases[0]).toMatchObject({
			enabled: false,
			intentSequence: 8,
			revocationEpoch: 2,
		});
		expect(s.canCapture("camera")).toBe(false);
		s.consume(restored);
		expect(s.releaseRestoredGrants()).toEqual([]);
		const explicit = s.intent("camera", true)!;
		s.consume(snapshot(3));
		expect(s.releaseRestoredGrants()).toEqual([]);
		expect(s.wants("camera")).toBe(true);
		const accepted = {
			...restored,
			snapshotSequence: 5,
			participants: [
				{
					...restored.participants[0],
					cameraIntentSequence: explicit.intentSequence,
				},
			],
		};
		s.consume(accepted);
		expect(s.canCapture("camera")).toBe(true);
		s.intent("camera", false);
		s.consume(accepted);
		expect(s.canCapture("camera")).toBe(false);
	});
	it("reconciles interrupted off once per transport without releasing new intent or epoch", () => {
		const s = new RoomMediaSession("room", "session");
    s.bindRoomGeneration(1);
		s.consume(snapshot());
		s.releaseRestoredGrants();
		const on = s.intent("camera", true)!;
		const granted = snapshot(2);
		granted.participants[0] = {
			...granted.participants[0],
			cameraGranted: true,
			cameraIntentSequence: on.intentSequence,
		};
		s.consume(granted);
		const off = s.intent("camera", false)!;
		s.beginTransport();
		s.consume(granted);
		expect(s.releaseRestoredGrants()).toEqual([off]);
		s.consume(granted);
		expect(s.releaseRestoredGrants()).toEqual([]);
		expect(s.canCapture("camera")).toBe(false);
		const enabled = s.intent("camera", true)!;
		s.beginTransport();
		s.consume(granted);
		expect(s.releaseRestoredGrants()).toEqual([]);
		const current = {
			...granted,
			snapshotSequence: 3,
			participants: [
				{
					...granted.participants[0],
					cameraIntentSequence: enabled.intentSequence,
				},
			],
		};
		s.consume(current);
		expect(s.canCapture("camera")).toBe(true);
		s.intent("camera", false);
		s.beginTransport();
		const revoked = {
			...current,
			snapshotSequence: 4,
			participants: [{ ...current.participants[0], cameraRevocationEpoch: 1 }],
		};
		s.consume(revoked);
		expect(s.releaseRestoredGrants()).toEqual([]);
	});
	it("does not retry a committed off with a lost ACK", () => {
		const s = new RoomMediaSession("room", "session");
    s.bindRoomGeneration(1);
		s.consume(snapshot());
		s.releaseRestoredGrants();
		const off = s.intent("camera", false)!;
		const state = snapshot(2);
		state.participants[0].cameraIntentSequence = off.intentSequence;
		s.beginTransport();
		s.consume(state);
		expect(s.releaseRestoredGrants()).toEqual([]);
		expect(s.canCapture("camera")).toBe(false);
	});

	it("releases only a terminal failure's exact current enabled owner", () => {
		const s = new RoomMediaSession("room", "session");
    s.bindRoomGeneration(1);
		s.consume(snapshot());
		const camera = s.intent("camera", true)!;
		const mic = s.intent("microphone", true)!;
		expect(s.disableFailedIntent(camera)).toMatchObject({
			media: "camera",
			enabled: false,
			intentSequence: 2,
		});
		expect(s.wants("microphone")).toBe(true);
		s.intent("camera", true);
		expect(s.disableFailedIntent(camera)).toBeNull();
		expect(
			s.disableFailedIntent({ ...mic, participantSessionId: "other" }),
		).toBeNull();
		s.consume(snapshot(4, 1));
		expect(s.disableFailedIntent(camera)).toBeNull();
	});
});
