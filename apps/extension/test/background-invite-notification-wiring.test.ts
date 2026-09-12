import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  restore: vi.fn<() => Promise<boolean>>(),
  reconcile: vi.fn(), retryAlarm: vi.fn(), maintenance: vi.fn(),
  website: vi.fn(), history: vi.fn(), departures: vi.fn(),
}));
vi.mock("wxt/utils/define-background", () => ({ defineBackground: (main: () => void) => main }));
vi.mock("../src/room-invite-notifications", async (original) => ({
  ...await original<object>(),
  restoreRoomInviteNotificationRetries: boundary.restore,
  reconcileRoomInviteNotifications: boundary.reconcile,
  handleRoomInviteNotificationRetryAlarm: boundary.retryAlarm,
  createRoomInviteNotificationMaintenanceAlarm: boundary.maintenance,
}));
vi.mock("../src/auth-client", async (original) => ({
  ...await original<object>(), reconcileExtensionSessionAgainstWebsite: boundary.website,
}));
vi.mock("../src/watch-history-client", async (original) => ({
  ...await original<object>(), flushWatchHistoryInBackground: boundary.history,
}));
vi.mock("../src/room-departure-retry", async (original) => ({
  ...await original<object>(), drainRoomDepartureRetries: boundary.departures,
}));

const handlers = new Map<string, (...args: any[]) => void>();
const listener = (name: string) => ({ addListener: (handler: (...args: any[]) => void) => handlers.set(name, handler) });
async function flush() { await new Promise((resolve) => setTimeout(resolve, 0)); }
async function start() {
  const background = await import("../entrypoints/background");
  (background.default as unknown as () => void)();
  await flush();
}

beforeEach(() => {
  vi.resetModules();
  handlers.clear();
  for (const mock of Object.values(boundary)) mock.mockReset().mockResolvedValue(undefined);
  boundary.restore.mockResolvedValue(false);
  vi.stubGlobal("self", { addEventListener: (name: string, handler: (...args: any[]) => void) => handlers.set(name, handler) });
  vi.stubGlobal("chrome", {
    runtime: { onMessage: listener("message"), onStartup: listener("startup"), onInstalled: listener("installed") },
    storage: { onChanged: listener("storage") },
    permissions: { onRemoved: listener("permissions") },
    alarms: { onAlarm: listener("alarm") },
    tabs: { onRemoved: listener("tabRemoved") },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("background invitation retry wiring", () => {
  it("restores saved work on module start and online, without creating new external reconciliation", async () => {
    await start();
    expect(boundary.restore).toHaveBeenCalledOnce();
    expect(boundary.reconcile).not.toHaveBeenCalled();
    handlers.get("online")!();
    await flush();
    expect(boundary.restore).toHaveBeenCalledTimes(2);
    expect(boundary.reconcile).not.toHaveBeenCalled();
    expect(boundary.maintenance).toHaveBeenCalledOnce();
  });

  it("routes one-shot recovery separately from daily catch-up and ignores unrelated alarms", async () => {
    await start();
    handlers.get("alarm")!({ name: "unrelated" });
    handlers.get("alarm")!({ name: "anidachi-room-invite-notifications-retry" });
    await flush();
    expect(boundary.retryAlarm).toHaveBeenCalledWith("anidachi-room-invite-notifications-retry");
    expect(boundary.reconcile).not.toHaveBeenCalled();
    handlers.get("alarm")!({ name: "anidachi-room-invite-notifications" });
    await flush();
    expect(boundary.reconcile).toHaveBeenCalledWith({ notify: true });
  });

  it("restores browser-startup work before a hung website auth probe without promoting a saved silent intent", async () => {
    boundary.restore.mockResolvedValueOnce(true).mockResolvedValue(false);
    boundary.website.mockImplementation(() => new Promise(() => {}));
    await start();
    handlers.get("startup")!();
    await flush();
    expect(boundary.restore).toHaveBeenCalledTimes(2);
    expect(boundary.website).toHaveBeenCalledOnce();
    expect(boundary.reconcile).not.toHaveBeenCalled();
  });

  it("does not upgrade saved registration-only work after website auth succeeds", async () => {
    boundary.restore.mockResolvedValueOnce(true).mockResolvedValue(false);
    await start();
    handlers.get("startup")!();
    await flush();
    expect(boundary.website).toHaveBeenCalledOnce();
    expect(boundary.reconcile).not.toHaveBeenCalled();
  });

  it("preserves browser-startup catch-up alerts when no saved intent exists", async () => {
    await start();
    handlers.get("startup")!();
    await flush();
    expect(boundary.restore).toHaveBeenCalledTimes(2);
    expect(boundary.reconcile).toHaveBeenCalledWith({ notify: true });
  });
});
