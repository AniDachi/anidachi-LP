import { describe, expect, it, vi } from "vitest";
import {
  createAuthSessionStorageAuthority,
  normalizeExtensionAuthTokens,
  type AuthSessionStorageAdapter,
  type ExtensionAuthTokens,
} from "../src/auth-tokens";

vi.mock("wxt/utils/storage", () => ({ storage: {} }));

const tokens: ExtensionAuthTokens = {
  accessToken: "access-a",
  refreshToken: "refresh-a",
  user: { id: "account-a", email: "a@example.com", displayName: "A", avatarUrl: null, plan: "free" },
};

function durableStorage(initial: ExtensionAuthTokens | null = null) {
  let stored = initial;
  let revision: string | null = initial?.authRevision ?? null;
  const adapter: AuthSessionStorageAdapter = {
    durableRevision: true,
    get: async () => stored,
    getRevision: async () => revision,
    set: vi.fn(async next => { stored = structuredClone(next); revision = next.authRevision ?? null; }),
    remove: async nextRevision => { stored = null; revision = nextRevision ?? null; },
  };
  return { adapter, authority: createAuthSessionStorageAuthority(adapter) };
}

describe("logical login identity", () => {
  it("preserves a valid logical ID when normalizing and ignores malformed optional IDs", () => {
    expect(normalizeExtensionAuthTokens({ ...tokens, authSessionId: "login-a" })?.authSessionId).toBe("login-a");
    for (const authSessionId of [undefined, null, "", 4, {}]) {
      expect(normalizeExtensionAuthTokens({ ...tokens, authSessionId })).toEqual(tokens);
    }
  });

  it("migrates an existing credential family once without changing credentials or profile generation, including after restart", async () => {
    const old = { ...tokens, authRevision: "credential-a", profileRevision: 3 };
    const { adapter, authority } = durableStorage(old);
    const migrated = (await authority.read())!;
    expect(migrated.authSessionId).toEqual(expect.any(String));
    expect(migrated).toMatchObject(old);
    expect(await authority.read()).toEqual(migrated);
    expect(await createAuthSessionStorageAuthority(adapter).read()).toEqual(migrated);
    expect(adapter.set).toHaveBeenCalledTimes(1);
  });

  it("gives legacy records both generations once without changing their tokens", async () => {
    const { adapter, authority } = durableStorage(tokens);
    const migrated = (await authority.read())!;
    expect(migrated).toMatchObject({ ...tokens, authSessionId: expect.any(String), authRevision: expect.any(String), profileRevision: 0 });
    expect(await authority.read()).toEqual(migrated);
    expect(adapter.set).toHaveBeenCalledTimes(1);
  });

  it("keeps the logical login across rotation of both tokens and credential revision, then profile updates", async () => {
    const { authority } = durableStorage();
    await authority.replace(tokens);
    const before = (await authority.read())!;
    expect(before.authSessionId).toEqual(expect.any(String));
    const refreshed = await authority.commitIfCurrent(before, {
      ...before, authSessionId: "untrusted-replacement-id", authRevision: "request-revision", accessToken: "access-b", refreshToken: "refresh-b",
    });
    expect(refreshed.committed).toBe(true);
    expect(refreshed.current?.authSessionId).toBe(before.authSessionId);
    expect(refreshed.current?.authRevision).not.toBe(before.authRevision);
    const profile = await authority.commitIfCurrent(refreshed.current!, {
      ...refreshed.current!, authSessionId: "untrusted-profile-id", user: { ...tokens.user, plan: "plus" },
    });
    expect(profile.current?.authSessionId).toBe(before.authSessionId);
    expect(profile.current?.authRevision).toBe(refreshed.current?.authRevision);
    expect(profile.current?.profileRevision).toBe(1);
  });

  it.each(["replace", "replaceIfRevision"] as const)("a new same-owner login through %s cannot reuse the old logical ID", async operation => {
    const { authority } = durableStorage();
    await authority.replace(tokens);
    const before = (await authority.read())!;
    expect(before.authSessionId).toEqual(expect.any(String));
    if (operation === "replace") await authority.replace(before);
    else expect((await authority.replaceIfRevision(before.authRevision!, before)).committed).toBe(true);
    const next = (await authority.read())!;
    expect(next.authSessionId).not.toBe(before.authSessionId);
    expect(next.authRevision).not.toBe(before.authRevision);
    expect(next.accessToken).toBe(before.accessToken);
    expect((await authority.commitIfCurrent(before, { ...before, accessToken: "late-refresh" })).committed).toBe(false);
    expect(await authority.read()).toEqual(next);
  });

  it("logout and login of the same account create a fresh logical ID and reject the previous credential family", async () => {
    const { authority } = durableStorage();
    await authority.replace(tokens);
    const before = (await authority.read())!;
    expect(before.authSessionId).toEqual(expect.any(String));
    await authority.clear();
    expect(await authority.read()).toBeNull();
    await authority.replace(before);
    const next = (await authority.read())!;
    expect(next.authSessionId).not.toBe(before.authSessionId);
    expect((await authority.commitIfCurrent(before, null)).committed).toBe(false);
    expect(await authority.read()).toEqual(next);
  });

  it("changing the owner through a guarded commit creates another logical ID", async () => {
    const { authority } = durableStorage();
    await authority.replace(tokens);
    const before = (await authority.read())!;
    expect(before.authSessionId).toEqual(expect.any(String));
    const changed = await authority.commitIfCurrent(before, { ...before, user: { ...tokens.user, id: "account-b" } });
    expect(changed.committed).toBe(true);
    expect(changed.current?.authSessionId).not.toBe(before.authSessionId);
  });

  it("does not accept a new login when its expected credential revision is stale", async () => {
    const { authority } = durableStorage();
    await authority.replace(tokens);
    const before = (await authority.read())!;
    expect((await authority.replaceIfRevision("stale-revision", tokens)).committed).toBe(false);
    expect(await authority.read()).toEqual(before);
  });
});
