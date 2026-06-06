import { storage } from "wxt/utils/storage";

export const AUTH_TOKENS_STORAGE_KEY = "authTokens";
export const AUTH_TOKENS_KEY = `local:${AUTH_TOKENS_STORAGE_KEY}` as const;

export type AuthenticatedUserPlan = "watcher" | "nakama" | "junkie";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  plan: AuthenticatedUserPlan;
}

export interface ExtensionAuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlan(value: unknown): value is AuthenticatedUserPlan {
  return value === "watcher" || value === "nakama" || value === "junkie";
}

export function normalizeAuthenticatedUser(value: unknown): AuthenticatedUser | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.email !== "string" ||
    typeof value.displayName !== "string" ||
    !isPlan(value.plan)
  ) {
    return null;
  }

  if (value.avatarUrl !== null && value.avatarUrl !== undefined && typeof value.avatarUrl !== "string") {
    return null;
  }

  return {
    id: value.id,
    email: value.email,
    displayName: value.displayName,
    avatarUrl: value.avatarUrl ?? null,
    plan: value.plan,
  };
}

export function normalizeExtensionAuthTokens(value: unknown): ExtensionAuthTokens | null {
  if (!isRecord(value)) return null;
  if (typeof value.accessToken !== "string" || typeof value.refreshToken !== "string") {
    return null;
  }

  const user = normalizeAuthenticatedUser(value.user);
  if (!user) return null;

  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    user,
  };
}

export async function getStoredAuthTokens(): Promise<ExtensionAuthTokens | null> {
  const stored = await storage.getItem<unknown>(AUTH_TOKENS_KEY);
  return normalizeExtensionAuthTokens(stored);
}

export async function setStoredAuthTokens(tokens: ExtensionAuthTokens): Promise<void> {
  await storage.setItem(AUTH_TOKENS_KEY, tokens);
}

export async function clearStoredAuthTokens(): Promise<void> {
  await storage.removeItem(AUTH_TOKENS_KEY);
}
