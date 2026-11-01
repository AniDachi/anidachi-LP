import { ACCOUNT_HOSTING_OWNER_HEADER, Free20WarningRequestSchema, Free20WarningResponseSchema, type Free20WarningResponse } from "@anidachi/protocol";
import { z } from "zod";
import { getBackgroundAuthSession, isSameExtensionAuthSession, type ExtensionAuthTokens } from "./auth-tokens";
import { refreshExtensionSession } from "./auth-client";
import { WEB_HTTP_BASE } from "./constants";

const TYPE = "ANIDACHI_FREE20_WARNING";
const STORAGE_KEY = "free20WarningAttempts";
const id = z.string().min(1).max(256);
const common = { type: z.literal(TYPE), requestId: z.uuid(), ownerUserId: z.uuid(), loginKey: z.string().max(512) };
export function isFree20WarningLoginKey(ownerUserId: string, loginKey: string): boolean {
  try { const key: unknown = JSON.parse(loginKey); return Array.isArray(key) && key.length === 3 && key[0] === ownerUserId && key[1] === "login" && id.safeParse(key[2]).success; } catch { return false; }
}
const MessageSchema = z.discriminatedUnion("command", [
  z.strictObject({ ...common, command: z.literal("claim"), credentialRevision: id, reason: z.enum(["initial", "retry", "crossing"]), snapshotSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), request: Free20WarningRequestSchema }),
  z.strictObject({ ...common, command: z.literal("cancel") }),
]).refine(value => isFree20WarningLoginKey(value.ownerUserId, value.loginKey));
export type Free20WarningMessage = z.infer<typeof MessageSchema>;
type Claim = Extract<Free20WarningMessage, { command: "claim" }>;
export type Free20WarningResult = { kind: "server"; response: Free20WarningResponse } | { kind: "suppressed" } | { kind: "failed"; retryable: boolean };
export function isFree20WarningMessage(value: unknown): value is Free20WarningMessage { return MessageSchema.safeParse(value).success; }

const EntrySchema = z.strictObject({ ownerUserId: z.uuid(), loginId: id, utcDay: Free20WarningRequestSchema.shape.utcDay, attempts: z.number().int().min(1).max(2), lastAttempt: z.number().finite(), sequence: z.number().int().nonnegative(), next: z.enum(["retry", "crossing", "done"]) });
type Entry = z.infer<typeof EntrySchema>;
type Dependencies = {
  getSession(): Promise<ExtensionAuthTokens | null>;
  refresh(expected: ExtensionAuthTokens): Promise<ExtensionAuthTokens | null>;
  fetch: typeof fetch;
  now(): number;
  read(): Promise<unknown>;
  write(entries: Entry[]): Promise<void>;
};

/** Reserve before I/O, serialize metadata only, and return each HTTP result to
 * its requesting document. A show promise must never be shared between tabs. */
export function createFree20WarningClient(dependencies: Dependencies) {
  let queue: Promise<unknown> = Promise.resolve();
  const active = new Map<string, { message: Claim; controller: AbortController }>();
  const serialize = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation, operation); queue = result.catch(() => undefined); return result;
  };
  const entries = async (): Promise<Entry[]> => {
    const value = await dependencies.read();
    return (Array.isArray(value) ? value : []).flatMap(item => { const parsed = EntrySchema.safeParse(item); return parsed.success ? [parsed.data] : []; }).slice(-32);
  };
  return async (message: Free20WarningMessage): Promise<Free20WarningResult> => {
    const failed = (retryable = false): Free20WarningResult => ({ kind: "failed", retryable });
    if (message.command === "cancel") {
      const pending = active.get(message.requestId);
      if (pending?.message.ownerUserId === message.ownerUserId && pending.message.loginKey === message.loginKey) pending.controller.abort();
      return { kind: "suppressed" };
    }
    const controller = new AbortController();
    active.set(message.requestId, { message, controller });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      let session = await dependencies.getSession();
      const loginId = session?.authSessionId;
      if (!session || !loginId || controller.signal.aborted || session.user.id !== message.ownerUserId || session.authRevision !== message.credentialRevision || message.loginKey !== JSON.stringify([session.user.id, "login", loginId])) return failed();
      const initial = session;
      const key = (entry: Entry) => entry.ownerUserId === message.ownerUserId && entry.loginId === loginId && entry.utcDay === message.request.utcDay;
      const reserved = await serialize(async () => {
        const all = await entries();
        // An old document/completion cannot prune the new day's reservations.
        if (all.some(entry => entry.utcDay > message.request.utcDay)) return false;
        const stored = all.filter(entry => entry.utcDay === message.request.utcDay);
        const previous = stored.find(key);
        const now = dependencies.now();
        if (previous && (previous.attempts >= 2 || now - previous.lastAttempt < 5_000 ||
          [...active.values()].some(item => item.message.requestId !== message.requestId && item.message.ownerUserId === message.ownerUserId && item.message.loginKey === message.loginKey && item.message.request.utcDay === message.request.utcDay) ||
          !(previous.next === "retry" && message.reason === "retry" || previous.next === "crossing" && message.reason === "crossing" && message.snapshotSequence > previous.sequence))) return false;
        if (!previous && message.reason !== "initial") return false;
        const entry: Entry = { ownerUserId: message.ownerUserId, loginId, utcDay: message.request.utcDay, attempts: (previous?.attempts ?? 0) + 1, lastAttempt: now, sequence: message.snapshotSequence, next: "retry" };
        await dependencies.write([...stored.filter(item => !key(item)), entry].slice(-32));
        return true;
      });
      if (!reserved) return { kind: "suppressed" };
      const current = async () => {
        const stored = await dependencies.getSession();
        return !controller.signal.aborted && stored?.authSessionId === loginId && isSameExtensionAuthSession(session!, stored);
      };
      const fetchClaim = () => dependencies.fetch(new URL("/api/me/hosting-warning/claim", WEB_HTTP_BASE), {
        method: "POST", headers: { Authorization: `Bearer ${session!.accessToken}`, "Content-Type": "application/json", [ACCOUNT_HOSTING_OWNER_HEADER]: message.ownerUserId },
        body: JSON.stringify(message.request), credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal,
      });
      const load = async (): Promise<Free20WarningResult> => {
        try {
          if (!(await current())) return failed();
          let response = await fetchClaim();
          if (response.status === 401) {
            if (!(await current())) return failed();
            const refreshed = await dependencies.refresh(initial);
            if (!refreshed || refreshed.authSessionId !== loginId || refreshed.user.id !== message.ownerUserId) return failed();
            session = refreshed;
            if (!(await current())) return failed();
            response = await fetchClaim();
          }
          if (!(await current())) return failed();
          if (response.status !== 200) return failed(response.status === 429 || response.status >= 500);
          const parsed = Free20WarningResponseSchema.safeParse(await response.json());
          if (!(await current()) || !parsed.success) return failed();
          const value = parsed.data;
          if (value.ownerUserId !== message.ownerUserId || value.roomId !== message.request.roomId || value.roomGeneration !== message.request.roomGeneration || value.utcDay !== message.request.utcDay) return failed();
          return { kind: "server", response: value };
        } catch { return failed(!controller.signal.aborted); }
      };
      const result = await Promise.race([load(), new Promise<Free20WarningResult>(resolve => {
        timeout = setTimeout(() => { controller.abort(); resolve(failed(true)); }, 10_000);
      })]);
      await serialize(async () => {
        const stored = await entries();
        const own = stored.find(key);
        if (own && own.sequence === message.snapshotSequence) {
          own.next = result.kind === "server" && result.response.decision === "not_eligible" ? "crossing" : result.kind === "failed" && result.retryable ? "retry" : "done";
          await dependencies.write(stored);
        }
      });
      return result;
    } catch { return failed(); }
    finally { if (timeout !== undefined) clearTimeout(timeout); active.delete(message.requestId); }
  };
}

const backgroundClient = createFree20WarningClient({
  getSession: getBackgroundAuthSession, refresh: expected => refreshExtensionSession(undefined, expected), fetch: (...args) => fetch(...args), now: () => Date.now(),
  read: async () => (await chrome.storage.session.get(STORAGE_KEY))[STORAGE_KEY],
  write: async entries => { await chrome.storage.session.set({ [STORAGE_KEY]: entries }); },
});
export const handleFree20WarningMessage = backgroundClient;

export async function requestFree20Warning(input: Omit<Claim, "type" | "command" | "requestId">, signal: AbortSignal): Promise<Free20WarningResult> {
  if (signal.aborted) return { kind: "failed", retryable: false };
  const message: Claim = { ...input, type: TYPE, command: "claim", requestId: crypto.randomUUID() };
  if (!isFree20WarningMessage(message)) return { kind: "failed", retryable: false };
  const cancel = () => { void chrome.runtime.sendMessage({ type: TYPE, command: "cancel", requestId: message.requestId, ownerUserId: message.ownerUserId, loginKey: message.loginKey }).catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const result: unknown = await chrome.runtime.sendMessage(message);
    if (signal.aborted) return { kind: "failed", retryable: false };
    if (result && typeof result === "object" && "kind" in result) {
      if (result.kind === "suppressed") return { kind: "suppressed" };
      if (result.kind === "server" && "response" in result) {
        const parsed = Free20WarningResponseSchema.safeParse(result.response);
        if (parsed.success) return { kind: "server", response: parsed.data };
      }
      if (result.kind === "failed" && "retryable" in result && typeof result.retryable === "boolean") return { kind: "failed", retryable: result.retryable };
    }
    return { kind: "failed", retryable: false };
  } catch { return { kind: "failed", retryable: !signal.aborted }; }
  finally { signal.removeEventListener("abort", cancel); }
}
