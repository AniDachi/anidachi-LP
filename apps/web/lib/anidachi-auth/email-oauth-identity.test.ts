import assert from "node:assert/strict";
import { test } from "node:test";
import { upsertUser } from "./db";

const baseUser = {
	id: "11111111-1111-4111-8111-111111111111",
	email: "Existing@Example.com",
	display_name: "Name",
	avatar_url: null,
	google_id: null,
	discord_id: null,
	plan: "plus",
	created_at: "2026-01-01T00:00:00Z",
};
async function withDbFetch(run: () => Promise<void>, fetcher: typeof fetch) {
	const oldFetch = globalThis.fetch,
		url = process.env.NEXT_PUBLIC_SUPABASE_URL,
		key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://database.example.test";
	process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only-key";
	globalThis.fetch = fetcher;
	try {
		await run();
	} finally {
		globalThis.fetch = oldFetch;
		if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
		if (key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
		else process.env.SUPABASE_SERVICE_ROLE_KEY = key;
	}
}
const reply = (value: unknown, status = 200) =>
	new Response(JSON.stringify(value), {
		status,
		headers: { "Content-Type": "application/json" },
	});

test("verified Google or Discord attaches to existing email account, preserves ID and plan", async () => {
	for (const provider of ["google", "discord"] as const) {
		let writes = 0;
		await withDbFetch(
			async () => {
				const result = await upsertUser({
					email: "EXISTING@example.com",
					display_name: "Provider name",
					emailVerified: true,
					[`${provider}_id`]: "provider-id",
				});
				assert.equal(result.id, baseUser.id);
				assert.equal(result.plan, "plus");
				assert.equal(writes, 1);
			},
			async (input, init) => {
				const url = new URL(String(input));
				if (url.pathname.endsWith("/profiles"))
					return reply([
						{
							user_id: baseUser.id,
							display_name: "Custom name",
							avatar_url: "already-set",
						},
					]);
				if (init?.method === "PATCH") {
					writes++;
					const update = JSON.parse(init.body as string);
					assert.equal(url.searchParams.get("id"), `eq.${baseUser.id}`);
					assert.equal(update.plan, undefined);
					assert.equal(update.email, undefined);
					return reply({ ...baseUser, ...update });
				}
				assert.equal(
					url.searchParams.get("email"),
					"ilike.existing@example.com",
				);
				return reply([baseUser]);
			},
		);
	}
});
test("unverified provider cannot attach to an email-only account; existing same-provider login remains usable", async () => {
	let writes = 0;
	await withDbFetch(
		async () => {
			await assert.rejects(
				upsertUser({
					email: baseUser.email,
					display_name: "Someone",
					google_id: "new-google",
					emailVerified: false,
				}),
				/Verified email required/,
			);
			assert.equal(writes, 0);
		},
		async (_input, init) => {
			if (init?.method === "PATCH" || init?.method === "POST") writes++;
			return reply([baseUser]);
		},
	);
	await withDbFetch(
		async () => {
			assert.equal(
				(
					await upsertUser({
						email: baseUser.email,
						display_name: "Existing",
						google_id: "same-google",
						emailVerified: false,
					})
				).id,
				baseUser.id,
			);
		},
		async (input, init) => {
			if (String(input).includes("/profiles"))
				return reply([
					{
						user_id: baseUser.id,
						display_name: "Custom name",
						avatar_url: "set",
					},
				]);
			return reply(
				init?.method === "PATCH"
					? { ...baseUser, google_id: "same-google" }
					: [{ ...baseUser, google_id: "same-google" }],
			);
		},
	);
});
test("database lookup failures and provider identity conflicts cannot insert or overwrite users", async () => {
	for (const conflict of [false, true]) {
		let writes = 0;
		await withDbFetch(
			async () => {
				await assert.rejects(
					upsertUser({
						email: baseUser.email,
						display_name: "Other",
						google_id: "other-google",
						emailVerified: true,
					}),
				);
				assert.equal(writes, 0);
			},
			async (_input, init) => {
				if (init?.method === "POST" || init?.method === "PATCH") writes++;
				return conflict
					? reply([{ ...baseUser, google_id: "original-google" }])
					: reply({ message: "database unavailable" }, 503);
			},
		);
	}
});
test("concurrent email signup is re-read after unique conflict instead of duplicating an OAuth account", async () => {
	let reads = 0,
		inserts = 0;
	await withDbFetch(
		async () => {
			const result = await upsertUser({
				email: "existing@example.com",
				display_name: "Google",
				google_id: "google",
				emailVerified: true,
			});
			assert.equal(result.id, baseUser.id);
			assert.equal(inserts, 1);
			assert.equal(reads, 2);
		},
		async (input, init) => {
			if (String(input).includes("/profiles"))
				return reply([
					{
						user_id: baseUser.id,
						display_name: "Custom name",
						avatar_url: "set",
					},
				]);
			if (init?.method === "POST") {
				inserts++;
				return reply({ code: "23505", message: "duplicate" }, 409);
			}
			if (init?.method === "PATCH")
				return reply({ ...baseUser, google_id: "google" });
			return reply(++reads === 1 ? [] : [baseUser]);
		},
	);
});
