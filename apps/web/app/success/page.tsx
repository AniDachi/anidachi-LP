import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, CreditCard, Mail } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
            <AnidachiLogo size={64} className="ring-2 ring-purple-100" priority />
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
            </span>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
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
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-600" aria-hidden="true" />
              What is active now
            </h3>
            <ol className="space-y-3 text-gray-700 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span>
                  Stripe checkout is complete. AniDachi confirms the session
                  and mirrors the subscription into your account.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span>
                  Account, room creation, and extension auth should now use your
                  current plan limits.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
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

          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <h4 className="font-medium text-gray-900 mb-1 flex items-center gap-2">
              <Mail className="h-4 w-4" aria-hidden="true" />
              Full refund guarantee
            </h4>
            <p>
              Changed your mind? No worries — email{" "}
              <a
                href="mailto:goshan.tolochko@gmail.com"
                className="text-purple-600 hover:underline"
              >
                goshan.tolochko@gmail.com
              </a>{" "}
              anytime and we&apos;ll cancel your subscription and refund you
              promptly. No questions asked.
            </p>
          </div>

          <DiscordContact />

          <DiscordCredentialsForm sessionId={sessionId} />
        </CardContent>
      </Card>
    </div>
  );
}
