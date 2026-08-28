import { describe, expect, it } from "vitest";
import {
	isRoomRailEdgeProximity,
	isRoomRailEdgeIntent,
	ROOM_RAIL_OPEN_DELAY_MS,
  selectVoiceRailParticipants,
  shouldRenderRoomRail,
} from "../src/room-rail-intent";

describe("room rail intent", () => {
  it("never renders outside an active room", () => {
    expect(
      shouldRenderRoomRail({
        participantCount: 1,
        panelOpen: false,
        roomActive: false,
      }),
    ).toBe(false);
  });

  it("renders only for a closed panel with room participants", () => {
    expect(
      shouldRenderRoomRail({
        participantCount: 1,
        panelOpen: false,
        roomActive: true,
      }),
    ).toBe(true);
    expect(
      shouldRenderRoomRail({
        participantCount: 1,
        panelOpen: true,
        roomActive: true,
      }),
    ).toBe(false);
    expect(
      shouldRenderRoomRail({
        participantCount: 0,
        panelOpen: false,
        roomActive: true,
      }),
    ).toBe(false);
  });

	it("previews an approaching cursor before deliberate edge intent opens the rail", () => {
		expect(isRoomRailEdgeProximity({ clientX: 980, edgeRight: 1000 })).toBe(true);
		expect(isRoomRailEdgeProximity({ clientX: 979, edgeRight: 1000 })).toBe(false);
		expect(isRoomRailEdgeIntent({ clientX: 994, edgeRight: 1000 })).toBe(true);
		expect(isRoomRailEdgeIntent({ clientX: 993, edgeRight: 1000 })).toBe(false);
		expect(ROOM_RAIL_OPEN_DELAY_MS).toBeGreaterThanOrEqual(200);
		expect(ROOM_RAIL_OPEN_DELAY_MS).toBeLessThanOrEqual(300);
	});

  it("hands a participant to video controls only while the video bubble is mounted", () => {
    const participants = [
      { id: "video", displayName: "Video" },
      { id: "voice", displayName: "Voice" },
    ];

    expect(
      selectVoiceRailParticipants(participants, new Set(["video"])).map((item) => item.id),
    ).toEqual(["voice"]);
    expect(selectVoiceRailParticipants(participants, new Set()).map((item) => item.id)).toEqual([
      "video",
      "voice",
    ]);
  });
});
