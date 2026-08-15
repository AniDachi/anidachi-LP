import { describe, expect, it } from "vitest";
import {
  resolveWatchHistoryRuntimeGate,
  shouldRefreshWatchHistoryAuthority,
} from "../src/watch-history-runtime-policy";

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
      ownerUserId: null,
      roomSessionLoadedForUserId: null,
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

describe("watch history authority refresh policy", () => {
  it("refreshes exactly once on the first same-owner token change after hydration installs the controller", () => {
    const beforeHydration = {
      ownerUserId: "owner-a",
      accessToken: "token-1",
    };
    const afterRefresh = {
      ownerUserId: "owner-a",
      accessToken: "token-2",
    };

    expect(shouldRefreshWatchHistoryAuthority({
      previous: null,
      next: beforeHydration,
      controllerAvailable: false,
    })).toBe(false);
    expect(shouldRefreshWatchHistoryAuthority({
      previous: beforeHydration,
      next: afterRefresh,
      controllerAvailable: true,
    })).toBe(true);
    expect(shouldRefreshWatchHistoryAuthority({
      previous: afterRefresh,
      next: afterRefresh,
      controllerAvailable: true,
    })).toBe(false);
  });

  it("does not refresh on initial controller install or owner change", () => {
    expect(shouldRefreshWatchHistoryAuthority({
      previous: null,
      next: { ownerUserId: "owner-a", accessToken: "token-1" },
      controllerAvailable: true,
    })).toBe(false);
    expect(shouldRefreshWatchHistoryAuthority({
      previous: { ownerUserId: "owner-a", accessToken: "token-1" },
      next: { ownerUserId: "owner-b", accessToken: "token-2" },
      controllerAvailable: true,
    })).toBe(false);
  });
});
