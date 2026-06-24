import { type NextRequest, NextResponse } from "next/server";
import { getGmailRedirectUri, isGmailConfigured, sendPlaintextEmail } from "@/lib/kreatli-crm/gmail";
import { readGmailTokens } from "@/lib/kreatli-crm/gmail-tokens";
import { upsertSurveyLead } from "@/lib/kreatli-crm/survey-lead";
import type { HomeSurveyAnswers } from "@/lib/home-survey";
import { getResolvedSiteOrigin } from "@/lib/site-url";

function buildInterestEmail(
  email: string,
  survey: Partial<HomeSurveyAnswers>,
): { subject: string; body: string } {
  const subject = `AniDachi interest lead: ${email}`;
  const body = [
    "A user saved their plan recommendation but has not subscribed yet.",
    "",
    `Email: ${email}`,
    `Segment: ${survey.segment ?? "—"}`,
    `Priority: ${survey.priority ?? "—"}`,
    `Group size: ${survey.group_size ?? "—"}`,
    `Timing: ${survey.timing ?? "—"}`,
    `Current solution: ${survey.current_solution ?? "—"}`,
  ].join("\n");
  return { subject, body };
}

export async function POST(request: NextRequest) {
  let email: string;
  let survey: Partial<HomeSurveyAnswers>;

  try {
    const body = (await request.json()) as { email?: unknown; survey?: unknown };
    if (typeof body.email !== "string" || !body.email.trim()) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }
    email = body.email.trim();
    survey = (typeof body.survey === "object" && body.survey !== null
      ? body.survey
      : {}) as Partial<HomeSurveyAnswers>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  console.info("[subscribe-interest] New lead:", email, survey);

  let waitlistPosition: number | null = null;
  try {
    const crmResult = await upsertSurveyLead(email, survey);
    waitlistPosition = crmResult.waitlistCount;
    if (crmResult.saved) {
      console.info("[subscribe-interest] Saved to CRM:", email, "waitlist position:", waitlistPosition);
    } else {
      console.warn("[subscribe-interest] CRM save skipped:", crmResult.reason, email);
    }
  } catch (e) {
    console.error("[subscribe-interest] Failed to save to CRM:", email, e);
  }

  const toRaw = process.env.SUBSCRIPTION_NOTIFY_EMAILS;
  if (!toRaw?.trim() || !isGmailConfigured()) {
    // Log but still return success so the modal flow isn't blocked
    console.warn("[subscribe-interest] Email not sent — Gmail not configured or no notify address");
    return NextResponse.json({ ok: true, waitlistPosition });
  }

  const to = toRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const tokens = await readGmailTokens();
  if (!tokens?.refresh_token) {
    console.warn("[subscribe-interest] Gmail not connected (no refresh token); skipping alert");
    return NextResponse.json({ ok: true });
  }

  const redirectUri = getGmailRedirectUri(getResolvedSiteOrigin());
  const { subject, body: emailBody } = buildInterestEmail(email, survey);

  for (const address of to) {
    try {
      await sendPlaintextEmail(redirectUri, { to: address, subject, body: emailBody });
    } catch (e) {
      console.error("[subscribe-interest] Failed to send alert to", address, e);
    }
  }

  return NextResponse.json({ ok: true, waitlistPosition });
}
