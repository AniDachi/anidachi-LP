import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("wxt/utils/storage", () => ({ storage: {
  getItem: async (key: string) => store.get(key) ?? null,
  setItem: async (key: string, value: unknown) => { store.set(key, value); },
  removeItem: async (key: string) => { store.delete(key); },
  watch: () => () => {},
} }));
// History has independent read/capture leases, tested with its real background elsewhere.
vi.mock("../src/popup-watch-history", () => ({ PopupWatchHistoryPanel: () => null }));
import { PopupApp } from "../src/popup-app";
import { AUTH_TOKENS_KEY, AUTH_TOKENS_STORAGE_KEY, type ExtensionAuthTokens } from "../src/auth-tokens";
import type { HostingAccountAccess } from "../src/hosting-access-client";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>();
let root: Root, container: HTMLDivElement;
let read: ReturnType<typeof vi.fn<(owner: string) => Promise<HostingAccountAccess>>>;
const tokens = (owner = A): ExtensionAuthTokens => ({ accessToken: owner, refreshToken: `login-${owner}`,
  user: { id: owner, email: "viewer@example.com", displayName: "Viewer", avatarUrl: null, plan: "free" } });
const access = (plan: HostingAccountAccess["planCode"], owner = A): HostingAccountAccess => ({
  entitlementsVersion: 1, ownerUserId: owner, serverTime: "2026-10-01T05:00:00Z", planCode: plan,
  hosting: { hostingPolicyVersion: 2, hostingActivationAt: "2026-09-28T00:00:00Z",
    canHost: plan !== "free", trialEligibility: "used", trialEndsAt: "2026-10-01T02:00:00Z" },
});
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
async function settle() { await act(async () => { await new Promise(r => setTimeout(r, 0)); }); }
async function mount() { await act(async () => root.render(<PopupApp />)); await settle(); }
async function changeSession(session: ExtensionAuthTokens | null) {
  store.set(AUTH_TOKENS_KEY, session);
  await act(async () => {
    for (const listener of listeners) listener({ [AUTH_TOKENS_STORAGE_KEY]: { newValue: session } }, "local");
  });
  await settle();
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); store.clear(); listeners.clear(); store.set(AUTH_TOKENS_KEY, tokens());
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  read = vi.fn(async owner => access("free", owner));
  vi.stubGlobal("chrome", {
    storage: { local: { get: async () => ({}) }, onChanged: { addListener: (fn: any) => listeners.add(fn), removeListener: (fn: any) => listeners.delete(fn) } },
    action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async () => {} },
    runtime: { sendMessage: vi.fn(async (message: any) => {
      if (message.type === "ANIDACHI_AUTH") return { ok: true, tokens: store.get(AUTH_TOKENS_KEY) };
      if (message.type === "ANIDACHI_HOSTING_ACCESS") return { ok: true, access: await read(message.ownerUserId) };
      if (message.command === "list-social-directory") return { ok: true, directory: { friends: [], incomingRequests: [], outgoingRequests: [], groups: [], recentPeople: [] } };
      if (message.command === "list-invites") return { ok: true, invites: { meta: { serverTime: access("free").serverTime, schemaVersion: 1 }, inbox: [], sent: [] } };
      return { ok: false };
    }) },
  });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Popup current account plan", () => {
  it("does not retain a cached paid badge after server access becomes Free or unavailable", async () => {
    const cached = tokens(); cached.user.plan = "pro"; store.set(AUTH_TOKENS_KEY, cached);
    await mount();
    expect(container.querySelector(".plan-badge")?.textContent).toBe("Free");
    expect(container.textContent).not.toContain("Save your watch progress?");
    read.mockRejectedValueOnce(new Error("offline"));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(container.querySelector(".plan-badge")).toBeNull();
  });
  it("uses an older server's plan without inventing hosting metadata", async () => {
    read.mockResolvedValue({ ...access("plus"), hosting: undefined });
    await mount();
    expect(container.querySelector(".plan-badge")?.textContent).toBe("Plus");
    expect(container.textContent).not.toContain("3-day free trial");
  });
  it("updates the badge and recording invitation from effective access instead of the cached login plan", async () => {
    read.mockResolvedValue(access("plus"));
    await mount();
    expect(container.querySelector(".plan-badge")?.textContent).toBe("Plus");
    expect(container.textContent).toContain("Save your watch progress?");
    for (const plan of ["pro", "free", "plus"] as const) {
      const pending = deferred<HostingAccountAccess>(); read.mockReturnValueOnce(pending.promise);
      await act(async () => window.dispatchEvent(new Event("focus")));
      expect(container.querySelector(".plan-badge")).toBeNull();
      expect(container.textContent).not.toContain("Save your watch progress?");
      await act(async () => pending.resolve(access(plan)));
      expect(container.querySelector(".plan-badge")?.textContent?.toLowerCase()).toBe(plan);
      expect(container.textContent?.includes("Save your watch progress?")).toBe(plan !== "free");
    }
    read.mockRejectedValueOnce(new Error("offline"));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(container.querySelector(".plan-badge")).toBeNull();
    expect(container.textContent).not.toContain("Save your watch progress?");
    expect(vi.mocked(chrome.runtime.sendMessage).mock.calls.some(([m]: any) => m.command === "create-room")).toBe(false);
  });
  it.each(["account", "same-owner-login", "logout"] as const)("retires a pending plan read after %s", async change => {
    const old = deferred<HostingAccountAccess>(), fresh = deferred<HostingAccountAccess>();
    read.mockReturnValueOnce(old.promise).mockReturnValue(fresh.promise);
    await mount();
    expect(read).toHaveBeenCalledOnce();
    await changeSession(change === "logout" ? null : change === "account" ? tokens(B) : { ...tokens(), refreshToken: "new-login" });
    await act(async () => old.resolve(access("pro")));
    expect(container.querySelector(".plan-badge")).toBeNull();
    expect(container.textContent).not.toContain("Save your watch progress?");
    if (change !== "logout") {
      await act(async () => fresh.resolve(access("plus", change === "account" ? B : A)));
      expect(container.querySelector(".plan-badge")?.textContent).toBe("Plus");
    }
  });
});
