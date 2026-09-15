import { describe, expect, it } from "vitest";
import type { RoomMediaV3Snapshot } from "@anidachi/protocol";
import { RoomMediaSession } from "../src/room-media-session";
import { getP2PMediaSessionState } from "../src/overlay-media-session";

function snapshot(sequence = 1, granted = true): RoomMediaV3Snapshot {
  return {
    type: "ROOM_MEDIA_SNAPSHOT", roomId: "room", roomGeneration: 1,
    snapshotSequence: sequence, closingAt: null,
    capabilities: { mediaProtocolVersion: 3, hostPlanCode: "pro", maxParticipants: 15,
      maxMediaSeats: 8, maxCameras: 4, capabilityRevision: 1, capabilitiesValidUntil: "2026-09-15T12:30:00Z" },
    participants: [{ participantSessionId: "session", mediaSeatGranted: granted, seatRevision: sequence - 1,
      cameraGranted: false, microphoneGranted: false, cameraIntentSequence: 0, microphoneIntentSequence: 0,
      cameraRevocationEpoch: 0, microphoneRevocationEpoch: 0 }],
  };
}

describe("host-managed media seats client", () => {
  it("keeps receiving without a seat in v3", () => {
    expect(getP2PMediaSessionState({mediaProtocolVersion: 3, localHasMediaSeat: false,
      participantId: "listener", roomId: "room", roomMediaSeatLimit: 8,
      roomSnapshotReady: true, status: "connected"})).toEqual({p2pReady: true, p2pSessionActive: true});
  });

  it("rejects capture without a seat, and a later host grant does not create local intent", () => {
    const media = new RoomMediaSession("room", "session");
    media.bindRoomGeneration(1);
    media.consume(snapshot(1, false));
    expect(media.intent("microphone", true)).toBeNull();
    media.consume(snapshot(2, true));
    expect(media.wants("microphone")).toBe(false);
    expect(media.canCapture("microphone")).toBe(false);
  });

  it("cancels first PTT before ACK and keeps its seat after microphone off", () => {
    const media = new RoomMediaSession("room", "session");
    media.bindRoomGeneration(1);
    media.consume(snapshot());
    const on = media.intent("microphone", true)!;
    expect(media.canCapture("microphone")).toBe(false);
    media.intent("microphone", false);
    media.consume({...on, type: "MEDIA_INTENT_ACK", snapshotSequence: 2,
      state: {...snapshot().participants[0], microphoneGranted: true, microphoneIntentSequence: on.intentSequence}});
    expect(media.canCapture("microphone")).toBe(false);
    expect(media.snapshot?.participants[0]).toMatchObject({mediaSeatGranted: true});
  });

  it("releases restored camera capture without requesting or changing the seat", () => {
    const media = new RoomMediaSession("room", "session");
    media.bindRoomGeneration(1);
    const restored = snapshot(); restored.participants[0].cameraGranted = true;
    media.consume(restored);
    expect(media.releaseRestoredGrants()).toMatchObject([{type: "SET_MEDIA_INTENT", media: "camera", enabled: false}]);
    expect(media.snapshot?.participants[0]).toMatchObject({mediaSeatGranted: true, seatRevision: 0});
    expect(media.canCapture("camera")).toBe(false);
  });

  it("revoke clears both pending intents, and regrant cannot restart them", () => {
    const media = new RoomMediaSession("room", "session");
    media.bindRoomGeneration(1); media.consume(snapshot());
    const camera = media.intent("camera", true)!;
    media.intent("microphone", true);
    const revoked = snapshot(3, false);
    revoked.participants[0].cameraRevocationEpoch = 1;
    revoked.participants[0].microphoneRevocationEpoch = 1;
    media.consume(revoked);
    expect(media.wants("camera")).toBe(false);
    expect(media.wants("microphone")).toBe(false);
    media.consume({...camera, type: "MEDIA_INTENT_ACK", snapshotSequence: 2,
      state: {...snapshot().participants[0], cameraGranted: true, cameraIntentSequence: camera.intentSequence}});
    const granted = {...revoked, snapshotSequence: 4, participants: [{...revoked.participants[0], mediaSeatGranted: true, seatRevision: 3}]};
    media.consume(granted);
    expect(media.canCapture("camera")).toBe(false);
    expect(media.canCapture("microphone")).toBe(false);
  });

  it("only matching results complete a host command and cannot advance room authority", () => {
    const media = new RoomMediaSession("room", "session");
    media.bindRoomGeneration(1); media.consume(snapshot());
    const command = media.setMediaSeat("user", "session", false)!;
    expect(command).toMatchObject({type: "SET_MEDIA_SEAT", targetUserId: "user", targetParticipantSessionId: "session", expectedSeatRevision: 0, enabled: false, roomGeneration: 1});
    expect(media.seatControls.get("user")).toEqual({pending: true, requestId: command.requestId});
    expect(media.snapshot?.participants[0]).toMatchObject({mediaSeatGranted: true});
    expect(media.consume({type: "MEDIA_SEAT_RESULT", requestId: command.requestId, targetParticipantSessionId: "session", code: "OK", snapshot: {...snapshot(99, false), roomGeneration: 2}})).toBe(false);
    expect(media.seatControls.get("user")?.pending).toBe(true);
    const revoked = snapshot(2, false);
    media.consume({type: "MEDIA_SEAT_RESULT", requestId: command.requestId, targetParticipantSessionId: "session", code: "OK", snapshot: revoked});
    expect(media.seatControls.get("user")).toEqual({pending: false});
    expect(media.snapshot?.participants[0]).toMatchObject({mediaSeatGranted: false});
    media.consume({type: "MEDIA_SEAT_RESULT", requestId: command.requestId, targetParticipantSessionId: "session", code: "OK", snapshot: snapshot(1, true)});
    expect(media.snapshot?.participants[0]).toMatchObject({mediaSeatGranted: false});
  });

  it("rejects a v2 ACK or snapshot inside an established v3 room", () => {
    const media = new RoomMediaSession("room", "session"); media.bindRoomGeneration(1);
    const current = snapshot(); media.consume(current);
    const intent = media.intent("camera", true)!;
    const {mediaSeatGranted: _seat, seatRevision: _revision, ...state} = current.participants[0];
    expect(media.consume({...intent, type: "MEDIA_INTENT_ACK", snapshotSequence: 2,
      state: {...state, cameraGranted: true, cameraIntentSequence: intent.intentSequence}})).toBe(false);
    const {maxMediaSeats: _limit, ...caps} = current.capabilities;
    expect(media.consume({...current, snapshotSequence: 3,
      capabilities: {...caps, mediaProtocolVersion: 2, maxMicrophones: 8}, participants: [state]})).toBe(false);
    expect(media.canCapture("camera")).toBe(false);
  });
});
