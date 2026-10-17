import {
	TrialChallengeSchema,
	TRIAL_INSTALLATION_SIGNING_PREFIX,
	type TrialInstallationProof,
} from "@anidachi/protocol";

type StoredKey = { version: 1; privateKey: JsonWebKey; publicKey: string };
export const TRIAL_INSTALLATION_STORAGE_KEY =
	"local:anidachi.trialInstallationKey.v1";
const encode = (bytes: ArrayBuffer) =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
/** Sign only the purpose-prefixed challenge; never expose the persisted private key. */
export function createTrialInstallationSigner(store: {
	get(): Promise<unknown>;
	set(value: StoredKey): Promise<void>;
}) {
	let pending:
		| Promise<{ privateKey: CryptoKey; publicKey: string }>
		| undefined;
	async function load() {
		const saved = (await store.get()) as StoredKey | null;
		if (saved) {
			if (
				saved.version !== 1 ||
				!saved.privateKey ||
				typeof saved.publicKey !== "string"
			)
				throw new Error("Installation key unavailable");
			return {
				privateKey: await crypto.subtle.importKey(
					"jwk",
					saved.privateKey,
					{ name: "ECDSA", namedCurve: "P-256" },
					false,
					["sign"],
				),
				publicKey: saved.publicKey,
			};
		}
		const keys = await crypto.subtle.generateKey(
			{ name: "ECDSA", namedCurve: "P-256" },
			true,
			["sign", "verify"],
		);
		const publicKey = encode(
			await crypto.subtle.exportKey("spki", keys.publicKey),
		);
		await store.set({
			version: 1,
			privateKey: await crypto.subtle.exportKey("jwk", keys.privateKey),
			publicKey,
		});
		return { privateKey: keys.privateKey, publicKey };
	}
	return async (challenge: string): Promise<TrialInstallationProof> => {
		TrialChallengeSchema.parse(challenge);
		pending ??= load().catch((error) => {
			pending = undefined;
			throw error;
		});
		const key = await pending;
		const signature = encode(
			await crypto.subtle.sign(
				{ name: "ECDSA", hash: "SHA-256" },
				key.privateKey,
				new TextEncoder().encode(TRIAL_INSTALLATION_SIGNING_PREFIX + challenge),
			),
		);
		return { version: 1, challenge, publicKey: key.publicKey, signature };
	};
}
export function isTrialWebsiteSender(
	sender: { id?: string; url?: string; origin?: string; frameId?: number },
	origins: readonly string[],
) {
	if (
		sender.id ||
		!sender.url ||
		(sender.frameId !== undefined && sender.frameId !== 0)
	)
		return false;
	try {
		const url = new URL(sender.url);
		return (
			!url.username &&
			!url.password &&
			origins.includes(url.origin) &&
			(!sender.origin || sender.origin === url.origin)
		);
	} catch {
		return false;
	}
}
