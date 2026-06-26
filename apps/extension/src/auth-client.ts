import { WEB_HTTP_BASE } from "./constants";
import {
  clearStoredAuthTokens,
  getStoredAuthTokens,
  normalizeAuthenticatedUser,
  normalizeExtensionAuthTokens,
  setStoredAuthTokens,
  type AuthenticatedUser,
  type ExtensionAuthTokens,
} from "./auth-tokens";

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
  | { ok: false; error: string };

export type WebsiteSessionProbe =
  | { status: "authenticated"; user: AuthenticatedUser }
  | { status: "signed-out" }
  | { status: "unknown" };

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

function cryptoRandomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
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

export function buildExtensionConnectUrl(redirectUri: string, state: string): string {
  const url = new URL("/extension/connect", WEB_HTTP_BASE);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export function buildExtensionLogoutUrl(redirectUri: string, state: string): string {
  const url = new URL("/extension/logout", WEB_HTTP_BASE);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export function parseExtensionAuthRedirect(
  redirectUrl: string,
  expectedState: string,
): ExtensionAuthRedirect {
  const url = new URL(redirectUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) throw new Error("Missing extension auth code");
  if (!state || state !== expectedState) throw new Error("Invalid extension auth state");
  return { code, state };
}

export function assertExtensionLogoutRedirect(redirectUrl: string, expectedState: string): void {
  const url = new URL(redirectUrl);
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
  redirect: ExtensionAuthRedirect,
): Promise<ExtensionAuthTokens> {
  const response = await fetch(buildWebUrl("/api/extension/auth/exchange"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(redirect),
  });

  if (!response.ok) {
    throw new Error(`Extension auth exchange failed: ${response.status}`);
  }

  const tokens = normalizeExtensionAuthTokens(await response.json());
  if (!tokens) throw new Error("Extension auth exchange returned malformed tokens");
  await setStoredAuthTokens(tokens);
  return tokens;
}

export async function refreshExtensionSession(): Promise<ExtensionAuthTokens | null> {
  const stored = await getStoredAuthTokens();
  if (!stored) return null;

  const response = await fetch(buildWebUrl("/api/extension/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: stored.refreshToken }),
  });

  if (!response.ok) {
    await clearStoredAuthTokens();
    return null;
  }

  const body = normalizeExtensionRefreshResponse(await response.json().catch(() => null));
  if (!body) {
    await clearStoredAuthTokens();
    return null;
  }

  const tokens: ExtensionAuthTokens = {
    ...stored,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken ?? stored.refreshToken,
  };
  const freshUser = await fetchAuthenticatedUser(tokens.accessToken);
  if (freshUser) {
    tokens.user = freshUser;
  }
  await setStoredAuthTokens(tokens);
  return tokens;
}

async function revokeExtensionRefreshToken(refreshToken: string): Promise<void> {
  await fetch(buildWebUrl("/api/extension/auth/logout"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function fetchAuthenticatedUser(accessToken: string): Promise<AuthenticatedUser | null> {
  const response = await fetch(buildWebUrl("/api/me"), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;

  const body = (await response.json().catch(() => null)) as { user?: unknown } | null;
  return normalizeAuthenticatedUser(body?.user);
}

async function fetchWebsiteSessionProbe(): Promise<WebsiteSessionProbe> {
  let response: Response;
  try {
    response = await fetch(buildWebUrl("/api/me"), {
      cache: "no-store",
      credentials: "include",
    });
  } catch {
    return { status: "unknown" };
  }

  if (response.status === 401) {
    return { status: "signed-out" };
  }

  if (!response.ok) {
    return { status: "unknown" };
  }

  const body = (await response.json().catch(() => null)) as { user?: unknown } | null;
  const user = normalizeAuthenticatedUser(body?.user);
  return user ? { status: "authenticated", user } : { status: "unknown" };
}

export function shouldClearExtensionSessionForWebsiteProbe(
  stored: ExtensionAuthTokens,
  probe: WebsiteSessionProbe,
): boolean {
  if (probe.status === "unknown") return false;
  if (probe.status === "signed-out") return true;
  return probe.user.id !== stored.user.id;
}

async function ensureWebsiteSessionStillMatches(stored: ExtensionAuthTokens): Promise<boolean> {
  const probe = await fetchWebsiteSessionProbe();
  if (!shouldClearExtensionSessionForWebsiteProbe(stored, probe)) {
    return true;
  }

  await revokeExtensionRefreshToken(stored.refreshToken).catch(() => undefined);
  await clearStoredAuthTokens();
  return false;
}

export async function getCachedExtensionSession(): Promise<ExtensionAuthTokens | null> {
  return getStoredAuthTokens();
}

export async function getCurrentExtensionSession(
  options: { validateWebsiteSession?: boolean } = {},
): Promise<ExtensionAuthTokens | null> {
  const stored = await getStoredAuthTokens();
  if (!stored) return null;

  if (options.validateWebsiteSession && !(await ensureWebsiteSessionStillMatches(stored))) {
    return null;
  }

  const user = await fetchAuthenticatedUser(stored.accessToken);
  if (user) {
    const tokens = { ...stored, user };
    await setStoredAuthTokens(tokens);
    return tokens;
  }

  const refreshed = await refreshExtensionSession();
  if (!refreshed) return null;

  const refreshedUser = await fetchAuthenticatedUser(refreshed.accessToken);
  if (!refreshedUser) {
    await clearStoredAuthTokens();
    return null;
  }

  const tokens = { ...refreshed, user: refreshedUser };
  await setStoredAuthTokens(tokens);
  return tokens;
}

export async function validateExtensionSessionAgainstWebsite(): Promise<ExtensionAuthTokens | null> {
  const stored = await getStoredAuthTokens();
  if (!stored) return signInWithWebsiteSilently();

  if (!(await ensureWebsiteSessionStillMatches(stored))) {
    return signInWithWebsiteSilently();
  }

  return getCurrentExtensionSession({ validateWebsiteSession: false });
}

async function runWebsiteAuthFlow(interactive: boolean): Promise<ExtensionAuthTokens | null> {
  if (!chrome.identity?.getRedirectURL || !chrome.identity?.launchWebAuthFlow) {
    if (interactive) throw new Error("Chrome Identity API is unavailable");
    return null;
  }

  const redirectUri = chrome.identity.getRedirectURL(AUTH_CALLBACK_PATH);
  const state = cryptoRandomState();
  const url = buildExtensionConnectUrl(redirectUri, state);
  const redirectUrl = await chrome.identity.launchWebAuthFlow({ url, interactive });
  if (!redirectUrl) {
    if (interactive) throw new Error("Extension auth flow was cancelled");
    return null;
  }

  return exchangeExtensionAuthCode(parseExtensionAuthRedirect(redirectUrl, state));
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
    return await runWebsiteAuthFlow(false);
  } catch {
    return null;
  }
}

interface WebsiteSignOutSequenceActions {
  getStoredTokens: () => Promise<ExtensionAuthTokens | null>;
  revokeRefreshToken: (refreshToken: string) => Promise<void>;
  attemptWebsiteLogout: () => Promise<void>;
  clearTokens: () => Promise<void>;
}

export async function runWebsiteSignOutSequence({
  getStoredTokens,
  revokeRefreshToken,
  attemptWebsiteLogout,
  clearTokens,
}: WebsiteSignOutSequenceActions): Promise<void> {
  const stored = await getStoredTokens();
  if (stored) {
    await revokeRefreshToken(stored.refreshToken).catch(() => undefined);
  }

  try {
    await attemptWebsiteLogout();
  } finally {
    await clearTokens();
  }
}

async function attemptWebsiteLogoutFlow(): Promise<void> {
  if (!chrome.identity?.getRedirectURL || !chrome.identity?.launchWebAuthFlow) {
    return;
  }

  const redirectUri = chrome.identity.getRedirectURL(LOGOUT_CALLBACK_PATH);
  const state = cryptoRandomState();
  const url = buildExtensionLogoutUrl(redirectUri, state);
  const redirectUrl = await chrome.identity
    .launchWebAuthFlow({ url, interactive: false })
    .catch(() => null);
  if (redirectUrl) {
    assertExtensionLogoutRedirect(redirectUrl, state);
  }
}

export async function signOutWithWebsite(): Promise<void> {
  await runWebsiteSignOutSequence({
    getStoredTokens: getStoredAuthTokens,
    revokeRefreshToken: revokeExtensionRefreshToken,
    attemptWebsiteLogout: attemptWebsiteLogoutFlow,
    clearTokens: clearStoredAuthTokens,
  });
}

export async function handleWebsiteAuthCookieChange(
  changeInfo: WebAuthCookieChange,
): Promise<void> {
  if (shouldClearExtensionSessionForWebsiteCookieChange(changeInfo)) {
    const stored = await getStoredAuthTokens();
    if (stored) {
      await revokeExtensionRefreshToken(stored.refreshToken).catch(() => undefined);
    }
    await clearStoredAuthTokens();
    return;
  }

  if (shouldSyncExtensionSessionForWebsiteCookieChange(changeInfo)) {
    await validateExtensionSessionAgainstWebsite().catch(() => undefined);
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
    return {
      ok: true,
      tokens: await getCurrentExtensionSession({
        validateWebsiteSession: message.command !== "get-session-fast",
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Extension auth failed",
    };
  }
}

export async function sendAuthCommand(command: AuthCommand): Promise<AuthMessageResponse> {
  return chrome.runtime.sendMessage(createAuthMessage(command));
}
