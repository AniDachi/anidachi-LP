import {
  ACCOUNT_HOSTING_OWNER_HEADER,
  FREE20_CONTEXT_HEADER,
  Free20ContextResponseSchema,
  type Free20InstallationProof,
} from "@anidachi/protocol";
import { isSameExtensionAuthSession, type ExtensionAuthTokens } from "./auth-tokens";

export type Free20Request = (url: URL, init: RequestInit) => Promise<Response>;
type Dependencies = {
  baseUrl: string;
  getSession(): Promise<ExtensionAuthTokens | null>;
  refresh(): Promise<ExtensionAuthTokens | null>;
  sign(challenge: string): Promise<Free20InstallationProof>;
  fetch?: Free20Request;
};
/** A logical login survives credential refresh, never signout or account replacement.
 * Legacy sessions have no durable login identity, so retain the stricter fence. */
export function isSameFree20Login(expected: ExtensionAuthTokens, current: ExtensionAuthTokens | null): boolean {
  return Boolean(current && current.user.id === expected.user.id && (
    expected.authSessionId && current.authSessionId
      ? expected.authSessionId === current.authSessionId
      : isSameExtensionAuthSession(expected, current)
  ));
}
const retired = () => new Error("Free20 account session changed");
function waitFor<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void promise.catch(() => undefined); return Promise.reject(signal.reason); }
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

/** Constructed only by the background. Contexts and signing never cross runtime messages. */
export function createFree20AbuseClient(deps: Dependencies) {
  const transport: Free20Request = deps.fetch ?? ((url, init) => fetch(url, init));
  const endpoint = new URL("/api/me/free20-context", deps.baseUrl);
  let cache: { session: ExtensionAuthTokens; context: string; expiresAt: number } | undefined;
  type RefreshBudget = { used: boolean };
  type Enrollment = { budget: RefreshBudget; session: ExtensionAuthTokens; controller: AbortController; waiters: number; promise: Promise<string | Response> };
  let pending: Enrollment | undefined;
  const requests = new Map<AbortController, ExtensionAuthTokens>();
  function onSessionChanged(next: ExtensionAuthTokens | null) {
    if (cache && !isSameFree20Login(cache.session, next)) cache = undefined;
    if (pending && !isSameFree20Login(pending.session, next)) {
      pending.controller.abort(retired()); pending = undefined;
    }
    for (const [controller, session] of requests) {
      if (!isSameFree20Login(session, next)) controller.abort(retired());
    }
  }
  async function current(initial: ExtensionAuthTokens, signal: AbortSignal) {
    signal.throwIfAborted();
    const session = await waitFor(deps.getSession(), signal);
    signal.throwIfAborted();
    if (!isSameFree20Login(initial, session)) throw retired();
    return session!;
  }
  async function bufferResponse(response: Response, initial: ExtensionAuthTokens, signal: AbortSignal) {
    const body = await waitFor(response.arrayBuffer(), signal);
    await current(initial, signal);
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  }
  async function refresh(initial: ExtensionAuthTokens, signal: AbortSignal, budget: RefreshBudget) {
    if (budget.used) return false;
    budget.used = true;
    await current(initial, signal);
    const replacement = await waitFor(deps.refresh(), signal);
    const stored = await current(initial, signal);
    if (!replacement || !isSameExtensionAuthSession(replacement, stored)) throw retired();
    return true;
  }
  async function enroll(initial: ExtensionAuthTokens, signal: AbortSignal, budget: RefreshBudget): Promise<string | Response> {
    let session = await current(initial, signal);
    const requestId = crypto.randomUUID();
    const post = (body: unknown) => transport(endpoint, {
      method: "POST", credentials: "include", cache: "no-store", redirect: "error", signal,
      headers: { Authorization: `Bearer ${session.accessToken}`, [ACCOUNT_HOSTING_OWNER_HEADER]: initial.user.id, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const authenticatedPost = async (body: unknown) => {
      let response = await waitFor(post(body), signal);
      session = await current(initial, signal);
      if (response.status === 401 && await refresh(initial, signal, budget)) {
        session = await current(initial, signal);
        response = await waitFor(post(body), signal);
        session = await current(initial, signal);
      }
      return response;
    };
    let response = await authenticatedPost({ action: "challenge", requestId });
    session = await current(initial, signal);
    if (!response.ok) return bufferResponse(response, initial, signal);
    const challenge = Free20ContextResponseSchema.parse(await waitFor(response.json(), signal));
    await current(initial, signal);
    if (challenge.action !== "challenge" || challenge.expiresAt <= Date.now()) throw new Error("Free20 challenge unavailable");
    const proof = await waitFor(deps.sign(challenge.challenge), signal);
    session = await current(initial, signal);
    response = await authenticatedPost({ action: "complete", requestId, proof });
    session = await current(initial, signal);
    if (!response.ok) {
      // Missing/blocked cookie and invalid proof both fail closed. Neither is
      // diagnosed as exhausted allowance, and neither rotates installation keys.
      return response.status === 428 ? Response.json({
        code: "FREE20_CONTEXT_UNAVAILABLE", retryable: true,
        message: "Browser verification is unavailable. Allow AniDachi cookies and try again.",
      }, { status: 428 }) : bufferResponse(response, initial, signal);
    }
    const completed = Free20ContextResponseSchema.parse(await waitFor(response.json(), signal));
    session = await current(initial, signal);
    if (completed.action !== "complete" || completed.expiresAt <= Date.now()) throw new Error("Free20 context unavailable");
    cache = { session, context: completed.context, expiresAt: completed.expiresAt };
    return completed.context;
  }
  async function enrollment(session: ExtensionAuthTokens, signal: AbortSignal, budget: RefreshBudget): Promise<string | Response> {
    await current(session, signal);
    if (!pending || !isSameFree20Login(pending.session, session) || pending.controller.signal.aborted) {
      const controller = new AbortController();
      const own: Enrollment = { budget, session, controller, waiters: 0, promise: undefined! };
      pending = own;
      const timeout = setTimeout(() => controller.abort(new Error("Free20 enrollment timed out")), 10_000);
      own.promise = enroll(session, controller.signal, own.budget).finally(() => {
        clearTimeout(timeout);
        if (pending === own) pending = undefined;
      });
    }
    const own = pending;
    // Every waiter shares the strictest remaining refresh budget.
    own.budget.used ||= budget.used;
    own.waiters++;
    try {
      const result = await waitFor(own.promise, signal);
      await current(session, signal);
      budget.used ||= own.budget.used;
      return result instanceof Response ? result.clone() : result;
    } finally {
      own.waiters--;
      if (!own.waiters) {
        own.controller.abort(new Error("Free20 enrollment no longer needed"));
        if (pending === own) pending = undefined;
      }
    }
  }
  async function request(url: URL, init: RequestInit): Promise<Response> {
    // Never route credentials/context to a caller-selected external origin.
    if (url.origin !== endpoint.origin) throw new Error("Invalid Free20 request origin");
    const controller = new AbortController();
    const abort = () => controller.abort(init.signal?.reason);
    init.signal?.addEventListener("abort", abort, { once: true });
    if (init.signal?.aborted) abort();
    const timeout = setTimeout(() => controller.abort(new Error("Free20 request timed out")), 10_000);
    try {
      const initial = await waitFor(deps.getSession(), controller.signal);
      const supplied = new Headers(init.headers);
      if (!initial || supplied.get(ACCOUNT_HOSTING_OWNER_HEADER) !== initial.user.id || supplied.get("authorization") !== `Bearer ${initial.accessToken}`) throw retired();
      requests.set(controller, initial);
      let session = initial, enrolled = false;
      const budget: RefreshBudget = { used: false };
      const signal = controller.signal;
      while (true) {
        session = await current(initial, signal);
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${session.accessToken}`);
        headers.delete(FREE20_CONTEXT_HEADER);
        if (cache && isSameFree20Login(cache.session, session) && cache.expiresAt > Date.now()) headers.set(FREE20_CONTEXT_HEADER, cache.context);
        let response = await waitFor(transport(url, { ...init, headers, credentials: "omit", redirect: "error", signal }), signal);
        await current(initial, signal);
        if (response.status === 428 && !enrolled) {
          enrolled = true;
          // A concurrent response may already have enrolled this login. Retry
          // with that context instead of generating a second enrollment.
          if (!cache || !isSameFree20Login(cache.session, session) || cache.expiresAt <= Date.now() || headers.get(FREE20_CONTEXT_HEADER) === cache.context) {
            cache = undefined;
            const result = await enrollment(session, signal, budget);
            if (typeof result !== "string") response = result;
            else continue;
          } else continue;
        }
        if (response.status === 401 && await refresh(initial, signal, budget)) continue;
        // Keep cancellation/session fences until the complete consumer payload
        // arrives; a fetch resolving headers alone does not finish the request.
        return await bufferResponse(response, initial, signal);
      }
    } finally {
      clearTimeout(timeout); requests.delete(controller);
      init.signal?.removeEventListener("abort", abort);
    }
  }
  return { request, onSessionChanged };
}
