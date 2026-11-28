import { sendTransactionalEmail } from "../transactional-email";

export function emailCodeMessage(code: string) {
	if (!/^\d{6}$/.test(code)) throw new Error("Invalid email code");
	return {
		subject: "Your AniDachi sign-in code",
		text: `Your AniDachi sign-in code is ${code}.\n\nEnter it in the window where you requested it. This code expires in 10 minutes.\n\nIf you didn’t request this code, you can ignore this email. Never share your code.\n\nAniDachi`,
		html: `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your AniDachi sign-in code</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f4f0">
<table role="presentation" lang="en" dir="ltr" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f4f0" style="width:100%;background-color:#f6f4f0">
<tr><td align="center" style="padding:32px 16px">
<!--[if mso]><table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:480px;background-color:#ffffff;border:1px solid #e8e4de;border-radius:20px;color:#202020;font-family:Arial,Helvetica,sans-serif">
<tr><td style="padding:28px 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="40" valign="middle"><img src="https://www.anidachi.app/Anidachi_logo.png" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border:0"></td>
<td valign="middle" style="padding-left:10px;font-size:22px;line-height:28px;font-weight:bold;color:#202020">AniDachi</td>
</tr>
</table>
<h1 style="margin:24px 0 12px;font-size:24px;line-height:32px;font-weight:bold;color:#202020">Your sign-in code</h1>
<p style="margin:0;font-size:15px;line-height:24px;color:#555555">Enter this code in the window where you requested it.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%">
<tr><td style="padding:24px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f4f0" style="width:100%;background-color:#f6f4f0;border-radius:12px">
<tr><td align="center" style="padding:18px 12px;font-size:36px;line-height:44px;font-weight:bold;letter-spacing:6px;white-space:nowrap;color:#202020">${code}</td></tr>
</table>
</td></tr>
</table>
<p style="margin:12px 0 24px;text-align:center;font-size:13px;line-height:20px;color:#666666">Expires in 10 minutes.</p>
<p style="margin:0;font-size:13px;line-height:21px;color:#666666">If you didn’t request this code, you can ignore this email. Never share your code.</p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`,
	};
}

export async function sendEmailLoginCode(email: string, code: string, challengeId: string): Promise<void> {
	return sendTransactionalEmail(email, emailCodeMessage(code), `email-login/${challengeId}`);
}
