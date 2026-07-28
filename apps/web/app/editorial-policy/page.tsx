import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Editorial Policy",
  description:
    "How AniDachi researches, updates, sources, and corrects product and watch-together guidance on anidachi.app.",
  alternates: { canonical: "/editorial-policy" },
  openGraph: {
    title: "Editorial Policy | AniDachi",
    description:
      "Sourcing, corrections, AI use, and update rules for AniDachi marketing and help content.",
    url: "/editorial-policy",
  },
};

export default function EditorialPolicyPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <article className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Editorial Policy
        </h1>
        <p className="text-sm text-foreground/50 mb-10">Last updated: July 28, 2026</p>

        <div className="space-y-8 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Purpose
            </h2>
            <p>
              This policy covers public marketing and help pages on{" "}
              <Link href="/" className="text-brand-orange hover:underline">
                anidachi.app
              </Link>
              : guides, comparisons, glossary entries, and product explainers.
              Our goal is accurate, people-first content — not publishing pages
              solely to manipulate search rankings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Who writes content
            </h2>
            <p>
              Content is produced by the AniDachi team. Bylines attribute pages
              to AniDachi and link to{" "}
              <Link href="/about" className="text-brand-orange hover:underline">
                About
              </Link>
              . We do not invent fictional expert personas.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Source hierarchy
            </h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                First-hand product behavior (what AniDachi actually does in
                desktop Chrome today).
              </li>
              <li>
                Primary sources for third-party claims (official help docs,
                store listings, vendor pricing pages) with a verification date.
              </li>
              <li>
                Anime catalog facts from MyAnimeList via the Jikan API where we
                display scores, episodes, or posters.
              </li>
            </ol>
            <p className="mt-4">
              Competitor feature, pricing, availability, and historical claims
              must cite a primary source and a “verified on” date. Absolutes
              such as “only,” “best,” or “no spoilers” require evidence or must
              be rewritten as qualified statements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Updates and freshness
            </h2>
            <p>
              We bump visible and structured <code className="text-sm">dateModified</code>{" "}
              when content, links, or product claims meaningfully change. We do
              not change dates for cosmetic or ranking-only “freshness theater.”
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Corrections
            </h2>
            <p>
              If you find an error, email{" "}
              <a
                href="mailto:anidachi.app@gmail.com"
                className="text-brand-orange hover:underline"
              >
                anidachi.app@gmail.com
              </a>{" "}
              with the URL and the correction. Material factual fixes are
              updated on the page; we note significant corrections when they
              change product advice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              AI assistance
            </h2>
            <p>
              We may use AI tools to draft structure or copy. Published pages are
              reviewed against current product behavior, pricing, and platform
              limits before they go live. AI output is not published unchecked.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Commercial disclosure
            </h2>
            <p>
              AniDachi sells paid plans (Plus / Pro). Product pages and CTAs may
              link to{" "}
              <Link href="/pricing" className="text-brand-orange hover:underline">
                pricing
              </Link>
              . We do not accept paid placements that misrepresent competitors
              or unsupported platforms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">
              Related
            </h2>
            <p>
              <Link href="/about" className="text-brand-orange hover:underline">
                About
              </Link>
              {" · "}
              <Link href="/contact" className="text-brand-orange hover:underline">
                Contact
              </Link>
              {" · "}
              <Link href="/security" className="text-brand-orange hover:underline">
                Security
              </Link>
              {" · "}
              <Link href="/privacy" className="text-brand-orange hover:underline">
                Privacy
              </Link>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
