import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { api } from "../client-api";
import {
	createWatchHistoryV3RouteHandlers,
	type WatchHistoryV3RouteDependencies,
} from "./watch-history-v3-routes";
import {
	deleteWatchHistoryV3,
	updateWatchHistoryPreferencesV3,
	type WatchHistoryV3Store,
} from "./watch-history-v3";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const at = "2026-09-05T00:00:00.000Z";
const header = "x-anidachi-history-owner";
const deletion = {
	schemaVersion: 3,
	clientMutationId: "33333333-3333-4333-8333-333333333333",
	accountGeneration: 2,
	target: { scope: "all" },
	requestedAt: at,
};
const unexpected = async (): Promise<never> => {
	throw new Error("Unexpected dependency");
};
function dependencies(
	overrides: Partial<WatchHistoryV3RouteDependencies>,
): WatchHistoryV3RouteDependencies {
	return {
		getSession: unexpected,
		listHistory: unexpected,
		listTitleEpisodes: unexpected,
		applyProgress: unexpected,
		beginCatalog: unexpected,
		applyCatalog: unexpected,
		getPreferences: unexpected,
		updatePreferences: unexpected,
		deleteHistory: unexpected,
		createRoomFromSession: unexpected,
		...overrides,
	};
}

for (const kind of ["delete", "preferences"] as const) {
	for (const refresh of [false, true]) {
		test(`${kind}: stale rendered A intent cannot write B with equal generation${refresh ? " after 401 refresh" : " directly"}`, async () => {
			const writes: string[] = [];
			const meta = (owner: string, generation = 2) => ({
				ownerUserId: owner,
				accountGeneration: generation,
				schemaVersion: 3 as const,
				serverTime: at,
			});
			const store = {
				deleteHistory: async (owner, request) => {
					writes.push(owner);
					return {
						schemaVersion: 3,
						clientMutationId: request.clientMutationId,
						target: request.target,
						meta: meta(owner, 3),
						accountGeneration: 3,
						deletedAt: at,
					};
				},
				setPreferences: async (owner, preferences) => {
					writes.push(owner);
					return { meta: meta(owner), preferences };
				},
			} as WatchHistoryV3Store;
			const handlers = createWatchHistoryV3RouteHandlers(
				dependencies({
					getSession: async () => ({
						userId: B,
						email: "test@example.invalid",
						plan: "free",
						source: "cookie",
					}),
					deleteHistory: (params) => deleteWatchHistoryV3({ ...params, store }),
					updatePreferences: (params) =>
						updateWatchHistoryPreferencesV3({ ...params, store }),
				}),
			);
			const previousFetch = globalThis.fetch;
			const owners: (string | null)[] = [];
			let refreshes = 0;
			globalThis.fetch = async (path, init) => {
				if (path === "/api/auth/refresh") {
					refreshes++;
					return Response.json({ ok: true });
				}
				owners.push(new Headers(init?.headers).get(header));
				if (refresh && owners.length === 1)
					return Response.json({}, { status: 401 });
				const request = new NextRequest(`https://example.invalid${path}`, {
					...init,
					signal: init?.signal ?? undefined,
				});
				return kind === "delete"
					? handlers.postDelete(request)
					: handlers.patchPreferences(request);
			};
			try {
				await assert.rejects(
					api(`/api/watch-history/v3/${kind}`, {
						method: kind === "delete" ? "POST" : "PATCH",
						headers: { [header]: A },
						body: JSON.stringify(
							kind === "delete" ? deletion : { youtubeHistoryEnabled: true },
						),
					}),
					/owner changed/i,
				);
				assert.deepEqual(writes, []);
				assert.deepEqual(owners, refresh ? [A, A] : [A]);
				assert.equal(refreshes, refresh ? 1 : 0);
			} finally {
				globalThis.fetch = previousFetch;
			}
		});
	}

	test(`${kind}: cookie mutations require a valid matching owner; extension bearer dispatch remains supported`, async () => {
		for (const [source, owner, status] of [
			["cookie", undefined, 400],
			["cookie", "invalid", 400],
			["cookie", B, 409],
			["cookie", A, 200],
			["extension", undefined, 200],
			["extension", B, 409],
		] as const) {
			const writes: string[] = [];
			const handlers = createWatchHistoryV3RouteHandlers(
				dependencies({
					getSession: async () => ({
						userId: A,
						email: "test@example.invalid",
						plan: "free",
						source,
					}),
					deleteHistory: async ({ userId }) => {
						writes.push(userId);
						return {} as never;
					},
					updatePreferences: async ({ userId }) => {
						writes.push(userId);
						return {} as never;
					},
				}),
			);
			const request = new NextRequest(
				"https://example.invalid/api/watch-history/v3/" + kind,
				{
					method: kind === "delete" ? "POST" : "PATCH",
					headers: owner === undefined ? {} : { [header]: owner },
					body: JSON.stringify(
						kind === "delete" ? deletion : { youtubeHistoryEnabled: true },
					),
				},
			);
			const response = await (kind === "delete"
				? handlers.postDelete(request)
				: handlers.patchPreferences(request));
			assert.equal(response.status, status, `${source}/${owner}`);
			assert.deepEqual(writes, status === 200 ? [A] : []);
		}
	});
}
