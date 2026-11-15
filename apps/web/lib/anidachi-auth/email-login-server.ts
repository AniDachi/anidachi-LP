import { db } from "./db";
import type { EmailChallenge, EmailVerification } from "./email-login";

export async function reserveEmailChallenge(
	challenge: EmailChallenge,
	ipHash: string,
): Promise<number> {
	const { data, error } = await db()
		.rpc("start_email_login_v1", {
			p_id: challenge.id,
			p_email: challenge.email,
			p_code_hash: challenge.codeHash,
			p_browser_hash: challenge.browserHash,
			p_email_hash: challenge.emailHash,
			p_ip_hash: ipHash,
			p_return_to: challenge.returnTo,
		})
		.abortSignal(AbortSignal.timeout(8000));
	if (error || typeof data !== "number" || data < 0)
		throw new Error("Email login unavailable");
	return data;
}

export async function markEmailChallengeSent(id: string): Promise<void> {
	const { data, error } = await db()
		.from("email_login_challenges")
		.update({ sent_at: new Date().toISOString() })
		.eq("id", id)
		.is("consumed_at", null)
		.select("id")
		.abortSignal(AbortSignal.timeout(8000))
		.maybeSingle();
	if (error || !data) throw new Error("Email login unavailable");
}

export async function consumeEmailChallenge(
	id: string,
	browserHash: string,
	codeHash: string,
): Promise<EmailVerification> {
	const { data, error } = await db()
		.rpc("consume_email_login_v1", {
			p_id: id,
			p_browser_hash: browserHash,
			p_code_hash: codeHash,
		})
		.abortSignal(AbortSignal.timeout(8000));
	const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
	if (
		error ||
		!row ||
		!["verified", "invalid", "provider_required"].includes(row.outcome) ||
		(row.outcome === "verified" && typeof row.user_id !== "string")
	)
		throw new Error("Email login unavailable");
	return row as EmailVerification;
}
