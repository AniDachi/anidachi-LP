import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_PLUS_PRICE_LINE } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Crunchyroll Party — Which Is Better for Anime Nights? (2026)",
  description:
    "Compare Crunchyroll watch parties: live sync, on-player chat, voice and cameras, invitations, and personal watch history. See what AniDachi offers today.",
  alternates: { canonical: "/compare/anidachi-vs-crunchyroll-party" },
  openGraph: {
    title: "AniDachi vs Crunchyroll Party",
    description:
      "Compare live Crunchyroll watch parties, room features, and personal watch history.",
    url: "/compare/anidachi-vs-crunchyroll-party",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Crunchyroll Party",
    description: "Compare live Crunchyroll rooms, invitations, and personal watch history.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is Crunchyroll Party free compared to AniDachi?",
    answer:
      "Crunchyroll Party is a free Chrome extension for live, synchronized watching. AniDachi has a Free tier for joining and limited hosting. Plus and Pro raise the host's room limits and let each subscribed viewer record and edit personal watch progress. Saved history and Resume remain available on Free.",
  },
  {
    question: "Do we still need Crunchyroll accounts for both tools?",
    answer:
      "Yes. Each viewer needs their own Crunchyroll access to stream legally. AniDachi adds the watchroom, sync layer, chat, and progress on top of each person’s own stream.",
  },
  {
    question: "Which is better for friends in different time zones?",
    answer:
      "AniDachi currently supports live rooms, so friends need to watch at the same time to stay in sync. Personal history helps each viewer resume their own viewing later; it is not a shared group progress record. Async catch-up is planned and is not available today.",
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "feature-comparison", label: "Feature comparison", level: 2 },
  { id: "when-crunchyroll-party", label: "When Crunchyroll Party is enough", level: 2 },
  { id: "when-anidachi", label: "When AniDachi wins", level: 2 },
  { id: "migration", label: "Migration path", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsCrunchyrollPartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        {
          name: "AniDachi vs Crunchyroll Party",
          url: "/compare/anidachi-vs-crunchyroll-party",
        },
      ]}
      title="AniDachi vs Crunchyroll Party"
      description="Side-by-side comparison for Crunchyroll watch parties."
      url="/compare/anidachi-vs-crunchyroll-party"
      datePublished="2026-05-11"
      dateModified="2026-09-18"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
    >
      <SeoGuideTitle>AniDachi vs Crunchyroll Party for anime watch parties</SeoGuideTitle>
      <h2 id="answer" className="scroll-mt-24">
        Short Answer
      </h2>
      <SeoGuideAnswer>

        <strong>
          Both tools support live Crunchyroll watch parties. AniDachi adds
          on-player chat, reactions, voice and cameras, friend and group
          invitations, and personal progress recording on Plus and Pro.
        </strong>
      
      </SeoGuideAnswer>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-foreground/80 mb-8">
        <strong>TL;DR:</strong> Use <strong>Crunchyroll Party</strong> for free, live
        synchronized watching. Use <strong>AniDachi</strong> for live rooms with
        on-player social controls and invitations. Each viewer with Plus or Pro
        can record and edit their own progress; saved history and Resume remain
        available on Free. Async catch-up is planned, not available today.
      </p>

      <h2
        id="feature-comparison"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Feature comparison
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "crunchyrollParty", label: "Crunchyroll Party" },
        ]}
        rows={[
          { feature: "Live sync", values: { anidachi: "yes", crunchyrollParty: "yes" } },
          {
            feature: "Asynchronous catch-up",
            values: { anidachi: "Planned — not available yet", crunchyrollParty: "no" },
          },
          {
            feature: "Auto anime detection",
            values: { anidachi: "yes", crunchyrollParty: "No / manual" },
          },
          {
            feature: "Per-person progress",
            values: {
              anidachi: "Record and edit on Plus/Pro; saved history and Resume on all plans",
              crunchyrollParty: "no",
            },
          },
          {
            feature: "Pricing",
            values: {
              anidachi: PRICING_PLUS_PRICE_LINE,
              crunchyrollParty: "Free",
            },
          },
        ]}
      />

      <h2
        id="when-crunchyroll-party"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When Crunchyroll Party is enough
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>Your whole group can watch at the same time every week.</li>
        <li>You mainly need basic live sync and a lightweight chat.</li>
        <li>You want a free option and can accept fewer “anime-specific” workflows.</li>
      </ul>

      <h2
        id="when-anidachi"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When AniDachi wins
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>You want voice, cameras, chat, and reactions on the video player.</li>
        <li>You want to invite friends or a saved group to a live room.</li>
        <li>You want to record and edit your own viewing progress with Plus or Pro.</li>
      </ul>

      <h2
        id="migration"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Migration path
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Each person opens Crunchyroll in their own browser. Create a live room,
        invite your friends, and watch in sync. Progress stays personal: each
        viewer needs their own Plus or Pro subscription to record and edit it,
        including when joining a paid host. Start with{" "}
        <Link href="/watch-crunchyroll-together" className="text-brand-orange hover:underline">
          Watch Crunchyroll Together
        </Link>{" "}
        and then review{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>
        . For another comparison, see{" "}
        <Link
          href="/guides/crunchyroll-party-alternative"
          className="text-brand-orange hover:underline"
        >
          Crunchyroll Party alternative
        </Link>
        .
      </p>

      <h2 id="related" className="scroll-mt-24">
        Related
      </h2>
      <SeoGuideRelated
        links={[
          { href: "/guides/is-crunchyroll-party-worth-it", label: "Is Crunchyroll Party worth it?" },
                    { href: "/guides/crunchyroll-party-alternative", label: "Crunchyroll Party alternative" },
                    { href: "/compare/anidachi-vs-teleparty", label: "AniDachi vs Teleparty" },
                    { href: "/compare/anidachi-vs-discord-screen-share", label: "AniDachi vs Discord screen share" },
                    { href: "/guides/crunchyroll-watch-party-chrome-extension", label: "Best Crunchyroll watch party Chrome extensions" }
        ]}
      />
    </SeoPageLayout>
  );
}
