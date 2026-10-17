import { dom } from "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { test } from "node:test";
import { guardBillingNavigation } from "./billing-navigation";

test("a deferred billing redirect waits for visibility and rejects a replacement account", async () => {
	const original = globalThis.fetch;
	let reads = 0;
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		value: "hidden",
	});
	globalThis.fetch = async () => {
		reads++;
		return Response.json({ ownerUserId: "other", action: "subscribe" });
	};
	try {
		const pending = guardBillingNavigation(
			"owner",
			new AbortController().signal,
			true,
		);
		const rejected = assert.rejects(pending, /account changed/i);
		await Promise.resolve();
		assert.equal(reads, 0);
		Reflect.deleteProperty(document, "visibilityState");
		document.dispatchEvent(new Event("visibilitychange"));
		await rejected;
		assert.equal(reads, 1);
	} finally {
		globalThis.fetch = original;
		Reflect.deleteProperty(document, "visibilityState");
	}
});

test("an uninterrupted billing action needs no extra read, and unmount cancels a deferred redirect", async () => {
	const original = globalThis.fetch;
	globalThis.fetch = async () => {
		throw new Error("unnecessary read");
	};
	try {
		await guardBillingNavigation("owner", new AbortController().signal, false);
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		});
		const controller = new AbortController();
		const rejected = assert.rejects(
			guardBillingNavigation("owner", controller.signal, true),
		);
		controller.abort();
		await rejected;
	} finally {
		globalThis.fetch = original;
		Reflect.deleteProperty(document, "visibilityState");
	}
	void dom;
});

test("an account read overlapping another tab departure cannot authorize the redirect", async () => {
	const original = globalThis.fetch;
	let revision = 1,
		reads = 0;
	globalThis.fetch = async () => {
		reads++;
		if (reads === 1) {
			revision++;
			return Response.json({ ownerUserId: "owner", action: "trial" });
		}
		return Response.json({ ownerUserId: "replacement", action: "subscribe" });
	};
	try {
		await assert.rejects(
			guardBillingNavigation(
				"owner",
				new AbortController().signal,
				true,
				() => revision,
			),
			/account changed/,
		);
		assert.equal(reads, 2);
	} finally {
		globalThis.fetch = original;
	}
});
