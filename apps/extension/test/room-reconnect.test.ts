import { describe, expect, it } from "vitest";
import { getRoomReconnectDelayMs } from "../src/room-reconnect";

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
