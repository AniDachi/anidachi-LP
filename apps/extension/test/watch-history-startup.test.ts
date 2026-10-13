import { describe, expect, it, vi } from "vitest";
import { createWatchHistoryLease } from "../src/watch-history-access";
import { createWatchHistoryClient, parseWatchHistoryBootstrapData } from "../src/watch-history-client";
import { createWatchHistoryController } from "../src/watch-history-controller";
import { invalidateWatchHistoryOnAuthStorageChange } from "../src/watch-history-runtime-policy";
import { bindWatchHistoryPreferenceListener } from "../src/watch-history-preference-listener";
import { bindWatchHistoryPlaybackListeners } from "../src/watch-history-listeners";
import { createWatchHistoryStorage, watchHistoryPartitionKey, type WatchHistoryStorageRoot, WATCH_HISTORY_STORAGE_KEY } from "../src/watch-history-storage";

const owner = "00000000-0000-4000-8000-000000000001";
const session = {
  accessToken: "startup-access", refreshToken: "startup-refresh",
  user: { id: owner, email: "test@example.com", displayName: "Test", avatarUrl: null, plan: "plus" as const },
};

function fixture(options: { warm?: boolean; state?: "allowed" | "plan_required"; youtubeEnabled?: boolean; paused?: boolean; recording?: boolean; unavailable?: boolean; hold?: boolean; notifications?: boolean; attestation?: "cache" | "absent" } = {}) {
  let time = Date.parse("2026-10-14T00:00:00Z");
  let requests = 0;
  let recording = options.recording ?? true;
  let current = session;
  let unavailable = options.unavailable ?? false;
  let release: (() => void) | undefined;
  const gate = options.hold ? new Promise<void>(resolve => { release = resolve; }) : Promise.resolve();
  const access = () => ({
    accessVersion: 1, ownerUserId: owner, accountGeneration: 1, accessEpoch: 1,
    youtubeConsentEpoch: 1, state: options.state ?? "allowed",
    serverTime: new Date(time).toISOString(), captureNotBefore: new Date(time - 1_000).toISOString(),
    validUntil: new Date(time + 300_000).toISOString(), youtubeHistoryEnabled: options.youtubeEnabled ?? true,
  });
  let stored: WatchHistoryStorageRoot = { schemaVersion: 3, partitions: {}, activeGenerations: {} };
  if (options.warm) stored = {
    schemaVersion: 3, activeGenerations: { [owner]: 1 },
    partitions: { [watchHistoryPartitionKey(owner, 1)]: {
      ownerUserId: owner, accountGeneration: 1,
      accessLease: createWatchHistoryLease(access(), owner, time, time), cache: null,
      preferences: { youtubeHistoryEnabled: options.youtubeEnabled ?? true },
      preferencesConfirmed: true, captureMarkersReady: true, currentObservation: null,
      capturePaused: options.paused ?? false,
      outbox: { ownerUserId: owner, accountGeneration: 1, entries: [] },
    } },
  };
  const listeners = new Set<(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void>();
  const storage = createWatchHistoryStorage({
    item: { getValue: async () => structuredClone(stored), setValue: async value => {
      const oldValue = stored;
      stored = structuredClone(value);
      if (options.notifications) for (const listener of listeners) listener({ [WATCH_HISTORY_STORAGE_KEY]: { oldValue, newValue: stored } }, "local");
    } },
    getBytesInUse: async () => 0, quotaBytes: 1_000_000,
  });
  const client = createWatchHistoryClient({
    now: () => time, getCurrentSession: async () => current, hasRecordingConsent: async () => recording,
    recordingContextRevision: () => 0, storage,
    fetch: async input => {
      expect(new URL(String(input)).pathname).toBe("/api/watch-history/v3/access");
      requests++;
      await gate;
      return unavailable ? Response.json({ code: "HISTORY_UNAVAILABLE" }, { status: 503 }) : Response.json(access());
    },
  });
  const load = async (command: "bootstrap" | "bootstrap-cache") => {
    const response = await client.handle({ type: "ANIDACHI_WATCH_HISTORY_V3", command, expectedOwnerUserId: owner });
    const parsed = response.ok ? parseWatchHistoryBootstrapData(response.data) : null;
    return parsed ? { ...parsed, recordingEnabled: recording,
      ...(options.attestation ? { source: options.attestation === "cache" ? "cache" as const : undefined } : {}),
    } : null;
  };
  let storageRecoveries = 0;
  const controller = createWatchHistoryController({
    now: () => time, isOwnerCurrent: expected => current.user.id === expected,
    getProvider: () => options.youtubeEnabled === false ? "youtube" : "crunchyroll",
    getObservation: () => null, getRoomActive: () => false,
    loadRecordingChoice: async () => ({ ownerUserId: owner, enabled: recording }),
    loadCachedPreferences: () => load("bootstrap-cache"), loadPreferences: () => load("bootstrap"),
    recoverCapture: async () => {
      storageRecoveries++;
      await client.handle({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "recover-storage" });
      return load("bootstrap");
    },
    observeLocally: async () => ({ ok: true }), isPlaying: () => false, isSeeking: () => false,
  });
  bindWatchHistoryPreferenceListener({ ownerUserId: owner, controller,
    hasRecordingConsent: async () => recording,
    onChanged: { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener) },
  });
  // This is the startup phase in overlay-app. Explicit online recovery below
  // intentionally uses recover() without this one-use startup option.
  const recoverStartup = () => controller.recover({ startup: true });
  return { controller, recoverStartup, requests: () => requests, storageRecoveries: () => storageRecoveries,
    advance: (ms: number) => { time += ms; }, release: () => release?.(),
    setUnavailable: (value: boolean) => { unavailable = value; },
    replaceOwner: () => { current = { ...session, user: { ...session.user, id: "00000000-0000-4000-8000-000000000002" } }; },
    revokeRecording: () => { recording = false; controller.setRecordingEnabled(false); },
    localPreferenceChange: async () => {
      const loaded = await load("bootstrap-cache");
      if (!loaded) throw new Error("missing fixture partition");
      await controller.applyLocalPreferences({ ...loaded, preferences: { youtubeHistoryEnabled: false } });
    },
    replaceAuthority: async (change: "generation" | "consent") => {
      const loaded = await load("bootstrap-cache");
      if (!loaded?.accessLease) throw new Error("missing fixture lease");
      if (change === "generation") {
        loaded.accountGeneration = 2;
        loaded.accessLease.access.accountGeneration = 2;
      } else {
        loaded.accessLease.access.youtubeConsentEpoch = 2;
        loaded.accessLease.access.youtubeHistoryEnabled = false;
        loaded.preferences.youtubeHistoryEnabled = false;
      }
      await controller.applyLocalPreferences(loaded);
    },
    publishSemanticStorageChange: async (change: "generation" | "access epoch" | "consent" | "local revision") => {
      const previous = await storage.readRoot();
      const next = structuredClone(previous);
      const partition = next.partitions[watchHistoryPartitionKey(owner, 1)];
      if (!partition?.accessLease) throw new Error("missing fixture lease");
      if (change === "generation") {
        partition.accountGeneration = 2;
        partition.accessLease.access.accountGeneration = 2;
        next.activeGenerations![owner] = 2;
        next.partitions[watchHistoryPartitionKey(owner, 2)] = partition;
      } else if (change === "access epoch") partition.accessLease.access.accessEpoch = 2;
      else if (change === "consent") partition.accessLease.access.youtubeConsentEpoch = 2;
      else partition.preferencesLocalRevision = 1;
      stored = next;
      for (const listener of listeners) listener({ [WATCH_HISTORY_STORAGE_KEY]: { oldValue: previous, newValue: next } }, "local");
      // The listener awaits local recording consent before applying authority.
      await Promise.resolve();
    },
    storage,
  };
}

describe("history startup validation reuse at the access network boundary", () => {
  it.each(["allowed", "plan_required"] as const)("uses one fresh request for cold %s startup and forces later recovery", async state => {
    const f = fixture({ state });
    await f.controller.start();
    await f.recoverStartup();
    expect(f.requests()).toBe(1);
    await f.controller.recover();
    expect(f.requests()).toBe(2);
  });

  it.each(["allowed", "plan_required"] as const)("uses one cold %s access request with the real storage preference listener", async state => {
    const f = fixture({ state, notifications: true });
    await f.controller.start();
    await f.recoverStartup();
    expect(f.requests()).toBe(1);
  });

  it("reuses a warm renewal despite self-origin storage change notifications", async () => {
    const f = fixture({ warm: true, notifications: true });
    f.advance(1_000);
    await f.controller.start();
    await f.recoverStartup();
    expect(f.requests()).toBe(1);
  });

  it("awaits the warm startup request before consuming its successful validation", async () => {
    const f = fixture({ warm: true, hold: true });
    await f.controller.start();
    await vi.waitFor(() => expect(f.requests()).toBe(1));
    let completed = false;
    const recovering = f.recoverStartup().then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    f.release();
    await recovering;
    expect(f.requests()).toBe(1);
    await f.recoverStartup();
    expect(f.requests()).toBe(2);
  });

  it.each(["negative", "youtube opt-out", "storage paused"] as const)("requires a fresh validation for warm %s state", async state => {
    const f = fixture({ warm: true, state: state === "negative" ? "plan_required" : "allowed",
      youtubeEnabled: state !== "youtube opt-out", paused: state === "storage paused" });
    await f.controller.start();
    expect(f.requests()).toBe(0);
    await f.recoverStartup();
    expect(f.requests()).toBe(state === "storage paused" ? 2 : 1);
    expect(f.storageRecoveries()).toBe(state === "storage paused" ? 1 : 0);
  });

  it("preserves local recording OFF with no validation or capture recovery", async () => {
    const f = fixture({ warm: true, recording: false, paused: true });
    await f.controller.start();
    await f.recoverStartup();
    expect(f.requests()).toBe(0);
    expect(f.storageRecoveries()).toBe(0);
  });

  it("retries startup failure instead of treating retained cache as validation", async () => {
    const f = fixture({ unavailable: true });
    await f.controller.start();
    expect(f.requests()).toBe(1);
    f.setUnavailable(false);
    await f.recoverStartup();
    expect(f.requests()).toBe(2);
  });

  it.each(["cache", "absent"] as const)("refreshes when the bootstrap adapter returns %s network attestation", async attestation => {
    const f = fixture({ attestation });
    await f.controller.start();
    await f.recoverStartup();
    expect(f.requests()).toBe(2);
  });

  it("does not reuse an expired startup lease or extend its deadline", async () => {
    const f = fixture();
    await f.controller.start();
    const before = await f.storage.readRoot();
    const lease = before.partitions[watchHistoryPartitionKey(owner, 1)].accessLease!;
    f.advance(300_000);
    expect(lease.expiresAt).toBe(Date.parse("2026-10-14T00:05:00Z"));
    await f.recoverStartup();
    expect(f.requests()).toBe(2);
  });

  it.each(["access invalidation", "local choice"] as const)("does not reuse validation after %s changes", async change => {
    const f = fixture();
    await f.controller.start();
    if (change === "access invalidation") f.controller.invalidateCaptureAuthority();
    else await f.localPreferenceChange();
    await f.recoverStartup();
    expect(f.requests()).toBe(2);
  });

  it.each(["generation", "consent"] as const)("does not reuse startup validation after same-owner %s replacement", async change => {
    const f = fixture();
    await f.controller.start();
    await f.replaceAuthority(change);
    await f.recoverStartup();
    expect(f.requests()).toBe(2);
  });

  it.each(["generation", "access epoch", "consent", "local revision"] as const)("forces fresh validation after a storage %s change", async change => {
    const f = fixture({ notifications: true });
    await f.controller.start();
    await f.publishSemanticStorageChange(change);
    await f.recoverStartup();
    expect(f.requests()).toBe(2);
  });

  it("rejects a delayed startup validation for a replaced account", async () => {
    const f = fixture({ hold: true });
    const starting = f.controller.start();
    await vi.waitFor(() => expect(f.requests()).toBe(1));
    f.replaceOwner();
    f.release();
    await starting;
    await f.recoverStartup();
    expect((await f.storage.readRoot()).activeGenerations?.[owner]).toBeUndefined();
    expect(f.requests()).toBe(1);
  });

  it("does not revive recording after revocation during the startup request", async () => {
    const f = fixture({ hold: true });
    const starting = f.controller.start();
    await vi.waitFor(() => expect(f.requests()).toBe(1));
    f.revokeRecording();
    f.release();
    await starting;
    await f.recoverStartup();
    await f.controller.observe("heartbeat");
    expect(f.requests()).toBe(1);
    expect(f.storageRecoveries()).toBe(0);
  });

  it("stops startup recovery when recording is revoked while it awaits validation", async () => {
    const f = fixture({ warm: true, hold: true });
    await f.controller.start();
    await vi.waitFor(() => expect(f.requests()).toBe(1));
    const recovering = f.recoverStartup();
    f.revokeRecording();
    f.release();
    await recovering;
    expect(f.requests()).toBe(1);
    expect(f.storageRecoveries()).toBe(0);
  });

  it("fences same-owner same-credential logout/login before async identity hydration", async () => {
    const f = fixture({ warm: true, hold: true });
    await f.controller.start();
    await vi.waitFor(() => expect(f.requests()).toBe(1));
    const before = { ...session, authRevision: "revision-before" };
    const tombstone = { authRevision: "revision-logout" };
    const after = { ...session, authRevision: "revision-after" };
    invalidateWatchHistoryOnAuthStorageChange(f.controller, tombstone, before);
    invalidateWatchHistoryOnAuthStorageChange(f.controller, after, tombstone);
    f.release();
    await f.recoverStartup();
    expect(f.requests()).toBe(2);
  });

  it("keeps a startup validation current through metadata-only auth storage notifications", async () => {
    const f = fixture();
    await f.controller.start();
    const before = { ...session, authRevision: "revision-same" };
    const after = { ...before, user: { ...before.user, displayName: "Renamed" } };
    invalidateWatchHistoryOnAuthStorageChange(f.controller, after, before);
    await f.recoverStartup();
    expect(f.requests()).toBe(1);
  });

  it("forces a fresh validation on the real online listener after startup", async () => {
    const f = fixture();
    await f.controller.start();
    await f.recoverStartup();
    const remove = bindWatchHistoryPlaybackListeners({ video: document.createElement("video"), controller: f.controller });
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(f.requests()).toBe(2));
    remove();
  });
});
