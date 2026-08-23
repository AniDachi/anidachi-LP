import { NextResponse } from "next/server";
import { getGmailRedirectUri, isGmailConfigured, sendPlaintextEmail } from "@/lib/kreatli-crm/gmail";
import { readGmailTokens } from "@/lib/kreatli-crm/gmail-tokens";
import { upsertSurveyLead } from "@/lib/kreatli-crm/survey-lead";
import { isValidEmail } from "@/lib/kreatli-crm/validation";
import type { HomeSurveyAnswers } from "@/lib/home-survey";
import { getResolvedSiteOrigin } from "@/lib/site-url";

function buildInterestEmail(
  name: string,
  email: string,
  survey: Partial<HomeSurveyAnswers>,
): { subject: string; body: string } {
  const subject = `AniDachi interest lead: ${name} <${email}>`;
  const body = [
    "A user saved their plan recommendation but has not subscribed yet.",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Segment: ${survey.segment ?? "—"}`,
    `Priority: ${survey.priority ?? "—"}`,
    `Group size: ${survey.group_size ?? "—"}`,
    `Timing: ${survey.timing ?? "—"}`,
    `Current solution: ${survey.current_solution ?? "—"}`,
  ].join("\n");
  return { subject, body };
}

export type SubscribeInterestDependencies = {
  upsertSurveyLead: typeof upsertSurveyLead;
  isGmailConfigured: typeof isGmailConfigured;
  readGmailTokens: typeof readGmailTokens;
  sendPlaintextEmail: typeof sendPlaintextEmail;
  getGmailRedirectUri: typeof getGmailRedirectUri;
  getSiteOrigin: typeof getResolvedSiteOrigin;
  notifyEmails?: string;
};

const subscribeInterestDependencies: SubscribeInterestDependencies = {
  upsertSurveyLead,
  isGmailConfigured,
  readGmailTokens,
  sendPlaintextEmail,
  getGmailRedirectUri,
  getSiteOrigin: getResolvedSiteOrigin,
};

function persistenceFailure() {
  return NextResponse.json(
    {
      ok: false,
      error: "Could not save your place. Please try again.",
    },
    { status: 503 },
  );
}

export async function handleSubscribeInterestPost(
  request: Pick<Request, "json">,
  dependencies: SubscribeInterestDependencies = subscribeInterestDependencies,
) {
  let name: string;
  let email: string;
  let survey: Partial<HomeSurveyAnswers>;

  try {
    const body = (await request.json()) as {
      name?: unknown;
      email?: unknown;
      survey?: unknown;
    };
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }
    if (typeof body.email !== "string" || !body.email.trim()) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }
    name = body.name.trim();
    email = body.email.trim();
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    survey = (typeof body.survey === "object" && body.survey !== null
      ? body.survey
      : {}) as Partial<HomeSurveyAnswers>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let crmResult: Awaited<ReturnType<typeof upsertSurveyLead>>;
  try {
    crmResult = await dependencies.upsertSurveyLead(email, survey, name, {
      signupSource: "survey",
    });
  } catch (error) {
    console.error("[subscribe-interest] CRM persistence failed", error);
    return persistenceFailure();
  }
  if (!crmResult.saved) {
    console.warn("[subscribe-interest] CRM did not persist the request");
    return persistenceFailure();
  }

  const responsePayload = {
    ok: true,
    waitlistPosition: crmResult.waitlistPosition,
    referralLink: crmResult.referralLink,
    referralCount: crmResult.referralCount,
  };

  const toRaw = dependencies.notifyEmails ?? process.env.SUBSCRIPTION_NOTIFY_EMAILS;
  if (!toRaw?.trim() || !dependencies.isGmailConfigured()) {
    console.warn("[subscribe-interest] Email not sent — Gmail not configured or no notify address");
    return NextResponse.json(responsePayload);
  }

  const to = toRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const tokens = await dependencies.readGmailTokens();
    if (!tokens?.refresh_token) {
      console.warn("[subscribe-interest] Gmail not connected; skipping alert");
      return NextResponse.json(responsePayload);
    }

    const redirectUri = dependencies.getGmailRedirectUri(
      dependencies.getSiteOrigin(),
    );
    const { subject, body: emailBody } = buildInterestEmail(name, email, survey);

    for (const address of to) {
      try {
        await dependencies.sendPlaintextEmail(redirectUri, {
          to: address,
          subject,
          body: emailBody,
        });
      } catch (error) {
        console.error("[subscribe-interest] Gmail alert failed", error);
      }
    }
  } catch (error) {
    console.error("[subscribe-interest] Gmail notification unavailable", error);
  }

  return NextResponse.json(responsePayload);
}
