import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AccountPageHeader } from "@/components/account/account-ui";
import { getSession } from "@/lib/anidachi-auth/session";
import { getUserById } from "@/lib/anidachi-auth/db";
import { ensureProfileForUser } from "@/lib/anidachi-auth/social";
import { FeatureRequestForm } from "@/components/feature-request-form";

export const metadata: Metadata = {
  title: "Feature Requests",
  robots: { index: false, follow: false },
};

export default async function AccountFeatureRequestsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Ffeature-requests");
  const [user, profile] = await Promise.all([
    getUserById(session.userId),
    ensureProfileForUser(session.userId),
  ]);
  return (
    <div className="ac-page">
      <AccountPageHeader
        title="Share an idea"
        description="What would make AniDachi better for you? We read every suggestion."
      />
      <div className="ac-detail-layout">
        <FeatureRequestForm
          key={session.userId}
          variant="account"
          initialContact={{
            name: profile?.display_name ?? user?.display_name ?? "",
            email: session.email,
          }}
        />
        <aside className="ac-context" aria-label="Suggestion tips">
          <h2>Start with the problem</h2>
          <p>
            Tell us what you were trying to do, what got in the way, and how you
            would like it to work.
          </p>
          <div className="ac-context-section">
            <h2>Something not working?</h2>
            <p>
              Report a problem with AniDachi so we can investigate and fix it.
            </p>
            <Link href="/account/bug-report" className="ac-text-link">
              Report a bug <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
