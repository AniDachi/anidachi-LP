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
  clearStoredAuthTokensIfRefreshToken,
  commitStoredAuthTokensIfCurrent,
  type ExtensionAuthTokens,
  getStoredAuthTokens,
  isSameExtensionAuthSession,
  normalizeAuthenticatedUser,
  normalizeExtensionAuthTokens,
  setStoredAuthTokens,
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
  | "sign-out"
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

type WebsiteSessionMatchResult = "matches" | "cleared" | "browser-flow-required";

export type ExtensionRefreshRequestResult =
  | { kind: "success"; accessToken: string; refreshToken?: string }
  | { kind: "invalid" }
  | { kind: "unavailable"; status?: number };

export interface ExtensionSessionRefreshDependencies {
  getStored: () => Promise<ExtensionAuthTokens | null>;
  requestRefresh: (refreshToken: string) => Promise<ExtensionRefreshRequestResult>;
  resolveUser: (accessToken: string) => Promise<AuthenticatedUser | null>;
  commitIfCurrent: (
    expected: ExtensionAuthTokens,
    replacement: ExtensionAuthTokens | null,
  ) => Promise<AuthSessionMutationResult>;
  clearAccountData?: (userId: string) => Promise<void>;
}

export interface ExtensionSessionDependencies {
  getStored: () => Promise<ExtensionAuthTokens | null>;
  resolveUser: (accessToken: string) => Promise<AuthenticatedUser | null>;
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
      message.command === "sign-out" ||
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
): Promise<ExtensionAuthTokens> {
  const parsed = ExtensionAuthExchangeRequestSchema.parse(request);
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
  await setStoredAuthTokens(tokens);
  recordDiagnosticEvent("auth.exchange", "succeeded", {
    userId: tokens.user.id,
    plan: tokens.user.plan,
  });
  return tokens;
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
  getStored: getStoredAuthTokens,
  requestRefresh: requestExtensionSessionRefresh,
  resolveUser: fetchAuthenticatedUser,
  commitIfCurrent: commitStoredAuthTokensIfCurrent,
  clearAccountData: clearCachedAccountDataForUser,
};

let sessionRefreshInFlight: Promise<ExtensionAuthTokens | null> | null = null;

async function performExtensionSessionRefresh(
  dependencies: ExtensionSessionRefreshDependencies,
): Promise<ExtensionAuthTokens | null> {
  const stored = await dependencies.getStored();
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
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? stored.refreshToken,
  };
  const freshUser = await dependencies.resolveUser(tokens.accessToken).catch(() => null);
  if (freshUser) {
    tokens.user = freshUser;
  }
  const commit = await dependencies.commitIfCurrent(stored, tokens);
  if (!commit.committed) {
    recordDiagnosticEvent("auth.refresh", "discarded after user resolution changed session", {
      previousUserId: stored.user.id,
      currentUserId: commit.current?.user.id,
    });
    return commit.current;
  }
  recordDiagnosticEvent("auth.refresh", "succeeded", {
    userId: tokens.user.id,
    plan: tokens.user.plan,
    rotatedRefreshToken: Boolean(result.refreshToken),
  });
  return tokens;
}

export function refreshExtensionSession(
  dependencies: ExtensionSessionRefreshDependencies = defaultRefreshDependencies,
): Promise<ExtensionAuthTokens | null> {
  if (sessionRefreshInFlight) {
    return sessionRefreshInFlight;
  }

  const operation = performExtensionSessionRefresh(dependencies).finally(() => {
    if (sessionRefreshInFlight === operation) {
      sessionRefreshInFlight = null;
    }
  });
  sessionRefreshInFlight = operation;
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
  clearIfRefreshToken: (expectedRefreshToken: string) => Promise<AuthSessionMutationResult>;
  clearAccountData?: (userId: string) => Promise<void>;
}

const defaultConditionalClearDependencies: ConditionalSessionClearDependencies = {
  clearIfRefreshToken: clearStoredAuthTokensIfRefreshToken,
  clearAccountData: clearCachedAccountDataForUser,
};

export async function clearExtensionSessionIfCurrent(
  expectedRefreshToken: string,
  dependencies: ConditionalSessionClearDependencies = defaultConditionalClearDependencies,
): Promise<boolean> {
  const result = await dependencies.clearIfRefreshToken(expectedRefreshToken);
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

export async function fetchAuthenticatedUser(
  accessToken: string,
): Promise<AuthenticatedUser | null> {
  let response: Response;
  try {
    response = await fetch(buildWebUrl("/api/me"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    recordDiagnosticEvent("auth.me", "network error", undefined, "warn");
    return null;
  }
  if (!response.ok) {
    recordDiagnosticEvent(
      "auth.me",
      "failed with bearer token",
      { status: response.status },
      "warn",
    );
    return null;
  }

  const body = (await response.json().catch(() => null)) as {
    user?: unknown;
  } | null;
  return normalizeAuthenticatedUser(body?.user);
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
  await revokeExtensionRefreshToken(stored.refreshToken).catch(() => undefined);
  const cleared = await clearExtensionSessionIfCurrent(stored.refreshToken);
  return !cleared && (await getStoredAuthTokens()) ? "matches" : "cleared";
}

export async function getCachedExtensionSession(): Promise<ExtensionAuthTokens | null> {
  return getStoredAuthTokens();
}

const defaultSessionDependencies: ExtensionSessionDependencies = {
  getStored: getStoredAuthTokens,
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

  const user = await dependencies.resolveUser(stored.accessToken);
  if (user) {
    const tokens = { ...stored, user };
    const commit = await dependencies.commitIfCurrent(stored, tokens);
    return commit.committed ? tokens : commit.current;
  }

  const refreshed = await dependencies.refresh();
  if (refreshed) return refreshed;
  return dependencies.adoptSilently?.() ?? null;
}

const defaultWebsiteReconciliationDependencies: WebsiteSessionReconciliationDependencies = {
  getStored: getStoredAuthTokens,
  ensureMatches: ensureWebsiteSessionStillMatches,
  signInSilently: signInWithWebsiteSilently,
  getCurrent: getCurrentExtensionSession,
  revokeRefreshToken: revokeExtensionRefreshToken,
};

let websiteReconciliationInFlight: Promise<ExtensionAuthTokens | null> | null = null;

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
  if (websiteReconciliationInFlight) {
    return websiteReconciliationInFlight;
  }

  const operation = performWebsiteSessionReconciliation(
    { adoptIfMissing: options.adoptIfMissing ?? true },
    dependencies,
  ).finally(() => {
    if (websiteReconciliationInFlight === operation) {
      websiteReconciliationInFlight = null;
    }
  });
  websiteReconciliationInFlight = operation;
  return operation;
}

async function runWebsiteAuthFlow(interactive: boolean): Promise<ExtensionAuthTokens | null> {
  if (!chrome.identity?.getRedirectURL || !chrome.identity?.launchWebAuthFlow) {
    if (interactive) throw new Error("Chrome Identity API is unavailable");
    return null;
  }

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
  return exchangeExtensionAuthCode({
    clientId,
    redirectUri,
    code: redirect.code,
    state: redirect.state,
    codeVerifier: transaction.codeVerifier,
  });
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

export async function runWebsiteSignOutSequence({
  getStoredTokens,
  flushBeforeSignOut,
  revokeRefreshToken,
  attemptWebsiteLogout,
  clearTokens,
}: WebsiteSignOutSequenceActions): Promise<void> {
  const stored = await getStoredTokens();
  if (stored) {
    await flushBeforeSignOut?.(stored).catch(() => undefined);
    await revokeRefreshToken(stored.refreshToken).catch(() => undefined);
  }

  try {
    await attemptWebsiteLogout();
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
    .launchWebAuthFlow({ url, interactive: false })
    .catch(() => null);
  if (redirectUrl) {
    assertExtensionLogoutRedirect(redirectUrl, state, redirectUri);
  }
}

export async function signOutWithWebsite(): Promise<void> {
  const stored = await getStoredAuthTokens();
  try {
    await runWebsiteSignOutSequence({
      getStoredTokens: async () => stored,
      flushBeforeSignOut: async (tokens) => {
        const { bestEffortFlushWatchHistoryBeforeSignOut } = await import("./watch-history-client");
        await bestEffortFlushWatchHistoryBeforeSignOut(tokens);
      },
      revokeRefreshToken: revokeExtensionRefreshToken,
      attemptWebsiteLogout: attemptWebsiteLogoutFlow,
      clearTokens: async (expectedRefreshToken) => {
        if (expectedRefreshToken) {
          await clearExtensionSessionIfCurrent(expectedRefreshToken);
        }
      },
    });
  } finally {
    if (stored) {
      await clearCachedAccountDataForUser(stored.user.id);
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
): Promise<void> {
  if (shouldClearExtensionSessionForWebsiteCookieChange(changeInfo)) {
    recordDiagnosticEvent(
      "auth.cookie",
      "website refresh cookie removed; clearing extension session",
      {
        cause: changeInfo.cause,
        domain: changeInfo.cookie.domain,
      },
      "warn",
    );
    const stored = await getStoredAuthTokens();
    if (stored) {
      await revokeExtensionRefreshToken(stored.refreshToken).catch(() => undefined);
      await clearExtensionSessionIfCurrent(stored.refreshToken);
    }
    return;
  }

  if (shouldSyncExtensionSessionForWebsiteCookieChange(changeInfo)) {
    recordDiagnosticEvent(
      "auth.cookie",
      "website refresh cookie changed; syncing extension session",
      {
        cause: changeInfo.cause,
        domain: changeInfo.cookie.domain,
      },
    );
    await reconcileExtensionSessionAgainstWebsite().catch(() => undefined);
  }
}

export async function handleAuthMessage(message: AuthMessage): Promise<AuthMessageResponse> {
  try {
    if (message.command === "sign-in") {
      return { ok: true, tokens: await signInWithWebsite() };
    }
    if (message.command === "sign-in-silent") {
      return { ok: true, tokens: await signInWithWebsiteSilently() };
    }
    if (message.command === "sign-out") {
      await signOutWithWebsite();
      return { ok: true, tokens: null };
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

async function requestAuthTokens(command: AuthCommand): Promise<ExtensionAuthTokens | null> {
  const response = await sendAuthCommand(command);
  if (!response.ok) {
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
