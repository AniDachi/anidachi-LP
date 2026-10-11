import assert from "node:assert/strict";
import test from "node:test";
import { deliverAmplitudeServerEvent } from "./amplitude-server";

test("server publisher acknowledges only a successful HTTP API receipt and retains stable fields", async () => {
	const originalFetch = globalThis.fetch;
	const originalKey = process.env.AMPLITUDE_API_KEY;
	process.env.AMPLITUDE_API_KEY = "test-public-project-key";
	try {
		let payload: any;
		globalThis.fetch = async (_url, init) => {
			assert.ok(init?.signal);
			payload = JSON.parse(String(init?.body));
			return Response.json({ code: 200, events_ingested: 1 });
		};
		assert.equal(
			await deliverAmplitudeServerEvent({
				eventType: "trial_started",
				userId: "a1000000-0000-4000-8000-000000000001",
				insertId: "a5000000-0000-4000-8000-000000000001",
				occurredAt: 1900000000000,
				properties: { environment: "staging" },
			}),
			true,
		);
		assert.equal(
			payload.events[0].user_id,
			"a1000000-0000-4000-8000-000000000001",
		);
		assert.equal(
			payload.events[0].insert_id,
			"a5000000-0000-4000-8000-000000000001",
		);
		assert.equal(payload.events[0].time, 1900000000000);
		assert.equal(payload.events[0].device_id, undefined);
		for (const response of [
			Response.json({}, { status: 429 }),
			Response.json({ code: 400, events_ingested: 0 }),
			new Response("garbled", { status: 200 }),
		]) {
			globalThis.fetch = async () => response;
			assert.equal(
				await deliverAmplitudeServerEvent({ eventType: "trial_started" }),
				false,
			);
		}
		globalThis.fetch = async () => {
			throw Error("network");
		};
		assert.equal(
			await deliverAmplitudeServerEvent({ eventType: "trial_started" }),
			false,
		);
	} finally {
		globalThis.fetch = originalFetch;
		if (originalKey === undefined) delete process.env.AMPLITUDE_API_KEY;
		else process.env.AMPLITUDE_API_KEY = originalKey;
	}
});
