import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_COMPARE_OVERVIEW } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Is Crunchyroll Party Worth It? (2026 Evaluation) | AniDachi",
  description:
    "When free Crunchyroll Party is enough for live sync — and when anime groups should upgrade to AniDachi for async watchrooms and progress tracking.",
  alternates: { canonical: "/guides/is-crunchyroll-party-worth-it" },
  openGraph: {
    title: "Is Crunchyroll Party Worth It?",
    description:
      "Evaluate free CR Party vs AniDachi — live-only limits and upgrade triggers.",
    url: "/guides/is-crunchyroll-party-worth-it",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Is Crunchyroll Party Worth It?",
    description: "When free live sync is enough vs when to upgrade.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is Crunchyroll Party worth using?",
    answer:
      "Yes for free live-only watch nights when everyone can show up at the same time. It is not worth relying on long-term if your group spans time zones, needs async catch-up, or wants per-episode spoiler controls — upgrade to AniDachi for those workflows.",
  },
  {
    question: "What does Crunchyroll Party cost?",
    answer:
      "Crunchyroll Party is a free Chrome extension for live synchronized playback on Crunchyroll. You still need individual Crunchyroll subscriptions; the extension only adds sync and chat.",
  },
  {
    question: "When should I upgrade from Crunchyroll Party to AniDachi?",
    answer:
      "Upgrade when late members spoil the group, sync breaks every week after player updates, or you want async watchrooms with per-person progress on seasonal simulcasts.",
  },
  {
    question: "How does AniDachi pricing compare to free Crunchyroll Party?",
    answer: PRICING_COMPARE_OVERVIEW,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "what-cr-party-does", label: "What CR Party does", level: 2 },
  { id: "worth-it", label: "When it is worth it", level: 2 },
  { id: "upgrade", label: "When to upgrade", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function IsCrunchyrollPartyWorthItPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["crunchyroll", "watch-party", "compare"],
    excludeHref: "/guides/is-crunchyroll-party-worth-it",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Guides", url: "/watch-anime-together" },
        {
          name: "Is Crunchyroll Party worth it?",
          url: "/guides/is-crunchyroll-party-worth-it",
        },
      ]}
      title="Is Crunchyroll Party worth it?"
      description="When free Crunchyroll Party live sync is enough — and when to upgrade."
      url="/guides/is-crunchyroll-party-worth-it"
      datePublished="2026-07-22"
      dateModified="2026-07-22"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta={true}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Is Crunchyroll Party Worth It?
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Crunchyroll Party is worth it for free, same-time Crunchyroll watch
          nights — not worth it as your only tool when schedules drift or
          spoilers leak from early watchers.
        </strong>{" "}
        Treat it as a zero-cost live sync starter; upgrade when your club needs
        async watchrooms.
      </p>

      <h2
        id="what-cr-party-does"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        What Crunchyroll Party does
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Crunchyroll Party is a community Chrome extension that syncs play/pause
        and seek across separate Crunchyroll tabs with a side chat. It is
        Crunchyroll-only, live-only, and free — no async mode, no auto anime
        detection, no per-episode progress tracking.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        For the full feature matrix, read{" "}
        <Link
          href="/compare/anidachi-vs-crunchyroll-party"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Crunchyroll Party
        </Link>{" "}
        or the upgrade narrative at{" "}
        <Link
          href="/guides/crunchyroll-party-alternative"
          className="text-brand-orange hover:underline"
        >
          Crunchyroll Party alternative
        </Link>
        .
      </p>

      <h2
        id="worth-it"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When it is worth it
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>Your group watches live every week at a fixed time.</li>
        <li>You want zero extension cost beyond Crunchyroll subscriptions.</li>
        <li>You are testing group watch before committing to a host tool.</li>
        <li>Everyone is in the same region with matching catalog access.</li>
      </ul>

      <h2
        id="upgrade"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When to upgrade
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-4">
        <li>Half the group watches Sunday morning, half Monday night.</li>
        <li>Chat spoilers arrive before late members finish the episode.</li>
        <li>Sync breaks after every Crunchyroll player update.</li>
        <li>You host long simulcasts and need repeatable watchrooms.</li>
      </ul>
      <p className="text-foreground/80 leading-relaxed mb-8">
        AniDachi adds async catch-up, auto anime detection, and spoiler
        boundaries on top of per-user Crunchyroll streams. See{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>{" "}
        — guests can stay Free; hosts upgrade for higher room limits.
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related guides
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link
            href="/compare/anidachi-vs-crunchyroll-party"
            className="hover:underline"
          >
            AniDachi vs Crunchyroll Party
          </Link>
        </li>
        <li>
          <Link
            href="/guides/crunchyroll-party-alternative"
            className="hover:underline"
          >
            Crunchyroll Party alternative
          </Link>
        </li>
        <li>
          <Link
            href="/guides/crunchyroll-watch-party-free"
            className="hover:underline"
          >
            Crunchyroll watch party free
          </Link>
        </li>
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll together
          </Link>
        </li>
        {relatedGuideLinks.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href} className="hover:underline">
              {guide.label}
            </Link>
          </li>
        ))}
      </ul>
    </SeoPageLayout>
  );
}
