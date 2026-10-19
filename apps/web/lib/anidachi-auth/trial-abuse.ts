import {
	createHash,
	createHmac,
	randomBytes,
	timingSafeEqual,
	webcrypto,
} from "node:crypto";
import {
	TrialInstallationProofSchema,
	TRIAL_INSTALLATION_SIGNING_PREFIX,
} from "@anidachi/protocol";

export type TrialAbuseMarkers = { browser: string; installation?: string };
export const TRIAL_BROWSER_MAX_AGE = 365 * 24 * 60 * 60;
export const TRIAL_DENIAL_MAX_AGE = 10 * 60;
export const TRIAL_CHALLENGE_MAX_AGE = 5 * 60;
const digest = (value: string | Uint8Array) =>
	createHash("sha256").update(value).digest("hex");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function trialBrowserCookieName(origin: string) {
	return new URL(origin).protocol === "https:"
		? "__Host-anidachi-trial-browser"
		: "anidachi-trial-browser-local";
}
export function trialDenialCookieName(origin: string) {
	return new URL(origin).protocol === "https:"
		? "__Host-anidachi-trial-denial"
		: "anidachi-trial-denial-local";
}
/** No I/O. Cookies and challenges use an origin/purpose-separated key, not auth tokens. */
export function createTrialAbuseTokens(
	secret: string,
	origin: string,
	now = Date.now,
) {
	if (!secret) throw new Error("Trial context unavailable");
	if (new URL(origin).origin !== origin)
		throw new Error("Invalid trial origin");
	const key = createHmac("sha256", secret)
		.update("anidachi-trial-abuse-v1\0" + origin)
		.digest();
	const mac = (value: string) =>
		createHmac("sha256", key).update(value).digest("base64url");
	const sign = (kind: string, data: Record<string, unknown>, ttl: number) => {
		const iat = Math.floor(now() / 1000);
		const body = Buffer.from(
			JSON.stringify({ ...data, version: 1, kind, iat, exp: iat + ttl }),
		).toString("base64url");
		return body + "." + mac(body);
	};
	const read = (
		value: string | undefined,
		kind: string,
		ttl: number,
	): Record<string, unknown> | null => {
		if (
			!value ||
			value.length > 2048 ||
			!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)
		)
			return null;
		const [body, signature] = value.split(".");
		if (!timingSafeEqual(Buffer.from(signature), Buffer.from(mac(body))))
			return null;
		try {
			const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
			const at = Math.floor(now() / 1000);
			if (
				p.version !== 1 ||
				p.kind !== kind ||
				!Number.isSafeInteger(p.iat) ||
				!Number.isSafeInteger(p.exp) ||
				p.exp - p.iat !== ttl ||
				p.iat > at ||
				p.exp <= at
			)
				return null;
			return p;
		} catch {
			return null;
		}
	};
	const readCookie = (cookie: string | undefined) => {
		const p = read(cookie, "browser", TRIAL_BROWSER_MAX_AGE);
		return p && typeof p.id === "string" && /^[A-Za-z0-9_-]{43}$/.test(p.id)
			? digest("browser:" + origin + ":" + p.id)
			: null;
	};
	return {
		issueCookie: () =>
			sign(
				"browser",
				{ id: randomBytes(32).toString("base64url") },
				TRIAL_BROWSER_MAX_AGE,
			),
		readCookie,
		issueDenial(browser: string, owner: string) {
			return sign("denial", { browser, owner }, TRIAL_DENIAL_MAX_AGE);
		},
		isDenied(
			cookie: string | undefined,
			denial: string | undefined,
			owner: string,
		) {
			const browser = readCookie(cookie),
				p = read(denial, "denial", TRIAL_DENIAL_MAX_AGE);
			return !!browser && p?.browser === browser && p?.owner === owner;
		},
		issueChallenge(browser: string, owner: string, requestId: string) {
			if (
				!/^[a-f0-9]{64}$/.test(browser) ||
				!uuid.test(owner) ||
				!uuid.test(requestId)
			)
				throw new Error("Invalid trial context");
			return sign(
				"challenge",
				{
					browser,
					owner,
					requestId,
					nonce: randomBytes(16).toString("base64url"),
				},
				TRIAL_CHALLENGE_MAX_AGE,
			);
		},
		async markers(
			cookie: string | undefined,
			owner: string,
			requestId: string,
			suppliedProof: unknown,
		): Promise<TrialAbuseMarkers> {
			const browser = readCookie(cookie);
			if (!browser || !uuid.test(owner) || !uuid.test(requestId))
				throw new Error("Trial context required");
			if (suppliedProof === undefined) return { browser };
			const proof = TrialInstallationProofSchema.parse(suppliedProof);
			const p = read(proof.challenge, "challenge", TRIAL_CHALLENGE_MAX_AGE);
			if (
				!p ||
				p.browser !== browser ||
				p.owner !== owner ||
				p.requestId !== requestId
			)
				throw new Error("Trial confirmation expired");
			const key = await webcrypto.subtle.importKey(
				"spki",
				Buffer.from(proof.publicKey, "base64url"),
				{ name: "ECDSA", namedCurve: "P-256" },
				true,
				["verify"],
			);
			const canonical = Buffer.from(
				await webcrypto.subtle.exportKey("spki", key),
			);
			if (
				canonical.toString("base64url") !== proof.publicKey ||
				!(await webcrypto.subtle.verify(
					{ name: "ECDSA", hash: "SHA-256" },
					key,
					Buffer.from(proof.signature, "base64url"),
					new TextEncoder().encode(
						TRIAL_INSTALLATION_SIGNING_PREFIX + proof.challenge,
					),
				))
			)
				throw new Error("Invalid installation proof");
			return {
				browser,
				installation: digest("installation:" + origin + ":" + proof.publicKey),
			};
		},
	};
}
