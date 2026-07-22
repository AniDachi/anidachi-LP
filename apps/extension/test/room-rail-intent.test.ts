import { describe, expect, it } from "vitest";
import {
  isRoomRailEdgeIntent,
  ROOM_RAIL_OPEN_DELAY_MS,
  shouldRenderRoomRail,
} from "../src/room-rail-intent";

describe("room rail intent", () => {
  it("never renders outside an active room", () => {
    expect(
      shouldRenderRoomRail({ participantCount: 1, panelOpen: false, roomActive: false }),
    ).toBe(false);
  });

  it("renders only for a closed panel with room participants", () => {
    expect(
      shouldRenderRoomRail({ participantCount: 1, panelOpen: false, roomActive: true }),
    ).toBe(true);
    expect(
      shouldRenderRoomRail({ participantCount: 1, panelOpen: true, roomActive: true }),
    ).toBe(false);
    expect(
      shouldRenderRoomRail({ participantCount: 0, panelOpen: false, roomActive: true }),
    ).toBe(false);
  });

  it("requires the cursor to press within three pixels of the player edge", () => {
    expect(isRoomRailEdgeIntent({ clientX: 997, edgeRight: 1000 })).toBe(true);
    expect(isRoomRailEdgeIntent({ clientX: 996, edgeRight: 1000 })).toBe(false);
    expect(ROOM_RAIL_OPEN_DELAY_MS).toBeGreaterThanOrEqual(400);
  });
});
