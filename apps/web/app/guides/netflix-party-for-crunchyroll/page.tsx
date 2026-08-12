import type { Metadata } from "next";
import Link from "next/link";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_TELEPARTY_COMPARE_FAQ } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Netflix Party for Crunchyroll — Watch Anime Together (2026) | AniDachi",
  description:
    "Searching “Netflix Party Crunchyroll”? Teleparty (formerly Netflix Party) can sync Crunchyroll live. AniDachi adds anime watchrooms with async catch-up.",
  alternates: { canonical: "/guides/netflix-party-for-crunchyroll" },
  openGraph: {
    title: "Netflix Party for Crunchyroll",
    description:
      "What “Netflix Party for Crunchyroll” means in 2026 — Teleparty live sync vs AniDachi watchrooms.",
    url: "/guides/netflix-party-for-crunchyroll",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Netflix Party for Crunchyroll",
    description: "Teleparty lineage + AniDachi Crunchyroll watchrooms explained.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is there a Netflix Party for Crunchyroll?",
    answer:
      "There is no Netflix-branded Crunchyroll party. People usually mean Teleparty (formerly Netflix Party), which supports Crunchyroll live sync, Crunchyroll Party, or a dedicated anime watchroom tool like AniDachi.",
  },
  {
    question: "Does Netflix Party work on Crunchyroll?",
    answer:
      "Teleparty (the product formerly called Netflix Party) can sync Crunchyroll when everyone is online together. It does not offer AniDachi-style async watchrooms or per-episode anime progress.",
  },
  {
    question: "What should I use instead of Netflix Party for Crunchyroll?",
    answer:
      "For live-only free sync, Teleparty or Crunchyroll Party. For Crunchyroll watchrooms with async catch-up — and the same tool for YouTube nights — choose AniDachi.",
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

export default function NetflixPartyForCrunchyrollPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-crunchyroll"],
    excludeHref: "/guides/netflix-party-for-crunchyroll",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
        {
          name: "Netflix Party for Crunchyroll",
          url: "/guides/netflix-party-for-crunchyroll",
        },
      ]}
      title="Netflix Party for Crunchyroll"
      description="What people mean by Netflix Party for Crunchyroll — and the best tools in 2026."
      url="/guides/netflix-party-for-crunchyroll"
      datePublished="2026-08-11"
      dateModified="2026-08-11"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Netflix Party for Crunchyroll — How to Co-Watch Anime in 2026
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-8">
        <strong>
          “Netflix Party for Crunchyroll” usually means Teleparty (the old Netflix
          Party brand) syncing a Crunchyroll episode — or a purpose-built anime
          watchroom like AniDachi.
        </strong>{" "}
        AniDachi does not sync Netflix. It does host full Crunchyroll and YouTube
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
        “netflix party crunchyroll” when they want co-watching on Crunchyroll.
        That is different from watching Netflix itself — see{" "}
        <Link
          href="/compare/anidachi-vs-netflix-watch-party"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Netflix Watch Party
        </Link>{" "}
        if your group is Netflix-first, or the YouTube twin{" "}
        <Link
          href="/guides/netflix-party-for-youtube"
          className="text-brand-orange hover:underline"
        >
          Netflix Party for YouTube
        </Link>
        .
      </p>

      <h2
        id="options"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Your options for Crunchyroll
      </h2>
      <ul className="list-disc pl-6 space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi</strong> — Crunchyroll watchrooms with live sync and
          async catch-up; same extension as{" "}
          <Link
            href="/watch-youtube-together"
            className="text-brand-orange hover:underline"
          >
            YouTube
          </Link>
          .
        </li>
        <li>
          <strong>Teleparty</strong> — multi-platform live sync including
          Crunchyroll (
          <Link
            href="/guides/does-teleparty-work-with-crunchyroll"
            className="text-brand-orange hover:underline"
          >
            does Teleparty work with Crunchyroll?
          </Link>
          ).
        </li>
        <li>
          <strong>Crunchyroll Party</strong> — free live sync built for Crunchyroll
          only (
          <Link
            href="/guides/crunchyroll-party-alternative"
            className="text-brand-orange hover:underline"
          >
            Crunchyroll Party alternative
          </Link>
          ).
        </li>
      </ul>

      <PrimaryCheckoutCta
        pagePath="/guides/netflix-party-for-crunchyroll"
        pageTemplate="guide"
        placement="content_mid"
        className="my-10"
      />

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange">
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Crunchyroll watch party hub
          </Link>
        </li>
        <li>
          <Link
            href="/guides/how-to-watch-crunchyroll-with-friends"
            className="hover:underline"
          >
            How to watch Crunchyroll with friends
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
