import { CHROME_WEB_STORE_URL } from "./install-cta";
import type { EmailMessage } from "./transactional-email";

export function installLinkEmail(): EmailMessage {
  const subject = "Your AniDachi install link";
  const instruction = "Open this link in Chrome on your computer.";
  return {
    subject,
    text: `Watch together with friends\n\n${instruction}\n\nInstall AniDachi: ${CHROME_WEB_STORE_URL}`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title>
<style>
.seam {position:relative}
.seam::before,.seam::after {content:"";position:absolute;top:-9px;width:9px;height:17px;background:#f6f4f0;border:1px solid #e4dace}
.seam::before {left:-1px;border-left:0;border-radius:0 12px 12px 0}
.seam::after {right:-1px;border-right:0;border-radius:12px 0 0 12px}
</style></head>
<body style="margin:0;padding:0;background:#f6f4f0">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f6f4f0"><tr><td align="center" style="padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#30251e">
<!--[if mso]><table role="presentation" width="452"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fffdf8" style="max-width:452px;border:1px solid #e4dace;border-radius:18px">
<tr><td align="center" style="padding:27px 24px 23px">
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td><img src="https://www.anidachi.app/Anidachi_logo.png" alt="" width="28" height="28" style="display:block;border:0"></td><td style="padding-left:7px;font-size:17px;font-weight:bold">AniDachi</td></tr></table>
<h1 style="margin:20px 0 0;font-size:32px;line-height:1.1;letter-spacing:-1.2px">Watch together with friends</h1>
<p style="margin:11px 0 0;color:#625953;font-size:15px;line-height:1.5">${instruction}</p>
</td></tr>
<tr><td class="seam" style="padding:0 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="border-top:1px dashed #d5c6b8;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>
<tr><td align="center" style="padding:20px 24px 22px">
<a href="${CHROME_WEB_STORE_URL}" style="display:inline-block;background:#ff983f;color:#25180e;border:14px solid #ff983f;border-left-width:34px;border-right-width:34px;border-radius:26px;font-size:16px;font-weight:bold;text-decoration:none">Install AniDachi</a>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
  };
}
