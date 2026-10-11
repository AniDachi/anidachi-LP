import { db } from "./db";

/** The caller has just completed the existing provider OAuth exchange. */
export async function recordVerifiedAccountEmail(
	userId: string,
	email: string,
): Promise<void> {
	const { error } = await db()
		.rpc("record_verified_account_email_v1", {
			p_user_id: userId,
			p_email: email,
		})
		.abortSignal(AbortSignal.timeout(8000));
	if (error) throw new Error("Email verification record unavailable");
}
export async function hasVerifiedAccountEmail(
	userId: string,
): Promise<boolean> {
	const client = db();
	const [user, proof] = await Promise.all([
		client
			.from("users")
			.select("email")
			.eq("id", userId)
			.abortSignal(AbortSignal.timeout(8000))
			.maybeSingle(),
		client
			.from("account_verified_emails")
			.select("email")
			.eq("user_id", userId)
			.abortSignal(AbortSignal.timeout(8000))
			.maybeSingle(),
	]);
	if (user.error || proof.error)
		throw new Error("Email verification unavailable");
	return !!user.data?.email && user.data.email === proof.data?.email;
}
