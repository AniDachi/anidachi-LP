import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_FREE_TIER_TABLE,
  PRICING_IS_ANIDACHI_FREE_ANSWER,
  PRICING_PLUS_SHORT,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Free Crunchyroll Watch Party — Free Tier Options (2026) | AniDachi",
  description:
    "Yes, you can run a free Crunchyroll watch party. AniDachi Free for joining + limited hosting; upgrade the host for async. Compare Crunchyroll Party and Discord — start at pricing.",
  alternates: { canonical: "/guides/crunchyroll-watch-party-free" },
  openGraph: {
    title: "Free Crunchyroll Watch Party Options",
    description:
      "AniDachi Free vs Crunchyroll Party vs Discord — what free includes and when hosts upgrade.",
    url: "/guides/crunchyroll-watch-party-free",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Crunchyroll Watch Party Options",
    description:
      "Free tiers for Crunchyroll sync — then upgrade the host when you need async.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is there a free Crunchyroll watch party?",
    answer:
      "Yes. Crunchyroll Party and Discord Go Live are free (with tradeoffs). AniDachi Free lets friends join and host limited daily rooms — see /pricing when the host needs unlimited rooms or async catch-up.",
  },
  {
    question: "Is AniDachi free for Crunchyroll watch parties?",
    answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
  },
  {
    question: "What is the best free Crunchyroll watch party app?",
    answer:
      "For free live-only nights, Crunchyroll Party. For free joining plus a path to async catch-up when the host upgrades, AniDachi. Discord is free for voice but a poor video pipe.",
  },
  {
    question: "Does Crunchyroll itself offer a free watch party?",
    answer:
      "No. Crunchyroll has no native watch party. Free third-party tools work on Crunchyroll in desktop Chrome on each person's own account.",
  },
  {
    question: "When should the host upgrade from Free?",
    answer: `Upgrade to Plus (${PRICING_PLUS_SHORT}) when you hit the Free daily host cap, need larger rooms, or want async reactions for friends in other time zones. Guests can stay on Free.`,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "options", label: "Free options", level: 2 },
  { id: "limits", label: "What free usually means", level: 2 },
  { id: "upgrade", label: "When hosts upgrade", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function CrunchyrollWatchPartyFreePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-crunchyroll"],
    excludeHref: "/guides/crunchyroll-watch-party-free",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
        {
          name: "Crunchyroll watch party free",
          url: "/guides/crunchyroll-watch-party-free",
        },
      ]}
      title="Free Crunchyroll watch party options"
      description="Free Crunchyroll watch party tools and AniDachi Free tier limits — when hosts upgrade."
      url="/guides/crunchyroll-watch-party-free"
      datePublished="2026-07-12"
      dateModified="2026-07-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Free Crunchyroll Watch Party Options (2026)
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Yes — you can run a free Crunchyroll watch party with AniDachi Free (
          {PRICING_FREE_TIER_TABLE.toLowerCase()}), Crunchyroll Party, or Discord
          Go Live (with quality tradeoffs).
        </strong>{" "}
        Free usually means live-only sync and host caps. When your group needs
        unlimited hosting or async catch-up, the <strong>host</strong> upgrades
        on{" "}
        <Link href="/pricing" className="text-brand-orange hover:underline">
          /pricing
        </Link>{" "}
        while guests stay Free. Hub:{" "}
        <Link
          href="/watch-crunchyroll-together"
          className="text-brand-orange hover:underline"
        >
          Watch Crunchyroll Together
        </Link>
        .
      </p>

      <h2
        id="options"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Free Options Compared
      </h2>
      <ul className="space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi Free:</strong> Join rooms and host limited daily time;
          unlock async + unlimited hosting when the host moves to Plus.
        </li>
        <li>
          <strong>Crunchyroll Party:</strong> Free live sync on Crunchyroll —
          same-time groups only.
        </li>
        <li>
          <strong>Discord Go Live:</strong> Free and fast, but often blocked or
          low quality — prefer Discord for voice only. See{" "}
          <Link
            href="/guides/can-you-screen-share-crunchyroll-on-discord"
            className="text-brand-orange hover:underline"
          >
            can you screen share Crunchyroll on Discord
          </Link>
          .
        </li>
      </ul>

      <h2
        id="limits"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        What “Free” Usually Means
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Expect live-only sessions, smaller rooms, or daily host caps. Each person
        still needs their own Crunchyroll access for the video — AniDachi and
        similar tools sync the room; they do not replace streaming subscriptions.
      </p>

      <PrimaryCheckoutCta
        pagePath="/guides/crunchyroll-watch-party-free"
        pageTemplate="guide"
        placement="content_mid"
        className="my-10"
      />

      <h2
        id="upgrade"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When Hosts Upgrade
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Move to Plus ({PRICING_PLUS_SHORT}) when you hit the Free host cap, run
        weekly clubs, or need async reactions for friends in other time zones.
        Guests keep Free accounts. Full plan details:{" "}
        <Link href="/pricing" className="text-brand-orange hover:underline">
          pricing
        </Link>
        .
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related Guides
      </h2>
      <ul className="space-y-2 mb-8 text-brand-orange">
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll Together
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
