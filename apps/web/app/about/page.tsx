import type { Metadata } from "next";
import Link from "next/link";
import { PUBLIC_SOCIAL_LINKS } from "@/lib/public-social-links";

export const metadata: Metadata = {
  title: "About AniDachi",
  description:
    "Who operates AniDachi, what the product does on Crunchyroll and YouTube, and how we stay independent of streaming platforms.",
  alternates: { canonical: "/about" },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "About AniDachi",
    description:
      "AniDachi helps friends watch together on Crunchyroll and YouTube with synced watchrooms — built by an independent team.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <article className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-2">About AniDachi</h1>
        <p className="text-sm text-foreground/50 mb-10">Last updated: July 28, 2026</p>

        <div className="space-y-8 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              What we build
            </h2>
            <p>
              AniDachi (アニ友) is a Chrome extension and web product for watching
              together with friends. You create a watchroom, sync playback on{" "}
              <strong>Crunchyroll</strong> or <strong>YouTube</strong>, chat in
              real time, and catch up asynchronously when schedules do not match.
            </p>
            <p className="mt-4">
              Each person streams with their own account on the supported
              platform. AniDachi provides the watchroom layer — sync, chat, and
              progress — not the video catalog itself.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Who operates AniDachi
            </h2>
            <p>
              AniDachi is operated by the AniDachi product team. We publish
              product and help content under the AniDachi name. For how we
              research, update, and correct that content, see our{" "}
              <Link href="/editorial-policy" className="text-brand-orange hover:underline">
                Editorial Policy
              </Link>
              .
            </p>
            <p className="mt-4">
              We do not invent anonymous author personas. When a page needs a
              byline, it attributes content to the AniDachi team and links here.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Independence
            </h2>
            <p>
              AniDachi is <strong>not affiliated with</strong> Crunchyroll, Sony,
              YouTube, Google, or any other streaming platform. Product names of
              third parties appear only to describe compatibility.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Product limits (honest)
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Full watchrooms on Crunchyroll catalog pages in desktop Chrome.
              </li>
              <li>
                Full <code className="text-sm">youtube.com/watch</code> pages in
                desktop Chrome — not Shorts, embeds, homepage feeds, or native
                mobile apps.
              </li>
              <li>
                Rooms stay on one provider per session (Crunchyroll or YouTube).
              </li>
              <li>
                Netflix, Disney+, Hulu, and Amazon Prime Video sync are not
                supported.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Contact &amp; community
            </h2>
            <p>
              Support and general questions:{" "}
              <Link href="/contact" className="text-brand-orange hover:underline">
                Contact
              </Link>{" "}
              or{" "}
              <a
                href="mailto:anidachi.app@gmail.com"
                className="text-brand-orange hover:underline"
              >
                anidachi.app@gmail.com
              </a>
              .
            </p>
            <p className="mt-4">Public community and social profiles:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              {PUBLIC_SOCIAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-orange hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Legal
            </h2>
            <p>
              <Link href="/privacy" className="text-brand-orange hover:underline">
                Privacy Policy
              </Link>
              {" · "}
              <Link href="/terms" className="text-brand-orange hover:underline">
                Terms of Service
              </Link>
              {" · "}
              <Link href="/security" className="text-brand-orange hover:underline">
                Security &amp; extension permissions
              </Link>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
