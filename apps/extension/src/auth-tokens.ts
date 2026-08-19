import { storage } from "wxt/utils/storage";

export const AUTH_TOKENS_STORAGE_KEY = "authTokens";
export const AUTH_TOKENS_KEY = `local:${AUTH_TOKENS_STORAGE_KEY}` as const;

export type AuthenticatedUserPlan = "free" | "plus" | "pro";

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

export interface AuthSessionStorageAdapter {
  get: () => Promise<ExtensionAuthTokens | null>;
  set: (tokens: ExtensionAuthTokens) => Promise<void>;
  remove: () => Promise<void>;
}

export type AuthSessionMutationResult = {
  committed: boolean;
  current: ExtensionAuthTokens | null;
  previous: ExtensionAuthTokens | null;
};

export interface AuthSessionStorageAuthority {
  replace: (tokens: ExtensionAuthTokens) => Promise<void>;
  clear: () => Promise<void>;
  commitIfCurrent: (
    expected: ExtensionAuthTokens,
    replacement: ExtensionAuthTokens | null,
  ) => Promise<AuthSessionMutationResult>;
  clearIfRefreshToken: (expectedRefreshToken: string) => Promise<AuthSessionMutationResult>;
}

export function isSameExtensionAuthSession(
  expected: ExtensionAuthTokens,
  current: ExtensionAuthTokens | null,
): boolean {
  return Boolean(
    current &&
      current.refreshToken === expected.refreshToken &&
      current.user.id === expected.user.id,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePlan(value: unknown): AuthenticatedUserPlan | null {
  if (value === "free" || value === "watcher") return "free";
  if (value === "plus" || value === "nakama") return "plus";
  if (value === "pro" || value === "junkie") return "pro";
  return null;
}

export function normalizeAuthenticatedUser(value: unknown): AuthenticatedUser | null {
  if (!isRecord(value)) return null;
  const plan = normalizePlan(value.plan);
  if (
    typeof value.id !== "string" ||
    typeof value.email !== "string" ||
    typeof value.displayName !== "string" ||
    !plan
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
    plan,
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

export function createAuthSessionStorageAuthority(
  adapter: AuthSessionStorageAdapter,
): AuthSessionStorageAuthority {
  let mutationQueue: Promise<void> = Promise.resolve();

  function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    replace(tokens) {
      return runSerialized(() => adapter.set(tokens));
    },
    clear() {
      return runSerialized(() => adapter.remove());
    },
    commitIfCurrent(expected, replacement) {
      return runSerialized(async () => {
        const current = await adapter.get();
        if (!isSameExtensionAuthSession(expected, current)) {
          return { committed: false, current, previous: current };
        }

        if (replacement) await adapter.set(replacement);
        else await adapter.remove();
        return { committed: true, current: replacement, previous: current };
      });
    },
    clearIfRefreshToken(expectedRefreshToken) {
      return runSerialized(async () => {
        const current = await adapter.get();
        if (!current || current.refreshToken !== expectedRefreshToken) {
          return { committed: false, current, previous: current };
        }

        await adapter.remove();
        return { committed: true, current: null, previous: current };
      });
    },
  };
}

const authSessionStorageAdapter: AuthSessionStorageAdapter = {
  async get() {
    const stored = await storage.getItem<unknown>(AUTH_TOKENS_KEY);
    return normalizeExtensionAuthTokens(stored);
  },
  async set(tokens) {
    await storage.setItem(AUTH_TOKENS_KEY, tokens);
  },
  async remove() {
    await storage.removeItem(AUTH_TOKENS_KEY);
  },
};

const authSessionStorageAuthority = createAuthSessionStorageAuthority(
  authSessionStorageAdapter,
);

export async function getStoredAuthTokens(): Promise<ExtensionAuthTokens | null> {
  return authSessionStorageAdapter.get();
}

export async function setStoredAuthTokens(tokens: ExtensionAuthTokens): Promise<void> {
  await authSessionStorageAuthority.replace(tokens);
}

export async function clearStoredAuthTokens(): Promise<void> {
  await authSessionStorageAuthority.clear();
}

export async function commitStoredAuthTokensIfCurrent(
  expected: ExtensionAuthTokens,
  replacement: ExtensionAuthTokens | null,
): Promise<AuthSessionMutationResult> {
  return authSessionStorageAuthority.commitIfCurrent(expected, replacement);
}

export async function clearStoredAuthTokensIfRefreshToken(
  expectedRefreshToken: string,
): Promise<AuthSessionMutationResult> {
  return authSessionStorageAuthority.clearIfRefreshToken(expectedRefreshToken);
}
