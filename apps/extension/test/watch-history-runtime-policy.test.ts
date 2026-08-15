import { describe, expect, it } from "vitest";
import { resolveWatchHistoryRuntimeGate } from "../src/watch-history-runtime-policy";

describe("watch history runtime hydration gate", () => {
  it("fails closed until the current identity room session is hydrated", () => {
    expect(resolveWatchHistoryRuntimeGate({
      identityLoaded: false,
      ownerUserId: null,
      roomSessionLoadedForUserId: undefined,
      storedRoomSessionOwnerUserId: null,
      roomActive: false,
    })).toEqual({ ready: false, roomSuppressed: true });

    expect(resolveWatchHistoryRuntimeGate({
      identityLoaded: true,
      ownerUserId: "owner-a",
      roomSessionLoadedForUserId: undefined,
      storedRoomSessionOwnerUserId: null,
      roomActive: false,
    })).toEqual({ ready: false, roomSuppressed: true });
  });

  it("suppresses an owner-matching restored room before reconnect and opens solo only after proven absence", () => {
    expect(resolveWatchHistoryRuntimeGate({
      identityLoaded: true,
      ownerUserId: "owner-a",
      roomSessionLoadedForUserId: "owner-a",
      storedRoomSessionOwnerUserId: "owner-a",
      roomActive: false,
    })).toEqual({ ready: true, roomSuppressed: true });

    expect(resolveWatchHistoryRuntimeGate({
      identityLoaded: true,
      ownerUserId: "owner-a",
      roomSessionLoadedForUserId: "owner-a",
      storedRoomSessionOwnerUserId: null,
      roomActive: false,
    })).toEqual({ ready: true, roomSuppressed: false });
  });

  it("does not let a persisted room from another owner suppress the current identity", () => {
    expect(resolveWatchHistoryRuntimeGate({
      identityLoaded: true,
      ownerUserId: "owner-b",
      roomSessionLoadedForUserId: "owner-b",
      storedRoomSessionOwnerUserId: "owner-a",
      roomActive: false,
    })).toEqual({ ready: true, roomSuppressed: false });
  });
});
