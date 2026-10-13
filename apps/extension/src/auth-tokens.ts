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
  /** Durable credential generation, stored atomically with the credentials. */
  authRevision?: string;
  /** Metadata generation; advances independently of the credential family. */
  profileRevision?: number;
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

export interface AuthSessionStorageAdapter {
  get: () => Promise<ExtensionAuthTokens | null>;
  set: (tokens: ExtensionAuthTokens) => Promise<void>;
  remove: (authRevision?: string) => Promise<void>;
  durableRevision?: boolean;
  getRevision?: () => Promise<string | null>;
}

export type AuthSessionMutationResult = {
  committed: boolean;
  current: ExtensionAuthTokens | null;
  previous: ExtensionAuthTokens | null;
  /** Exact tombstone written by this mutation, never a later logout tombstone. */
  clearedRevision?: string;
};

export interface AuthSessionStorageAuthority {
  read: () => Promise<ExtensionAuthTokens | null>;
  readRevision: () => Promise<string | null>;
  replaceIfRevision: (
    expectedRevision: string | null,
    tokens: ExtensionAuthTokens,
  ) => Promise<AuthSessionMutationResult>;
  replace: (tokens: ExtensionAuthTokens) => Promise<void>;
  clear: () => Promise<void>;
  commitIfCurrent: (
    expected: ExtensionAuthTokens,
    replacement: ExtensionAuthTokens | null,
  ) => Promise<AuthSessionMutationResult>;
  clearIfCurrentAfter: (
    expected: ExtensionAuthTokens,
    beforeClear: (current: ExtensionAuthTokens) => Promise<void>,
  ) => Promise<AuthSessionMutationResult>;
  clearIfRefreshToken: (expectedRefreshToken: string, expectedRevision?: string) => Promise<AuthSessionMutationResult>;
}

export function isSameExtensionAuthSession(
  expected: ExtensionAuthTokens,
  current: ExtensionAuthTokens | null,
): boolean {
  return Boolean(
    current &&
      current.authRevision === expected.authRevision &&
      current.accessToken === expected.accessToken &&
      current.refreshToken === expected.refreshToken &&
      current.user.id === expected.user.id,
  );
}

export function isSameExtensionAuthProfile(
  expected: ExtensionAuthTokens,
  current: ExtensionAuthTokens | null,
): boolean {
  return isSameExtensionAuthSession(expected, current) &&
    current?.profileRevision === expected.profileRevision;
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

export function normalizeExtensionAuthTokens(
  value: unknown,
): ExtensionAuthTokens | null {
  if (!isRecord(value)) return null;
  if (typeof value.accessToken !== "string" || typeof value.refreshToken !== "string") {
    return null;
  }

  const user = normalizeAuthenticatedUser(value.user);
  if (!user) return null;

  return {
    ...(typeof value.authRevision === "string" && value.authRevision
      ? { authRevision: value.authRevision }
      : {}),
    ...(Number.isSafeInteger(value.profileRevision) && (value.profileRevision as number) >= 0
      ? { profileRevision: value.profileRevision as number } : {}),
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

  function withRevision(tokens: ExtensionAuthTokens): ExtensionAuthTokens {
    return adapter.durableRevision
      ? { ...tokens, authRevision: crypto.randomUUID(), profileRevision: tokens.profileRevision ?? 0 }
      : tokens;
  }

  async function read(): Promise<ExtensionAuthTokens | null> {
    const current = await adapter.get();
    if (!current || !adapter.durableRevision ||
      (current.authRevision && current.profileRevision !== undefined)) return current;
    const migrated = current.authRevision
      ? { ...current, profileRevision: 0 }
      : withRevision(current);
    await adapter.set(migrated);
    return migrated;
  }

  return {
    read() {
      return runSerialized(read);
    },
    readRevision() {
      return runSerialized(async () => {
        const current = await read();
        return current?.authRevision ?? (await adapter.getRevision?.()) ?? null;
      });
    },
    replaceIfRevision(expectedRevision, tokens) {
      return runSerialized(async () => {
        const current = await adapter.get();
        const revision =
          current?.authRevision ?? (await adapter.getRevision?.()) ?? null;
        if (revision !== expectedRevision)
          return { committed: false, current, previous: current };
        const next = withRevision(tokens);
        await adapter.set(next);
        return { committed: true, current: next, previous: current };
      });
    },
    replace(tokens) {
      return runSerialized(() => adapter.set(withRevision(tokens)));
    },
    clear() {
      return runSerialized(() =>
        adapter.remove(
          adapter.durableRevision ? crypto.randomUUID() : undefined,
        ),
      );
    },
    commitIfCurrent(expected, replacement) {
      return runSerialized(async () => {
        const current = await adapter.get();
        if (!current || !isSameExtensionAuthSession(expected, current)) {
          return { committed: false, current, previous: current };
        }

        const credentialsChanged = replacement && (
          replacement.authRevision !== current.authRevision ||
          replacement.accessToken !== current.accessToken ||
          replacement.refreshToken !== current.refreshToken ||
          replacement.user.id !== current.user.id
        );
        const profileChanged = !isSameExtensionAuthProfile(expected, current);
        if (profileChanged) {
          if (credentialsChanged && replacement) {
            // A refresh may have consumed credentials; retain the newer profile.
            replacement = { ...replacement, user: current.user, profileRevision: current.profileRevision };
          } else {
            return { committed: false, current, previous: current };
          }
        }
        const userChanged = replacement && (
          replacement.user.id !== current.user.id ||
          replacement.user.email !== current.user.email ||
          replacement.user.displayName !== current.user.displayName ||
          replacement.user.avatarUrl !== current.user.avatarUrl ||
          replacement.user.plan !== current.user.plan
        );
        const profileRevision = (current.profileRevision ?? 0) + (userChanged ? 1 : 0);
        if (!Number.isSafeInteger(profileRevision)) throw new Error("Auth profile generation exhausted");
        const next = replacement && {
          ...(credentialsChanged ? withRevision(replacement) : replacement),
          ...(current.authRevision && !credentialsChanged ? { authRevision: current.authRevision } : {}),
          ...(adapter.durableRevision ? { profileRevision } : {}),
        };
        const clearedRevision = !next && adapter.durableRevision ? crypto.randomUUID() : undefined;
        if (next) await adapter.set(next);
        else await adapter.remove(clearedRevision);
        return { committed: true, current: next, previous: current, ...(clearedRevision ? { clearedRevision } : {}) };
      });
    },
    clearIfCurrentAfter(expected, beforeClear) {
      return runSerialized(async () => {
        const current = await adapter.get();
        if (!current || !isSameExtensionAuthSession(expected, current)) {
          return { committed: false, current, previous: current };
        }

        try {
          await beforeClear(current);
        } finally {
          await adapter.remove(
            adapter.durableRevision ? crypto.randomUUID() : undefined,
          );
        }
        return { committed: true, current: null, previous: current };
      });
    },
    clearIfRefreshToken(expectedRefreshToken, expectedRevision) {
      return runSerialized(async () => {
        const current = await adapter.get();
        if (
          !current ||
          current.refreshToken !== expectedRefreshToken ||
          current.authRevision !== expectedRevision
        ) {
          return { committed: false, current, previous: current };
        }

        await adapter.remove(
          adapter.durableRevision ? crypto.randomUUID() : undefined,
        );
        return { committed: true, current: null, previous: current };
      });
    },
  };
}

const authSessionStorageAdapter: AuthSessionStorageAdapter = {
  durableRevision: true,
  async getRevision() {
    const stored = await storage.getItem<{ authRevision?: unknown }>(
      AUTH_TOKENS_KEY,
    );
    return typeof stored?.authRevision === "string"
      ? stored.authRevision
      : null;
  },
  async get() {
    const stored = await storage.getItem<unknown>(AUTH_TOKENS_KEY);
    return normalizeExtensionAuthTokens(stored);
  },
  async set(tokens) {
    await storage.setItem(AUTH_TOKENS_KEY, tokens);
  },
  async remove(authRevision) {
    await storage.setItem(AUTH_TOKENS_KEY, { authRevision });
  },
};

const authSessionStorageAuthority = createAuthSessionStorageAuthority(
  authSessionStorageAdapter,
);

export async function getBackgroundAuthRevision(): Promise<string | null> {
  return authSessionStorageAuthority.readRevision();
}

export async function replaceStoredAuthTokensIfRevision(
  expectedRevision: string | null,
  tokens: ExtensionAuthTokens,
): Promise<AuthSessionMutationResult> {
  return authSessionStorageAuthority.replaceIfRevision(
    expectedRevision,
    tokens,
  );
}

/** Only background auth flows call this migrating, serialized read. Other contexts read without writes. */
export async function getBackgroundAuthSession(): Promise<ExtensionAuthTokens | null> {
  return authSessionStorageAuthority.read();
}

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

export async function clearStoredAuthTokensIfCurrentAfter(
  expected: ExtensionAuthTokens,
  beforeClear: (current: ExtensionAuthTokens) => Promise<void>,
): Promise<AuthSessionMutationResult> {
  return authSessionStorageAuthority.clearIfCurrentAfter(expected, beforeClear);
}

/** Legacy token-only callers cannot clear a revision-bearing session. */
export async function clearStoredAuthTokensIfRefreshToken(
  expectedRefreshToken: string,
  expectedRevision?: string,
): Promise<AuthSessionMutationResult> {
  return authSessionStorageAuthority.clearIfRefreshToken(expectedRefreshToken, expectedRevision);
}
