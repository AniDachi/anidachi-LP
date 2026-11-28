export type EmailMessage = { subject: string; text: string; html: string };

export async function sendTransactionalEmail(
	email: string,
	message: EmailMessage,
	idempotencyKey: string,
): Promise<void> {
	const key = process.env.RESEND_API_KEY;
	if (!key) throw new Error("Email delivery unavailable");
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${key}`,
			"Content-Type": "application/json",
			"Idempotency-Key": idempotencyKey,
		},
		body: JSON.stringify({
			from: "AniDachi <notifications@anidachi.app>",
			to: [email],
			...message,
		}),
		signal: AbortSignal.timeout(8000),
		cache: "no-store",
	});
	// Never log the provider body: it may contain an address or message content.
	if (!response.ok) throw new Error("Email delivery unavailable");
	const data = (await response.json()) as { id?: unknown };
	if (typeof data.id !== "string" || !data.id)
		throw new Error("Email delivery unavailable");
}
