import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, CreditCard } from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { DiscordContact } from "@/components/discord-contact";
import { DiscordCredentialsForm } from "@/components/discord-credentials-form";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getPlanEntitlements } from "@/lib/anidachi-auth/plan-entitlements";
import { getSession } from "@/lib/anidachi-auth/session";
import { CheckoutSessionSync } from "./checkout-session-sync";

export const metadata: Metadata = {
  title: "AniDachi Subscription Confirmed",
  description:
    "Your AniDachi subscription is confirmed and your account is being updated.",
  robots: { index: false, follow: false },
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const sp = await searchParams;
  const sessionId =
    typeof sp?.session_id === "string" ? sp.session_id : undefined;
  const authSession = await getSession();
  const user = authSession ? await getUserById(authSession.userId) : null;
  const currentPlan = user?.plan ?? authSession?.plan ?? "free";
  const currentPlanLabel = getPlanEntitlements(currentPlan).label;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ani-canvas p-4">
      <Card className="relative max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
            <AnidachiLogo size={64} priority />
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-ani-line bg-ani-panel">
              <CheckCircle className="h-4 w-4 text-ani-progress" aria-hidden="true" />
            </span>
          </div>
          <CardTitle className="text-2xl font-semibold tracking-[-0.03em] text-ani-text">
            Subscription confirmed
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Your AniDachi account is being updated to {currentPlanLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <CheckoutSessionSync
            sessionId={sessionId}
            initialPlanCode={currentPlan}
          />

          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-ani-text">
              <CreditCard className="h-5 w-5 text-ani-muted" aria-hidden="true" />
              What is active now
            </h3>
            <ol className="space-y-3 text-sm text-ani-muted">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-ani-line bg-ani-hover text-xs font-semibold text-ani-text">
                  1
                </span>
                <span>
                  Stripe checkout is complete. AniDachi confirms the session
                  and mirrors the subscription into your account.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-ani-line bg-ani-hover text-xs font-semibold text-ani-text">
                  2
                </span>
                <span>
                  Account, room creation, and extension auth should now use your
                  current plan limits.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-ani-line bg-ani-hover text-xs font-semibold text-ani-text">
                  3
                </span>
                <span>
                  If you already have the extension open, refresh the AniDachi
                  menu or create a new room so it picks up the latest account
                  state.
                </span>
              </li>
            </ol>
          </div>

          <div className="rounded-[12px] border border-ani-line bg-ani-panel p-4 text-sm text-ani-muted">
            <h4 className="mb-1 font-medium text-ani-text">Your subscription</h4>
            <p>
              View your billing status or cancel renewal in{" "}
              <Link href="/account/billing" className="text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary">
                Account → Subscription
              </Link>
              . If you cancel, paid access continues until the end of your billing period.
            </p>
          </div>

          <DiscordContact />

          <DiscordCredentialsForm sessionId={sessionId} />
        </CardContent>
      </Card>
    </div>
  );
}
