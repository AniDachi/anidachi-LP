import test from "node:test";
import assert from "node:assert/strict";
import { requestPrimeLaunch } from "./prime-launch-client";
test("website commits navigation only after prepared response and current caller fence", async () => {
	const calls: Record<string, unknown>[] = [];
	const navigation = {
		contentId: "A".repeat(26),
		routes: [
			{
				url: "https://www.amazon.de/gp/video/detail/B0FX2ZCPFK",
				observedAt: "2026-11-16T00:00:00Z",
			},
		],
	};
	const prior = Object.getOwnPropertyDescriptor(globalThis, "chrome");
	Object.defineProperty(globalThis, "chrome", {
		configurable: true,
		value: {
			runtime: {
				sendMessage(
					_id: string,
					message: Record<string, unknown>,
					reply: (v: unknown) => void,
				) {
					calls.push(message);
					reply(
						message.action === "start"
							? {
									status: "prepared",
									intentId: "11111111-1111-4111-8111-111111111111",
								}
							: { status: "ready" },
					);
				},
			},
		},
	});
	try {
		assert.equal(
			await requestPrimeLaunch(
				"a".repeat(32),
				{
					expectedOwnerUserId: "owner",
					contentId: "A".repeat(26),
					roomId: "room",
					navigation,
				},
				() => false,
			),
			false,
		);
		assert.deepEqual(
			calls.map((c) => c.action),
			["start"],
		);
		calls.length = 0;
		assert.equal(
			await requestPrimeLaunch("a".repeat(32), {
				expectedOwnerUserId: "owner",
				contentId: "A".repeat(26),
				roomId: "room",
				navigation,
			}),
			true,
		);
		assert.deepEqual(
			calls.map((c) => c.action),
			["start", "commit"],
		);
		assert.deepEqual(calls[0]?.navigation, navigation);
	} finally {
		if (prior) Object.defineProperty(globalThis, "chrome", prior);
		else Reflect.deleteProperty(globalThis, "chrome");
	}
});
test("missing or old extension yields explicit fallback, not silent provider navigation", async () => {
	assert.equal(await requestPrimeLaunch(null, {}), false);
	const prior = Object.getOwnPropertyDescriptor(globalThis, "chrome");
	Object.defineProperty(globalThis, "chrome", {
		configurable: true,
		value: {
			runtime: {
				sendMessage(
					_id: string,
					_message: unknown,
					reply: (v: unknown) => void,
				) {
					reply({ unavailable: true });
				},
			},
		},
	});
	try {
		assert.equal(await requestPrimeLaunch("a".repeat(32), {}), false);
	} finally {
		if (prior) Object.defineProperty(globalThis, "chrome", prior);
		else Reflect.deleteProperty(globalThis, "chrome");
	}
});
