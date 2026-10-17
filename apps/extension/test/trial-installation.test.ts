import { expect, test } from "vitest";
import {
	createTrialInstallationSigner,
	isTrialWebsiteSender,
} from "../src/trial-installation";
test("sender must be exact trusted top-level website, never another extension", () => {
	const allowed = ["https://staging.anidachi.app"];
	expect(
		isTrialWebsiteSender(
			{ url: allowed[0] + "/checkout", origin: allowed[0], frameId: 0 },
			allowed,
		),
	).toBe(true);
	for (const sender of [
		{ url: "https://www.anidachi.app/checkout" },
		{ url: allowed[0] + ".evil.test/" },
		{ url: allowed[0] + "/checkout", origin: "https://evil.test" },
		{ url: allowed[0] + "/checkout", id: "other-extension" },
		{ url: allowed[0] + "/checkout", frameId: 3 },
	])
		expect(isTrialWebsiteSender(sender, allowed)).toBe(false);
});
test("concurrent calls and service-worker restart retain the same installation key", async () => {
	let saved: unknown = null,
		writes = 0;
	const storage = {
		get: async () => saved,
		set: async (v: unknown) => {
			saved = v;
			writes++;
		},
	};
	const signer = createTrialInstallationSigner(storage);
	const challenge = "a".repeat(180) + "." + "b".repeat(43);
	const [a, b] = await Promise.all([signer(challenge), signer(challenge)]);
	expect(writes).toBe(1);
	expect(a.publicKey).toBe(b.publicKey);
	const restarted = await createTrialInstallationSigner(storage)(challenge);
	expect(restarted.publicKey).toBe(a.publicKey);
	expect(writes).toBe(1);
	const key = await crypto.subtle.importKey(
		"spki",
		Uint8Array.from(
			atob(a.publicKey.replaceAll("-", "+").replaceAll("_", "/")),
			(c) => c.charCodeAt(0),
		),
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["verify"],
	);
	const signature = Uint8Array.from(
		atob(a.signature.replaceAll("-", "+").replaceAll("_", "/")),
		(c) => c.charCodeAt(0),
	);
	expect(
		await crypto.subtle.verify(
			{ name: "ECDSA", hash: "SHA-256" },
			key,
			signature,
			new TextEncoder().encode("anidachi-trial-installation-v1\n" + challenge),
		),
	).toBe(true);
	await expect(signer("x".repeat(5000))).rejects.toThrow();
});

test("corrupt existing key is never silently replaced by a fresh identity", async () => {
	let writes = 0;
	const signer = createTrialInstallationSigner({
		get: async () => ({ version: 1, privateKey: {}, publicKey: "broken" }),
		set: async () => {
			writes++;
		},
	});
	await expect(
		signer("a".repeat(180) + "." + "b".repeat(43)),
	).rejects.toThrow();
	expect(writes).toBe(0);
});
