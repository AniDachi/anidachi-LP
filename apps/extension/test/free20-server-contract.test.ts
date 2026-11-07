// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "../../web/node_modules/next/server";
import { ACCOUNT_HOSTING_OWNER_HEADER, FREE20_CONTEXT_HEADER } from "@anidachi/protocol";
import { createFree20ContextHandler } from "../../web/lib/anidachi-auth/free20-abuse-routes";
import { createFree20AbuseTokens, Free20ContextError, type Free20AbuseContext } from "../../web/lib/anidachi-auth/free20-abuse";
import { createTrialAbuseTokens, trialBrowserCookieName } from "../../web/lib/anidachi-auth/trial-abuse";
import { createAccountHostingStatusHandler } from "../../web/lib/anidachi-auth/account-hosting-status";
import { createFree20AbuseClient } from "../src/free20-abuse-client";
import { createInstallationSigners } from "../src/trial-installation";
import { handleAccountHostingStatusMessage } from "../src/account-hosting-status-client";
import { connectWebsiteRoomFromApi, createWebsiteRoomFromApi } from "../src/room-client";
import type { ExtensionAuthTokens } from "../src/auth-tokens";

const origin = "http://localhost:3003";
const ownerA = "11111111-1111-4111-8111-111111111111", ownerB = "22222222-2222-4222-8222-222222222222";
const auth = (owner: string): ExtensionAuthTokens => ({ authSessionId: `login-${owner}`, authRevision: `revision-${owner}`, accessToken: `access-${owner}`, refreshToken: `refresh-${owner}`, user: { id: owner, email: "test@example.invalid", displayName: "Fixture", avatarUrl: null, plan: "free" } });
function fixture() {
  const tokens = createFree20AbuseTokens("synthetic-test-only-secret", origin);
  const browserTokens = createTrialAbuseTokens("synthetic-test-only-secret", origin);
  let session = auth(ownerA), saved: unknown = null, cookieBlocked = false;
  const jar = new Map<string, string>(), scopes: Free20AbuseContext[] = [], enrollments: string[] = [];
  // SQL is deliberately a fixture: actual Web proof/response/status logic and
  // the background/consumer chain run here; SQL ledger concurrency is separate.
  const committed = new Map<string, number>();
  const getSession = async (request: NextRequest) => request.headers.get("authorization") === `Bearer ${session.accessToken}`
    ? { userId: session.user.id, email: session.user.email, plan: session.user.plan, source: "extension" as const } : null;
  const enroll = createFree20ContextHandler({ enabled: () => true, siteOrigin: () => origin, extensionId: () => "a".repeat(32), getSession, allowRequest: async () => true, tokens: () => tokens, browserTokens: () => browserTokens });
  const transport = async (url: URL, init: RequestInit): Promise<Response> => {
    const headers = new Headers(init.headers);
    expect(headers.has("origin")).toBe(false);
    expect(headers.get(ACCOUNT_HOSTING_OWNER_HEADER)).toBe(session.user.id);
    if (init.credentials === "include" && !cookieBlocked) headers.set("cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
    const req = new NextRequest(url, { ...init, signal: init.signal ?? undefined, headers: Object.fromEntries(headers) });
    if (url.pathname.endsWith("free20-context")) {
      expect(init.credentials).toBe("include");
      enrollments.push(JSON.parse(String(init.body)).action);
      if (JSON.parse(String(init.body)).action === "complete" && !cookieBlocked) expect(browserTokens.readCookie(req.cookies.get(trialBrowserCookieName(origin))?.value)).toBeTruthy();
      const response = await enroll(req);
      if (!cookieBlocked) for (const cookie of response.cookies.getAll()) jar.set(cookie.name, cookie.value);
      return response;
    }
    const context = tokens.readContext(headers.get(FREE20_CONTEXT_HEADER) ?? undefined, session.user.id);
    if (url.pathname.endsWith("hosting-status")) {
      return createAccountHostingStatusHandler({ enabled: () => true, getSession, clock: () => 0,
        readAuthority: async owner => {
          if (!context) throw new Free20ContextError();
          scopes.push(context);
          const at = Date.now();
          return { enabled: true, ownerUserId: owner, planCode: "free", serverTime: new Date(at).toISOString(), refreshBy: new Date(Math.min(at + 60000, (Math.floor(at / 86400000) + 1) * 86400000)).toISOString(), resetAt: new Date((Math.floor(at / 86400000) + 1) * 86400000).toISOString(), accountGeneration: 1, accessEpoch: 1, committedSeconds: Math.max(committed.get(context.browser) ?? 0, committed.get(context.installation) ?? 0), grant: null, assignment: null };
        }, readLive: async () => { throw new Error("Unexpected live request"); },
      })(req);
    }
    if (!context) return Response.json({ code: "FREE20_CONTEXT_REQUIRED" }, { status: 428 });
    scopes.push(context);
    return Response.json({ roomId: "synthetic-room", roomToken: "synthetic-room-token", shareableLink: `${origin}/room/synthetic-room`, quota: { remainingSeconds: 480, resetAt: "2026-11-04T00:00:00Z" } });
  };
  const makeClient = () => createFree20AbuseClient({ baseUrl: origin, getSession: async () => session, refresh: async () => session,
    sign: createInstallationSigners({ get: async () => saved, set: async value => { saved = value; } }).free20, fetch: transport });
  let client = makeClient();
  const status = () => handleAccountHostingStatusMessage({ type: "ANIDACHI_ACCOUNT_HOSTING_STATUS", ownerUserId: session.user.id, fresh: true }, { getSession: async () => session, refresh: async () => session, request: client.request });
  return { status, scopes, enrollments, committed, jar, get client() { return client; }, get session() { return session; }, set blocked(value: boolean) { cookieBlocked = value; }, switchOwner() { session = auth(ownerB); client.onSessionChanged(session); }, restart() { client.onSessionChanged(null); client = makeClient(); }, reinstall() { saved = null; this.restart(); } };
}
afterEach(() => vi.unstubAllGlobals());
it("real Web crypto/cookie responses reach status and both room consumers without exposing context in DTOs", async () => {
  const f = fixture();
  const initial = await f.status(); expect(initial).toMatchObject({ ok: true, mode: "free20", status: { access: { remainingSeconds: 1200 } } });
  const first = f.scopes[0]; f.committed.set(first.browser, 720); f.committed.set(first.installation, 720);
  f.switchOwner();
  expect(await f.status()).toMatchObject({ ok: true, mode: "free20", status: { ownerUserId: ownerB, access: { remainingSeconds: 480 } } });
  expect(f.scopes[1]).toEqual(first);
  expect(f.enrollments).toEqual(["challenge", "complete", "challenge", "complete"]);
  const options = { ownerUserId: ownerB, request: f.client.request };
  const created = await createWebsiteRoomFromApi(f.session.accessToken, "participant-session", undefined, options);
  const connected = await connectWebsiteRoomFromApi(created.roomId, f.session.accessToken, "participant-session", options);
  expect(created.quota?.remainingSeconds).toBe(480); expect(connected.quota?.remainingSeconds).toBe(480);
  expect(JSON.stringify([initial, created, connected])).not.toContain(first.browser);
  expect(f.enrollments).toHaveLength(4);
});
it.each(["clear-cookie", "reinstall", "restart"])("%s retains the surviving marker's identity and does not offer fresh account-only seconds", async replacement => {
  const f = fixture(); await f.status(); const first = f.scopes[0];
  f.committed.set(first.browser, 720); f.committed.set(first.installation, 720);
  if (replacement === "clear-cookie") { f.jar.clear(); f.restart(); }
  if (replacement === "reinstall") f.reinstall();
  if (replacement === "restart") f.restart();
  f.switchOwner();
  expect(await f.status()).toMatchObject({ ok: true, status: { access: { remainingSeconds: 480 } } });
  const next = f.scopes[1];
  expect(next.installation === first.installation).toBe(replacement !== "reinstall");
  expect(next.browser === first.browser).toBe(replacement !== "clear-cookie");
});
it("real completion rejects blocked cookie; a later allowed retry retains the installation", async () => {
  const f = fixture(); f.blocked = true;
  expect(await f.status()).toEqual({ ok: false }); expect(f.scopes).toHaveLength(0);
  f.blocked = false;
  expect(await f.status()).toMatchObject({ ok: true });
  expect(f.enrollments).toEqual(["challenge", "complete", "challenge", "complete"]);
});
