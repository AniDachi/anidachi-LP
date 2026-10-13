import {
  ExtensionAuthExchangeRequestSchema,
  ExtensionAuthInitiationSchema,
  type ExtensionAuthExchangeRequest,
  type ExtensionAuthInitiation,
} from "@anidachi/protocol";
import { clearCachedAccountInboxForUser } from "./account-inbox-cache";
import {
  type AuthenticatedUser,
  type AuthSessionMutationResult,
  clearStoredAuthTokensIfCurrentAfter,
  clearStoredAuthTokensIfRefreshToken,
  commitStoredAuthTokensIfCurrent,
  type ExtensionAuthTokens,
  getStoredAuthTokens,
  getBackgroundAuthSession,
  getBackgroundAuthRevision,
  replaceStoredAuthTokensIfRevision,
  isSameExtensionAuthSession,
  normalizeAuthenticatedUser,
  normalizeExtensionAuthTokens,
} from "./auth-tokens";
import { WEB_HTTP_BASE } from "./constants";
import { recordDiagnosticEvent } from "./diagnostic-log";
import { clearCachedSocialSnapshotForUser } from "./social-snapshot-cache";

const AUTH_CALLBACK_PATH = "auth";
const LOGOUT_CALLBACK_PATH = "logout";
const AUTH_MESSAGE_TYPE = "ANIDACHI_AUTH";
const WEB_REFRESH_TOKEN_COOKIE = "anidachi_refresh_token";

export type AuthCommand =
  | "sign-in"
  | "sign-in-silent"
  | "refresh"
  | "get-session"
  | "get-session-fast";

export interface AuthMessage {
  type: typeof AUTH_MESSAGE_TYPE;
  command: AuthCommand;
}

export type AuthMessageResponse =
  | { ok: true; tokens: ExtensionAuthTokens | null }
  | {
      ok: false;
      error: string;
      tokens?: ExtensionAuthTokens;
      retryable?: boolean;
    };

export class ExtensionAuthTemporarilyUnavailableError extends Error {
  readonly cachedTokens: ExtensionAuthTokens;

  constructor(cachedTokens: ExtensionAuthTokens) {
    super("Anidachi authentication is temporarily unavailable. Try again.");
    this.name = "ExtensionAuthTemporarilyUnavailableError";
    this.cachedTokens = cachedTokens;
  }
}

export type WebsiteSessionProbe =
  | { status: "authenticated"; user: AuthenticatedUser }
  | { status: "signed-out" }
  | { status: "browser-flow-required" }
  | { status: "unknown" };

type WebsiteSessionMatchResult =
  | "matches"
  | "cleared"
  | "browser-flow-required";

export type ExtensionRefreshRequestResult =
  | { kind: "success"; accessToken: string; refreshToken?: string }
  | { kind: "invalid" }
  | { kind: "unavailable"; status?: number };

export interface ExtensionSessionRefreshDependencies {
  getStored: () => Promise<ExtensionAuthTokens | null>;
  requestRefresh: (refreshToken: string) => Promise<ExtensionRefreshRequestResult>;
  resolveUser: (accessToken: string) => Promise<AuthenticatedUser | null>;
  probeUser?: (tokens: ExtensionAuthTokens) => Promise<AuthenticatedUserProbe>;
  commitIfCurrent: (
    expected: ExtensionAuthTokens,
    replacement: ExtensionAuthTokens | null,
  ) => Promise<AuthSessionMutationResult>;
  clearAccountData?: (userId: string) => Promise<void>;
}

export interface ExtensionSessionDependencies {
  getStored: () => Promise<ExtensionAuthTokens | null>;
  resolveUser: (accessToken: string) => Promise<AuthenticatedUser | null>;
  probeUser?: (tokens: ExtensionAuthTokens) => Promise<AuthenticatedUserProbe>;
  commitIfCurrent: (
    expected: ExtensionAuthTokens,
    replacement: ExtensionAuthTokens | null,
  ) => Promise<AuthSessionMutationResult>;
  refresh: () => Promise<ExtensionAuthTokens | null>;
  adoptSilently?: () => Promise<ExtensionAuthTokens | null>;
}

export interface WebsiteSessionReconciliationDependencies {
  getStored: () => Promise<ExtensionAuthTokens | null>;
  ensureMatches: (stored: ExtensionAuthTokens) => Promise<WebsiteSessionMatchResult>;
  signInSilently: () => Promise<ExtensionAuthTokens | null>;
  getCurrent: () => Promise<ExtensionAuthTokens | null>;
  revokeRefreshToken: (refreshToken: string) => Promise<void>;
}

export type WebAuthCookieChange = {
  removed: boolean;
  cause?: string;
  cookie: {
    name: string;
    domain: string;
  };
};

export interface ExtensionAuthRedirect {
  code: string;
  state: string;
}

function randomBase64Url(bytesCount = 32): string {
  const bytes = new Uint8Array(bytesCount);
  crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function digestToBase64Url(value: ArrayBuffer): string {
  const binary = Array.from(new Uint8Array(value), (byte) =>
    String.fromCharCode(byte),
  ).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export async function deriveExtensionPkceChallenge(
  codeVerifier: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return digestToBase64Url(digest);
}

export async function createExtensionAuthTransaction(): Promise<{
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}> {
  const state = randomBase64Url();
  const codeVerifier = randomBase64Url();
  return {
    state,
    codeVerifier,
    codeChallenge: await deriveExtensionPkceChallenge(codeVerifier),
    codeChallengeMethod: "S256",
  };
}

function buildWebUrl(path: string): string {
  return new URL(path, WEB_HTTP_BASE).toString();
}

export function createAuthMessage(command: AuthCommand): AuthMessage {
  return { type: AUTH_MESSAGE_TYPE, command };
}

export function isAuthMessage(value: unknown): value is AuthMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<AuthMessage>;
  return (
    message.type === AUTH_MESSAGE_TYPE &&
    (message.command === "sign-in" ||
      message.command === "sign-in-silent" ||
      message.command === "refresh" ||
      message.command === "get-session" ||
      message.command === "get-session-fast")
  );
}

function configuredWebHost(): string | null {
  try {
    return new URL(WEB_HTTP_BASE).hostname;
  } catch {
    return null;
  }
}

export function isConfiguredWebsiteCookie(cookie: WebAuthCookieChange["cookie"]): boolean {
  if (cookie.name !== WEB_REFRESH_TOKEN_COOKIE) return false;
  const webHost = configuredWebHost();
  if (!webHost) return false;
  const cookieDomain = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain;
  return webHost === cookieDomain || webHost.endsWith(`.${cookieDomain}`);
}

export function shouldClearExtensionSessionForWebsiteCookieChange(
  changeInfo: WebAuthCookieChange,
): boolean {
  return (
    isConfiguredWebsiteCookie(changeInfo.cookie) &&
    changeInfo.removed &&
    changeInfo.cause !== "overwrite"
  );
}

export function shouldSyncExtensionSessionForWebsiteCookieChange(
  changeInfo: WebAuthCookieChange,
): boolean {
  return isConfiguredWebsiteCookie(changeInfo.cookie) && !changeInfo.removed;
}

export function buildExtensionConnectUrl(input: ExtensionAuthInitiation): string {
  const parsed = ExtensionAuthInitiationSchema.parse(input);
  const url = new URL("/extension/connect", WEB_HTTP_BASE);
  url.searchParams.set("client_id", parsed.clientId);
  url.searchParams.set("redirect_uri", parsed.redirectUri);
  url.searchParams.set("state", parsed.state);
  url.searchParams.set("code_challenge", parsed.codeChallenge);
  url.searchParams.set("code_challenge_method", parsed.codeChallengeMethod);
  return url.toString();
}

export function buildExtensionLogoutUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("/extension/logout", WEB_HTTP_BASE);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function parseExtensionAuthRedirect(
  redirectUrl: string,
  expectedState: string,
  expectedRedirectUri: string,
): ExtensionAuthRedirect {
  const url = new URL(redirectUrl);
  const expected = new URL(expectedRedirectUri);
  if (
    url.hash ||
    !redirectUrl.startsWith(`${expectedRedirectUri}?`) ||
    `${url.origin}${url.pathname}` !== expected.toString()
  ) {
    throw new Error("Invalid extension auth redirect");
  }
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 2 || !keys.includes("code") || !keys.includes("state")) {
    throw new Error("Invalid extension auth redirect");
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) throw new Error("Missing extension auth code");
  if (!state || state !== expectedState) throw new Error("Invalid extension auth state");
  return { code, state };
}

export function assertExtensionLogoutRedirect(
  redirectUrl: string,
  expectedState: string,
  expectedRedirectUri: string,
): void {
  const url = new URL(redirectUrl);
  const expected = new URL(expectedRedirectUri);
  if (
    url.hash ||
    !redirectUrl.startsWith(`${expectedRedirectUri}?`) ||
    `${url.origin}${url.pathname}` !== expected.toString()
  ) {
    throw new Error("Invalid extension logout redirect");
  }
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 2 || !keys.includes("signed_out") || !keys.includes("state")) {
    throw new Error("Invalid extension logout redirect");
  }
  const signedOut = url.searchParams.get("signed_out");
  const state = url.searchParams.get("state");
  if (signedOut !== "1") throw new Error("Missing extension logout confirmation");
  if (!state || state !== expectedState) throw new Error("Invalid extension logout state");
}

export function normalizeExtensionRefreshResponse(
  value: unknown,
): { accessToken: string; refreshToken?: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as { accessToken?: unknown; refreshToken?: unknown };
  if (typeof body.accessToken !== "string") return null;
  if (body.refreshToken !== undefined && typeof body.refreshToken !== "string") {
    return null;
  }
  return {
    accessToken: body.accessToken,
    ...(body.refreshToken ? { refreshToken: body.refreshToken } : {}),
  };
}

export async function exchangeExtensionAuthCode(
  request: ExtensionAuthExchangeRequest,
  expectedRevision?: string | null,
): Promise<ExtensionAuthTokens> {
  const parsed = ExtensionAuthExchangeRequestSchema.parse(request);
  const revision =
    expectedRevision === undefined
      ? await getBackgroundAuthRevision()
      : expectedRevision;
  const response = await fetch(buildWebUrl("/api/extension/auth/exchange"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });

  if (!response.ok) {
    recordDiagnosticEvent("auth.exchange", "failed", { status: response.status }, "warn");
    throw new Error(`Extension auth exchange failed: ${response.status}`);
  }

  const tokens = normalizeExtensionAuthTokens(await response.json());
  if (!tokens) throw new Error("Extension auth exchange returned malformed tokens");
  const commit = await replaceStoredAuthTokensIfRevision(revision, tokens);
  if (!commit.committed || !commit.current) {
    if (commit.current)
      throw new ExtensionAuthTemporarilyUnavailableError(commit.current);
    throw new Error("Extension auth session changed during sign in");
  }
  recordDiagnosticEvent("auth.exchange", "succeeded", {
    userId: tokens.user.id,
    plan: tokens.user.plan,
  });
  return commit.current;
}

async function requestExtensionSessionRefresh(
  refreshToken: string,
): Promise<ExtensionRefreshRequestResult> {
  let response: Response;
  try {
    response = await fetch(buildWebUrl("/api/extension/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return { kind: "unavailable" };
  }

  if (response.status === 401) {
    return { kind: "invalid" };
  }
  if (!response.ok) {
    return { kind: "unavailable", status: response.status };
  }

  const body = normalizeExtensionRefreshResponse(await response.json().catch(() => null));
  if (!body) {
    return { kind: "unavailable", status: response.status };
  }

  return { kind: "success", ...body };
}

const defaultRefreshDependencies: ExtensionSessionRefreshDependencies = {
  getStored: getBackgroundAuthSession,
  probeUser: probeAuthenticatedUser,
  requestRefresh: requestExtensionSessionRefresh,
  resolveUser: fetchAuthenticatedUser,
  commitIfCurrent: commitStoredAuthTokensIfCurrent,
  clearAccountData: clearCachedAccountDataForUser,
};

let sessionRefreshInFlight: {
  expected: ExtensionAuthTokens;
  promise: Promise<ExtensionAuthTokens | null>;
} | null = null;

async function performExtensionSessionRefresh(
  dependencies: ExtensionSessionRefreshDependencies,
  stored: ExtensionAuthTokens,
): Promise<ExtensionAuthTokens | null> {
  if (!stored) {
    recordDiagnosticEvent("auth.refresh", "skipped without stored session", undefined, "warn");
    return null;
  }

  const result = await dependencies.requestRefresh(stored.refreshToken);

  if (result.kind === "invalid") {
    const commit = await dependencies.commitIfCurrent(stored, null);
    if (!commit.committed) {
      recordDiagnosticEvent("auth.refresh", "discarded after stored session changed", {
        previousUserId: stored.user.id,
        currentUserId: commit.current?.user.id,
      });
      if (dependencies.probeUser && commit.current)
        throw new ExtensionAuthTemporarilyUnavailableError(commit.current);
      return commit.current;
    }
    recordDiagnosticEvent(
      "auth.refresh",
      "refresh token rejected; clearing stored session",
      { status: 401, userId: stored.user.id },
      "warn",
    );
    await dependencies.clearAccountData?.(stored.user.id);
    return null;
  }

  if (result.kind === "unavailable") {
    const current = await dependencies.getStored();
    if (!current || !isSameExtensionAuthSession(stored, current)) {
      recordDiagnosticEvent("auth.refresh", "discarded after stored session changed", {
        previousUserId: stored.user.id,
        currentUserId: current?.user.id,
      });
      if (dependencies.probeUser && current)
        throw new ExtensionAuthTemporarilyUnavailableError(current);
      return current;
    }
    recordDiagnosticEvent(
      "auth.refresh",
      "temporarily unavailable; keeping stored session",
      { status: result.status, userId: stored.user.id },
      "warn",
    );
    throw new ExtensionAuthTemporarilyUnavailableError(current);
  }

  const tokens: ExtensionAuthTokens = {
    ...stored,
    ...(stored.authRevision ? { authRevision: crypto.randomUUID() } : {}),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? stored.refreshToken,
  };
  // Persist consumed/rotated credentials before profile validation can fail or hang.
  const commit = await dependencies.commitIfCurrent(stored, tokens);
  if (!commit.committed || !commit.current) {
    if (dependencies.probeUser && commit.current)
      throw new ExtensionAuthTemporarilyUnavailableError(commit.current);
    return commit.current;
  }
  const committed = commit.current;
  const probe = dependencies.probeUser
    ? await dependencies.probeUser(committed)
    : {
        kind: "valid" as const,
        user: await dependencies
          .resolveUser(committed.accessToken)
          .catch(() => null),
      };
  if (
    probe.kind !== "valid" ||
    !probe.user ||
    probe.user.id !== committed.user.id
  ) {
    const current = await dependencies.getStored();
    if (!current) return null;
    throw new ExtensionAuthTemporarilyUnavailableError(current);
  }
  if (!dependencies.probeUser) return { ...committed, user: probe.user };
  const metadata = await dependencies.commitIfCurrent(committed, {
    ...committed,
    user: probe.user,
  });
  if (!metadata.committed) {
    if (!metadata.current) return null;
    throw new ExtensionAuthTemporarilyUnavailableError(metadata.current);
  }
  recordDiagnosticEvent("auth.refresh", "succeeded", {
    userId: committed.user.id,
    rotatedRefreshToken: Boolean(result.refreshToken),
  });
  return metadata.current;
}

export async function refreshExtensionSession(
  dependencies: ExtensionSessionRefreshDependencies = defaultRefreshDependencies,
  expected?: ExtensionAuthTokens,
): Promise<ExtensionAuthTokens | null> {
  // Join only the existing refresh for this exact credential generation.
  if (
    expected &&
    sessionRefreshInFlight &&
    isSameExtensionAuthSession(expected, sessionRefreshInFlight.expected)
  ) {
    return sessionRefreshInFlight.promise;
  }
  const stored = await dependencies.getStored();
  if (!stored) return null;
  if (expected && !isSameExtensionAuthSession(expected, stored)) {
    throw new ExtensionAuthTemporarilyUnavailableError(stored);
  }
  if (sessionRefreshInFlight) {
    if (isSameExtensionAuthSession(stored, sessionRefreshInFlight.expected))
      return sessionRefreshInFlight.promise;
    // Keep one refresh authority; a different account cannot inherit its result.
    await sessionRefreshInFlight.promise.catch(() => undefined);
    return refreshExtensionSession(dependencies, expected ?? stored);
  }
  const operation = performExtensionSessionRefresh(
    dependencies,
    stored,
  ).finally(() => {
    if (sessionRefreshInFlight?.promise === operation)
      sessionRefreshInFlight = null;
  });
  sessionRefreshInFlight = { expected: stored, promise: operation };
  return operation;
}

async function revokeExtensionRefreshToken(refreshToken: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(buildWebUrl("/api/extension/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    recordDiagnosticEvent("auth.logout", "server revocation network error", undefined, "warn");
    throw new Error("Extension auth logout request failed");
  }
  if (!response.ok) {
    recordDiagnosticEvent(
      "auth.logout",
      "server revocation failed",
      { status: response.status },
      "warn",
    );
    throw new Error(`Extension auth logout failed: ${response.status}`);
  }
}

interface ConditionalSessionClearDependencies {
  clearIfRefreshToken: (expectedRefreshToken: string, expectedRevision?: string) => Promise<AuthSessionMutationResult>;
  clearAccountData?: (userId: string) => Promise<void>;
}

const defaultConditionalClearDependencies: ConditionalSessionClearDependencies = {
  clearIfRefreshToken: clearStoredAuthTokensIfRefreshToken,
  clearAccountData: clearCachedAccountDataForUser,
};

export async function clearExtensionSessionIfCurrent(
  expectedRefreshToken: string,
  dependencies: ConditionalSessionClearDependencies = defaultConditionalClearDependencies,
  expectedRevision?: string,
): Promise<boolean> {
  const result = expectedRevision === undefined
    ? await dependencies.clearIfRefreshToken(expectedRefreshToken)
    : await dependencies.clearIfRefreshToken(expectedRefreshToken, expectedRevision);
  if (!result.committed || !result.previous) {
    return false;
  }

  await dependencies.clearAccountData?.(result.previous.user.id);
  return true;
}

async function clearCachedAccountDataForUser(userId: string): Promise<void> {
  await Promise.allSettled([
    clearCachedSocialSnapshotForUser(userId),
    clearCachedAccountInboxForUser(userId),
  ]);
}

export type AuthenticatedUserProbe =
  | { kind: "valid"; user: AuthenticatedUser }
  | { kind: "unauthorized" }
  | { kind: "unavailable"; status?: number }
  | { kind: "failure"; status: number };

const pendingProfileProbes = new Map<string, Promise<AuthenticatedUserProbe>>();

async function requestAuthenticatedUser(
  accessToken: string,
): Promise<AuthenticatedUserProbe> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    const request = fetch(buildWebUrl("/api/me"), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) return { kind: "unauthorized" } as const;
        if (response.status === 429 || response.status >= 500)
          return { kind: "unavailable", status: response.status } as const;
        if (response.status !== 200)
          return { kind: "failure", status: response.status } as const;
        const body = await response.json().catch(() => null);
        const user = normalizeAuthenticatedUser(body?.user);
        return user
          ? ({ kind: "valid", user } as const)
          : ({ kind: "unavailable" } as const);
      })
      .catch(() => ({ kind: "unavailable" }) as const);
    return await Promise.race([
      request,
      new Promise<AuthenticatedUserProbe>((resolve) => {
        timeout = setTimeout(() => {
          controller.abort();
          resolve({ kind: "unavailable" });
        }, 10_000);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/** Coalesce pending transport only; no successful-response authorization cache. */
export function probeAuthenticatedUser(
  tokens: ExtensionAuthTokens,
): Promise<AuthenticatedUserProbe> {
  const key = JSON.stringify([
    tokens.authRevision,
    tokens.user.id,
    tokens.accessToken,
    tokens.refreshToken,
    tokens.user.plan,
  ]);
  const pending = pendingProfileProbes.get(key);
  if (pending) return pending;
  const operation = requestAuthenticatedUser(tokens.accessToken).finally(() => {
    if (pendingProfileProbes.get(key) === operation)
      pendingProfileProbes.delete(key);
  });
  pendingProfileProbes.set(key, operation);
  return operation;
}

export async function fetchAuthenticatedUser(
  accessToken: string,
): Promise<AuthenticatedUser | null> {
  const result = await requestAuthenticatedUser(accessToken);
  return result.kind === "valid" ? result.user : null;
}

type WebsiteSessionRequest = (url: string, init?: RequestInit) => Promise<Response>;
type WebsiteRefreshCookieLookup = () => Promise<boolean | null>;

async function websiteRefreshCookieExists(): Promise<boolean | null> {
  if (!chrome.cookies?.get) return null;

  try {
    const cookie = await chrome.cookies.get({
      url: new URL("/", WEB_HTTP_BASE).toString(),
      name: WEB_REFRESH_TOKEN_COOKIE,
    });
    return Boolean(cookie);
  } catch {
    return null;
  }
}

export async function fetchWebsiteSessionProbe(
  request: WebsiteSessionRequest = fetch,
  hasRefreshCookie: WebsiteRefreshCookieLookup = websiteRefreshCookieExists,
): Promise<WebsiteSessionProbe> {
  let response: Response;
  try {
    response = await request(buildWebUrl("/api/extension/auth/website-session"), {
      cache: "no-store",
      credentials: "include",
    });
  } catch {
    recordDiagnosticEvent("auth.website-probe", "network error", undefined, "warn");
    return { status: "unknown" };
  }

  if (response.status === 401) {
    const cookieExists = await hasRefreshCookie();
    if (cookieExists === true) {
      recordDiagnosticEvent(
        "auth.website-probe",
        "cookie exists but request could not authenticate; browser flow required",
        { status: response.status },
        "warn",
      );
      return { status: "browser-flow-required" };
    }
    if (cookieExists === null) {
      return { status: "unknown" };
    }
    recordDiagnosticEvent("auth.website-probe", "signed out", { status: response.status }, "warn");
    return { status: "signed-out" };
  }

  if (!response.ok) {
    recordDiagnosticEvent(
      "auth.website-probe",
      "unexpected status",
      { status: response.status },
      "warn",
    );
    return { status: "unknown" };
  }

  const body = (await response.json().catch(() => null)) as {
    user?: unknown;
  } | null;
  const user = normalizeAuthenticatedUser(body?.user);
  if (!user) {
    recordDiagnosticEvent("auth.website-probe", "malformed user", undefined, "warn");
    return { status: "unknown" };
  }

  return { status: "authenticated", user };
}

export function shouldClearExtensionSessionForWebsiteProbe(
  stored: ExtensionAuthTokens,
  probe: WebsiteSessionProbe,
): boolean {
  if (probe.status === "unknown" || probe.status === "browser-flow-required") return false;
  if (probe.status === "signed-out") return true;
  return probe.user.id !== stored.user.id;
}

async function ensureWebsiteSessionStillMatches(
  stored: ExtensionAuthTokens,
): Promise<WebsiteSessionMatchResult> {
  const probe = await fetchWebsiteSessionProbe();
  if (probe.status === "browser-flow-required") {
    return "browser-flow-required";
  }
  if (!shouldClearExtensionSessionForWebsiteProbe(stored, probe)) {
    return "matches";
  }

  recordDiagnosticEvent(
    "auth.session",
    "website session mismatch; clearing extension session",
    {
      storedUserId: stored.user.id,
      probeStatus: probe.status,
      probeUserId: probe.status === "authenticated" ? probe.user.id : undefined,
    },
    "warn",
  );
  const commit = await clearStoredAuthTokensIfCurrentAfter(
    stored,
    async (current) => {
      await revokeExtensionRefreshToken(current.refreshToken).catch(
        () => undefined,
      );
    },
  );
  const cleared = commit.committed;
  if (cleared) await clearCachedAccountDataForUser(stored.user.id);
  return !cleared && (await getStoredAuthTokens()) ? "matches" : "cleared";
}

export async function getCachedExtensionSession(): Promise<ExtensionAuthTokens | null> {
  return getStoredAuthTokens();
}

const defaultSessionDependencies: ExtensionSessionDependencies = {
  getStored: getBackgroundAuthSession,
  probeUser: probeAuthenticatedUser,
  resolveUser: fetchAuthenticatedUser,
  commitIfCurrent: commitStoredAuthTokensIfCurrent,
  refresh: refreshExtensionSession,
  adoptSilently: signInWithWebsiteSilently,
};

export async function getCurrentExtensionSession(
  dependencies: ExtensionSessionDependencies = defaultSessionDependencies,
): Promise<ExtensionAuthTokens | null> {
  const stored = await dependencies.getStored();
  if (!stored) return null;

  const probe = dependencies.probeUser
    ? await dependencies.probeUser(stored)
    : ((user: AuthenticatedUser | null): AuthenticatedUserProbe =>
        user ? { kind: "valid", user } : { kind: "unauthorized" })(
        await dependencies.resolveUser(stored.accessToken),
      );
  const current = await dependencies.getStored();
  if (
    !isSameExtensionAuthSession(stored, current) ||
    (dependencies.probeUser && current?.user.plan !== stored.user.plan)
  ) {
    if (!current) return null;
    if (dependencies.probeUser)
      throw new ExtensionAuthTemporarilyUnavailableError(current);
    return current;
  }
  if (probe.kind === "valid" && probe.user.id === stored.user.id) {
    const user = probe.user;
    const tokens = { ...stored, user };
    const commit = await dependencies.commitIfCurrent(stored, tokens);
    if (!commit.committed && dependencies.probeUser && commit.current)
      throw new ExtensionAuthTemporarilyUnavailableError(commit.current);
    return commit.current;
  }

  if (probe.kind !== "unauthorized")
    throw new ExtensionAuthTemporarilyUnavailableError(current!);
  const refreshed =
    dependencies === defaultSessionDependencies
      ? await refreshExtensionSession(defaultRefreshDependencies, stored)
      : await dependencies.refresh();
  if (refreshed) return refreshed;
  return dependencies.adoptSilently?.() ?? null;
}

const defaultWebsiteReconciliationDependencies: WebsiteSessionReconciliationDependencies =
  {
    getStored: getBackgroundAuthSession,
    ensureMatches: ensureWebsiteSessionStillMatches,
    signInSilently: signInWithWebsiteSilently,
    getCurrent: getCurrentExtensionSession,
    revokeRefreshToken: revokeExtensionRefreshToken,
  };

type WebsiteSessionReconciliationPass = {
  adoptIfMissing: boolean;
  dependencies: WebsiteSessionReconciliationDependencies;
  promise: Promise<ExtensionAuthTokens | null>;
  resolve: (tokens: ExtensionAuthTokens | null) => void;
  reject: (error: unknown) => void;
};

let activeWebsiteReconciliation: WebsiteSessionReconciliationPass | null = null;
let trailingWebsiteReconciliation: WebsiteSessionReconciliationPass | null = null;

async function performWebsiteSessionReconciliation(
  options: { adoptIfMissing: boolean },
  dependencies: WebsiteSessionReconciliationDependencies,
): Promise<ExtensionAuthTokens | null> {
  const stored = await dependencies.getStored();
  if (!stored) {
    return options.adoptIfMissing ? dependencies.signInSilently() : null;
  }

  const matchResult = await dependencies.ensureMatches(stored);
  if (matchResult === "browser-flow-required") {
    const adopted = await dependencies.signInSilently();
    if (!adopted) return dependencies.getCurrent();
    if (adopted.refreshToken !== stored.refreshToken) {
      await dependencies.revokeRefreshToken(stored.refreshToken).catch(() => undefined);
    }
    return adopted;
  }
  if (matchResult === "cleared") {
    return dependencies.signInSilently();
  }

  return dependencies.getCurrent();
}

export function reconcileExtensionSessionAgainstWebsite(
  options: { adoptIfMissing?: boolean } = {},
  dependencies: WebsiteSessionReconciliationDependencies = defaultWebsiteReconciliationDependencies,
): Promise<ExtensionAuthTokens | null> {
  const adoptIfMissing = options.adoptIfMissing ?? true;
  if (!activeWebsiteReconciliation) {
    const pass = createWebsiteSessionReconciliationPass(adoptIfMissing, dependencies);
    startWebsiteSessionReconciliationPass(pass);
    return pass.promise;
  }

  if (!trailingWebsiteReconciliation) {
    trailingWebsiteReconciliation = createWebsiteSessionReconciliationPass(
      adoptIfMissing,
      dependencies,
    );
  } else {
    trailingWebsiteReconciliation.adoptIfMissing ||= adoptIfMissing;
    trailingWebsiteReconciliation.dependencies = dependencies;
  }
  return trailingWebsiteReconciliation.promise;
}

function createWebsiteSessionReconciliationPass(
  adoptIfMissing: boolean,
  dependencies: WebsiteSessionReconciliationDependencies,
): WebsiteSessionReconciliationPass {
  let resolve!: (tokens: ExtensionAuthTokens | null) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<ExtensionAuthTokens | null>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { adoptIfMissing, dependencies, promise, resolve, reject };
}

function startWebsiteSessionReconciliationPass(
  pass: WebsiteSessionReconciliationPass,
): void {
  activeWebsiteReconciliation = pass;
  void performWebsiteSessionReconciliation(
    { adoptIfMissing: pass.adoptIfMissing },
    pass.dependencies,
  ).then(
    (tokens) => finishWebsiteSessionReconciliationPass(pass, { ok: true, tokens }),
    (error) => finishWebsiteSessionReconciliationPass(pass, { ok: false, error }),
  );
}

function finishWebsiteSessionReconciliationPass(
  pass: WebsiteSessionReconciliationPass,
  outcome:
    | { ok: true; tokens: ExtensionAuthTokens | null }
    | { ok: false; error: unknown },
): void {
  if (activeWebsiteReconciliation !== pass) return;

  activeWebsiteReconciliation = null;
  const next = trailingWebsiteReconciliation;
  trailingWebsiteReconciliation = null;
  if (next) startWebsiteSessionReconciliationPass(next);

  if (outcome.ok) pass.resolve(outcome.tokens);
  else pass.reject(outcome.error);
}

async function runWebsiteAuthFlow(
  interactive: boolean,
): Promise<ExtensionAuthTokens | null> {
  if (!chrome.identity?.getRedirectURL || !chrome.identity?.launchWebAuthFlow) {
    if (interactive) throw new Error("Chrome Identity API is unavailable");
    return null;
  }

  const expectedRevision = await getBackgroundAuthRevision();
  const redirectUri = chrome.identity.getRedirectURL(AUTH_CALLBACK_PATH);
  const clientId = chrome.runtime.id;
  const transaction = await createExtensionAuthTransaction();
  const url = buildExtensionConnectUrl({
    clientId,
    redirectUri,
    state: transaction.state,
    codeChallenge: transaction.codeChallenge,
    codeChallengeMethod: transaction.codeChallengeMethod,
  });
  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    url,
    interactive,
  });
  if (!redirectUrl) {
    if (interactive) throw new Error("Extension auth flow was cancelled");
    return null;
  }

  const redirect = parseExtensionAuthRedirect(
    redirectUrl,
    transaction.state,
    redirectUri,
  );
  return exchangeExtensionAuthCode(
    {
clientId,
redirectUri,
code: redirect.code,
state: redirect.state,
codeVerifier: transaction.codeVerifier,
},
    expectedRevision,
  );
}

export async function signInWithWebsite(): Promise<ExtensionAuthTokens> {
  const tokens = await runWebsiteAuthFlow(true);
  if (!tokens) throw new Error("Extension auth flow was cancelled");
  return tokens;
}

/**
 * Picks up an existing website (cookie) session without any UI. When the user
 * is already signed in on the website — e.g. right after opening a shared room
 * link and logging in — `/extension/connect` redirects straight back with a
 * one-time code, so the non-interactive auth flow completes silently. If no
 * website session exists, the flow needs interaction and we resolve to null
 * instead of throwing, leaving the overlay signed out.
 */
export async function signInWithWebsiteSilently(): Promise<ExtensionAuthTokens | null> {
  try {
    const tokens = await runWebsiteAuthFlow(false);
    recordDiagnosticEvent(
      "auth.silent",
      tokens ? "succeeded" : "no website session",
      tokens ? { userId: tokens.user.id, plan: tokens.user.plan } : undefined,
      tokens ? "info" : "warn",
    );
    return tokens;
  } catch {
    recordDiagnosticEvent("auth.silent", "failed", undefined, "warn");
    return null;
  }
}

interface WebsiteSignOutSequenceActions {
  getStoredTokens: () => Promise<ExtensionAuthTokens | null>;
  flushBeforeSignOut?: (tokens: ExtensionAuthTokens) => Promise<void>;
  revokeRefreshToken: (refreshToken: string) => Promise<void>;
  attemptWebsiteLogout: () => Promise<void>;
  clearTokens: (expectedRefreshToken: string | null) => Promise<void>;
}

const REMOTE_SIGN_OUT_STAGE_TIMEOUT_MS = 2_000;
const NATIVE_NON_INTERACTIVE_LOGOUT_TIMEOUT_MS = 1_500;

async function runRemoteSignOutStage(
  stage: "watch-history-flush" | "refresh-token-revocation" | "website-logout",
  operation: () => Promise<void>,
): Promise<void> {
  let operationOutcome: Promise<"completed" | "failed">;
  try {
    operationOutcome = Promise.resolve(operation())
      .then(() => "completed" as const)
      .catch(() => "failed" as const);
  } catch {
    operationOutcome = Promise.resolve("failed");
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race([
    operationOutcome,
    new Promise<"timed-out">((resolve) => {
      timeout = setTimeout(() => resolve("timed-out"), REMOTE_SIGN_OUT_STAGE_TIMEOUT_MS);
    }),
  ]);
  if (timeout !== undefined) {
    clearTimeout(timeout);
  }
  if (outcome !== "completed") {
    recordDiagnosticEvent(
      "auth.logout",
      "remote sign-out stage did not complete",
      { stage, outcome },
      "warn",
    );
  }
}

export async function runWebsiteSignOutSequence({
  getStoredTokens,
  flushBeforeSignOut,
  revokeRefreshToken,
  attemptWebsiteLogout,
  clearTokens,
}: WebsiteSignOutSequenceActions): Promise<void> {
  const stored = await getStoredTokens();
  if (stored) {
    if (flushBeforeSignOut) {
      await runRemoteSignOutStage("watch-history-flush", () => flushBeforeSignOut(stored));
    }
    await runRemoteSignOutStage("refresh-token-revocation", () =>
      revokeRefreshToken(stored.refreshToken),
    );
  }

  try {
    await runRemoteSignOutStage("website-logout", attemptWebsiteLogout);
  } finally {
    await clearTokens(stored?.refreshToken ?? null);
  }
}

async function attemptWebsiteLogoutFlow(): Promise<void> {
  if (!chrome.identity?.getRedirectURL || !chrome.identity?.launchWebAuthFlow) {
    return;
  }

  const redirectUri = chrome.identity.getRedirectURL(LOGOUT_CALLBACK_PATH);
  const state = randomBase64Url();
  const url = buildExtensionLogoutUrl({
    clientId: chrome.runtime.id,
    redirectUri,
    state,
  });
  const redirectUrl = await chrome.identity
    .launchWebAuthFlow({
      url,
      interactive: false,
      timeoutMsForNonInteractive: NATIVE_NON_INTERACTIVE_LOGOUT_TIMEOUT_MS,
    })
    .catch(() => null);
  if (redirectUrl) {
    assertExtensionLogoutRedirect(redirectUrl, state, redirectUri);
  }
}

/**
 * Runs `onMatchedSession` inside the exact-family auth mutation. The callback
 * must not enqueue another auth mutation; privileged sign-out uses only the
 * independent per-tab room-authority queue here.
 */
export async function signOutWithWebsite(
  expected: ExtensionAuthTokens,
  onMatchedSession?: (matchedSession: ExtensionAuthTokens) => Promise<void>,
): Promise<boolean> {
  let matchedExpectedSession = false;
  try {
    const result = await clearStoredAuthTokensIfCurrentAfter(expected, async (stored) => {
      matchedExpectedSession = true;
      await onMatchedSession?.(stored).catch(() => {
        recordDiagnosticEvent(
          "auth.logout",
          "matched-session cleanup failed",
          undefined,
          "warn",
        );
      });
      await runWebsiteSignOutSequence({
        getStoredTokens: async () => stored,
        flushBeforeSignOut: async (tokens) => {
          const { bestEffortFlushWatchHistoryBeforeSignOut } = await import(
            "./watch-history-client"
          );
          await bestEffortFlushWatchHistoryBeforeSignOut(tokens);
        },
        revokeRefreshToken: revokeExtensionRefreshToken,
        attemptWebsiteLogout: attemptWebsiteLogoutFlow,
        clearTokens: async () => undefined,
      });
    });
    return result.committed;
  } finally {
    if (matchedExpectedSession) {
      await clearCachedAccountDataForUser(expected.user.id);
    }
  }
}

export async function getFastSessionAndRefreshInBackground({
  getCached = getCachedExtensionSession,
  refresh = getCurrentExtensionSession,
}: {
  getCached?: () => Promise<ExtensionAuthTokens | null>;
  refresh?: () => Promise<ExtensionAuthTokens | null>;
} = {}): Promise<ExtensionAuthTokens | null> {
  const cached = await getCached();
  if (cached) {
    void refresh().catch(() => undefined);
  }
  return cached;
}

export async function handleWebsiteAuthCookieChange(
  changeInfo: WebAuthCookieChange,
  reconciliationDependencies: WebsiteSessionReconciliationDependencies =
    defaultWebsiteReconciliationDependencies,
): Promise<void> {
  if (shouldClearExtensionSessionForWebsiteCookieChange(changeInfo)) {
    recordDiagnosticEvent(
      "auth.cookie",
      "website refresh cookie removed; reconciling extension session",
      {
        cause: changeInfo.cause,
        domain: changeInfo.cookie.domain,
      },
      "warn",
    );
  } else if (shouldSyncExtensionSessionForWebsiteCookieChange(changeInfo)) {
    recordDiagnosticEvent(
      "auth.cookie",
      "website refresh cookie changed; syncing extension session",
      {
        cause: changeInfo.cause,
        domain: changeInfo.cookie.domain,
      },
    );
  } else {
    return;
  }

  await reconcileExtensionSessionAgainstWebsite({}, reconciliationDependencies).catch(
    () => undefined,
  );
}

export async function handleAuthMessage(message: AuthMessage): Promise<AuthMessageResponse> {
  try {
    if (message.command === "sign-in") {
      return { ok: true, tokens: await signInWithWebsite() };
    }
    if (message.command === "sign-in-silent") {
      return { ok: true, tokens: await signInWithWebsiteSilently() };
    }
    if (message.command === "refresh") {
      return { ok: true, tokens: await refreshExtensionSession() };
    }
    if (message.command === "get-session-fast") {
      return { ok: true, tokens: await getFastSessionAndRefreshInBackground() };
    }
    return {
      ok: true,
      tokens: await getCurrentExtensionSession(),
    };
  } catch (error) {
    recordDiagnosticEvent(
      "auth.command",
      "failed",
      {
        command: message.command,
        message: error instanceof Error ? error.message : "Extension auth failed",
      },
      "error",
    );
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Extension auth failed",
      ...(error instanceof ExtensionAuthTemporarilyUnavailableError
        ? { tokens: error.cachedTokens, retryable: true }
        : {}),
    };
  }
}

export async function sendAuthCommand(command: AuthCommand): Promise<AuthMessageResponse> {
  return chrome.runtime.sendMessage(createAuthMessage(command));
}

async function requestAuthTokens(
  command: AuthCommand,
): Promise<ExtensionAuthTokens | null> {
  const response = await sendAuthCommand(command);
  if (!response.ok) {
    if (response.retryable && response.tokens)
      throw new ExtensionAuthTemporarilyUnavailableError(response.tokens);
    throw new Error(response.error);
  }
  return response.tokens;
}

export function requestCurrentExtensionSession(): Promise<ExtensionAuthTokens | null> {
  return requestAuthTokens("get-session");
}

export async function requestWebsiteSignIn(): Promise<ExtensionAuthTokens> {
  const tokens = await requestAuthTokens("sign-in");
  if (!tokens) throw new Error("Sign in did not return a session");
  return tokens;
}

export function requestSilentWebsiteSignIn(): Promise<ExtensionAuthTokens | null> {
  return requestAuthTokens("sign-in-silent");
}
