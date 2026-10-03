import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_COMPARE_OVERVIEW } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Is Crunchyroll Party Worth It? (2026 Evaluation) | AniDachi",
  description:
    "Compare Crunchyroll Party with AniDachi for live anime nights: sync, chat, cameras, microphones, personal history, and hosting requirements.",
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
      "It can suit basic live watch nights when everyone is online together. Compare AniDachi if your group also wants live cameras and microphones, YouTube support, or personal history for viewers with Plus or Pro. Async catch-up is coming soon in AniDachi.",
  },
  {
    question: "What does Crunchyroll Party cost?",
    answer:
      "Crunchyroll Party is a free Chrome extension for live synchronized playback on Crunchyroll. You still need individual Crunchyroll subscriptions; the extension only adds sync and chat.",
  },
  {
    question: "When should I upgrade from Crunchyroll Party to AniDachi?",
    answer:
      "Consider AniDachi when you want live rooms on Crunchyroll and YouTube, cameras and microphones, or personal history with your own Plus or Pro access. Choose based on current features and hosting requirements.",
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
        { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
        {
          name: "Is Crunchyroll Party worth it?",
          url: "/guides/is-crunchyroll-party-worth-it",
        },
      ]}
      title="Is Crunchyroll Party worth it?"
      description="When free Crunchyroll Party live sync is enough — and when to upgrade."
      url="/guides/is-crunchyroll-party-worth-it"
      datePublished="2026-07-22"
      dateModified="2026-10-01"
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
        Treat it as a live sync option. Compare AniDachi when your club wants cameras, microphones, YouTube support, or personal history on Plus or Pro.
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
        AniDachi adds live sync, anime detection, chat, cameras, and microphones on top of each person’s Crunchyroll stream. See{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>{" "}
        — hosts need Plus or Pro access, including an active trial; guests can join on Free.
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
