import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "AniDachi terms of service — the rules and conditions for using our anime watchroom platform and Chrome extension.",
  alternates: { canonical: "/terms" },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

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
            Last updated: October 1, 2026
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
                AniDachi provides watchrooms for synchronized viewing on
                supported platforms (Crunchyroll, YouTube and Netflix), with chat,
                reactions, and related social features through a Chrome
                extension and website. Free accounts can join rooms hosted on
                Plus or Pro, including rooms hosted during an active trial.
                Creating your own room and recording or editing personal watch
                progress require your own Plus or Pro access, including an
                active trial. Recording also needs your permission in the
                extension, with a separate setting for YouTube. Saved history
                remains available to read, resume and delete on Free. Planned
                features may be described as coming soon and are not guaranteed
                until they ship.
              </p>
              <p className="mt-4">
                Install the extension from the official Chrome Web Store listing
                via our{" "}
                <Link href="/extension" className="text-brand-orange hover:underline">
                  install page
                </Link>
                . Download only from AniDachi or that listing.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
                3. Platform Status
              </h2>
              <p>
                AniDachi is a live product. Features may change without notice
                or experience downtime. By using the Service, you acknowledge
                this and agree that the platform is provided &quot;as is.&quot;
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
                Plus and Pro subscriptions are billed through Stripe on the
                monthly or yearly schedule you select and renew automatically
                unless you cancel renewal. Free accounts are available at no
                charge. Prices and plan limits are listed on our{" "}
                <Link href="/pricing" className="text-brand-orange hover:underline">
                  pricing page
                </Link>
                .
              </p>
              <p className="mt-4">
                New and existing Free accounts with an unused trial can try
                Plus or Pro for three days with a card. There is one trial per
                account across both plans and billing periods. Unless you
                cancel renewal before the trial ends, Stripe charges your card
                for the selected monthly or yearly subscription when it ends.
                Changing plans or billing periods does not restart or extend
                the trial.
              </p>
              <p className="mt-4">
                You can cancel renewal from Account → Subscription. Trial
                access continues until the original trial end; paid access
                continues until the end of the paid billing period. For refund
                requests, email{" "}
                <a
                  href="mailto:anidachi.app@gmail.com"
                  className="text-brand-orange hover:underline"
                >
                  anidachi.app@gmail.com
                </a>
                .
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
                Crunchyroll, Sony, YouTube, Google, Netflix, or any streaming platform.
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
                  href="mailto:anidachi.app@gmail.com"
                  className="text-brand-orange hover:underline"
                >
                  anidachi.app@gmail.com
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
                {" · "}
                <Link
                  href="/security"
                  className="text-brand-orange hover:underline"
                >
                  Security
                </Link>
              </p>
            </section>
          </div>
        </article>
      </main>
    </>
  );
}
