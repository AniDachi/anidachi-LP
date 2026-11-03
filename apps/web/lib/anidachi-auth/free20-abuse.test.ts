import assert from "node:assert/strict";
import test from "node:test";
import { createFree20AbuseTokens } from "./free20-abuse";
import { signProof } from "./free20-abuse.test-support";
import { createTrialAbuseTokens } from "./trial-abuse";

const origin = "https://staging.anidachi.app";
const owner = "ab000000-0000-4000-8000-000000000001";
const requestId = "ac000000-0000-4000-8000-000000000001";
const secret = "test-secret-for-free20-proof-only";

test("genuine P-256 proof reuses signed browser and installation semantics with a distinct purpose", async () => {
	let now = 1_900_000_000_000;
	const browser = createTrialAbuseTokens(secret, origin, () => now);
	const tokens = createFree20AbuseTokens(secret, origin, () => now);
	const cookie = browser.issueCookie();
	const challenge = tokens.issueChallenge(cookie, owner, requestId);
	const proof = await signProof(challenge);
	const result = await tokens.complete(cookie, owner, requestId, proof);
	const context = tokens.readContext(result.context, owner);
	assert.equal(context?.browser, browser.readCookie(cookie));
	assert.match(context!.installation, /^[a-f0-9]{64}$/);
	assert.equal(result.expiresAt, now + 1_800_000);
	assert.deepEqual(
		tokens.readContext(
			(await tokens.complete(cookie, owner, requestId, proof)).context,
			owner,
		),
		context,
	);
	assert.equal(
		tokens.readContext(result.context, owner.replace(/1$/, "2")),
		null,
	);
	assert.equal(
		createFree20AbuseTokens(
			secret,
			"https://www.anidachi.app",
			() => now,
		).readContext(result.context, owner),
		null,
	);
	assert.equal(tokens.readContext(result.context + "x", owner), null);
	now += 1_800_000;
	assert.equal(tokens.readContext(result.context, owner), null);
});
test("forgery, omitted proof/cookie, wrong account/request/origin/purpose and expiry never enroll", async () => {
	let now = 1_900_000_000_000;
	const browser = createTrialAbuseTokens(secret, origin, () => now);
	const tokens = createFree20AbuseTokens(secret, origin, () => now);
	const cookie = browser.issueCookie();
	const challenge = tokens.issueChallenge(cookie, owner, requestId);
	const proof = await signProof(challenge);
	const other = await signProof(challenge);
	const signature = Buffer.from(proof.signature, "base64url");
	signature[0] ^= 1;
	for (const [c, o, r, p] of [
		[undefined, owner, requestId, proof],
		[cookie + "x", owner, requestId, proof],
		[browser.issueCookie(), owner, requestId, proof],
		[cookie, owner.replace(/1$/, "2"), requestId, proof],
		[cookie, owner, requestId.replace(/1$/, "2"), proof],
		[cookie, owner, requestId, undefined],
		[cookie, owner, requestId, { ...proof, publicKey: other.publicKey }],
		[
			cookie,
			owner,
			requestId,
			{ ...proof, signature: signature.toString("base64url") },
		],
		[cookie, owner, requestId, { ...proof, challenge: challenge + "x" }],
		[cookie, owner, requestId, { ...proof, browser: "a".repeat(64) }],
		[
			cookie,
			owner,
			requestId,
			await signProof(challenge, "anidachi-trial-installation-v1\n"),
		],
	] as const)
		await assert.rejects(
			() => tokens.complete(c, o, r, p),
			/FREE20_CONTEXT_REQUIRED/,
		);
	await assert.rejects(() =>
		createFree20AbuseTokens(
			secret,
			"https://other.example",
			() => now,
		).complete(cookie, owner, requestId, proof),
	);
	now += 300_000;
	await assert.rejects(
		() => tokens.complete(cookie, owner, requestId, proof),
		/FREE20_CONTEXT_REQUIRED/,
	);
});
