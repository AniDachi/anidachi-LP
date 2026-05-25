import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, Rocket, Mail } from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { DiscordContact } from "@/components/discord-contact";
import { DiscordCredentialsForm } from "@/components/discord-credentials-form";

export const metadata: Metadata = {
  title: "Welcome to AniDachi – Subscription Confirmed",
  description:
    "Your AniDachi early-access subscription is confirmed. Here's what happens next.",
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
            You&apos;re In — Welcome to AniDachi!
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Thanks for becoming a founding member. You&apos;ve locked in
            early-access pricing for life.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Rocket className="h-5 w-5 text-purple-600" aria-hidden="true" />
              What happens next
            </h3>
            <ol className="space-y-3 text-gray-700 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span>
                  We&apos;re finalizing the Chrome extension and watchroom
                  features. You&apos;ll get an email as soon as early access
                  opens.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span>
                  As a founding member, you&apos;ll be first in line for every
                  new feature — watchrooms, async group watching, and real-time
                  chat.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <span>
                  Your feedback shapes the product. Reply to any email from us
                  to share ideas or requests.
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
