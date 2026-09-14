import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AccountPageHeader } from "@/components/account/account-ui";
import { ContactForm } from "@/components/contact-form";
import { getSession } from "@/lib/anidachi-auth/session";
import { getUserById } from "@/lib/anidachi-auth/db";
import { ensureProfileForUser } from "@/lib/anidachi-auth/social";

export const metadata: Metadata = {
  title: "Report a bug",
  robots: { index: false, follow: false },
};

export default async function AccountBugReportPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Fbug-report");
  const [user, profile] = await Promise.all([
    getUserById(session.userId),
    ensureProfileForUser(session.userId),
  ]);

  return (
    <div className="ac-page">
      <AccountPageHeader
        title="Report a bug"
        description="Something not working? Tell us what happened so we can fix it."
      />
      <div className="ac-detail-layout">
        <ContactForm
          key={session.userId}
          variant="bug-report"
          initialContact={{
            name: profile?.display_name ?? user?.display_name ?? "",
            email: session.email,
          }}
        />
        <aside className="ac-context" aria-label="Bug report tips">
          <h2>Help us reproduce it</h2>
          <p>
            Include the steps that led to the problem. A page link, your browser
            and AniDachi extension version can help us find the cause.
          </p>
          <div className="ac-context-section">
            <h2>Have an idea instead?</h2>
            <p>Suggest a new feature or an improvement to AniDachi.</p>
            <Link href="/account/feature-requests" className="ac-text-link">
              Share an idea <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          <div className="ac-context-section">
            <h2>Other questions?</h2>
            <p>
              For account, billing or privacy questions, contact our support.
            </p>
            <Link href="/contact" className="ac-text-link">
              Contact support <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
