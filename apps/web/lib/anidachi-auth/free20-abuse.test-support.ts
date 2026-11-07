import { webcrypto } from "node:crypto";
import { FREE20_INSTALLATION_SIGNING_PREFIX } from "@anidachi/protocol";
export async function signProof(
	challenge: string,
	prefix = FREE20_INSTALLATION_SIGNING_PREFIX,
) {
	const keys = await webcrypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"],
	);
	return {
		version: 1 as const,
		challenge,
		publicKey: Buffer.from(
			await webcrypto.subtle.exportKey("spki", keys.publicKey),
		).toString("base64url"),
		signature: Buffer.from(
			await webcrypto.subtle.sign(
				{ name: "ECDSA", hash: "SHA-256" },
				keys.privateKey,
				new TextEncoder().encode(prefix + challenge),
			),
		).toString("base64url"),
	};
}
