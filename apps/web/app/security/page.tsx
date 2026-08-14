import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security & Extension Permissions",
  description:
    "How AniDachi handles accounts, Chrome extension permissions, data flow, and security vulnerability reports.",
  alternates: { canonical: "/security" },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "Security & Extension Permissions | AniDachi",
    description:
      "Extension permissions, data flow, and how to report security issues for AniDachi.",
    url: "/security",
  },
};

export default function SecurityPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <article className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Security &amp; extension permissions
        </h1>
        <p className="text-sm text-foreground/50 mb-10">Last updated: July 28, 2026</p>

        <div className="space-y-8 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Overview
            </h2>
            <p>
              AniDachi separates your streaming logins from our account system.
              You keep your own Crunchyroll or YouTube session in Chrome. We do
              not ask for those platform passwords.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Accounts and billing
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                AniDachi accounts use our auth system (email / OAuth as offered
                on the site).
              </li>
              <li>
                Paid plans are processed by Stripe. We do not store full card
                numbers.
              </li>
              <li>
                Details:{" "}
                <Link href="/privacy" className="text-brand-orange hover:underline">
                  Privacy Policy
                </Link>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Chrome extension
            </h2>
            <p>
              The extension overlays watchroom controls on supported pages and
              detects playback so friends can stay in sync. Store builds use
              narrow host permissions for YouTube, Crunchyroll, AniDachi web,
              and our Worker hosts — not blanket access to every site.
            </p>
            <p className="mt-4">
              Title/episode detection for watchrooms runs in your browser and is
              only sent when you create or join a room. The extension must never
              receive service-role keys, OAuth client secrets, Stripe secrets, or
              TURN secrets.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Realtime rooms
            </h2>
            <p>
              Live room state and signaling use our API / Durable Object Worker.
              Media between friends uses WebRTC where available; we may provide
              ICE/TURN access for connectivity. Room tokens are short-lived and
              scoped to the room you join.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Report a vulnerability
            </h2>
            <p>
              Email{" "}
              <a
                href="mailto:anidachi.app@gmail.com?subject=Security%20report"
                className="text-brand-orange hover:underline"
              >
                anidachi.app@gmail.com
              </a>{" "}
              with “Security” in the subject. Include steps to reproduce,
              affected URL or extension version, and impact. Please give us a
              reasonable window to respond before public disclosure.
            </p>
            <p className="mt-4 text-sm text-foreground/60">
              Do not use this channel for general product support — use{" "}
              <Link href="/contact" className="text-brand-orange hover:underline">
                Contact
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Related
            </h2>
            <p>
              <Link href="/privacy" className="text-brand-orange hover:underline">
                Privacy
              </Link>
              {" · "}
              <Link href="/terms" className="text-brand-orange hover:underline">
                Terms
              </Link>
              {" · "}
              <Link href="/about" className="text-brand-orange hover:underline">
                About
              </Link>
              {" · "}
              <Link href="/contact" className="text-brand-orange hover:underline">
                Contact
              </Link>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
