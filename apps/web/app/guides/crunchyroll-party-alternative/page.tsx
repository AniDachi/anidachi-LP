import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_COMPARE_OVERVIEW,
  PRICING_EARLY_ACCESS_PRICE,
  PRICING_FREE_TIER_TABLE,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Crunchyroll Party Alternative — Upgrade to AniDachi (2026)",
  description:
    "Outgrew free Crunchyroll Party live sync? AniDachi adds async watchrooms, anime detection, and host entitlements. Compare and upgrade path.",
  alternates: { canonical: "/guides/crunchyroll-party-alternative" },
  openGraph: {
    title: "Crunchyroll Party Alternative — AniDachi",
    description:
      "Upgrade narrative from free CR Party limits to AniDachi async watchrooms.",
    url: "/guides/crunchyroll-party-alternative",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crunchyroll Party Alternative",
    description: "When free live sync is not enough for anime clubs.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is the best Crunchyroll Party alternative?",
    answer:
      "AniDachi is the strongest upgrade path for anime groups that outgrew free live-only sync — especially when friends need async catch-up, per-person progress, and auto anime detection on Crunchyroll.",
  },
  {
    question: "Is Crunchyroll Party free forever?",
    answer:
      "Crunchyroll Party is commonly used as a free live-sync Chrome extension. Free tools can still hit practical limits: everyone must be online together, and anime-specific workflows (async, progress, host controls) are thin compared with AniDachi.",
  },
  {
    question: "How does AniDachi pricing work if we leave Crunchyroll Party?",
    answer: PRICING_COMPARE_OVERVIEW,
  },
  {
    question: "Where is the full feature comparison?",
    answer:
      "See AniDachi vs Crunchyroll Party for the side-by-side matrix. This page focuses on when and why to upgrade, not duplicating every row of that compare page.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "limits", label: "CR Party limits", level: 2 },
  { id: "upgrade", label: "What AniDachi adds", level: 2 },
  { id: "table", label: "Quick comparison", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function CrunchyrollPartyAlternativePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["crunchyroll", "watch-party", "pillar-watch-crunchyroll"],
    excludeHref: "/guides/crunchyroll-party-alternative",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
        {
          name: "Crunchyroll Party alternative",
          url: "/guides/crunchyroll-party-alternative",
        },
      ]}
      title="Crunchyroll Party alternative"
      description="Upgrade from free Crunchyroll Party live sync to AniDachi async watchrooms."
      url="/guides/crunchyroll-party-alternative"
      datePublished="2026-07-19"
      dateModified="2026-07-19"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta={true}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Crunchyroll Party Alternative: When to Upgrade to AniDachi
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          If free Crunchyroll Party live sync still works for same-time nights,
          keep it. When schedules fracture — or you need async catch-up, progress
          tracking, and anime-aware rooms — AniDachi is the upgrade.
        </strong>{" "}
        AniDachi is not affiliated with Crunchyroll. Full matrix:{" "}
        <Link
          href="/compare/anidachi-vs-crunchyroll-party"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Crunchyroll Party
        </Link>
        .
      </p>

      <h2
        id="limits"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Where free CR Party plateaus
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>Everyone must be online together — no spoiler-safe async lane.</li>
        <li>Thin anime-specific tooling (detection, episode progress, host mods).</li>
        <li>Club hosts outgrow “just sync tonight” when seasons run 12–24 weeks.</li>
      </ul>

      <h2
        id="upgrade"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        What AniDachi adds
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Watchrooms with live sync and async catch-up, auto anime detection, chat
        tied to the room, and host entitlements that scale from Free limited
        hosting to Plus/Pro ({PRICING_EARLY_ACCESS_PRICE} for Plus during
        pre-launch). Guests can stay Free while the host upgrades.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Review plans on{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>
        .
      </p>

      <h2
        id="table"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Quick comparison
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "crparty", label: "Crunchyroll Party" },
        ]}
        rows={[
          {
            feature: "Live sync on Crunchyroll",
            values: { anidachi: "yes", crparty: "yes" },
          },
          {
            feature: "Async catch-up",
            values: { anidachi: "yes", crparty: "no" },
          },
          {
            feature: "Auto anime detection",
            values: { anidachi: "yes", crparty: "no" },
          },
          {
            feature: "Free tier",
            values: {
              anidachi: PRICING_FREE_TIER_TABLE,
              crparty: "Yes (live sync)",
            },
          },
        ]}
      />

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
