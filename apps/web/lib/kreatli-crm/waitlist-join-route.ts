import { NextResponse } from "next/server";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getSession } from "@/lib/anidachi-auth/session";
import { upsertSurveyLead } from "@/lib/kreatli-crm/survey-lead";

export type WaitlistJoinDependencies = {
  getSession: typeof getSession;
  getUserById: typeof getUserById;
  upsertSurveyLead: typeof upsertSurveyLead;
};

const waitlistJoinDependencies: WaitlistJoinDependencies = {
  getSession,
  getUserById,
  upsertSurveyLead,
};

export async function handleWaitlistJoinPost(
  request: Pick<Request, "json">,
  dependencies: WaitlistJoinDependencies = waitlistJoinDependencies,
) {
  const session = await dependencies.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await dependencies.getUserById(session.userId);
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

  let result: Awaited<ReturnType<typeof upsertSurveyLead>>;
  try {
    result = await dependencies.upsertSurveyLead(
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
  } catch (error) {
    console.error("[waitlist-join] CRM persistence failed", error);
    return NextResponse.json(
      { ok: false, error: "Could not save your place. Please try again." },
      { status: 503 },
    );
  }

  if (!result.saved) {
    console.warn("[waitlist-join] CRM did not persist the request");
    return NextResponse.json(
      { ok: false, error: "Could not save your place. Please try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    waitlistPosition: result.waitlistPosition,
    baseWaitlistPosition: result.baseWaitlistPosition,
    referralLink: result.referralLink,
    referralCount: result.referralCount,
    isNewLead: result.isNewLead,
    referralCredited: creditReferral && result.isNewLead,
  });
}
