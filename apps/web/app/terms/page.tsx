import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "AniDachi terms of service — the rules and conditions for using our anime watchroom platform and Chrome extension.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | AniDachi",
    description:
      "Rules and conditions for using the AniDachi platform.",
    url: "/terms",
  },
};

export default function TermsPage() {
  return (
    <>
      <main className="min-h-screen bg-background">
        <article className="container mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-foreground/50 mb-10">
            Last updated: April 23, 2026
          </p>

          <div className="prose prose-gray max-w-none space-y-8 text-foreground/80 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using AniDachi (the &quot;Service&quot;),
                including our website at{" "}
                <Link href="/" className="text-brand-orange hover:underline">
                  anidachi.app
                </Link>{" "}
                and the AniDachi Chrome Extension, you agree to be bound by
                these Terms of Service. If you do not agree, do not use the
                Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                2. Description of Service
              </h2>
              <p>
                AniDachi provides a platform for watching anime together through
                watchrooms, real-time chat, playback synchronization, and a
                Chrome extension that detects anime on supported streaming
                platforms (e.g., Crunchyroll). Some features require a paid
                subscription.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                3. Early Access & Platform Status
              </h2>
              <p>
                AniDachi is currently in <strong>early access</strong>. Features
                may be incomplete, change without notice, or experience downtime.
                By subscribing during early access, you acknowledge this and
                agree that the platform is provided &quot;as is.&quot;
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                4. Accounts
              </h2>
              <p>
                You are responsible for maintaining the confidentiality of your
                account credentials. You must be at least 13 years old to use
                AniDachi. You agree not to share your account or let others
                access the Service through your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                5. Subscriptions & Payments
              </h2>
              <p>
                Paid subscriptions are billed monthly through Stripe. Prices are
                listed on our{" "}
                <Link href="/#pricing" className="text-brand-orange hover:underline">
                  pricing page
                </Link>
                . All subscriptions are refundable — if you want a refund or to
                cancel, email us at{" "}
                <a
                  href="mailto:goshan.tolochko@gmail.com"
                  className="text-brand-orange hover:underline"
                >
                  goshan.tolochko@gmail.com
                </a>{" "}
                and we will process it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                6. Acceptable Use
              </h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>
                  Use the Service to distribute copyrighted content you do not
                  have the right to share.
                </li>
                <li>
                  Harass, abuse, or threaten other users in watchroom chats.
                </li>
                <li>
                  Attempt to reverse-engineer, hack, or disrupt the Service.
                </li>
                <li>
                  Use bots or automated tools to interact with the Service.
                </li>
                <li>
                  Violate any applicable law or regulation.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                7. Intellectual Property
              </h2>
              <p>
                The AniDachi name, logo, website, and extension are owned by us.
                You retain ownership of any content you create (e.g., chat
                messages). By posting content, you grant us a license to display
                it within the Service. AniDachi is not affiliated with
                Crunchyroll, Sony, or any streaming platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                8. Disclaimer of Warranties
              </h2>
              <p>
                The Service is provided &quot;as is&quot; and &quot;as
                available&quot; without warranties of any kind, either express or
                implied, including but not limited to merchantability, fitness
                for a particular purpose, and non-infringement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                9. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by law, AniDachi shall not be
                liable for any indirect, incidental, special, or consequential
                damages arising out of your use of the Service. Our total
                liability shall not exceed the amount you paid us in the 12
                months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                10. Termination
              </h2>
              <p>
                We may suspend or terminate your access to the Service at any
                time for violation of these terms. You may cancel your account at
                any time by contacting us. Upon termination, your right to use
                the Service ceases immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                11. Changes to These Terms
              </h2>
              <p>
                We may update these terms from time to time. We will notify
                registered users of material changes by email. Continued use
                after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                12. Contact Us
              </h2>
              <p>
                If you have questions about these Terms of Service, contact us
                at{" "}
                <a
                  href="mailto:goshan.tolochko@gmail.com"
                  className="text-brand-orange hover:underline"
                >
                  goshan.tolochko@gmail.com
                </a>
                .
              </p>
            </section>

            <section className="border-t border-brand-border pt-6 mt-10">
              <p className="text-sm text-foreground/50">
                See also:{" "}
                <Link
                  href="/privacy"
                  className="text-brand-orange hover:underline"
                >
                  Privacy Policy
                </Link>
              </p>
            </section>
          </div>
        </article>
      </main>
    </>
  );
}
