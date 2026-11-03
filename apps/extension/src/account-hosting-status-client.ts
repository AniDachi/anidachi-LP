import type { Free20Request } from "./free20-abuse-client";
import { ACCOUNT_HOSTING_OWNER_HEADER, acceptAccountHostingStatus, type AccountHostingStatus } from "@anidachi/protocol";
import { getStoredAuthTokens, isSameExtensionAuthSession } from "./auth-tokens";
import { refreshExtensionSession } from "./auth-client";
import { WEB_HTTP_BASE } from "./constants";

const TYPE = "ANIDACHI_ACCOUNT_HOSTING_STATUS";
type Message = { type: typeof TYPE; ownerUserId: string; fresh?: boolean };
export type AccountHostingRead = { mode: "legacy" } | { mode: "free20"; status: AccountHostingStatus };
export function isAccountHostingStatusMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<Message>;
  return message.type === TYPE && typeof message.ownerUserId === "string" && message.ownerUserId.length > 0;
}
type Dependencies = { getSession: typeof getStoredAuthTokens; refresh: typeof refreshExtensionSession; request?: Free20Request };
const defaults: Dependencies = { getSession: getStoredAuthTokens, refresh: refreshExtensionSession };
type Result = ({ ok: true } & AccountHostingRead) | { ok: false };
const pending = new WeakMap<typeof defaults, Map<string, Promise<Result>>>();

export async function handleAccountHostingStatusMessage(message: Message, dependencies = defaults): Promise<Result> {
  const session = await dependencies.getSession().catch(() => null);
  if (!session || session.user.id !== message.ownerUserId) return { ok: false };
  const key = JSON.stringify([session.authRevision, session.accessToken, session.refreshToken, session.user.id]);
  let reads = pending.get(dependencies);
  if (!reads) { reads = new Map(); pending.set(dependencies, reads); }
  let request = message.fresh ? undefined : reads.get(key);
  if (!request) {
    request = load(message, dependencies, session);
    reads.set(key, request);
    const own = request;
    void own.finally(() => { if (reads.get(key) === own) reads.delete(key); });
  }
  return request;
}

async function load(message: Message, dependencies: typeof defaults, initial: NonNullable<Awaited<ReturnType<typeof getStoredAuthTokens>>>): Promise<Result> {
  const failure = { ok: false } as const;
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const read = async (): Promise<Result> => {
    try {
      let session = initial;
      const current = async () => {
        const stored = await dependencies.getSession();
        return !controller.signal.aborted && (dependencies.request && session.authSessionId
          ? stored?.user.id === session.user.id && stored.authSessionId === session.authSessionId
          : isSameExtensionAuthSession(session, stored));
      };
      const fetchStatus = () => (dependencies.request ?? fetch)(new URL("/api/me/hosting-status", WEB_HTTP_BASE), {
        headers: { Authorization: `Bearer ${session.accessToken}`, [ACCOUNT_HOSTING_OWNER_HEADER]: message.ownerUserId },
        credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal,
      });
      let response = await fetchStatus();
      if (response.status === 401 && !dependencies.request) {
        if (!(await current())) return failure;
        const refreshed = await dependencies.refresh();
        if (!refreshed || refreshed.user.id !== message.ownerUserId) return failure;
        session = refreshed;
        // Refresh may race a same-owner logout/login. Never send its bearer until
        // the complete credential family is confirmed as current in storage.
        if (!(await current())) return failure;
        response = await fetchStatus();
      }
      if (controller.signal.aborted || (response.status !== 200 && response.status !== 404)) return failure;
      const body: unknown = await response.json();
      if (!(await current())) return failure;
      if (response.status === 404) {
        return body && typeof body === "object" && "code" in body && body.code === "FREE20_DISABLED"
          ? { ok: true, mode: "legacy" } : failure;
      }
      const status = acceptAccountHostingStatus(message.ownerUserId, body);
      return status ? { ok: true, mode: "free20", status } : failure;
    } catch { return failure; }
  };
  return Promise.race([read(), new Promise<typeof failure>(resolve => {
    timeout = setTimeout(() => { controller.abort(); resolve(failure); }, 10_000);
  })]).finally(() => { if (timeout !== undefined) clearTimeout(timeout); });
}

export async function requestAccountHostingStatus(ownerUserId: string, fresh = false): Promise<AccountHostingRead> {
  const response = await chrome.runtime.sendMessage({ type: TYPE, ownerUserId, ...(fresh ? { fresh: true } : {}) });
  if (response?.ok === true && response.mode === "legacy") return { mode: "legacy" };
  if (response?.ok === true && response.mode === "free20") {
    const status = acceptAccountHostingStatus(ownerUserId, response.status);
    if (status) return { mode: "free20", status };
  }
  throw new Error("Hosting time unavailable");
}
