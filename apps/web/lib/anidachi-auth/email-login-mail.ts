export function emailCodeMessage(code: string) {
	if (!/^\d{6}$/.test(code)) throw new Error("Invalid email code");
	return {
		subject: "Your AniDachi sign-in code",
		text: `Your AniDachi sign-in code is ${code}.\n\nEnter it in the window where you requested it. This code expires in 10 minutes.\n\nIf you didn’t request this code, you can ignore this email. Never share your code.\n\nAniDachi`,
		html: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f6f4f0;color:#202020;font-family:Arial,sans-serif"><div style="max-width:440px;margin:32px auto;padding:32px;background:#fff;border-radius:16px"><div style="font-size:22px;font-weight:bold;color:#ee741c">AniDachi</div><h1 style="font-size:24px;margin:28px 0 16px">Your sign-in code</h1><p style="font-size:15px;line-height:1.6">Enter this code in the window where you requested it.</p><p style="font-size:36px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</p><p style="font-size:15px">Expires in 10 minutes.</p><p style="font-size:13px;line-height:1.6;color:#666;margin-top:32px">If you didn’t request this code, you can ignore this email. Never share your code.</p></div></body></html>`,
	};
}

export async function sendEmailLoginCode(
	email: string,
	code: string,
	challengeId: string,
): Promise<void> {
	const key = process.env.RESEND_API_KEY;
	if (!key) throw new Error("Email delivery unavailable");
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${key}`,
			"Content-Type": "application/json",
			"Idempotency-Key": `email-login/${challengeId}`,
		},
		body: JSON.stringify({
			from: "AniDachi <notifications@anidachi.app>",
			to: [email],
			...emailCodeMessage(code),
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
