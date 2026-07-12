import { describe, expect, it } from "vitest";
import { getRoomReconnectDelayMs } from "../src/room-reconnect";
import { isTerminalRoomCloseCode, ROOM_ENDED_CLOSE_CODE } from "../src/room-client";

describe("room reconnect backoff", () => {
  it("backs off quickly and caps the reconnect delay", () => {
    expect(getRoomReconnectDelayMs(0)).toBe(900);
    expect(getRoomReconnectDelayMs(1)).toBe(900);
    expect(getRoomReconnectDelayMs(2)).toBe(1800);
    expect(getRoomReconnectDelayMs(4)).toBe(7200);
    expect(getRoomReconnectDelayMs(5)).toBe(8000);
    expect(getRoomReconnectDelayMs(20)).toBe(8000);
  });
});

describe("room reconnect terminal closes", () => {
  it("classifies room-ended close code 4004 as terminal", () => {
    expect(ROOM_ENDED_CLOSE_CODE).toBe(4004);
    expect(isTerminalRoomCloseCode(4004)).toBe(true);
    expect(isTerminalRoomCloseCode(4001)).toBe(false);
    expect(isTerminalRoomCloseCode(1006)).toBe(false);
  });
});
