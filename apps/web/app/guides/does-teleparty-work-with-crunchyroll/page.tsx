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
  title: "Does Teleparty Work With Crunchyroll? (2026 Answer) | AniDachi",
  description:
    "Yes — Teleparty can sync Crunchyroll for live watch parties. It does not support async catch-up. Compare Teleparty for Crunchyroll vs AniDachi for anime groups.",
  alternates: { canonical: "/guides/does-teleparty-work-with-crunchyroll" },
  openGraph: {
    title: "Does Teleparty Work With Crunchyroll?",
    description:
      "Teleparty supports Crunchyroll live sync — but not async watchrooms. When it works and when anime groups outgrow it.",
    url: "/guides/does-teleparty-work-with-crunchyroll",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Does Teleparty Work With Crunchyroll?",
    description:
      "Live sync yes; async no. How Teleparty for Crunchyroll compares to AniDachi.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does Teleparty work with Crunchyroll in 2026?",
    answer:
      "Yes. Teleparty (formerly Netflix Party) supports Crunchyroll for live synchronized playback and shared chat when everyone is online at the same time. Compatibility can vary after browser or Crunchyroll player updates — always test with a short clip before a big premiere night.",
  },
  {
    question: "Is Teleparty free for Crunchyroll watch parties?",
    answer: PRICING_TELEPARTY_COMPARE_FAQ,
  },
  {
    question: "Does Teleparty support async watching on Crunchyroll?",
    answer:
      "No. Teleparty is built for live sync: everyone presses play together. If a friend is in another time zone or misses the start time, there is no episode-scoped progress or spoiler-safe catch-up layer. AniDachi adds async watchrooms for that Crunchyroll use case.",
  },
  {
    question: "What is the best Teleparty alternative for anime on Crunchyroll?",
    answer:
      "For Crunchyroll-first anime groups — especially ones that need async catch-up — AniDachi is the strongest Teleparty alternative. See our ranked list of Teleparty alternatives for anime and the full AniDachi vs Teleparty comparison.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "how-it-works", label: "How Teleparty + Crunchyroll works", level: 2 },
  { id: "limits", label: "Where Teleparty falls short for anime", level: 2 },
  { id: "when-to-switch", label: "When to switch tools", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DoesTelepartyWorkWithCrunchyrollPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["crunchyroll", "watch-party", "how-to-core"],
    excludeHref: "/guides/does-teleparty-work-with-crunchyroll",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
        {
          name: "Does Teleparty work with Crunchyroll?",
          url: "/guides/does-teleparty-work-with-crunchyroll",
        },
      ]}
      title="Does Teleparty work with Crunchyroll?"
      description="Yes for live sync; no for async. How Teleparty for Crunchyroll fits anime groups — and when AniDachi is the better fit."
      url="/guides/does-teleparty-work-with-crunchyroll"
      datePublished="2026-07-19"
      dateModified="2026-08-11"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta={true}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Does Teleparty Work With Crunchyroll?
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Yes — Teleparty can work with Crunchyroll for live, synchronized watch
          parties when everyone is online together.
        </strong>{" "}
        It does not offer async catch-up, per-episode progress, or
        anime-specific spoiler controls. If your group watches Crunchyroll on
        staggered schedules, you will outgrow Teleparty for Crunchyroll nights.
      </p>

      <h2
        id="how-it-works"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        How Teleparty + Crunchyroll works
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Teleparty is a multi-platform Chrome extension. On Crunchyroll, each
        person opens the same episode in their own browser, joins a Teleparty
        session, and the extension keeps play/pause and seek roughly aligned
        while a side chat runs. AniDachi is not affiliated with Teleparty or
        Crunchyroll — we are describing the common live-sync pattern fans already
        use.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        That live-only model is fine for a Friday night finale when everyone can
        show up. It is weaker for seasonal simulcasts where half the group
        watches Sunday morning and the rest Monday night.
      </p>

      <h2
        id="limits"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Where Teleparty falls short for anime
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>
          <strong>No async mode</strong> — late joiners cannot catch up inside
          the same room without spoiler risk.
        </li>
        <li>
          <strong>General-purpose, not anime-first</strong> — no auto anime
          detection or episode-scoped progress the way AniDachi watchrooms work.
        </li>
        <li>
          <strong>Update fragility</strong> — Crunchyroll player changes can
          break sync until Teleparty ships a fix; always smoke-test before a
          premiere.
        </li>
      </ul>

      <PrimaryCheckoutCta
        pagePath="/guides/does-teleparty-work-with-crunchyroll"
        pageTemplate="guide"
        placement="content_mid"
        className="my-10"
      />

      <h2
        id="when-to-switch"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When to switch tools
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Keep Teleparty if your crew only watches live and jumps across Netflix,
        Disney+, and Crunchyroll in the same week. Switch when Crunchyroll is the
        main destination and schedules rarely align — that is where AniDachi
        async watchrooms win. For a ranked list, see{" "}
        <Link
          href="/guides/best-teleparty-alternatives-for-anime"
          className="text-brand-orange hover:underline"
        >
          best Teleparty alternatives for anime
        </Link>
        . For a 1:1 feature matrix, read{" "}
        <Link
          href="/compare/anidachi-vs-teleparty"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Teleparty
        </Link>
        .
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Ready to host a Crunchyroll watchroom with sync and async? Check{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>{" "}
        — guests can join on Free; hosts upgrade when they need higher room
        limits.
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
            href="/guides/netflix-party-for-crunchyroll"
            className="hover:underline"
          >
            Netflix Party for Crunchyroll
          </Link>
        </li>
        <li>
          <Link
            href="/guides/best-teleparty-alternatives-for-anime"
            className="hover:underline"
          >
            Best Teleparty alternatives for anime
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
          </Link>
        </li>
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll together
          </Link>
        </li>
        <li>
          <Link href="/pricing" className="hover:underline">
            AniDachi pricing
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
