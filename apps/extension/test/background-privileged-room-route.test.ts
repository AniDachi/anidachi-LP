import { describe, expect, it, vi } from "vitest";
import {
  RoomAdmissionFence,
  cancelRoomAdmissionForTab,
  cleanupRoomAdmissionHandoffForTab,
  connectRoomHttpMessage,
  roomAdmissionHandoffMessage,
  type RoomAdmissionHandoff,
} from "../src/room-client";
import {
  confirmRoomSessionForTab,
  loadRoomSessionForTab,
  prepareRoomSessionForTab,
  type PreparedRoomSession,
} from "../src/room-session-storage";
import {
  ROOM_DEPARTURE_RETRY_ALARM,
  createRoomDepartureRetryCoordinator,
  type RoomDepartureRetryIdentity,
} from "../src/room-departure-retry";
import { handleRoomTabDeparture } from "../src/room-departure";

function preparedRoomSession(roomId: string): PreparedRoomSession {
  return {
    version: 1 as const,
    preparationId: `preparation-${roomId}`,
    roomId,
    ownerUserId: "user-a",
    participantSessionId: `session-${roomId}`,
  };
}

let routeAdmissionGeneration = 0;
const roomSessionRouteDependencies = {
  confirmRoomSession: async (
    _tabId: number,
    prepared: PreparedRoomSession,
    roomId: string,
  ) => ({
    version: 1 as const,
    revision: 1,
    roomId,
    ownerUserId: prepared.ownerUserId,
    participantSessionId: prepared.participantSessionId,
    cameraEnabled: false,
    voiceMode: "push-to-talk" as const,
  }),
  discardPreparedRoomSession: async () => false,
  renewCancelledAdmissionDepartureIntent: async (
    identity: RoomDepartureRetryIdentity,
  ) => ({ ...identity, generation: ++routeAdmissionGeneration }),
  requestCancelledAdmissionCleanup: async () => true,
  markAdmissionHandoff: async () => true,
};

describe("background privileged room route", () => {
  it("keeps a committed fresh-identity successor when the older admission resolves late", async () => {
    const scenario = await startSameIdentitySuccessorScenario();

    scenario.newAdmission.resolve(roomResponse(scenario.roomId));
    await expect(scenario.newer).resolves.toMatchObject({
      ok: true,
      connection: {
        roomSession: {
          participantSessionId: scenario.newPrepared.participantSessionId,
        },
      },
    });
    scenario.oldAdmission.resolve(roomResponse(scenario.roomId));
    await expect(scenario.older).resolves.toMatchObject({
      ok: false,
      code: "STALE_ROOM_SESSION",
    });

    expect(scenario.departExact).toHaveBeenCalledWith({
      roomId: scenario.roomId,
      ownerUserId: "user-a",
      participantSessionId: scenario.oldPrepared.participantSessionId,
    });
    await expect(
      loadRoomSessionForTab(scenario.tabId, scenario.roomSessionDependencies),
    ).resolves.toMatchObject({
      roomId: scenario.roomId,
      participantSessionId: scenario.newPrepared.participantSessionId,
    });
    expect(scenario.retryStorage.value()?.jobs).toEqual([
      expect.objectContaining({
        admissionState: "handoff-pending",
        participantSessionId: scenario.newPrepared.participantSessionId,
      }),
    ]);
  });

  it("does not let the older alarm depart an acknowledged fresh-identity successor", async () => {
    const scenario = await startSameIdentitySuccessorScenario();

    scenario.newAdmission.resolve(roomResponse(scenario.roomId));
    const newer = await scenario.newer;
    const handoff = admittedHandoff(newer);
    await expect(
      scenario.coordinator.acknowledgeAdmissionHandoff(handoff),
    ).resolves.toBe(true);
    scenario.advanceToSettlementHorizon();
    await scenario.coordinator.handleAlarm(ROOM_DEPARTURE_RETRY_ALARM);

    expect(scenario.departExact).toHaveBeenCalledTimes(1);
    expect(scenario.departExact).toHaveBeenCalledWith({
      roomId: scenario.roomId,
      ownerUserId: "user-a",
      participantSessionId: scenario.oldPrepared.participantSessionId,
    });
    expect(scenario.retryStorage.value()?.jobs).toEqual([]);
    await expect(
      loadRoomSessionForTab(scenario.tabId, scenario.roomSessionDependencies),
    ).resolves.toMatchObject({
      roomId: scenario.roomId,
      participantSessionId: scenario.newPrepared.participantSessionId,
    });

    scenario.oldAdmission.resolve(roomResponse(scenario.roomId));
    await expect(scenario.older).resolves.toMatchObject({ ok: false });
    expect(scenario.departExact).toHaveBeenCalledTimes(1);
  });

  it("retains the live successor generation when its admission is ambiguous", async () => {
    const scenario = await startSameIdentitySuccessorScenario();

    scenario.newAdmission.reject(new TypeError("successor transport lost"));
    await expect(scenario.newer).resolves.toMatchObject({ ok: false });

    expect(scenario.retryStorage.value()?.jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cleanupRequested: true,
          participantSessionId: scenario.oldPrepared.participantSessionId,
        }),
        expect.objectContaining({
          cleanupRequested: false,
          participantSessionId: scenario.newPrepared.participantSessionId,
        }),
      ]),
    );
    scenario.oldAdmission.resolve(roomResponse(scenario.roomId));
    await expect(scenario.older).resolves.toMatchObject({ ok: false });
    expect(scenario.departExact).toHaveBeenCalledOnce();
    expect(scenario.departExact).toHaveBeenCalledWith({
      roomId: scenario.roomId,
      ownerUserId: "user-a",
      participantSessionId: scenario.oldPrepared.participantSessionId,
    });
    expect(scenario.retryStorage.value()?.jobs).toEqual([
      expect.objectContaining({
        cleanupRequested: false,
        participantSessionId: scenario.newPrepared.participantSessionId,
      }),
    ]);
  });

  it("retains the canceled successor generation and supersedes the older cleanup", async () => {
    const scenario = await startSameIdentitySuccessorScenario();

    await expect(
      cancelRoomAdmissionForTab(scenario.tabId, scenario.admissionFence),
    ).resolves.toMatchObject({
      operation: {
        participantSessionId: scenario.newPrepared.participantSessionId,
      },
      owned: true,
    });
    scenario.newAdmission.reject(new TypeError("canceled successor transport lost"));
    await expect(scenario.newer).resolves.toMatchObject({ ok: false });
    expect(scenario.retryStorage.value()?.jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cleanupRequested: true,
          participantSessionId: scenario.oldPrepared.participantSessionId,
        }),
        expect.objectContaining({
          cleanupRequested: true,
          participantSessionId: scenario.newPrepared.participantSessionId,
        }),
      ]),
    );

    scenario.oldAdmission.resolve(roomResponse(scenario.roomId));
    await expect(scenario.older).resolves.toMatchObject({ ok: false });
    expect(scenario.departExact).toHaveBeenCalledTimes(2);
    expect(scenario.retryStorage.value()?.jobs).toEqual([
      expect.objectContaining({
        cleanupRequested: true,
        participantSessionId: scenario.newPrepared.participantSessionId,
      }),
    ]);
  });

  it("coalesces duplicate cancellation but renews a later same-identity reservation", async () => {
    const fence = new RoomAdmissionFence();
    const identity = {
      roomId: "room-renewed",
      ownerUserId: "user-a",
      participantSessionId: "session-reused",
    };
    let generation = 0;
    const renewIntent = vi.fn(async () => ({
      ...identity,
      generation: ++generation,
    }));
    const requestCleanup = vi.fn(async () => true);

    const first = fence.begin(44, identity, renewIntent, requestCleanup);
    const firstCancellation = fence.cancelAny(44);
    const duplicateCancellation = fence.cancelAny(44);
    expect(duplicateCancellation).toBe(firstCancellation);
    await firstCancellation;
    expect(renewIntent).toHaveBeenCalledOnce();
    expect(requestCleanup).toHaveBeenCalledOnce();
    fence.finish(first, { kind: "not-cancelled" });

    const second = fence.begin(44, identity, renewIntent, requestCleanup);
    const laterCancellation = fence.cancelAny(44);
    await expect(laterCancellation).resolves.toMatchObject({
      operation: { generation: 2 },
      owned: true,
    });
    expect(renewIntent).toHaveBeenCalledTimes(2);
    expect(requestCleanup).toHaveBeenCalledTimes(2);
    fence.finish(second, { kind: "not-cancelled" });
  });

  it("awaits persisted admission intent before passive tab cleanup and authority removal", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const calls: string[] = [];
    const persisted = deferred<void>();

    const handling = background.handleRemovedRoomTab(60, {
      cancelRoomAdmission: (tabId) => {
        calls.push(`cancel:${tabId}`);
        return persisted.promise;
      },
      clearRoomAuthorityRequest: (tabId) => calls.push(`request:${tabId}`),
      departRoom: async (tabId) => {
        calls.push(`depart:${tabId}`);
        return "departed";
      },
      removePrivilegedAuthority: async (tabId) => {
        calls.push(`authority:${tabId}`);
      },
    });

    await Promise.resolve();
    expect(calls).toEqual(["cancel:60", "request:60"]);

    persisted.resolve();
    await handling;

    expect(calls).toEqual([
      "cancel:60",
      "request:60",
      "depart:60",
      "authority:60",
    ]);
  });

  it("persists exact intent on passive close before the admission promise settles", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 601;
    const admissionFence = new RoomAdmissionFence();
    const storage = createSessionStorage();
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => "passive-late-admission",
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-passive-late" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    const renewIntent = vi.fn(async (identity: RoomDepartureRetryIdentity) => ({
      ...identity,
      generation: 1,
    }));
    const settleIntent = vi.fn(async () => "departed" as const);
    const sender = { tab: { id: tabId } };
    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-passive-late", "access-a", prepared),
      sender,
      {
        roomDependencies: {
          admissionFence,
          renewCancelledAdmissionDepartureIntent: renewIntent,
          settleCancelledAdmissionDeparture: settleIntent,
          issueAuthority: async () => null,
          roomSessionDependencies,
        },
      },
    );

    await background.handleRemovedRoomTab(tabId, {
      cancelRoomAdmission: (removedTabId) =>
        cancelRoomAdmissionForTab(removedTabId, admissionFence),
      clearRoomAuthorityRequest: () => undefined,
      departRoom: async () => "no-session",
      removePrivilegedAuthority: async () => undefined,
    });

    expect(renewIntent).toHaveBeenCalledOnce();
    expect(renewIntent).toHaveBeenCalledWith({
      roomId: "room-passive-late",
      ownerUserId: "user-a",
      participantSessionId: prepared.participantSessionId,
    });
    expect(settleIntent).not.toHaveBeenCalled();

    webAdmission.resolve(roomResponse("room-passive-late"));

    await expect(connecting).resolves.toMatchObject({
      ok: false,
      code: "STALE_ROOM_SESSION",
    });
    expect(settleIntent).toHaveBeenCalledOnce();
    expect(settleIntent).toHaveBeenCalledWith({
      roomId: "room-passive-late",
      ownerUserId: "user-a",
      participantSessionId: prepared.participantSessionId,
      generation: 1,
    });
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toBeNull();
  });

  it("exact-cleans a committed admission when its tab closes before snapshot handoff", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 605;
    const roomId = "room-pre-snapshot-close";
    const storage = createSessionStorage();
    let nextId = 0;
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => `pre-snapshot-${++nextId}`,
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId },
      roomSessionDependencies,
    );
    vi.stubGlobal("fetch", vi.fn(async () => roomResponse(roomId)));
    const retryStorage = createDepartureRetryStorage();
    const departExact = vi.fn(async () => "departed" as const);
    const coordinator = createRoomDepartureRetryCoordinator({
      storage: retryStorage,
      scheduler: createDepartureRetryScheduler(),
      getCurrentUserId: async () => "user-a",
      departExact,
      now: () => 10_000,
    });
    const admissionFence = new RoomAdmissionFence();
    const roomDependencies = {
      admissionFence,
      renewCancelledAdmissionDepartureIntent: coordinator.renewAdmissionIntent,
      requestCancelledAdmissionCleanup: coordinator.requestAdmissionCleanup,
      markAdmissionHandoff: coordinator.markAdmissionHandoff,
      acknowledgeAdmissionHandoff: coordinator.acknowledgeAdmissionHandoff,
      claimAdmissionHandoffCleanup: coordinator.claimAdmissionHandoffCleanup,
      settleCancelledAdmissionDeparture: coordinator.settleAdmission,
      retryCancelledAdmissionDeparture: coordinator.retryAdmission,
      issueAuthority: async () => null,
      roomSessionDependencies,
    };
    const connected = await background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage(roomId, "access-a", prepared),
      { tab: { id: tabId } },
      { roomDependencies },
    );
    const handoff = admittedHandoff(connected);
    expect(retryStorage.value()?.jobs).toEqual([
      expect.objectContaining({
        admissionState: "handoff-pending",
        generation: handoff.generation,
      }),
    ]);

    await background.handleRemovedRoomTab(tabId, {
      cancelRoomAdmission: (removedTabId) =>
        cancelRoomAdmissionForTab(removedTabId, admissionFence),
      cleanupPendingHandoff: (removedTabId) =>
        cleanupRoomAdmissionHandoffForTab(removedTabId, roomDependencies),
      clearRoomAuthorityRequest: () => undefined,
      departRoom: (removedTabId) =>
        handleRoomTabDeparture(removedTabId, { roomSessionDependencies }),
      removePrivilegedAuthority: async () => undefined,
    });

    expect(departExact).toHaveBeenCalledOnce();
    expect(departExact).toHaveBeenCalledWith({
      roomId,
      ownerUserId: "user-a",
      participantSessionId: prepared.participantSessionId,
    });
    expect(retryStorage.value()?.jobs).toEqual([]);
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toBeNull();
  });

  it("retires only a matching snapshot handoff and ignores a stale tab acknowledgement", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 606;
    const roomId = "room-handoff-ack";
    const storage = createSessionStorage();
    let nextId = 0;
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => `handoff-ack-${++nextId}`,
    };
    vi.stubGlobal("fetch", vi.fn(async () => roomResponse(roomId)));
    const retryStorage = createDepartureRetryStorage();
    const coordinator = createRoomDepartureRetryCoordinator({
      storage: retryStorage,
      scheduler: createDepartureRetryScheduler(),
      getCurrentUserId: async () => "user-a",
      departExact: vi.fn(async () => "stale" as const),
      now: () => 20_000,
    });
    const roomDependencies = {
      admissionFence: new RoomAdmissionFence(),
      renewCancelledAdmissionDepartureIntent: coordinator.renewAdmissionIntent,
      requestCancelledAdmissionCleanup: coordinator.requestAdmissionCleanup,
      markAdmissionHandoff: coordinator.markAdmissionHandoff,
      acknowledgeAdmissionHandoff: coordinator.acknowledgeAdmissionHandoff,
      claimAdmissionHandoffCleanup: coordinator.claimAdmissionHandoffCleanup,
      settleCancelledAdmissionDeparture: coordinator.settleAdmission,
      retryCancelledAdmissionDeparture: coordinator.retryAdmission,
      issueAuthority: async () => null,
      roomSessionDependencies,
    };
    const sender = { tab: { id: tabId } };
    const firstPrepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId },
      roomSessionDependencies,
    );
    const first = admittedHandoff(
      await background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(roomId, "access-a", firstPrepared),
        sender,
        { roomDependencies },
      ),
    );
    const secondPrepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId },
      roomSessionDependencies,
    );
    const second = admittedHandoff(
      await background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(roomId, "access-a", secondPrepared),
        sender,
        { roomDependencies },
      ),
    );

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        roomAdmissionHandoffMessage(first),
        sender,
        { roomDependencies },
      ),
    ).resolves.toEqual({ ok: true, acknowledged: false });
    expect(retryStorage.value()?.jobs).toHaveLength(2);
    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        roomAdmissionHandoffMessage(second),
        sender,
        { roomDependencies },
      ),
    ).resolves.toEqual({ ok: true, acknowledged: true });
    expect(retryStorage.value()?.jobs).toEqual([
      expect.objectContaining({
        participantSessionId: firstPrepared.participantSessionId,
      }),
    ]);
  });

  it("keeps a fresh committed session when an older confirmed leave resolves late", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 607;
    const roomId = "room-late-confirmed-leave";
    const storage = createSessionStorage();
    let nextId = 0;
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => `late-leave-${++nextId}`,
    };
    const oldPrepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId },
      roomSessionDependencies,
    );
    const oldRecord = await confirmRoomSessionForTab(
      tabId,
      oldPrepared,
      roomId,
      roomSessionDependencies,
    );
    if (!oldRecord) throw new Error("Expected old confirmed record");
    const oldDeparture = deferred<{
      kind: "ack";
      outcome: "stale";
    }>();
    const requestDeparture = vi.fn(() => oldDeparture.promise);
    const sender = { tab: { id: tabId } };
    const leaving = background.dispatchPrivilegedRoomRuntimeMessage(
      {
        type: "ANIDACHI_ROOM_DEPARTURE",
        command: "depart",
        roomId,
        expectedUserId: "user-a",
        participantSessionId: oldPrepared.participantSessionId,
      },
      sender,
      {
        departureDependencies: {
          getStoredSession: async () => sessionFor("user-a"),
          refreshSession: async () => null,
          requestDeparture,
          roomSessionDependencies,
          timeoutMs: 1_000,
        },
      },
    );
    await waitForCall(requestDeparture);

    const newPrepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId },
      roomSessionDependencies,
    );
    expect(newPrepared.participantSessionId).not.toBe(
      oldPrepared.participantSessionId,
    );
    vi.stubGlobal("fetch", vi.fn(async () => roomResponse(roomId)));
    const connected = await background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage(roomId, "access-a", newPrepared),
      sender,
      {
        roomDependencies: {
          issueAuthority: async () => null,
          renewCancelledAdmissionDepartureIntent: async (identity) => ({
            ...identity,
            generation: 10_000,
          }),
          requestCancelledAdmissionCleanup: async () => true,
          markAdmissionHandoff: async () => true,
          roomSessionDependencies,
        },
      },
    );
    expect(connected).toMatchObject({
      ok: true,
      connection: {
        roomSession: {
          participantSessionId: newPrepared.participantSessionId,
        },
      },
    });

    oldDeparture.resolve({ kind: "ack", outcome: "stale" });
    await expect(leaving).resolves.toEqual({ ok: true, outcome: "stale" });
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toMatchObject({
      roomId,
      participantSessionId: newPrepared.participantSessionId,
    });
  });

  it("keeps ambiguous canceled transport failure may-commit instead of settling on stale", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 603;
    const admissionFence = new RoomAdmissionFence();
    const storage = createSessionStorage();
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => "ambiguous-canceled-admission",
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-ambiguous" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    const renewIntent = vi.fn(async (identity: RoomDepartureRetryIdentity) => ({
      ...identity,
      generation: 1,
    }));
    const retryIntent = vi.fn(async () => "stale" as const);
    const settleIntent = vi.fn(async () => "stale" as const);
    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-ambiguous", "access-a", prepared),
      { tab: { id: tabId } },
      {
        roomDependencies: {
          admissionFence,
          renewCancelledAdmissionDepartureIntent: renewIntent,
          retryCancelledAdmissionDeparture: retryIntent,
          settleCancelledAdmissionDeparture: settleIntent,
          issueAuthority: async () => null,
          roomSessionDependencies,
        },
      },
    );

    await background.handleRemovedRoomTab(tabId, {
      cancelRoomAdmission: (removedTabId) =>
        cancelRoomAdmissionForTab(removedTabId, admissionFence),
      clearRoomAuthorityRequest: () => undefined,
      departRoom: async () => "no-session",
      removePrivilegedAuthority: async () => undefined,
    });
    webAdmission.reject(new TypeError("transport lost"));

    await expect(connecting).resolves.toMatchObject({ ok: false });
    expect(renewIntent).toHaveBeenCalledOnce();
    expect(retryIntent).toHaveBeenCalledOnce();
    expect(settleIntent).not.toHaveBeenCalled();
  });

  it("keeps explicit retry intent when leave is retryable and the tab closes", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 602;
    const admissionFence = new RoomAdmissionFence();
    const storage = createSessionStorage();
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => "explicit-retry-then-close",
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-explicit-retry" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    let jobOwned = false;
    const renewIntent = vi.fn(async (identity: RoomDepartureRetryIdentity) => {
      jobOwned = true;
      return { ...identity, generation: 1 };
    });
    const settleIntent = vi.fn(async () => {
      expect(jobOwned).toBe(true);
      jobOwned = false;
      return "departed" as const;
    });
    const requestDeparture = vi.fn(async () => ({
      kind: "retryable" as const,
      code: "ROOM_DEPARTURE_UNAVAILABLE" as const,
      message: "Departure is temporarily unavailable",
    }));
    const retryIntent = vi.fn(async () => "retryable" as const);
    const dependencies = {
      admissionDepartureTimeoutMs: 25,
      departureDependencies: {
        getStoredSession: async () => sessionFor("user-a"),
        refreshSession: async () => null,
        requestDeparture,
        timeoutMs: 100,
      },
      roomDependencies: {
        admissionFence,
        renewCancelledAdmissionDepartureIntent: renewIntent,
        retryCancelledAdmissionDeparture: retryIntent,
        settleCancelledAdmissionDeparture: settleIntent,
        issueAuthority: async () => null,
        roomSessionDependencies,
      },
    };
    const sender = { tab: { id: tabId } };
    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-explicit-retry", "access-a", prepared),
      sender,
      dependencies,
    );

    const leaving = background.dispatchPrivilegedRoomRuntimeMessage(
      {
        type: "ANIDACHI_ROOM_DEPARTURE",
        command: "depart",
        roomId: "room-explicit-retry",
        expectedUserId: "user-a",
        participantSessionId: prepared.participantSessionId,
      },
      sender,
      dependencies,
    );

    await expect(leaving).resolves.toMatchObject({ ok: false });
    expect(jobOwned).toBe(true);
    expect(renewIntent).toHaveBeenCalledOnce();
    expect(retryIntent).toHaveBeenCalledOnce();
    expect(requestDeparture).not.toHaveBeenCalled();

    await background.handleRemovedRoomTab(tabId, {
      cancelRoomAdmission: (removedTabId) =>
        cancelRoomAdmissionForTab(removedTabId, admissionFence),
      clearRoomAuthorityRequest: () => undefined,
      departRoom: async () => "no-session",
      removePrivilegedAuthority: async () => undefined,
    });

    expect(jobOwned).toBe(true);
    expect(renewIntent).toHaveBeenCalledOnce();
    webAdmission.resolve(roomResponse("room-explicit-retry"));

    await expect(connecting).resolves.toMatchObject({ ok: false });
    expect(settleIntent).toHaveBeenCalledOnce();
    expect(jobOwned).toBe(false);
  });

  it("routes an explicit leave through the sender tab's background-owned session", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
		const requestDeparture = vi.fn(
			async () =>
				({
      kind: "ack",
      outcome: "departed",
				}) as const,
		);

    const result = await background.dispatchPrivilegedRoomRuntimeMessage(
			{
				type: "ANIDACHI_ROOM_DEPARTURE",
				command: "depart",
				roomId: "room-a",
				expectedUserId: "user-a",
				participantSessionId: "session-62",
			},
      { tab: { id: 62 } },
      {
        departureDependencies: {
          loadRoomSession: async (tabId) => ({
            version: 1,
            revision: 1,
            roomId: "room-a",
            ownerUserId: "user-a",
            participantSessionId: `session-${tabId}`,
            cameraEnabled: false,
            voiceMode: "push-to-talk",
          }),
          getStoredSession: async () => sessionFor("user-a"),
          refreshSession: async () => null,
          requestDeparture,
          timeoutMs: 100,
        },
      },
    );

    expect(result).toEqual({ ok: true, outcome: "departed" });
    expect(requestDeparture).toHaveBeenCalledWith(
      expect.objectContaining({ participantSessionId: "session-62" }),
      expect.any(String),
      expect.any(AbortSignal),
    );
  });

  it("cancels an in-flight background admission before exact leave and cleans a late Web commit", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 81;
    const storage = createSessionStorage();
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => "late-admission",
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-late" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    const requestDeparture = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "already_departed" as const,
      })
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "departed" as const,
      });
    const dependencies = {
      departureDependencies: {
        getStoredSession: async () => sessionFor("user-a"),
        refreshSession: async () => null,
        requestDeparture,
        roomSessionDependencies,
        timeoutMs: 100,
      },
      roomDependencies: {
        issueAuthority: async () => null,
        roomSessionDependencies,
      },
    };
    const sender = { tab: { id: tabId } };

    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-late", "access-a", prepared),
      sender,
      dependencies,
    );
    const leaving = background.dispatchPrivilegedRoomRuntimeMessage(
      {
        type: "ANIDACHI_ROOM_DEPARTURE",
        command: "depart",
        roomId: "room-late",
        expectedUserId: "user-a",
        participantSessionId: prepared.participantSessionId,
      },
      sender,
      dependencies,
    );

    await waitForCall(requestDeparture);
    let leaveSettled = false;
    void leaving?.then(() => {
      leaveSettled = true;
    });
    await Promise.resolve();
    expect(leaveSettled).toBe(false);

    webAdmission.resolve(roomResponse("room-late"));

    await expect(connecting).resolves.toMatchObject({
      ok: false,
      code: "STALE_ROOM_SESSION",
      status: 409,
    });
    await expect(leaving).resolves.toEqual({
      ok: true,
      outcome: "already_departed",
    });
    expect(requestDeparture).toHaveBeenCalledTimes(2);
    expect(requestDeparture).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        roomId: "room-late",
        ownerUserId: "user-a",
        participantSessionId: prepared.participantSessionId,
      }),
      "access-token-user-a",
      expect.any(AbortSignal),
    );
    expect(requestDeparture).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        roomId: "room-late",
        ownerUserId: "user-a",
        participantSessionId: prepared.participantSessionId,
      }),
      "access-token-user-a",
      expect.any(AbortSignal),
    );
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toBeNull();
  });

  it("returns retryable and preserves the exact session when late cleanup gets 503", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 83;
    const storage = createSessionStorage();
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => "late-cleanup-503",
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-cleanup-503" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    const requestDeparture = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "already_departed" as const,
      })
      .mockResolvedValueOnce({
        kind: "retryable" as const,
        code: "ROOM_DEPARTURE_UNAVAILABLE" as const,
        message: "Departure is temporarily unavailable",
      })
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "departed" as const,
      });
    const dependencies = {
      admissionDepartureTimeoutMs: 100,
      departureDependencies: {
        getStoredSession: async () => sessionFor("user-a"),
        refreshSession: async () => null,
        requestDeparture,
        roomSessionDependencies,
        timeoutMs: 100,
      },
      roomDependencies: {
        issueAuthority: async () => null,
        roomSessionDependencies,
      },
    };
    const sender = { tab: { id: tabId } };
    const departureMessage = {
      type: "ANIDACHI_ROOM_DEPARTURE",
      command: "depart",
      roomId: "room-cleanup-503",
      expectedUserId: "user-a",
      participantSessionId: prepared.participantSessionId,
    } as const;

    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-cleanup-503", "access-a", prepared),
      sender,
      dependencies,
    );
    const leaving = background.dispatchPrivilegedRoomRuntimeMessage(
      departureMessage,
      sender,
      dependencies,
    );
    webAdmission.resolve(roomResponse("room-cleanup-503"));

    await expect(connecting).resolves.toMatchObject({
      ok: false,
      code: "STALE_ROOM_SESSION",
    });
    await expect(leaving).resolves.toMatchObject({ ok: false });
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toMatchObject({
      roomId: "room-cleanup-503",
      participantSessionId: prepared.participantSessionId,
    });

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        departureMessage,
        sender,
        dependencies,
      ),
    ).resolves.toEqual({ ok: true, outcome: "departed" });
    expect(requestDeparture).toHaveBeenCalledTimes(3);
  });

  it("returns retryable and preserves the exact session when late cleanup loses auth", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 84;
    const storage = createSessionStorage();
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => "late-cleanup-no-auth",
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-cleanup-no-auth" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    const getStoredSession = vi
      .fn()
      .mockResolvedValueOnce(sessionFor("user-a"))
      .mockResolvedValueOnce(null);
    const requestDeparture = vi.fn(async () => ({
      kind: "ack" as const,
      outcome: "already_departed" as const,
    }));
    const dependencies = {
      admissionDepartureTimeoutMs: 100,
      departureDependencies: {
        getStoredSession,
        refreshSession: async () => null,
        requestDeparture,
        roomSessionDependencies,
        timeoutMs: 100,
      },
      roomDependencies: {
        issueAuthority: async () => null,
        roomSessionDependencies,
      },
    };
    const sender = { tab: { id: tabId } };

    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-cleanup-no-auth", "access-a", prepared),
      sender,
      dependencies,
    );
    const leaving = background.dispatchPrivilegedRoomRuntimeMessage(
      {
        type: "ANIDACHI_ROOM_DEPARTURE",
        command: "depart",
        roomId: "room-cleanup-no-auth",
        expectedUserId: "user-a",
        participantSessionId: prepared.participantSessionId,
      },
      sender,
      dependencies,
    );
    webAdmission.resolve(roomResponse("room-cleanup-no-auth"));

    await expect(connecting).resolves.toMatchObject({ ok: false });
    await expect(leaving).resolves.toMatchObject({ ok: false });
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toMatchObject({
      participantSessionId: prepared.participantSessionId,
    });
    expect(requestDeparture).toHaveBeenCalledOnce();
  });

  it("bounds an unresolved canceled admission and keeps its record retryable", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 85;
    const storage = createSessionStorage();
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => "slow-canceled-admission",
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-slow-canceled" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    const requestDeparture = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "already_departed" as const,
      })
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "departed" as const,
      })
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "already_departed" as const,
      });
    const dependencies = {
      admissionDepartureTimeoutMs: 5,
      departureDependencies: {
        getStoredSession: async () => sessionFor("user-a"),
        refreshSession: async () => null,
        requestDeparture,
        roomSessionDependencies,
        timeoutMs: 100,
      },
      roomDependencies: {
        issueAuthority: async () => null,
        roomSessionDependencies,
      },
    };
    const sender = { tab: { id: tabId } };
    const departureMessage = {
      type: "ANIDACHI_ROOM_DEPARTURE",
      command: "depart",
      roomId: "room-slow-canceled",
      expectedUserId: "user-a",
      participantSessionId: prepared.participantSessionId,
    } as const;
    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-slow-canceled", "access-a", prepared),
      sender,
      dependencies,
    );

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        departureMessage,
        sender,
        dependencies,
      ),
    ).resolves.toMatchObject({ ok: false });
    expect(requestDeparture).toHaveBeenCalledOnce();

    webAdmission.resolve(roomResponse("room-slow-canceled"));
    await expect(connecting).resolves.toMatchObject({ ok: false });
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toMatchObject({
      participantSessionId: prepared.participantSessionId,
    });

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        departureMessage,
        sender,
        dependencies,
      ),
    ).resolves.toEqual({ ok: true, outcome: "already_departed" });
    expect(requestDeparture).toHaveBeenCalledTimes(3);
  });

  it("retains an exact retry identity when ambiguous admission and compensation both fail", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 86;
    const storage = createSessionStorage();
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => "ambiguous-retry-identity",
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-ambiguous-retry" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    const requestDeparture = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "already_departed" as const,
      })
      .mockResolvedValueOnce({
        kind: "retryable" as const,
        code: "ROOM_DEPARTURE_UNAVAILABLE" as const,
        message: "Departure is temporarily unavailable",
      })
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "departed" as const,
      });
    const dependencies = {
      admissionDepartureTimeoutMs: 100,
      departureDependencies: {
        getStoredSession: async () => sessionFor("user-a"),
        refreshSession: async () => null,
        requestDeparture,
        roomSessionDependencies,
        timeoutMs: 100,
      },
      roomDependencies: {
        issueAuthority: async () => null,
        roomSessionDependencies,
      },
    };
    const sender = { tab: { id: tabId } };
    const departureMessage = {
      type: "ANIDACHI_ROOM_DEPARTURE",
      command: "depart",
      roomId: "room-ambiguous-retry",
      expectedUserId: "user-a",
      participantSessionId: prepared.participantSessionId,
    } as const;
    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-ambiguous-retry", "access-a", prepared),
      sender,
      dependencies,
    );
    const leaving = background.dispatchPrivilegedRoomRuntimeMessage(
      departureMessage,
      sender,
      dependencies,
    );
    await waitForCall(requestDeparture);
    webAdmission.reject(new TypeError("Admission response was lost"));

    await expect(connecting).resolves.toMatchObject({ ok: false });
    await expect(leaving).resolves.toMatchObject({ ok: false });
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toMatchObject({
      roomId: "room-ambiguous-retry",
      ownerUserId: "user-a",
      participantSessionId: prepared.participantSessionId,
    });

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        departureMessage,
        sender,
        dependencies,
      ),
    ).resolves.toEqual({ ok: true, outcome: "departed" });
    expect(requestDeparture).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        roomId: "room-ambiguous-retry",
        ownerUserId: "user-a",
        participantSessionId: prepared.participantSessionId,
      }),
      "access-token-user-a",
      expect.any(AbortSignal),
    );
  });

  it("recovers a prepared retry identity after its first promotion write fails", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 88;
    const storage = createSessionStorage();
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => "failed-promotion-retry",
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-failed-promotion" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    const requestDeparture = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "already_departed" as const,
      })
      .mockResolvedValueOnce({
        kind: "retryable" as const,
        code: "ROOM_DEPARTURE_UNAVAILABLE" as const,
        message: "Departure is temporarily unavailable",
      })
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "departed" as const,
      });
    const dependencies = {
      admissionDepartureTimeoutMs: 100,
      departureDependencies: {
        getStoredSession: async () => sessionFor("user-a"),
        refreshSession: async () => null,
        requestDeparture,
        roomSessionDependencies,
        timeoutMs: 100,
      },
      roomDependencies: {
        issueAuthority: async () => null,
        roomSessionDependencies,
      },
    };
    const sender = { tab: { id: tabId } };
    const departureMessage = {
      type: "ANIDACHI_ROOM_DEPARTURE",
      command: "depart",
      roomId: "room-failed-promotion",
      expectedUserId: "user-a",
      participantSessionId: prepared.participantSessionId,
    } as const;
    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-failed-promotion", "access-a", prepared),
      sender,
      dependencies,
    );
    const leaving = background.dispatchPrivilegedRoomRuntimeMessage(
      departureMessage,
      sender,
      dependencies,
    );
    await waitForCall(requestDeparture);
    storage.failNextSet();
    webAdmission.reject(new TypeError("Admission response was lost"));

    await expect(connecting).resolves.toMatchObject({ ok: false });
    await expect(leaving).resolves.toMatchObject({ ok: false });
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toBeNull();

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        departureMessage,
        sender,
        dependencies,
      ),
    ).resolves.toEqual({ ok: true, outcome: "departed" });
    expect(requestDeparture).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        roomId: "room-failed-promotion",
        ownerUserId: "user-a",
        participantSessionId: prepared.participantSessionId,
      }),
      "access-token-user-a",
      expect.any(AbortSignal),
    );
  });

  it("does not overwrite a newer winner while retaining an ambiguous retry identity", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 87;
    const storage = createSessionStorage();
    let nextId = 0;
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => `ambiguous-replacement-${++nextId}`,
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-ambiguous-old" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    const cleanupResult = deferred<{
      kind: "retryable";
      code: "ROOM_DEPARTURE_UNAVAILABLE";
      message: string;
    }>();
    const requestDeparture = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "already_departed" as const,
      })
      .mockImplementationOnce(() => cleanupResult.promise);
    const dependencies = {
      admissionDepartureTimeoutMs: 100,
      departureDependencies: {
        getStoredSession: async () => sessionFor("user-a"),
        refreshSession: async () => null,
        requestDeparture,
        roomSessionDependencies,
        timeoutMs: 100,
      },
      roomDependencies: {
        issueAuthority: async () => null,
        roomSessionDependencies,
      },
    };
    const sender = { tab: { id: tabId } };
    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-ambiguous-old", "access-a", prepared),
      sender,
      dependencies,
    );
    const leaving = background.dispatchPrivilegedRoomRuntimeMessage(
      {
        type: "ANIDACHI_ROOM_DEPARTURE",
        command: "depart",
        roomId: "room-ambiguous-old",
        expectedUserId: "user-a",
        participantSessionId: prepared.participantSessionId,
      },
      sender,
      dependencies,
    );
    await waitForCall(requestDeparture);
    webAdmission.reject(new TypeError("Admission response was lost"));
    await waitForCallCount(requestDeparture, 2);

    const replacementPrepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-new-winner", forceNew: true },
      roomSessionDependencies,
    );
    const replacement = await confirmRoomSessionForTab(
      tabId,
      replacementPrepared,
      "room-new-winner",
      roomSessionDependencies,
    );
    if (!replacement) throw new Error("Expected replacement winner");
    cleanupResult.resolve({
      kind: "retryable",
      code: "ROOM_DEPARTURE_UNAVAILABLE",
      message: "Departure is temporarily unavailable",
    });

    await expect(connecting).resolves.toMatchObject({ ok: false });
    await expect(leaving).resolves.toMatchObject({ ok: false });
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toEqual(replacement);
    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        {
          type: "ANIDACHI_ROOM_DEPARTURE",
          command: "depart",
          roomId: "room-ambiguous-old",
          expectedUserId: "user-a",
          participantSessionId: prepared.participantSessionId,
        },
        sender,
        dependencies,
      ),
    ).resolves.toMatchObject({ ok: false });
    expect(requestDeparture).toHaveBeenCalledTimes(2);
  });

  it("does not consume a newer prepared candidate while recovering an old retry", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 89;
    const storage = createSessionStorage();
    let nextId = 0;
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => `prepared-winner-${++nextId}`,
    };
    const prepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-old-retry" },
      roomSessionDependencies,
    );
    const webAdmission = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => webAdmission.promise));
    const requestDeparture = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "ack" as const,
        outcome: "already_departed" as const,
      })
      .mockResolvedValueOnce({
        kind: "retryable" as const,
        code: "ROOM_DEPARTURE_UNAVAILABLE" as const,
        message: "Departure is temporarily unavailable",
      });
    const dependencies = {
      admissionDepartureTimeoutMs: 100,
      departureDependencies: {
        getStoredSession: async () => sessionFor("user-a"),
        refreshSession: async () => null,
        requestDeparture,
        roomSessionDependencies,
        timeoutMs: 100,
      },
      roomDependencies: {
        issueAuthority: async () => null,
        roomSessionDependencies,
      },
    };
    const sender = { tab: { id: tabId } };
    const connecting = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-old-retry", "access-a", prepared),
      sender,
      dependencies,
    );
    const leaving = background.dispatchPrivilegedRoomRuntimeMessage(
      {
        type: "ANIDACHI_ROOM_DEPARTURE",
        command: "depart",
        roomId: "room-old-retry",
        expectedUserId: "user-a",
        participantSessionId: prepared.participantSessionId,
      },
      sender,
      dependencies,
    );
    await waitForCall(requestDeparture);
    storage.failNextSet();
    webAdmission.reject(new TypeError("Admission response was lost"));
    await expect(connecting).resolves.toMatchObject({ ok: false });
    await expect(leaving).resolves.toMatchObject({ ok: false });

    const newerPrepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-prepared-winner", forceNew: true },
      roomSessionDependencies,
    );
    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        {
          type: "ANIDACHI_ROOM_DEPARTURE",
          command: "depart",
          roomId: "room-old-retry",
          expectedUserId: "user-a",
          participantSessionId: prepared.participantSessionId,
        },
        sender,
        dependencies,
      ),
    ).resolves.toMatchObject({ ok: false });
    expect(requestDeparture).toHaveBeenCalledTimes(2);

    const reusedWinner = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-prepared-winner" },
      roomSessionDependencies,
    );
    expect(reusedWinner.participantSessionId).not.toBe(
      newerPrepared.participantSessionId,
    );
  });

  it("cleans a superseded late admission without touching the newer winning session", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const tabId = 82;
    const storage = createSessionStorage();
    let nextId = 0;
    const roomSessionDependencies = {
      sessionStorage: storage,
      localStorage: storage,
      randomUUID: () => `superseded-${++nextId}`,
    };
    const oldPrepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-old", forceNew: true },
      roomSessionDependencies,
    );
    const oldAdmission = deferred<Response>();
    const newAdmission = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() => oldAdmission.promise)
        .mockImplementationOnce(() => newAdmission.promise),
    );
    const requestDeparture = vi.fn(async () => ({
      kind: "ack" as const,
      outcome: "stale" as const,
    }));
    const dependencies = {
      departureDependencies: {
        getStoredSession: async () => sessionFor("user-a"),
        refreshSession: async () => null,
        requestDeparture,
        roomSessionDependencies,
        timeoutMs: 100,
      },
      roomDependencies: {
        issueAuthority: async () => null,
        roomSessionDependencies,
      },
    };
    const sender = { tab: { id: tabId } };
    const older = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-old", "access-a", oldPrepared),
      sender,
      dependencies,
    );
    const newPrepared = await prepareRoomSessionForTab(
      tabId,
      { ownerUserId: "user-a", roomId: "room-new", forceNew: true },
      roomSessionDependencies,
    );
    const newer = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-new", "access-a", newPrepared),
      sender,
      dependencies,
    );

    newAdmission.resolve(roomResponse("room-new"));
    await expect(newer).resolves.toMatchObject({
      ok: true,
      connection: {
        roomSession: {
          roomId: "room-new",
          participantSessionId: newPrepared.participantSessionId,
        },
      },
    });
    oldAdmission.resolve(roomResponse("room-old"));
    await expect(older).resolves.toMatchObject({
      ok: false,
      code: "STALE_ROOM_SESSION",
      status: 409,
    });

    expect(requestDeparture).toHaveBeenCalledOnce();
    expect(requestDeparture).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-old",
        participantSessionId: oldPrepared.participantSessionId,
      }),
      "access-token-user-a",
      expect.any(AbortSignal),
    );
    await expect(
      loadRoomSessionForTab(tabId, roomSessionDependencies),
    ).resolves.toMatchObject({
      roomId: "room-new",
      participantSessionId: newPrepared.participantSessionId,
    });
  });

  it("routes a background-issued authority through connect, rejects a forgery, ends once, and rejects replay", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const storage = createSessionStorage();
		const endRoom = vi.fn(async () => ({
			endedAt: "2026-08-21T00:00:00.000Z",
		}));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
						roomToken: trustedRoomToken({
							sub: "user-a",
							roomId: "room-a",
							role: "host",
						}),
          }),
          { status: 200 },
        ),
      ),
    );
    const sender = { tab: { id: 61 } };
    const dependencies = {
      endRoom,
      intentDependencies: {
        sessionStorage: storage,
        getCurrentSession: async () => sessionFor("user-a"),
      },
      roomDependencies: {
        ...roomSessionRouteDependencies,
        authorityDependencies: {
          sessionStorage: storage,
          getStoredSession: async () => sessionFor("user-a"),
        },
      },
    };

    const connected = await background.dispatchPrivilegedRoomRuntimeMessage(
			connectRoomHttpMessage(
				"room-a",
				"access-a",
				preparedRoomSession("room-a"),
			),
      sender,
      dependencies,
    );
    expect(connected).toMatchObject({
      ok: true,
      connection: {
        privilegedRoomAuthority: {
          accountUserId: "user-a",
          roomId: "room-a",
          role: "host",
          authorityGeneration: 1,
        },
      },
    });
		const authority = (
			connected as { connection: { privilegedRoomAuthority: object } }
		).connection.privilegedRoomAuthority;

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: { ...authority, authorityGeneration: 2 },
        },
        sender,
        dependencies,
      ),
		).resolves.toEqual({
			ok: false,
			error: "Privileged overlay room authority is stale",
		});
    expect(endRoom).not.toHaveBeenCalled();

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: authority,
        },
        sender,
        dependencies,
      ),
    ).resolves.toEqual({ ok: true, endedAt: "2026-08-21T00:00:00.000Z" });
    expect(endRoom).toHaveBeenCalledOnce();

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: authority,
        },
        sender,
        dependencies,
      ),
		).resolves.toEqual({
			ok: false,
			error: "Privileged overlay room authority is stale",
		});
  });

  it("keeps the newest out-of-order room authority usable for manual and quota end", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
		const endRoom = vi.fn(async (roomId: string) => ({
			endedAt: `${roomId}-ended`,
		}));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const sender = { tab: { id: 62 } };

    for (const action of ["end-room", "quota-end-room"] as const) {
      const storage = createSessionStorage();
      const requestSequences = new Map<number, number>();
      const oldResponse = deferred<Response>();
      const newResponse = deferred<Response>();
			fetchMock
				.mockImplementationOnce(() => oldResponse.promise)
				.mockImplementationOnce(() => newResponse.promise);
      const dependencies = {
        endRoom,
        intentDependencies: {
          sessionStorage: storage,
          getCurrentSession: async () => sessionFor("user-a"),
        },
        roomDependencies: {
          ...roomSessionRouteDependencies,
          authorityRequestSequences: requestSequences,
          authorityDependencies: {
            sessionStorage: storage,
            getStoredSession: async () => sessionFor("user-a"),
          },
        },
      };
      const older = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(
          `room-old-${action}`,
          "access-a",
          preparedRoomSession(`room-old-${action}`),
        ),
        sender,
        dependencies,
      );
      const newer = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(
          `room-new-${action}`,
          "access-a",
          preparedRoomSession(`room-new-${action}`),
        ),
        sender,
        dependencies,
      );
      newResponse.resolve(roomResponse(`room-new-${action}`));
      const newest = await newer;
      oldResponse.resolve(roomResponse(`room-old-${action}`));
      const stale = await older;

			expect(stale).toMatchObject({
				ok: false,
				code: "STALE_ROOM_SESSION",
				status: 409,
			});
      expect(newest).toMatchObject({
        ok: true,
        connection: {
          privilegedRoomAuthority: {
            roomId: `room-new-${action}`,
            role: "host",
            authorityGeneration: 2,
          },
        },
      });
			const authority = (
				newest as { connection: { privilegedRoomAuthority: object } }
			).connection.privilegedRoomAuthority;

      await expect(
        background.dispatchPrivilegedRoomRuntimeMessage(
          {
            type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
            command: "invoke",
            action,
            context: { ...authority, roomId: `room-old-${action}` },
          },
          sender,
          dependencies,
        ),
			).resolves.toEqual({
				ok: false,
				error: "Privileged overlay room authority is stale",
			});
      await expect(
        background.dispatchPrivilegedRoomRuntimeMessage(
          {
            type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
            command: "invoke",
            action,
            context: authority,
          },
          sender,
          dependencies,
        ),
      ).resolves.toEqual({ ok: true, endedAt: `room-new-${action}-ended` });
      await expect(
        background.dispatchPrivilegedRoomRuntimeMessage(
          {
            type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
            command: "invoke",
            action,
            context: authority,
          },
          sender,
          dependencies,
        ),
			).resolves.toEqual({
				ok: false,
				error: "Privileged overlay room authority is stale",
			});
    }

		expect(endRoom).toHaveBeenNthCalledWith(
			1,
			"room-new-end-room",
			"access-token-user-a",
		);
		expect(endRoom).toHaveBeenNthCalledWith(
			2,
			"room-new-quota-end-room",
			"access-token-user-a",
		);
  });

  it("linearizes a superseding reservation with an older pending authority write", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const outcome of ["success", "failure"] as const) {
      const tabId = outcome === "success" ? 71 : 72;
      const storage = createPausedFirstWriteStorage();
      const dependencies = {
        roomDependencies: {
          ...roomSessionRouteDependencies,
          authorityDependencies: {
            sessionStorage: storage,
            getStoredSession: async () => sessionFor("user-a"),
          },
        },
      };
      fetchMock
				.mockImplementationOnce(() =>
					Promise.resolve(roomResponse(`room-old-${outcome}`)),
				)
        .mockImplementationOnce(() =>
          Promise.resolve(
            outcome === "success"
              ? roomResponse(`room-new-${outcome}`)
							: new Response(JSON.stringify({ error: "new request failed" }), {
									status: 500,
								}),
          ),
        );

      const older = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(
          `room-old-${outcome}`,
          "access-a",
          preparedRoomSession(`room-old-${outcome}`),
        ),
        { tab: { id: tabId } },
        dependencies,
      );
      await storage.firstWriteStarted;
      const newer = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(
          `room-new-${outcome}`,
          "access-a",
          preparedRoomSession(`room-new-${outcome}`),
        ),
        { tab: { id: tabId } },
        dependencies,
      );
      await waitForCallCount(fetchMock, outcome === "success" ? 2 : 4);
      expect(fetchMock).toHaveBeenCalledTimes(outcome === "success" ? 2 : 4);

      storage.releaseFirstWrite();
      const [oldResult, newResult] = await Promise.all([older, newer]);

			expect(oldResult).toMatchObject({
				ok: false,
				code: "STALE_ROOM_SESSION",
				status: 409,
			});
      if (outcome === "success") {
        expect(newResult).toMatchObject({
          ok: true,
					connection: {
						privilegedRoomAuthority: {
							roomId: "room-new-success",
							role: "host",
						},
					},
				});
				expect(storage.value()).toMatchObject({
					roomId: "room-new-success",
					role: "host",
        });
      } else {
        expect(newResult).toMatchObject({ ok: false, status: 500 });
        expect(storage.value()).toBeUndefined();
      }
    }
  });

  it("blocks invoke behind a superseding clear and does not finish a failed newer request early", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const storage = createPausableSessionStorage();
    const sender = { tab: { id: 73 } };
		const endRoom = vi.fn(async () => ({
			endedAt: "2026-08-21T00:00:00.000Z",
		}));
    const oldResponse = deferred<Response>();
    const failedResponseRead = deferred<void>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(roomResponse("room-active"))
      .mockImplementationOnce(() => oldResponse.promise)
      .mockResolvedValueOnce(failingRoomResponse(failedResponseRead))
      .mockResolvedValueOnce(roomResponse("room-after-failure"));
    vi.stubGlobal("fetch", fetchMock);
    const dependencies = {
      endRoom,
      intentDependencies: {
        sessionStorage: storage,
        getCurrentSession: async () => sessionFor("user-a"),
      },
      roomDependencies: {
        ...roomSessionRouteDependencies,
        authorityDependencies: {
          sessionStorage: storage,
          getStoredSession: async () => sessionFor("user-a"),
        },
      },
    };

    const connected = await background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage(
        "room-active",
        "access-a",
        preparedRoomSession("room-active"),
      ),
      sender,
      dependencies,
    );
    const activeAuthority = (
      connected as { connection: { privilegedRoomAuthority: object } }
    ).connection.privilegedRoomAuthority;

    const pausedMutation = storage.pauseNextMutation();
    const older = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage(
        "room-old-pending",
        "access-a",
        preparedRoomSession("room-old-pending"),
      ),
      sender,
      dependencies,
    );
    await pausedMutation.started;

    const newer = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage(
        "room-new-failed",
        "access-a",
        preparedRoomSession("room-new-failed"),
      ),
      sender,
      dependencies,
    );
    if (!newer) throw new Error("Expected newer room request to be routed");
    oldResponse.resolve(roomResponse("room-old-pending"));
    await failedResponseRead.promise;

    let newerSettled = false;
    void newer.then(() => {
      newerSettled = true;
    });
    const invoke = background.dispatchPrivilegedRoomRuntimeMessage(
      {
        type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
        command: "invoke",
        action: "end-room",
        context: activeAuthority,
      },
      sender,
      dependencies,
    );
    if (!invoke) throw new Error("Expected privileged invoke to be routed");
    let invokeSettled = false;
    void invoke.then(() => {
      invokeSettled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(endRoom).not.toHaveBeenCalled();
    expect(newerSettled).toBe(false);
    expect(invokeSettled).toBe(false);

    pausedMutation.release();
		const [oldResult, newResult, invokeResult] = await Promise.all([
			older,
			newer,
			invoke,
		]);

		expect(oldResult).toMatchObject({
			ok: false,
			code: "STALE_ROOM_SESSION",
			status: 409,
		});
    expect(newResult).toMatchObject({ ok: false, status: 500 });
    expect(invokeResult).toEqual({
      ok: false,
      error: "Privileged overlay room authority is stale",
    });
    expect(endRoom).not.toHaveBeenCalled();
    expect(storage.currentAuthority()).toBeNull();

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(
          "room-after-failure",
          "access-a",
          preparedRoomSession("room-after-failure"),
        ),
        sender,
        dependencies,
      ),
    ).resolves.toMatchObject({
      ok: true,
      connection: {
        privilegedRoomAuthority: {
          roomId: "room-after-failure",
          authorityGeneration: 4,
        },
      },
    });
  });

  it("does not reuse a same-room authority generation after restart-style storage re-read", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const storage = createSessionStorage();
    const sender = { tab: { id: 74 } };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(roomResponse("room-same"))
        .mockResolvedValueOnce(roomResponse("room-same")),
    );
    const dependencies = {
      roomDependencies: {
        ...roomSessionRouteDependencies,
        authorityDependencies: {
          sessionStorage: storage,
          getStoredSession: async () => sessionFor("user-a"),
        },
      },
    };

    const first = await background.dispatchPrivilegedRoomRuntimeMessage(
			connectRoomHttpMessage(
				"room-same",
				"access-a",
				preparedRoomSession("room-same"),
			),
      sender,
      dependencies,
    );
    const second = await background.dispatchPrivilegedRoomRuntimeMessage(
			connectRoomHttpMessage(
				"room-same",
				"access-a",
				preparedRoomSession("room-same"),
			),
      sender,
      dependencies,
    );
    const firstAuthority = (
			first as {
				connection: { privilegedRoomAuthority: Record<string, unknown> };
			}
    ).connection.privilegedRoomAuthority;
    const secondAuthority = (
			second as {
				connection: { privilegedRoomAuthority: Record<string, unknown> };
			}
    ).connection.privilegedRoomAuthority;

    vi.resetModules();
    const restartedIntent = await import("../src/privileged-overlay-intent");
		const endRoom = vi.fn(async () => ({
			endedAt: "2026-08-21T00:00:00.000Z",
		}));
		const replayResult =
			await restartedIntent.handlePrivilegedOverlayIntentMessage(
      {
        type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
        command: "invoke",
        action: "end-room",
        context: firstAuthority as never,
      },
      sender,
      {
        sessionStorage: storage,
        endRoom,
        getCurrentSession: async () => sessionFor("user-a"),
      },
    );

    expect({
      firstGeneration: firstAuthority.authorityGeneration,
      secondGeneration: secondAuthority.authorityGeneration,
      replayResult,
      endCalls: endRoom.mock.calls.length,
    }).toEqual({
      firstGeneration: 1,
      secondGeneration: 2,
			replayResult: {
				ok: false,
				error: "Privileged overlay room authority is stale",
			},
      endCalls: 0,
    });
  });
});

async function startSameIdentitySuccessorScenario() {
  vi.stubGlobal("chrome", {});
  const background = await import("../entrypoints/background");
  const tabId = 604;
  const roomId = "room-same-identity-successor";
  const sessionStorage = createSessionStorage();
  let nextId = 0;
  const roomSessionDependencies = {
    sessionStorage,
    localStorage: sessionStorage,
    randomUUID: () => `same-identity-${++nextId}`,
  };
  const oldPrepared = await prepareRoomSessionForTab(
    tabId,
    { ownerUserId: "user-a", roomId },
    roomSessionDependencies,
  );
  const oldAdmission = deferred<Response>();
  const newAdmission = deferred<Response>();
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(() => oldAdmission.promise)
    .mockImplementationOnce(() => newAdmission.promise);
  vi.stubGlobal("fetch", fetchMock);

  const retryStorage = createDepartureRetryStorage();
  const retryScheduler = createDepartureRetryScheduler();
  let now = 5_000;
  const departExact = vi.fn(async () => "departed" as const);
  const coordinator = createRoomDepartureRetryCoordinator({
    storage: retryStorage,
    scheduler: retryScheduler,
    getCurrentUserId: async () => "user-a",
    departExact,
    now: () => now,
  });
  const admissionFence = new RoomAdmissionFence();
  const roomDependencies = {
    admissionFence,
    renewCancelledAdmissionDepartureIntent: (
      identity: RoomDepartureRetryIdentity,
    ) => coordinator.renewAdmissionIntent(identity),
    requestCancelledAdmissionCleanup: coordinator.requestAdmissionCleanup,
    markAdmissionHandoff: coordinator.markAdmissionHandoff,
    settleCancelledAdmissionDeparture: coordinator.settleAdmission,
    retryCancelledAdmissionDeparture: coordinator.retryAdmission,
    issueAuthority: async () => null,
    roomSessionDependencies,
  };
  const sender = { tab: { id: tabId } };
  const older = background.dispatchPrivilegedRoomRuntimeMessage(
    connectRoomHttpMessage(roomId, "access-a", oldPrepared),
    sender,
    { roomDependencies },
  );
  await waitForCall(fetchMock);

  const newPrepared = await prepareRoomSessionForTab(
    tabId,
    { ownerUserId: "user-a", roomId },
    roomSessionDependencies,
  );
  expect(newPrepared.participantSessionId).not.toBe(
    oldPrepared.participantSessionId,
  );
  const newer = background.dispatchPrivilegedRoomRuntimeMessage(
    connectRoomHttpMessage(roomId, "access-a", newPrepared),
    sender,
    { roomDependencies },
  );
  await waitForCallCount(fetchMock, 2);

  return {
    admissionFence,
    advanceToSettlementHorizon() {
      now += 135_000;
      retryScheduler.consume();
    },
    coordinator,
    departExact,
    newAdmission,
    newPrepared,
    oldPrepared,
    newer,
    oldAdmission,
    older,
    retryStorage,
    roomId,
    roomSessionDependencies,
    tabId,
  };
}

function sessionFor(userId: string) {
  return {
    accessToken: `access-token-${userId}`,
    refreshToken: `refresh-token-${userId}`,
    user: {
      id: userId,
      email: `${userId}@example.com`,
      displayName: "User",
      avatarUrl: null,
      plan: "free" as const,
    },
  };
}

function admittedHandoff(value: unknown): RoomAdmissionHandoff {
  const handoff = (
    value as { connection?: { admissionHandoff?: RoomAdmissionHandoff } }
  ).connection?.admissionHandoff;
  if (!handoff) throw new Error("Expected admission handoff");
  return handoff;
}

function trustedRoomToken(payload: Record<string, unknown>): string {
  return `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ typ: "room", ...payload }))}.signature`;
}

function roomResponse(roomId: string): Response {
  return new Response(
    JSON.stringify({ roomToken: trustedRoomToken({ sub: "user-a", roomId, role: "host" }) }),
    { status: 200 },
  );
}

function failingRoomResponse(read: ReturnType<typeof deferred<void>>): Response {
  return {
    ok: false,
    status: 500,
    async json() {
      read.resolve();
      return { error: "new request failed" };
    },
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

async function waitForCall(mock: { mock: { calls: unknown[][] } }): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (mock.mock.calls.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for the exact departure request");
}

async function waitForCallCount(
  mock: { mock: { calls: unknown[][] } },
  count: number,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (mock.mock.calls.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${count} exact departure requests`);
}

function createSessionStorage() {
  const values = new Map<string, unknown>();
  let failSet = false;
  return {
    failNextSet() {
      failSet = true;
    },
    async get(key: string) {
      return values.has(key) ? { [key]: values.get(key) } : {};
    },
    async set(items: Record<string, unknown>) {
      if (failSet) {
        failSet = false;
        throw new Error("Session storage write failed");
      }
      for (const [key, value] of Object.entries(items)) values.set(key, value);
    },
    async remove(key: string) {
      values.delete(key);
    },
  };
}

function createDepartureRetryStorage() {
  let stored: {
    version: number;
    lastGeneration?: number;
    jobs: Array<Record<string, unknown>>;
  } | null = null;
  return {
    async read() {
      return stored;
    },
    async write(value: {
      version: number;
      lastGeneration?: number;
      jobs: Array<Record<string, unknown>>;
    }) {
      stored = structuredClone(value);
    },
    async clear() {
      stored = null;
    },
    value() {
      return stored;
    },
  };
}

function createDepartureRetryScheduler() {
  let scheduledAt: number | null = null;
  return {
    async replace(when: number | null) {
      scheduledAt = when;
    },
    consume() {
      scheduledAt = null;
    },
  };
}

function createPausableSessionStorage() {
  const values = new Map<string, unknown>();
  let nextPause:
    | {
        started: ReturnType<typeof deferred<void>>;
        released: ReturnType<typeof deferred<void>>;
      }
    | undefined;

  const beforeMutation = async () => {
    const pause = nextPause;
    if (!pause) return;
    nextPause = undefined;
    pause.started.resolve();
    await pause.released.promise;
  };

  return {
    pauseNextMutation() {
      const started = deferred<void>();
      const released = deferred<void>();
      nextPause = { started, released };
      return {
        started: started.promise,
        release: () => released.resolve(),
      };
    },
    currentAuthority() {
      const value = values.values().next().value;
      if (
        typeof value === "object" &&
        value !== null &&
        "currentAuthority" in value
      ) {
        return (value as { currentAuthority?: unknown }).currentAuthority ?? null;
      }
      return value ?? null;
    },
    async get(key: string) {
      return values.has(key) ? { [key]: values.get(key) } : {};
    },
    async set(items: Record<string, unknown>) {
      await beforeMutation();
      for (const [key, value] of Object.entries(items)) values.set(key, value);
    },
    async remove(key: string) {
      await beforeMutation();
      values.delete(key);
    },
  };
}

function createPausedFirstWriteStorage() {
  const values = new Map<string, unknown>();
  let releaseFirstWrite!: () => void;
  let signalFirstWrite!: () => void;
  let firstWrite = true;
  const firstWriteStarted = new Promise<void>((resolve) => {
    signalFirstWrite = resolve;
  });
  const firstWriteReleased = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve;
  });
  return {
    firstWriteStarted,
    releaseFirstWrite,
    value: () => {
      const value = values.values().next().value;
      if (typeof value === "object" && value !== null && "currentAuthority" in value) {
        return (value as { currentAuthority?: unknown }).currentAuthority ?? undefined;
      }
      return value;
    },
    async get(key: string) {
      return values.has(key) ? { [key]: values.get(key) } : {};
    },
    async set(items: Record<string, unknown>) {
      if (firstWrite) {
        firstWrite = false;
        signalFirstWrite();
        await firstWriteReleased;
      }
      for (const [key, value] of Object.entries(items)) values.set(key, value);
    },
    async remove(key: string) {
      values.delete(key);
    },
  };
}
