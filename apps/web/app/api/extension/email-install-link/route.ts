import { type NextRequest, NextResponse } from "next/server";
import { getGmailRedirectUri, isGmailConfigured, sendPlaintextEmail } from "@/lib/kreatli-crm/gmail";
import { readGmailTokens } from "@/lib/kreatli-crm/gmail-tokens";
import { upsertDesktopInstallLead } from "@/lib/kreatli-crm/desktop-install-lead";
import { isValidEmail } from "@/lib/kreatli-crm/validation";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { INSTALL_HUB_PATH, isSafeInstallNextPath } from "@/lib/install-cta";

export async function POST(request: NextRequest) {
  let email: string;
  let nextPath: string | null = null;

  try {
    const body = (await request.json()) as {
      email?: unknown;
      next?: unknown;
    };
    if (typeof body.email !== "string" || !body.email.trim()) {
      return NextResponse.json({ error: "Enter an email address." }, { status: 400 });
    }
    email = body.email.trim();
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (typeof body.next === "string") {
      nextPath = isSafeInstallNextPath(body.next);
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const crm = await upsertDesktopInstallLead(email);
    if (!crm.saved) {
      console.warn("[email-install-link] CRM save skipped:", crm.reason, email);
    }
  } catch (error) {
    console.error("[email-install-link] CRM failed:", email, error);
  }

  const origin = getResolvedSiteOrigin();
  const installUrl = nextPath
    ? `${origin}${INSTALL_HUB_PATH}?next=${encodeURIComponent(nextPath)}`
    : `${origin}${INSTALL_HUB_PATH}`;

  let emailed = false;
  if (isGmailConfigured()) {
    const tokens = await readGmailTokens();
    if (tokens?.refresh_token) {
      try {
        const redirectUri = getGmailRedirectUri(origin);
        await sendPlaintextEmail(redirectUri, {
          to: email,
          subject: "Install AniDachi on desktop Chrome",
          body: [
            "Watch parties need the AniDachi Chrome extension on a computer.",
            "",
            `Open this page on desktop Chrome (or Edge):`,
            installUrl,
            "",
            "Download the official zip from that page only. Unzip it, open chrome://extensions, turn on Developer mode, then Load unpacked and pick the folder that contains manifest.json.",
            "",
            "The Chrome Web Store listing is in Chrome’s standard review queue, including publisher verification. Until that page is live, download only from the link above.",
          ].join("\n"),
        });
        emailed = true;
      } catch (error) {
        console.error("[email-install-link] Send failed:", email, error);
      }
    } else {
      console.warn("[email-install-link] Gmail not connected; skipped send");
    }
  }

  return NextResponse.json({ ok: true, emailed, installUrl });
}
