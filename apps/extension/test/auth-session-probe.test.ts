import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ data: new Map<string, unknown>() }));
vi.mock("wxt/utils/storage", () => ({
	storage: {
		getItem: async (key: string) => state.data.get(key) ?? null,
		setItem: async (key: string, value: unknown) => {
			state.data.set(key, structuredClone(value));
		},
		removeItem: async (key: string) => {
			state.data.delete(key);
		},
	},
}));
vi.mock("../src/diagnostic-log", () => ({ recordDiagnosticEvent: vi.fn() }));
import {
	getCurrentExtensionSession,
	exchangeExtensionAuthCode,
	refreshExtensionSession,
	ExtensionAuthTemporarilyUnavailableError,
} from "../src/auth-client";
import {
	AUTH_TOKENS_KEY,
	clearStoredAuthTokens,
	clearStoredAuthTokensIfRefreshToken,
	getStoredAuthTokens,
	setStoredAuthTokens,
	commitStoredAuthTokensIfCurrent,
} from "../src/auth-tokens";
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
});
afterEach(() => {
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
