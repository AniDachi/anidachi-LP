import assert from "node:assert/strict";
import test from "node:test";
import {
	ACCOUNT_HOSTING_OWNER_HEADER,
	FREE20_CONTEXT_HEADER,
} from "@anidachi/protocol";
import { NextRequest } from "next/server";
import {
	createAccountHostingStatusHandler,
	readFree20PublicStatusAuthority,
	readFree20StatusAuthority,
} from "./account-hosting-status";
import { createFree20AbuseTokens } from "./free20-abuse";
import { signProof } from "./free20-abuse.test-support";
import { createTrialAbuseTokens } from "./trial-abuse";

const owner = "fa200000-0000-4000-8000-000000000001",
	origin = "https://status.example.test",
	secret = "status-context-test-secret";
async function fixture(run: (calls: string[]) => Promise<void>) {
	const env = {
		ANIDACHI_FREE20_ABUSE_ENABLED: "true",
		ANIDACHI_FREE20_ACCOUNTING_ENABLED: "true",
		ANIDACHI_JWT_SECRET: secret,
		NEXT_PUBLIC_SITE_URL: origin,
		NEXT_PUBLIC_SUPABASE_URL: "https://status-db.example.test",
		SUPABASE_SERVICE_ROLE_KEY: "test-role",
	};
	const saved = Object.fromEntries(
			Object.keys(env).map((key) => [key, process.env[key]]),
		),
		fetch = globalThis.fetch,
		calls: string[] = [];
	Object.assign(process.env, env);
	globalThis.fetch = async (input, init) => {
		const request = new Request(input, init),
			path = new URL(request.url).pathname;
		calls.push(path);
		const args = await request.json();
		assert.equal(args.p_user_id, owner);
		const scoped = path.endsWith("/read_free20_context_status_v1");
		assert.ok(scoped || path.endsWith("/read_free20_account_status_v1"));
		if (scoped && (!args.p_browser_hash || !args.p_installation_hash))
			return Response.json(
				{ code: "P0001", message: "FREE20_CONTEXT_REQUIRED" },
				{ status: 400 },
			);
		const now = Date.now();
		return Response.json({
			enabled: true,
			...(scoped ? { abuseEnabled: true } : {}),
			ownerUserId: owner,
			planCode: "free",
			serverTime: new Date(now).toISOString(),
			refreshBy: new Date(now + 60_000).toISOString(),
			resetAt: new Date(
				(Math.floor(now / 86400_000) + 1) * 86400_000,
			).toISOString(),
			accountGeneration: 1,
			accessEpoch: 1,
			committedSeconds: scoped ? 720 : 0,
			grant: null,
			assignment: null,
		});
	};
	try {
		await run(calls);
	} finally {
		globalThis.fetch = fetch;
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}
test("public finite status uses exactly one contextual read, while internal warning authority stays account-only", async () =>
	fixture(async (calls) => {
		const browser = createTrialAbuseTokens(secret, origin),
			tokens = createFree20AbuseTokens(secret, origin),
			cookie = browser.issueCookie(),
			requestId = "ac000000-0000-4000-8000-000000000001";
		const proof = await signProof(
			tokens.issueChallenge(cookie, owner, requestId),
		);
		const context = (await tokens.complete(cookie, owner, requestId, proof))
			.context;
		const handler = createAccountHostingStatusHandler({
			getSession: async () => ({
				userId: owner,
				email: "test@example.test",
				source: "extension",
				plan: "free",
			}),
		});
		const response = await handler(
			new NextRequest(origin + "/api/me/hosting-status", {
				headers: {
					[ACCOUNT_HOSTING_OWNER_HEADER]: owner,
					[FREE20_CONTEXT_HEADER]: context,
				},
			}),
		);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.equal(body.access.remainingSeconds, 480);
		assert.equal(JSON.stringify(body).includes("browser"), false);
		assert.equal(JSON.stringify(body).includes("abuseEnabled"), false);
		assert.equal(calls.length, 1);
		assert.ok(calls[0].endsWith("/read_free20_context_status_v1"));
		await readFree20StatusAuthority(owner);
		assert.ok(calls[1].endsWith("/read_free20_account_status_v1"));
	}));
test("missing or forged public context has no account-only fallback", async () =>
	fixture(async (calls) => {
		const handler = createAccountHostingStatusHandler({
			getSession: async () => ({
				userId: owner,
				email: "test@example.test",
				source: "extension",
				plan: "free",
			}),
		});
		for (const token of [undefined, "forged-context"]) {
			const response = await handler(
				new NextRequest(origin + "/api/me/hosting-status", {
					headers: {
						[ACCOUNT_HOSTING_OWNER_HEADER]: owner,
						...(token ? { [FREE20_CONTEXT_HEADER]: token } : {}),
					},
				}),
			);
			assert.equal(response.status, 428);
			assert.deepEqual(await response.json(), {
				code: "FREE20_CONTEXT_REQUIRED",
			});
		}
		await assert.rejects(
			() => readFree20PublicStatusAuthority(owner),
			/FREE20_CONTEXT_REQUIRED/,
		);
		assert.equal(calls.length, 3);
		assert.ok(calls.every((x) => x.endsWith("/read_free20_context_status_v1")));
	}));
