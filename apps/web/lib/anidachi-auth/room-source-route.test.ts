import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/internal/rooms/[roomId]/source/route";

const source = {
	provider: "youtube",
	sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	videoFingerprint: "youtube|dQw4w9WgXcQ",
};
const callback = { roomId: "route-proof-room", sourceGeneration: 2, source };
const proof = {
	room_id: callback.roomId, status: "ended", source_provider: "youtube",
	source_url: source.sourceUrl, video_fingerprint: source.videoFingerprint,
	source_generation: 2,
};

for (const scenario of ["persisted", "newer-pending", "read-error", "conflict", "unauthorized"] as const) {
	test(`real source route and Supabase boundary: ${scenario}`, async () => {
		const priorFetch = globalThis.fetch;
		const environment = {
			NEXT_PUBLIC_SUPABASE_URL: "https://source-proof.invalid",
			SUPABASE_SERVICE_ROLE_KEY: "local-fixture-key",
			ANIDACHI_INTERNAL_API_SECRET: "local-fixture-secret",
		};
		const priorEnvironment = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
		Object.assign(process.env, environment);
		const paths: string[] = [];
		globalThis.fetch = async (input, init) => {
			const url = new URL(input instanceof Request ? input.url : String(input));
			assert.equal(url.origin, "https://source-proof.invalid");
			paths.push(url.pathname);
			if (url.pathname === "/rest/v1/rpc/persist_room_source_v1") {
				assert.equal(init?.method, "POST");
				assert.deepEqual(JSON.parse(String(init?.body)), {
					p_room_id: callback.roomId, p_source_provider: "youtube",
					p_source_url: source.sourceUrl, p_video_fingerprint: source.videoFingerprint,
					p_source_generation: 2,
				});
				return Response.json({ code: scenario === "conflict" ? "23514" : "55000", message: "private database detail" }, { status: 400 });
			}
			assert.equal(url.pathname, "/rest/v1/rooms");
			assert.equal(init?.method, "GET");
			assert.equal(url.searchParams.get("room_id"), "eq.route-proof-room");
			assert.deepEqual(url.searchParams.get("select")?.split(",").sort(),
				["room_id", "status", "source_provider", "source_url", "video_fingerprint", "source_generation"].sort());
			if (scenario === "read-error") return Response.json({ code: "42501", message: "private database detail" }, { status: 403 });
			return Response.json([{ ...proof, source_generation: scenario === "newer-pending" ? 1 : 2 }]);
		};
		try {
			const response = await POST(new NextRequest("https://web.test/api/internal/rooms/route-proof-room/source", {
				method: "POST", headers: {
					Authorization: `Bearer ${scenario === "unauthorized" ? "wrong" : "local-fixture-secret"}`,
					"Content-Type": "application/json",
				}, body: JSON.stringify(callback),
			}), { params: Promise.resolve({ roomId: callback.roomId }) });
			const body = await response.json();
			assert.equal(JSON.stringify(body).includes("private database detail"), false);
			assert.equal(response.status, scenario === "persisted" ? 200 : scenario === "read-error" ? 500 : scenario === "unauthorized" ? 401 : 409);
			if (scenario === "persisted") assert.deepEqual(body, { ok: true, outcome: "persisted", sourceGeneration: 2 });
			assert.deepEqual(paths, scenario === "unauthorized" ? [] : scenario === "conflict"
				? ["/rest/v1/rpc/persist_room_source_v1"]
				: ["/rest/v1/rpc/persist_room_source_v1", "/rest/v1/rooms"]);
		} finally {
			globalThis.fetch = priorFetch;
			for (const [key, value] of Object.entries(priorEnvironment)) {
				if (value === undefined) delete process.env[key]; else process.env[key] = value;
			}
		}
	});
}
