import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

test("browse route rejects duplicate filters and client ownership before service access", async () => {
	const { createWatchHistoryBrowseHandler } = await import(
		"./watch-history-browse-routes"
	);
	let calls = 0;
	const handler = createWatchHistoryBrowseHandler("titles", {
		getSession: async () => ({
			userId: "11111111-1111-4111-8111-111111111111",
			email: "owner@example.test",
			plan: "free",
			source: "extension",
		}),
		browse: async () => {
			calls++;
			return {};
		},
	});
	for (const query of [
		"mode=shared&mode=solo",
		"mode=shared&userId=other",
		"mode=solo&groupId=11111111-1111-4111-8111-111111111111",
	]) {
		const response = await handler(
			new NextRequest(`http://localhost/api/watch-history/v3/browse?${query}`),
		);
		assert.equal(response.status, 400);
	}
	assert.equal(calls, 0);
});
test("browse route requires authenticated owner and disables shared caching", async () => {
	const { createWatchHistoryBrowseHandler } = await import(
		"./watch-history-browse-routes"
	);
	const denied = createWatchHistoryBrowseHandler("titles", {
		getSession: async () => null,
		browse: async () => {
			throw new Error("must not read");
		},
	});
	assert.equal(
		(
			await denied(
				new NextRequest(
					"http://localhost/api/watch-history/v3/browse?mode=shared",
				),
			)
		).status,
		401,
	);
	let owner: string | undefined;
	const handler = createWatchHistoryBrowseHandler("titles", {
		getSession: async () => ({
			userId: "11111111-1111-4111-8111-111111111111",
			email: "owner@example.test",
			plan: "free",
			source: "cookie",
		}),
		browse: async (params) => {
			owner = params.userId;
			return {};
		},
	});
	const response = await handler(
		new NextRequest(
			"http://localhost/api/watch-history/v3/browse?mode=shared&limit=5",
		),
	);
	assert.equal(response.status, 200);
	assert.equal(owner, "11111111-1111-4111-8111-111111111111");
	assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});
