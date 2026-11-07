import {
	createHash,
	createHmac,
	randomBytes,
	timingSafeEqual,
	webcrypto,
} from "node:crypto";
import {
	FREE20_CHALLENGE_TTL_SECONDS,
	FREE20_CONTEXT_TTL_SECONDS,
	FREE20_INSTALLATION_SIGNING_PREFIX,
	Free20InstallationProofSchema,
} from "@anidachi/protocol";
import { createTrialAbuseTokens } from "./trial-abuse";
export type Free20AbuseContext = { browser: string; installation: string };
const digest = (value: string) =>
	createHash("sha256").update(value).digest("hex");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
export function free20ContextCookieName(origin: string) {
	return new URL(origin).protocol === "https:"
		? "__Host-anidachi-free20-context"
		: "anidachi-free20-context-local";
}
export class Free20ContextError extends Error {
	constructor(
		readonly code:
			| "FREE20_CONTEXT_REQUIRED"
			| "FREE20_CONTEXT_BUSY"
			| "FREE20_CONTEXT_ATTACH_REQUIRED" = "FREE20_CONTEXT_REQUIRED",
	) {
		super(code);
	}
}
/** Pure evidence verification. Reuses trial marker identity, never trial eligibility.
 * Exact proof replay within TTL is safe: enrollment does not touch any usage ledger.
 */
export function createFree20AbuseTokens(
	secret: string,
	origin: string,
	now = Date.now,
) {
	if (!secret || new URL(origin).origin !== origin)
		throw new Error("Free20 context unavailable");
	const browserTokens = createTrialAbuseTokens(secret, origin, now);
	const key = createHmac("sha256", secret)
		.update("anidachi-free20-abuse-v1\0" + origin)
		.digest();
	const mac = (value: string) =>
		createHmac("sha256", key).update(value).digest("base64url");
	const sign = (kind: string, data: Record<string, unknown>, ttl: number) => {
		const iat = Math.floor(now() / 1000),
			exp = iat + ttl;
		const body = Buffer.from(
			JSON.stringify({
				...data,
				version: 1,
				purpose: "free20",
				origin,
				kind,
				iat,
				exp,
			}),
		).toString("base64url");
		return { token: body + "." + mac(body), expiresAt: exp * 1000 };
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
				p.purpose !== "free20" ||
				p.origin !== origin ||
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
	return {
		issueChallenge(
			cookie: string | undefined,
			owner: string,
			requestId: string,
		) {
			const browser = browserTokens.readCookie(cookie);
			if (!browser || !uuid.test(owner) || !uuid.test(requestId))
				throw new Free20ContextError();
			return sign(
				"challenge",
				{
					browser,
					owner,
					requestId,
					nonce: randomBytes(16).toString("base64url"),
				},
				FREE20_CHALLENGE_TTL_SECONDS,
			).token;
		},
		async complete(
			cookie: string | undefined,
			owner: string,
			requestId: string,
			suppliedProof: unknown,
		) {
			try {
				const browser = browserTokens.readCookie(cookie);
				const proof = Free20InstallationProofSchema.parse(suppliedProof);
				const p = read(
					proof.challenge,
					"challenge",
					FREE20_CHALLENGE_TTL_SECONDS,
				);
				if (
					!browser ||
					!uuid.test(owner) ||
					!uuid.test(requestId) ||
					!p ||
					p.browser !== browser ||
					p.owner !== owner ||
					p.requestId !== requestId ||
					typeof p.nonce !== "string" ||
					!/^[A-Za-z0-9_-]{22}$/.test(p.nonce)
				)
					throw new Free20ContextError();
				const publicKey = await webcrypto.subtle.importKey(
					"spki",
					Buffer.from(proof.publicKey, "base64url"),
					{ name: "ECDSA", namedCurve: "P-256" },
					true,
					["verify"],
				);
				if (
					Buffer.from(
						await webcrypto.subtle.exportKey("spki", publicKey),
					).toString("base64url") !== proof.publicKey ||
					!(await webcrypto.subtle.verify(
						{ name: "ECDSA", hash: "SHA-256" },
						publicKey,
						Buffer.from(proof.signature, "base64url"),
						new TextEncoder().encode(
							FREE20_INSTALLATION_SIGNING_PREFIX + proof.challenge,
						),
					))
				)
					throw new Free20ContextError();
				const issued = sign(
					"context",
					{
						browser,
						owner,
						requestId,
						nonce: p.nonce,
						installation: digest(
							"installation:" + origin + ":" + proof.publicKey,
						),
					},
					FREE20_CONTEXT_TTL_SECONDS,
				);
				return { context: issued.token, expiresAt: issued.expiresAt };
			} catch {
				throw new Free20ContextError();
			}
		},
		readContext(
			value: string | undefined,
			owner: string,
		): Free20AbuseContext | null {
			const p = read(value, "context", FREE20_CONTEXT_TTL_SECONDS);
			if (
				!p ||
				p.owner !== owner ||
				!uuid.test(owner) ||
				typeof p.browser !== "string" ||
				!hash.test(p.browser) ||
				typeof p.installation !== "string" ||
				!hash.test(p.installation)
			)
				return null;
			return { browser: p.browser, installation: p.installation };
		},
	};
}
