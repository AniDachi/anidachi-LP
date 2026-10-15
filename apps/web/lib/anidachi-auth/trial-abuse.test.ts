import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { createTrialAbuseTokens } from "./trial-abuse";
const origin = "https://staging.anidachi.app";
const owner = "ab000000-0000-4000-8000-000000000001";
const requestId = "ac000000-0000-4000-8000-000000000001";
const secret = "only-a-test-secret-with-sufficient-entropy";
let now = 1_900_000_000_000;
const tokens = () => createTrialAbuseTokens(secret, origin, () => now);
test("cookie is random, signed, origin-bound and expires; arbitrary or forged cookies fail", () => {
	const t = tokens(),
		cookie = t.issueCookie();
	assert.notEqual(cookie, t.issueCookie());
	assert.match(t.readCookie(cookie)!, /^[a-f0-9]{64}$/);
	assert.equal(t.readCookie(cookie + "x"), null);
	assert.equal(t.readCookie("client-trial-unused"), null);
	assert.equal(
		createTrialAbuseTokens(
			secret,
			"https://www.anidachi.app",
			() => now,
		).readCookie(cookie),
		null,
	);
	now += 366 * 86400_000;
	assert.equal(t.readCookie(cookie), null);
	now -= 366 * 86400_000;
});
test("optional proof binds installation ownership to account, cookie, origin and exact operation", async () => {
	const t = tokens(),
		cookie = t.issueCookie(),
		hash = t.readCookie(cookie)!;
	assert.deepEqual(await t.markers(cookie, owner, requestId, undefined), {
		browser: hash,
	});
	const challenge = t.issueChallenge(hash, owner, requestId);
	const keys = await webcrypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"],
	);
	const publicKey = Buffer.from(
		await webcrypto.subtle.exportKey("spki", keys.publicKey),
	).toString("base64url");
	const signature = Buffer.from(
		await webcrypto.subtle.sign(
			{ name: "ECDSA", hash: "SHA-256" },
			keys.privateKey,
			new TextEncoder().encode("anidachi-trial-installation-v1\n" + challenge),
		),
	).toString("base64url");
	const proof = { version: 1, challenge, publicKey, signature };
	const m = await t.markers(cookie, owner, requestId, proof);
	assert.match(m.installation!, /^[a-f0-9]{64}$/);
	for (const args of [
		[
			cookie,
			owner,
			requestId,
			{ ...proof, signature: signature.slice(0, -2) + "AA" },
		],
		[cookie, owner, requestId, { ...proof, extra: true }],
		[cookie, owner, requestId, null],
		[cookie, owner, "ac000000-0000-4000-8000-000000000002", proof],
		[cookie, "ab000000-0000-4000-8000-000000000002", requestId, proof],
		[t.issueCookie(), owner, requestId, proof],
	] as const)
		await assert.rejects(() => t.markers(args[0], args[1], args[2], args[3]));
	now += 301_000;
	await assert.rejects(() => t.markers(cookie, owner, requestId, proof));
	now -= 301_000;
	await assert.rejects(() => t.markers(undefined, owner, requestId, undefined));
});
test("denial receipt is short-lived and cannot affect another account or browser", () => {
	const t = tokens(),
		cookie = t.issueCookie(),
		hash = t.readCookie(cookie)!;
	const denial = t.issueDenial(hash, owner);
	assert.equal(t.isDenied(cookie, denial, owner), true);
	assert.equal(t.isDenied(t.issueCookie(), denial, owner), false);
	assert.equal(t.isDenied(cookie, denial, owner.replace(/1$/, "2")), false);
	assert.equal(t.isDenied(cookie, denial + "x", owner), false);
	now += 601_000;
	assert.equal(t.isDenied(cookie, denial, owner), false);
	now -= 601_000;
});
