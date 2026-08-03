import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_TELEPARTY_COMPARE_FAQ } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Does Teleparty Work With YouTube? (2026 Answer) | AniDachi",
  description:
    "Does Teleparty work with YouTube in 2026? Yes for live sync — no async. Teleparty for YouTube vs AniDachi watchrooms compared. Start free at pricing.",
  alternates: { canonical: "/guides/does-teleparty-work-with-youtube" },
  openGraph: {
    title: "Does Teleparty Work With YouTube?",
    description:
      "Teleparty supports YouTube live sync — but not async watchrooms. When to switch.",
    url: "/guides/does-teleparty-work-with-youtube",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Does Teleparty Work With YouTube?",
    description: "Live sync yes; async no. How Teleparty for YouTube compares to AniDachi.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does Teleparty work with YouTube in 2026?",
    answer:
      "Yes. Teleparty (formerly Netflix Party) supports YouTube for live synchronized playback and shared chat when everyone is online at the same time. Test with a short clip before a long session — player updates can temporarily break extensions.",
  },
  {
    question: "Does Teleparty support YouTube watch parties?",
    answer:
      "Yes for live parties. Each person opens the same YouTube video, joins the Teleparty session, and playback stays roughly aligned. Teleparty does not add async catch-up — AniDachi does if your group is staggered.",
  },
  {
    question: "Is Teleparty free for YouTube watch parties?",
    answer: PRICING_TELEPARTY_COMPARE_FAQ,
  },
  {
    question: "Does Teleparty support async watching on YouTube?",
    answer:
      "No. Teleparty is live-only. If a friend is in another time zone, there is no spoiler-safe catch-up layer. AniDachi adds async YouTube watchrooms for that use case.",
  },
  {
    question: "What is the best Teleparty alternative for YouTube?",
    answer:
      "AniDachi for extension watchrooms with async catch-up; Watch2Gether for free browser-only live rooms. See Watch2Gether alternatives for YouTube for a ranked list.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "how-it-works", label: "How Teleparty + YouTube works", level: 2 },
  { id: "limits", label: "Where Teleparty falls short", level: 2 },
  { id: "when-to-switch", label: "When to switch tools", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DoesTelepartyWorkWithYoutubePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["youtube", "watch-party"],
    excludeHref: "/guides/does-teleparty-work-with-youtube",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        {
          name: "Does Teleparty work with YouTube?",
          url: "/guides/does-teleparty-work-with-youtube",
        },
      ]}
      title="Does Teleparty work with YouTube?"
      description="Yes for live sync; no for async. How Teleparty for YouTube fits — and when AniDachi is better."
      url="/guides/does-teleparty-work-with-youtube"
      datePublished="2026-07-25"
      dateModified="2026-08-03"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Does Teleparty Work With YouTube?
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Yes — Teleparty can work with YouTube for live, synchronized watch
          parties when everyone is online together.
        </strong>{" "}
        It does not offer async catch-up or durable episode-style progress for
        staggered schedules. If your group watches YouTube across time zones,
        you will outgrow Teleparty for those nights — see{" "}
        <Link
          href="/guides/best-teleparty-alternatives-for-youtube"
          className="text-brand-orange hover:underline"
        >
          best Teleparty alternatives for YouTube
        </Link>
        .
      </p>

      <h2
        id="how-it-works"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        How Teleparty + YouTube works
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Each person opens the same YouTube video in Chrome, one host starts a
        Teleparty session, and others join via link. Play/pause and seek stay
        roughly aligned. Voice is separate (Discord, FaceTime) unless you use
        Teleparty’s premium chat features.
      </p>

      <h2
        id="limits"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Where Teleparty falls short
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>Live-only — no async YouTube watchrooms.</li>
        <li>Extension compatibility can break after player updates.</li>
        <li>
          Not built around the same anime + YouTube dual workflow as{" "}
          <Link
            href="/watch-youtube-together"
            className="text-brand-orange hover:underline"
          >
            AniDachi’s YouTube hub
          </Link>
          .
        </li>
      </ul>

      <h2
        id="when-to-switch"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When to switch tools
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Stay on Teleparty if live Netflix/Disney+/YouTube nights already work.
        Switch to AniDachi when you need async YouTube catch-up or also host
        Crunchyroll anime nights in one extension. Compare:{" "}
        <Link
          href="/compare/anidachi-vs-teleparty"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Teleparty
        </Link>
        . Pricing:{" "}
        <Link href="/pricing" className="text-brand-orange hover:underline">
          pricing / early access
        </Link>
        .
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related guides
      </h2>
      <ul className="space-y-2 text-brand-orange">
        <li>
          <Link
            href="/guides/does-teleparty-work-with-crunchyroll"
            className="hover:underline"
          >
            Does Teleparty work with Crunchyroll?
          </Link>
        </li>
        <li>
          <Link
            href="/guides/netflix-party-for-youtube"
            className="hover:underline"
          >
            Netflix Party for YouTube
          </Link>
        </li>
        <li>
          <Link
            href="/guides/watch2gether-alternatives-for-youtube"
            className="hover:underline"
          >
            Watch2Gether alternatives for YouTube
          </Link>
        </li>
        {relatedGuideLinks.map((g) => (
          <li key={g.href}>
            <Link href={g.href} className="hover:underline">
              {g.label}
            </Link>
          </li>
        ))}
      </ul>
    </SeoPageLayout>
  );
}
