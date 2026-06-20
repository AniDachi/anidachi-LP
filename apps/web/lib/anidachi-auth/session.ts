import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAccessToken, type AccessTokenPayload } from "./jwt";
import type { PlanCode } from "./plan-entitlements";

export const ACCESS_TOKEN_COOKIE = "anidachi_access_token";
export const REFRESH_TOKEN_COOKIE = "anidachi_refresh_token";

export type Session = {
  userId: string;
  email: string;
  plan: PlanCode;
};

/** Reads and verifies the access token cookie. Returns null if absent or invalid. */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyAccessToken(token);
  if (!payload) return null;
  return { userId: payload.sub, email: payload.email, plan: payload.plan };
}

/**
 * Used in Server Components and Route Handlers that require authentication.
 * Redirects to /login with the current path as returnTo if not signed in.
 */
export async function requireAuth(returnTo?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${next}`);
  }
  return session;
}

/** Helpers to set/clear auth cookies on a NextResponse. */
export function setAuthCookies(
  response: { cookies: { set: (name: string, value: string, opts: object) => void } },
  accessToken: string,
  refreshToken: string
) {
  const isProduction = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, secure: isProduction, sameSite: "lax" as const, path: "/" };
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...base,
    maxAge: 60 * 15, // 15 minutes
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...base,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearAuthCookies(response: {
  cookies: { set: (name: string, value: string, opts: object) => void };
}) {
  const base = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...base, maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...base, maxAge: 0 });
}

export type { AccessTokenPayload };
