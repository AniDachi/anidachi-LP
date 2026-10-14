import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ data: new Map<string, unknown>(), authWrites: [] as unknown[] }));
vi.mock("wxt/utils/storage", () => ({
	storage: {
		getItem: async (key: string) => state.data.get(key) ?? null,
		setItem: async (key: string, value: unknown) => {
			state.data.set(key, structuredClone(value));
			if (key === "local:authTokens") state.authWrites.push(structuredClone(value));
		},
		removeItem: async (key: string) => {
			state.data.delete(key);
		},
	},
}));
vi.mock("../src/diagnostic-log", () => ({ recordDiagnosticEvent: vi.fn() }));
import {
	getCurrentExtensionSession,
	reconcileExtensionSessionAgainstWebsite,
	handleAuthMessage,
	requestCurrentExtensionSession,
	exchangeExtensionAuthCode,
	refreshExtensionSession,
	ExtensionAuthTemporarilyUnavailableError,
} from "../src/auth-client";
import {
	AUTH_TOKENS_KEY,
	clearStoredAuthTokens,
	clearStoredAuthTokensIfRefreshToken,
	getStoredAuthTokens,
	getBackgroundAuthRevision,
	setStoredAuthTokens,
	commitStoredAuthTokensIfCurrent,
} from "../src/auth-tokens";
import { invalidateWatchHistoryOnAuthStorageChange, shouldRefreshWatchHistoryAuthority } from "../src/watch-history-runtime-policy";
const tokens = {
	accessToken: "access",
	refreshToken: "refresh",
	user: {
		id: "one",
		email: "one@example.com",
		displayName: "One",
		avatarUrl: null,
		plan: "plus" as const,
	},
};
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}
beforeEach(() => {
	state.data.clear();
	state.authWrites.length = 0;
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("pending authenticated profile probes", () => {
	it.each([
		1, 5, 20,
	])("shares one network probe for %i simultaneous callers and does not reuse a completed result", async (count) => {
		await setStoredAuthTokens(tokens);
		const gate = deferred<Response>();
		const request = vi.fn(() => gate.promise);
		vi.stubGlobal("fetch", request);
		const pending = Array.from({ length: count }, () =>
			getCurrentExtensionSession(),
		);
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
		gate.resolve(Response.json({ user: tokens.user }));
		expect(
			(await Promise.all(pending)).every((value) => value?.user.id === "one"),
		).toBe(true);
		request.mockImplementation(async () =>
			Response.json({ user: tokens.user }),
		);
		await getCurrentExtensionSession();
		expect(request).toHaveBeenCalledTimes(2);
	});
	it("does not probe without an account", async () => {
		const request = vi.fn();
		vi.stubGlobal("fetch", request);
		expect(await getCurrentExtensionSession()).toBeNull();
		expect(request).not.toHaveBeenCalled();
	});
	it.each([
		429, 500, 503, 403, 404,
	])("keeps the session without refreshing after HTTP %i", async (status) => {
		await setStoredAuthTokens(tokens);
		const before = await getStoredAuthTokens();
		const request = vi.fn(async () => new Response(null, { status }));
		vi.stubGlobal("fetch", request);
		await expect(getCurrentExtensionSession()).rejects.toBeInstanceOf(
			ExtensionAuthTemporarilyUnavailableError,
		);
		expect(await getStoredAuthTokens()).toEqual(before);
		expect(request).toHaveBeenCalledTimes(1);
	});
	it.each([
		"network",
		"malformed",
	])("keeps the session without refreshing after %s failure", async (kind) => {
		await setStoredAuthTokens(tokens);
		const before = await getStoredAuthTokens();
		const request = vi.fn(async () => {
			if (kind === "network") throw new TypeError("offline");
			return Response.json({ user: {} });
		});
		vi.stubGlobal("fetch", request);
		await expect(getCurrentExtensionSession()).rejects.toBeInstanceOf(
			ExtensionAuthTemporarilyUnavailableError,
		);
		expect(await getStoredAuthTokens()).toEqual(before);
		expect(request).toHaveBeenCalledTimes(1);
	});
	it("refreshes once after a rejected bearer and persists rotation before an unavailable profile", async () => {
		await setStoredAuthTokens(tokens);
		const before = await getStoredAuthTokens();
		const paths: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				const path = new URL(url).pathname;
				paths.push(path);
				return path.endsWith("/refresh")
					? Response.json({
							accessToken: "next-access",
							refreshToken: "next-refresh",
						})
					: new Response(null, { status: paths.length === 1 ? 401 : 503 });
			}),
		);
		await expect(getCurrentExtensionSession()).rejects.toBeInstanceOf(
			ExtensionAuthTemporarilyUnavailableError,
		);
		const stored = await getStoredAuthTokens();
		expect(stored).toMatchObject({
			accessToken: "next-access",
			refreshToken: "next-refresh",
			user: tokens.user,
		});
		expect((stored as any)?.authRevision).not.toBe(
			(before as any)?.authRevision,
		);
		expect(paths).toEqual([
			"/api/me",
			"/api/extension/auth/refresh",
			"/api/me",
		]);
	});
	it("does not refresh or publish a late old 401 after same-token logout and login", async () => {
		await setStoredAuthTokens(tokens);
		const gate = deferred<Response>();
		const request = vi.fn(() => gate.promise);
		vi.stubGlobal("fetch", request);
		const pending = getCurrentExtensionSession();
		await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
		await clearStoredAuthTokens();
		await setStoredAuthTokens(tokens);
		gate.resolve(new Response(null, { status: 401 }));
		await expect(pending).rejects.toBeInstanceOf(
			ExtensionAuthTemporarilyUnavailableError,
		);
		expect(request).toHaveBeenCalledTimes(1);
		expect(await getStoredAuthTokens()).toMatchObject(tokens);
	});
	it("new revision cannot join an older pending probe", async () => {
		await setStoredAuthTokens(tokens);
		const first = deferred<Response>(),
			second = deferred<Response>();
		const request = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		vi.stubGlobal("fetch", request);
		const old = getCurrentExtensionSession();
		const oldResult = old.catch((error) => error);
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
		await clearStoredAuthTokens();
		await setStoredAuthTokens(tokens);
		const next = getCurrentExtensionSession();
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
		first.resolve(Response.json({ user: tokens.user }));
		second.resolve(Response.json({ user: tokens.user }));
		expect(await oldResult).toBeInstanceOf(
			ExtensionAuthTemporarilyUnavailableError,
		);
		expect(await next).toMatchObject(tokens);
	});
	it.each([
		5, 20,
	])("shares exactly one refresh for %i simultaneous unauthorized probes", async (count) => {
		await setStoredAuthTokens(tokens);
		const profile = deferred<Response>(),
			refresh = deferred<Response>();
		const paths: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((url: string, init: RequestInit) => {
				const path = new URL(url).pathname;
				paths.push(path);
				if (path.endsWith("/refresh")) return refresh.promise;
				return (init.headers as Record<string, string>).Authorization ===
					"Bearer access"
					? profile.promise
					: Promise.resolve(Response.json({ user: tokens.user }));
			}),
		);
		const pending = Array.from({ length: count }, () =>
			getCurrentExtensionSession(),
		);
		await vi.waitFor(() => expect(paths).toEqual(["/api/me"]));
		profile.resolve(new Response(null, { status: 401 }));
		await vi.waitFor(() =>
			expect(paths).toEqual(["/api/me", "/api/extension/auth/refresh"]),
		);
		refresh.resolve(
			Response.json({
				accessToken: "rotated-access",
				refreshToken: "rotated-refresh",
			}),
		);
		expect(
			(await Promise.all(pending)).every(
				(value) => value?.accessToken === "rotated-access",
			),
		).toBe(true);
		expect(paths).toEqual([
			"/api/me",
			"/api/extension/auth/refresh",
			"/api/me",
		]);
	});
	it("does not let a stale metadata write undo a known rights change", async () => {
		await setStoredAuthTokens(tokens);
		const old = (await getStoredAuthTokens())!;
		await commitStoredAuthTokensIfCurrent(old, {
			...old,
			user: { ...old.user, plan: "pro" },
		});
		const rejected = await commitStoredAuthTokensIfCurrent(old, {
			...old,
			user: { ...old.user, displayName: "Late", plan: "plus" },
		});
		expect(rejected.committed).toBe(false);
		expect((await getStoredAuthTokens())?.user.plan).toBe("pro");
	});

	it("a late login exchange cannot restore logout or overwrite a replacement account", async () => {
		await setStoredAuthTokens(tokens);
		const gate = deferred<Response>();
		const request = vi.fn(() => gate.promise);
		vi.stubGlobal("fetch", request);
		const pending = exchangeExtensionAuthCode({
			clientId: "a".repeat(32),
			redirectUri: `https://${"a".repeat(32)}.chromiumapp.org/auth`,
			state: "s".repeat(32),
			code: "c".repeat(32),
			codeVerifier: "v".repeat(43),
		});
		const outcome = pending.catch((error) => error);
		await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
		await clearStoredAuthTokens();
		await setStoredAuthTokens({
			...tokens,
			user: { ...tokens.user, id: "two" },
		});
		gate.resolve(Response.json(tokens));
		expect(await outcome).toBeInstanceOf(
			ExtensionAuthTemporarilyUnavailableError,
		);
		expect((await getStoredAuthTokens())?.user.id).toBe("two");
	});
	it("a successful refresh creates a revision even if credentials are unchanged", async () => {
		await setStoredAuthTokens(tokens);
		const before = await getStoredAuthTokens();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) =>
				new URL(url).pathname.endsWith("/refresh")
					? Response.json({ accessToken: "access", refreshToken: "refresh" })
					: Response.json({ user: tokens.user }),
			),
		);
		expect(await refreshExtensionSession()).toMatchObject(tokens);
		expect((await getStoredAuthTokens())?.authRevision).not.toBe(
			before?.authRevision,
		);
	});

	it("does not clear same-token login for a late invalid refresh", async () => {
		await setStoredAuthTokens(tokens);
		const gate = deferred<Response>();
		const request = vi.fn(() => gate.promise);
		vi.stubGlobal("fetch", request);
		const pending = refreshExtensionSession();
		const outcome = pending.catch((error) => error);
		await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
		await clearStoredAuthTokens();
		await setStoredAuthTokens(tokens);
		gate.resolve(new Response(null, { status: 401 }));
		expect(await outcome).toBeInstanceOf(
			ExtensionAuthTemporarilyUnavailableError,
		);
		expect(await getStoredAuthTokens()).toMatchObject(tokens);
	});
	it("does not let an abandoned waiter abort another caller", async () => {
		await setStoredAuthTokens(tokens);
		const gate = deferred<Response>();
		const request = vi.fn(() => gate.promise);
		vi.stubGlobal("fetch", request);
		const first = getCurrentExtensionSession();
		const second = getCurrentExtensionSession();
		const abandoned = await Promise.race([first, Promise.resolve("cancelled")]);
		expect(abandoned).toBe("cancelled");
		await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
		gate.resolve(Response.json({ user: tokens.user }));
		expect(await second).toMatchObject(tokens);
		await first;
		expect(request.mock.calls[0]).toBeDefined();
	});
	it("times out an unresolved profile without refreshing or clearing cached identity", async () => {
		vi.useFakeTimers();
		await setStoredAuthTokens(tokens);
		const gate = deferred<Response>();
		const request = vi.fn(() => gate.promise);
		vi.stubGlobal("fetch", request);
		const pending = getCurrentExtensionSession();
		const outcome = pending.catch((error) => error);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(await outcome).toBeInstanceOf(
			ExtensionAuthTemporarilyUnavailableError,
		);
		expect(await getStoredAuthTokens()).toMatchObject(tokens);
		expect(request).toHaveBeenCalledOnce();
		gate.resolve(Response.json({ user: tokens.user }));
	});
	it("does not publish account A profile after replacement by B", async () => {
		await setStoredAuthTokens(tokens);
		const gate = deferred<Response>();
		const request = vi.fn(() => gate.promise);
		vi.stubGlobal("fetch", request);
		const pending = getCurrentExtensionSession();
		const outcome = pending.catch((error) => error);
		await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
		await setStoredAuthTokens({
			...tokens,
			accessToken: "B-access",
			refreshToken: "B-refresh",
			user: { ...tokens.user, id: "two" },
		});
		gate.resolve(Response.json({ user: tokens.user }));
		expect(await outcome).toBeInstanceOf(
			ExtensionAuthTemporarilyUnavailableError,
		);
		expect((await getStoredAuthTokens())?.user.id).toBe("two");
		expect(request).toHaveBeenCalledOnce();
	});
	it("a known plan change cannot join or overwrite a pending older profile", async () => {
		await setStoredAuthTokens(tokens);
		const gate = deferred<Response>();
		const request = vi
			.fn()
			.mockReturnValueOnce(gate.promise)
			.mockResolvedValueOnce(
				Response.json({ user: { ...tokens.user, plan: "pro" } }),
			);
		vi.stubGlobal("fetch", request);
		const pending = getCurrentExtensionSession();
		const outcome = pending.catch((error) => error);
		await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
		const current = (await getStoredAuthTokens())!;
		await commitStoredAuthTokensIfCurrent(current, {
			...current,
			user: { ...current.user, plan: "pro" },
		});
		const next = getCurrentExtensionSession();
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
		gate.resolve(Response.json({ user: tokens.user }));
		expect(await outcome).toBeInstanceOf(
			ExtensionAuthTemporarilyUnavailableError,
		);
		expect((await next)?.user.plan).toBe("pro");
		expect((await getStoredAuthTokens())?.user.plan).toBe("pro");
	});
});

describe("durable session revision", () => {
  it("refuses token-only clears once a durable revision exists", async () => {
    await setStoredAuthTokens(tokens);
    expect((await clearStoredAuthTokensIfRefreshToken("refresh")).committed).toBe(false);
    expect(await getStoredAuthTokens()).toMatchObject(tokens);
  });

	it("persists tombstone on logout and fences same-token ABA and credential changes", async () => {
		await setStoredAuthTokens(tokens);
		const old = await getStoredAuthTokens();
		expect((old as any)?.authRevision).toEqual(expect.any(String));
		await clearStoredAuthTokens();
		expect(state.data.get(AUTH_TOKENS_KEY)).toMatchObject({
			authRevision: expect.any(String),
		});
		expect(await getStoredAuthTokens()).toBeNull();
		await setStoredAuthTokens(tokens);
		expect((await commitStoredAuthTokensIfCurrent(old!, null)).committed).toBe(
			false,
		);
		const current = await getStoredAuthTokens();
		await commitStoredAuthTokensIfCurrent(current!, {
			...current!,
			user: { ...tokens.user, plan: "pro" },
		});
		expect(((await getStoredAuthTokens()) as any)?.authRevision).toBe(
			(current as any)?.authRevision,
		);
	});
	it("initializes legacy storage once when background probes and preserves the revision on restart", async () => {
		state.data.set(AUTH_TOKENS_KEY, tokens);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ user: tokens.user })),
		);
		await getCurrentExtensionSession();
		const initialized = await getStoredAuthTokens();
		expect((initialized as any)?.authRevision).toEqual(expect.any(String));
		vi.resetModules();
		const restarted = await import("../src/auth-client");
		await restarted.getCurrentExtensionSession();
		expect(((await getStoredAuthTokens()) as any)?.authRevision).toBe(
			(initialized as any)?.authRevision,
		);
	});
});

describe("review regressions at the production session boundary", () => {
  function enableWebsiteAdoption() {
    const clientId = "a".repeat(32);
    const launch = vi.fn(async ({ url }: { url: string }) => {
      const state = new URL(url).searchParams.get("state");
      return `https://${clientId}.chromiumapp.org/auth?code=${"c".repeat(32)}&state=${state}`;
    });
    vi.stubGlobal("chrome", {
      runtime: { id: clientId },
      identity: {
        getRedirectURL: () => `https://${clientId}.chromiumapp.org/auth`,
        launchWebAuthFlow: launch,
      },
    });
    return launch;
  }

  it.each(["invalid", "success"] as const)(
    "does not silently reauthenticate logout after a late %s refresh",
    async (result) => {
      await setStoredAuthTokens(tokens);
      const launch = enableWebsiteAdoption();
      const refresh = deferred<Response>();
      const paths: string[] = [];
      vi.stubGlobal("fetch", vi.fn((url: string) => {
        const path = new URL(url).pathname;
        paths.push(path);
        if (path.endsWith("/refresh")) return refresh.promise;
        if (path.endsWith("/exchange")) return Promise.resolve(Response.json(tokens));
        return Promise.resolve(new Response(null, { status: 401 }));
      }));
      const pending = getCurrentExtensionSession();
      await vi.waitFor(() => expect(paths).toEqual(["/api/me", "/api/extension/auth/refresh"]));
      await clearStoredAuthTokens();
      refresh.resolve(result === "invalid"
        ? new Response(null, { status: 401 })
        : Response.json({ accessToken: "next-access", refreshToken: "next-refresh" }));
      expect(await pending).toBeNull();
      expect(await getStoredAuthTokens()).toBeNull();
      expect(launch).not.toHaveBeenCalled();
      expect(paths).toEqual(["/api/me", "/api/extension/auth/refresh"]);
    },
  );

  it("keeps legitimate invalid-family website recovery available", async () => {
    await setStoredAuthTokens(tokens);
    const launch = enableWebsiteAdoption();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new URL(url).pathname.endsWith("/exchange")
      ? Response.json(tokens)
      : new Response(null, { status: 401 })));
    expect(await getCurrentExtensionSession()).toMatchObject(tokens);
    expect(launch).toHaveBeenCalledOnce();
  });

  it.each(["browser", "exchange"] as const)("logout while fallback %s adoption is pending remains signed out", async stage => {
    await setStoredAuthTokens(tokens);
    const launch = enableWebsiteAdoption();
    const browser = deferred<string>();
    const exchange = deferred<Response>();
    let callbackUrl = "";
    if (stage === "browser") launch.mockImplementationOnce(async ({url}) => {
      callbackUrl = `https://${"a".repeat(32)}.chromiumapp.org/auth?code=${"c".repeat(32)}&state=${new URL(url).searchParams.get("state")}`;
      return browser.promise;
    });
    const paths:string[]=[];
    vi.stubGlobal("fetch", vi.fn(async (url:string) => {
      const path = new URL(url).pathname; paths.push(path);
      return path.endsWith("/exchange") ? exchange.promise : new Response(null,{status:401});
    }));
    const pending=getCurrentExtensionSession();
    await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());
    if (stage === "exchange") await vi.waitFor(() => expect(paths).toContain("/api/extension/auth/exchange"));
    await clearStoredAuthTokens();
    browser.resolve(callbackUrl); exchange.resolve(Response.json(tokens));
    expect(await pending).toBeNull(); expect(await getStoredAuthTokens()).toBeNull();
  });

  it("does not launch fallback adoption if a newer logout supersedes its own invalid-family tombstone", async () => {
    await setStoredAuthTokens(tokens);
    const launch=enableWebsiteAdoption();
    const removed=deferred<void>(); const release=deferred<void>();
    const {storage} = await import("wxt/utils/storage");
    const remove = vi.spyOn(storage,"removeItem").mockImplementation(async () => { removed.resolve(); await release.promise; });
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:401})));
    const pending=getCurrentExtensionSession(); await removed.promise;
    expect(await getStoredAuthTokens()).toBeNull();
    await clearStoredAuthTokens(); release.resolve();
    expect(await pending).toBeNull(); expect(launch).not.toHaveBeenCalled(); remove.mockRestore();
  });

  it("migrates revision-bearing old records conservatively without changing their credential family", async () => {
    const old = {...tokens,authRevision:"existing-credential-family"};
    state.data.set(AUTH_TOKENS_KEY,old);
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json({user:tokens.user})));
    const migrated=await getCurrentExtensionSession();
    expect(migrated?.authRevision).toBe("existing-credential-family");
    expect(migrated?.profileRevision).toBe(0);
    expect((await commitStoredAuthTokensIfCurrent(old,{...old,user:{...old.user,plan:"pro"}})).committed).toBe(false);
  });

  it("profile-only changes keep the history credential authority and propagate through retryable auth messages", async () => {
    await setStoredAuthTokens(tokens); const before=(await getStoredAuthTokens())!;
    await commitStoredAuthTokensIfCurrent(before,{...before,user:{...before.user,displayName:"Renamed"}});
    const after=(await getStoredAuthTokens())!;
    expect(after.authRevision).toBe(before.authRevision); expect(after.profileRevision).toBe(1);
    const controller={invalidateCaptureAuthority:vi.fn()};
    invalidateWatchHistoryOnAuthStorageChange(controller,after,before);
    expect(controller.invalidateCaptureAuthority).not.toHaveBeenCalled();
    expect(shouldRefreshWatchHistoryAuthority({previous:{ownerUserId:before.user.id,authRevision:before.authRevision,accessToken:before.accessToken},next:{ownerUserId:after.user.id,authRevision:after.authRevision,accessToken:after.accessToken},controllerAvailable:true})).toBe(false);
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:503})));
    const response=await handleAuthMessage({type:"ANIDACHI_AUTH",command:"get-session"});
    expect(response).toMatchObject({ok:false,retryable:true,tokens:{profileRevision:1}});
    vi.stubGlobal("chrome",{runtime:{sendMessage:async()=>response}});
    const error=await requestCurrentExtensionSession().catch(error=>error);
    expect(error).toBeInstanceOf(ExtensionAuthTemporarilyUnavailableError); expect(error.cachedTokens.profileRevision).toBe(1);
  });

  it("a rights ABA cannot join or publish a profile from before the changes", async () => {
    await setStoredAuthTokens(tokens);
    const original = (await getStoredAuthTokens())!;
    const held = deferred<Response>();
    const request = vi.fn().mockReturnValueOnce(held.promise).mockResolvedValueOnce(Response.json({ user: tokens.user }));
    vi.stubGlobal("fetch", request);
    const pending = getCurrentExtensionSession().catch(error => error);
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    await commitStoredAuthTokensIfCurrent(original, { ...original, user: { ...original.user, plan: "pro" } });
    const pro = (await getStoredAuthTokens())!;
    await commitStoredAuthTokensIfCurrent(pro, { ...pro, user: { ...pro.user, plan: "plus" } });
    const latest = (await getStoredAuthTokens())!;
    expect(latest.authRevision).toBe(original.authRevision);
    const current = getCurrentExtensionSession();
    // Settle the old response before asserting count so RED leaves no leaked promises.
    held.resolve(Response.json({ user: { ...tokens.user, plan: "pro" } }));
    const oldOutcome = await pending;
    const freshOutcome = await current;
    expect(request).toHaveBeenCalledTimes(2);
    expect(oldOutcome).toBeInstanceOf(ExtensionAuthTemporarilyUnavailableError);
    expect(freshOutcome?.user.plan).toBe("plus");
    expect((await getStoredAuthTokens())?.user.plan).toBe("plus");
    expect((latest as { profileRevision?: number }).profileRevision).toBe(2);
  });

  it("rejects stale metadata CAS after plus to pro to plus", async () => {
    await setStoredAuthTokens(tokens);
    const old = (await getStoredAuthTokens())!;
    await commitStoredAuthTokensIfCurrent(old, { ...old, user: { ...old.user, plan: "pro" } });
    const pro = (await getStoredAuthTokens())!;
    await commitStoredAuthTokensIfCurrent(pro, { ...pro, user: { ...pro.user, plan: "plus" } });
    expect((await commitStoredAuthTokensIfCurrent(old, { ...old, user: { ...old.user, plan: "pro" } })).committed).toBe(false);
    expect((await getStoredAuthTokens())?.user.plan).toBe("plus");
  });
});


describe("bounded exact-family website mismatch cleanup", () => {
  it("releases held revocation cleanup at the deadline and preserves queued account B after a late completion", async () => {
    vi.useFakeTimers();
    await setStoredAuthTokens(tokens);
    vi.stubGlobal("chrome", {});
    const accountB = { ...tokens, accessToken: "account-B-access", refreshToken: "account-B-refresh", user: { ...tokens.user, id: "two" } };
    const remote = deferred<Response>();
    const paths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      paths.push(path);
      if (path.endsWith("/website-session")) return Response.json({ user: accountB.user });
      if (path.endsWith("/logout")) return remote.promise;
      return Response.json({ user: accountB.user });
    }));
    const reconcile = reconcileExtensionSessionAgainstWebsite({ adoptIfMissing: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(paths).toEqual(["/api/extension/auth/website-session", "/api/extension/auth/logout"]);
    let probeDone = false, revisionDone = false, clearDone = false, replacementDone = false;
    const probe = getCurrentExtensionSession().then(value => { probeDone = true; return value; });
    const revision = getBackgroundAuthRevision().then(value => { revisionDone = true; return value; });
    const clear = clearStoredAuthTokens().then(() => { clearDone = true; });
    const replacement = setStoredAuthTokens(accountB).then(() => { replacementDone = true; });
    await vi.advanceTimersByTimeAsync(1_999);
    expect([probeDone, revisionDone, clearDone, replacementDone]).toEqual([false, false, false, false]);
    expect((await getStoredAuthTokens())?.user.id).toBe("one");
    await vi.advanceTimersByTimeAsync(1);
    // Settle remote in finally so RED also releases the real storage authority.
    try {
      expect([probeDone, revisionDone, clearDone, replacementDone]).toEqual([true, true, true, true]);
      expect(await probe).toBeNull();
      expect(await revision).toEqual(expect.any(String));
      expect(state.authWrites.slice(1, 3)).toEqual([
        { authRevision: expect.any(String) },
        { authRevision: expect.any(String) },
      ]);
      expect(await getStoredAuthTokens()).toMatchObject(accountB);
    } finally {
      remote.resolve(new Response(null, { status: 200 }));
      await Promise.all([reconcile, probe, revision, clear, replacement]);
    }
    expect(await getStoredAuthTokens()).toMatchObject(accountB);
    expect(paths).toEqual(["/api/extension/auth/website-session", "/api/extension/auth/logout"]);
  });
});
