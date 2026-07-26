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
  title: "Netflix Party for YouTube — Watch YouTube Together (2026) | AniDachi",
  description:
    "Searching “Netflix Party YouTube”? Teleparty (formerly Netflix Party) can sync YouTube live. AniDachi adds YouTube watchrooms with async catch-up.",
  alternates: { canonical: "/guides/netflix-party-for-youtube" },
  openGraph: {
    title: "Netflix Party for YouTube",
    description:
      "What “Netflix Party for YouTube” means in 2026 — Teleparty live sync vs AniDachi watchrooms.",
    url: "/guides/netflix-party-for-youtube",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Netflix Party for YouTube",
    description: "Teleparty lineage + AniDachi YouTube watchrooms explained.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is there a Netflix Party for YouTube?",
    answer:
      "There is no Netflix-branded YouTube party. People usually mean Teleparty (formerly Netflix Party), which supports YouTube live sync, or a dedicated YouTube watchroom tool like AniDachi.",
  },
  {
    question: "Does Netflix Party work on YouTube?",
    answer:
      "Teleparty (the product formerly called Netflix Party) can sync YouTube when everyone is online together. It does not offer AniDachi-style async YouTube watchrooms.",
  },
  {
    question: "What should I use instead of Netflix Party for YouTube?",
    answer:
      "For live-only free sync, Teleparty or Watch2Gether. For YouTube watchrooms with async catch-up and the same tool you use for Crunchyroll, choose AniDachi.",
  },
  {
    question: "How does AniDachi pricing compare to Teleparty?",
    answer: PRICING_TELEPARTY_COMPARE_FAQ,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "name", label: "What “Netflix Party” means now", level: 2 },
  { id: "options", label: "Your options", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function NetflixPartyForYoutubePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["youtube", "watch-party"],
    excludeHref: "/guides/netflix-party-for-youtube",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        {
          name: "Netflix Party for YouTube",
          url: "/guides/netflix-party-for-youtube",
        },
      ]}
      title="Netflix Party for YouTube"
      description="What people mean by Netflix Party for YouTube — and the best tools in 2026."
      url="/guides/netflix-party-for-youtube"
      datePublished="2026-07-25"
      dateModified="2026-07-25"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Netflix Party for YouTube — How to Co-Watch in 2026
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-8">
        <strong>
          “Netflix Party for YouTube” usually means Teleparty (the old Netflix
          Party brand) syncing a YouTube video — or a purpose-built YouTube
          watchroom like AniDachi.
        </strong>{" "}
        AniDachi does not sync Netflix. It does host full YouTube and Crunchyroll
        watchrooms. Start at{" "}
        <Link href="/pricing" className="text-brand-orange hover:underline">
          pricing / early access
        </Link>
        .
      </p>

      <h2
        id="name"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        What “Netflix Party” means now
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Netflix Party rebranded to Teleparty years ago. Searchers still type
        “netflix party youtube” when they want co-watching on YouTube. That is a
        different problem from watching Netflix itself — see{" "}
        <Link
          href="/compare/anidachi-vs-netflix-watch-party"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Netflix Watch Party
        </Link>{" "}
        if your group is Netflix-first.
      </p>

      <h2
        id="options"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Your options for YouTube
      </h2>
      <ul className="list-disc pl-6 space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi</strong> — YouTube watchrooms with live sync and async
          catch-up; same extension as{" "}
          <Link
            href="/watch-crunchyroll-together"
            className="text-brand-orange hover:underline"
          >
            Crunchyroll
          </Link>
          .
        </li>
        <li>
          <strong>Teleparty</strong> — multi-platform live sync including YouTube (
          <Link
            href="/guides/does-teleparty-work-with-youtube"
            className="text-brand-orange hover:underline"
          >
            does Teleparty work with YouTube?
          </Link>
          ).
        </li>
        <li>
          <strong>Watch2Gether</strong> — free browser room for casual live hangs.
        </li>
      </ul>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange">
        <li>
          <Link href="/watch-youtube-together" className="hover:underline">
            YouTube watch party hub
          </Link>
        </li>
        <li>
          <Link
            href="/guides/how-to-watch-youtube-with-friends"
            className="hover:underline"
          >
            How to watch YouTube with friends
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
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
