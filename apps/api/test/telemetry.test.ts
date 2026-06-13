import { describe, expect, it, vi } from "vitest";
import {
  buildRoomDataPoint,
  emitRoomTelemetry,
  shortHash,
  type AnalyticsEngineDataset,
} from "../src/telemetry";

describe("telemetry", () => {
  it("hashes room ids deterministically and non-reversibly", () => {
    const hash = shortHash("room-abc");
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(shortHash("room-abc")).toBe(hash);
    expect(shortHash("room-xyz")).not.toBe(hash);
  });

  it("builds a data point with env/name/role blobs and a hashed room id", () => {
    const point = buildRoomDataPoint(
      { env: "staging", roomId: "room-1" },
      { name: "join", role: "host", value: 2 },
    );
    const roomIdHash = shortHash("room-1");
    expect(point.indexes).toEqual([roomIdHash]);
    expect(point.blobs).toEqual(["staging", "join", roomIdHash, "host"]);
    expect(point.doubles).toEqual([2]);
  });

  it("never leaks the raw room id into the data point", () => {
    const point = buildRoomDataPoint(
      { env: "production", roomId: "secret-room-id" },
      { name: "ws_open" },
    );
    expect(JSON.stringify(point)).not.toContain("secret-room-id");
  });

  it("defaults value to 1 and role to empty string", () => {
    const point = buildRoomDataPoint(
      { env: "local", roomId: "r" },
      { name: "p2p_signal" },
    );
    expect(point.doubles).toEqual([1]);
    expect(point.blobs[3]).toBe("");
  });

  it("emits through the dataset binding when present", () => {
    const writeDataPoint = vi.fn();
    const dataset: AnalyticsEngineDataset = { writeDataPoint };
    emitRoomTelemetry(dataset, { env: "staging", roomId: "r" }, { name: "ws_close" });
    expect(writeDataPoint).toHaveBeenCalledOnce();
    const point = writeDataPoint.mock.calls[0]?.[0];
    expect(point?.blobs?.[1]).toBe("ws_close");
  });

  it("no-ops without a binding and swallows binding errors", () => {
    expect(() =>
      emitRoomTelemetry(undefined, { env: "x", roomId: "r" }, { name: "join" }),
    ).not.toThrow();

    const throwing: AnalyticsEngineDataset = {
      writeDataPoint() {
        throw new Error("analytics down");
      },
    };
    expect(() =>
      emitRoomTelemetry(throwing, { env: "x", roomId: "r" }, { name: "join" }),
    ).not.toThrow();
  });
});
