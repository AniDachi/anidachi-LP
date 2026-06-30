import { type NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getSession } from "@/lib/anidachi-auth/session";
import { upsertSurveyLead } from "@/lib/kreatli-crm/survey-lead";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let referredBy = "";
  let source = "";

  try {
    const body = (await request.json()) as {
      referredBy?: unknown;
      source?: unknown;
    };
    if (typeof body.referredBy === "string") {
      referredBy = body.referredBy.trim();
    }
    if (typeof body.source === "string") {
      source = body.source.trim();
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const creditReferral = source === "referral_join" && Boolean(referredBy);

  const result = await upsertSurveyLead(
    user.email,
    {},
    user.display_name,
    {
      referredBy: referredBy || undefined,
      creditReferral,
      signupSource: "referral",
      viaReferralLink: true,
    },
  );

  return NextResponse.json({
    ok: result.saved,
    waitlistPosition: result.waitlistPosition,
    baseWaitlistPosition: result.baseWaitlistPosition,
    referralLink: result.referralLink,
    referralCount: result.referralCount,
    isNewLead: result.isNewLead,
    referralCredited: creditReferral && result.isNewLead,
  });
}
