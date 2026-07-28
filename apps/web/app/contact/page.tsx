import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact AniDachi",
  description:
    "Contact AniDachi for product support, privacy requests, security reports, and press questions.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact AniDachi",
    description:
      "Support, privacy, security, and press contact channels for AniDachi.",
    url: "/contact",
  },
};

const SUPPORT_EMAIL = "anidachi.app@gmail.com";

export default function ContactPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <article className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-2">Contact</h1>
        <p className="text-sm text-foreground/50 mb-10">Last updated: July 28, 2026</p>

        <div className="space-y-8 text-foreground/80 leading-relaxed">
          <p>
            We are a small team. Email is the fastest reliable channel. Please
            include the page URL, browser, and (for extension issues) the
            extension version when relevant.
          </p>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Product support
            </h2>
            <p>
              Watchrooms, billing, accounts, install help:{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=AniDachi%20support`}
                className="text-brand-orange hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
            <p className="mt-2 text-sm text-foreground/60">
              Typical reply window: within a few business days. Urgent billing
              issues — put “Billing” in the subject line.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Privacy
            </h2>
            <p>
              Data access or deletion requests:{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Privacy%20request`}
                className="text-brand-orange hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              — see also the{" "}
              <Link href="/privacy" className="text-brand-orange hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Security
            </h2>
            <p>
              Suspected vulnerabilities in the site or Chrome extension:{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Security%20report`}
                className="text-brand-orange hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              with “Security” in the subject. Details:{" "}
              <Link href="/security" className="text-brand-orange hover:underline">
                Security &amp; extension permissions
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Press &amp; partnerships
            </h2>
            <p>
              Editorial or partnership inquiries:{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Press%20/%20partnership`}
                className="text-brand-orange hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              . Please note we are independent of Crunchyroll, YouTube, and other
              streaming platforms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Content corrections
            </h2>
            <p>
              Factual errors on guides or comparisons: email the URL and
              correction. Our process is described in the{" "}
              <Link
                href="/editorial-policy"
                className="text-brand-orange hover:underline"
              >
                Editorial Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
