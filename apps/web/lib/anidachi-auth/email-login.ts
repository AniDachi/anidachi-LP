import { createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { sanitizeAuthReturnTo } from "./return-to";

export const EMAIL_CODE_TTL_SECONDS = 600;
export const EMAIL_RESEND_SECONDS = 60;
export const EMAIL_CHALLENGE_ID =
	/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const EMAIL_BROWSER_SECRET = /^[A-Za-z0-9_-]{43}$/;

export function emailLoginEnabled(
	env: NodeJS.ProcessEnv = process.env,
): boolean {
	return env.ANIDACHI_EMAIL_LOGIN_ENABLED === "true";
}

export function normalizeLoginEmail(value: unknown): string | null {
	if (typeof value !== "string" || value.length > 320) return null;
	const email = value.trim().toLowerCase();
	if (
		email.length > 254 ||
		!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(
			email,
		)
	)
		return null;
	const local = email.split("@")[0];
	if (
		local.length > 64 ||
		local.startsWith(".") ||
		local.endsWith(".") ||
		email.includes("..")
	)
		return null;
	return email;
}

/** Narrower than a plain leading slash: reject browser URL normalization tricks. */
export function emailLoginReturnTo(value: unknown): string {
	if (
		typeof value !== "string" ||
		value.length > 4096 ||
		/[\\\x00-\x20\x7f]/.test(value)
	)
		return "";
	const safe = sanitizeAuthReturnTo(value);
	if (!safe) return "";
	const url = new URL(safe, "https://auth.invalid");
	if (
		url.origin !== "https://auth.invalid" ||
		!sanitizeAuthReturnTo(url.pathname)
	)
		return "";
	try {
		const path = decodeURIComponent(url.pathname);
		if (
			/[\\\x00-\x20\x7f]/.test(path) ||
			!sanitizeAuthReturnTo(path) ||
			path === "/login"
		)
			return "";
	} catch {
		return "";
	}
	return safe;
}

export function emailLoginHash(
	purpose: string,
	value: string,
	secret = process.env.ANIDACHI_EMAIL_OTP_SECRET,
): string {
	if (!secret || secret.length < 32) throw new Error("Email login unavailable");
	return createHmac("sha256", secret)
		.update(`anidachi-email-login-v1\0${purpose}\0${value}`)
		.digest("hex");
}

export function createEmailChallenge(email: string, returnTo: unknown) {
	const id = randomUUID();
	const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
	const browserSecret = randomBytes(32).toString("base64url");
	return {
		id,
		email,
		code,
		browserSecret,
		codeHash: emailLoginHash("code", `${id}:${code}`),
		browserHash: emailLoginHash("browser", browserSecret),
		emailHash: emailLoginHash("email", email),
		returnTo: emailLoginReturnTo(returnTo),
	};
}

export function emailCookieName(id: string): string {
	if (!EMAIL_CHALLENGE_ID.test(id)) throw new Error("Invalid challenge");
	return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}anidachi_email_${id}`;
}

export function emailRequestIp(headers: Headers): string {
	// Vercel overwrites this header; never trust a caller-controlled alternate.
	const raw = (
		process.env.VERCEL
			? headers.get("x-vercel-forwarded-for")
			: headers.get("x-forwarded-for")
	)
		?.split(",")[0]
		?.trim();
	return raw && isIP(raw) ? raw : "unknown";
}

export type EmailChallenge = ReturnType<typeof createEmailChallenge>;
export type EmailVerification = {
	outcome: "verified" | "invalid" | "provider_required";
	user_id: string | null;
	return_to: string;
	is_new: boolean;
};
