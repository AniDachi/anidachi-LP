import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_COMPARE_OVERVIEW,
  PRICING_IS_ANIDACHI_FREE_ANSWER,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Best Way to Watch Crunchyroll With Friends (2026 Verdict) | AniDachi",
  description:
    "Verdict: sync, async, or screen share? For most anime groups the best way to watch Crunchyroll with friends is AniDachi watchrooms — not Discord Go Live.",
  alternates: {
    canonical: "/guides/best-way-to-watch-crunchyroll-with-friends",
  },
  openGraph: {
    title: "Best Way to Watch Crunchyroll With Friends",
    description:
      "Method decision page: live sync vs async vs screen share — and why AniDachi wins for most crews.",
    url: "/guides/best-way-to-watch-crunchyroll-with-friends",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Way to Watch Crunchyroll With Friends",
    description: "Sync vs async vs screen share — clear verdict for anime groups.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is the best way to watch Crunchyroll with friends?",
    answer:
      "For most anime groups in 2026, the best way is a synced watchroom where everyone streams Crunchyroll locally — AniDachi for live sync plus async catch-up. Screen share is a last resort; pure honor-system countdowns break on mid-credit scenes.",
  },
  {
    question: "Is live sync or async better for Crunchyroll?",
    answer:
      "Live sync wins for premiere drops and finale nights. Async wins when time zones or work schedules never overlap. AniDachi supports both in one watchroom so you do not pick a permanent camp.",
  },
  {
    question: "Is this the same as how to watch Crunchyroll with friends?",
    answer:
      "No. That how-to walks setup steps. This page is a method verdict — which approach to choose — then points you to pricing and deeper guides once you decide.",
  },
  {
    question: "Is AniDachi free?",
    answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "verdict", label: "Verdict", level: 2 },
  { id: "methods", label: "Method comparison", level: 2 },
  { id: "decision", label: "Decision tree", level: 2 },
  { id: "next", label: "What to do next", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function BestWayToWatchCrunchyrollWithFriendsPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["crunchyroll", "pillar-watch-crunchyroll", "how-to-core"],
    excludeHref: "/guides/best-way-to-watch-crunchyroll-with-friends",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
        {
          name: "Best way to watch Crunchyroll with friends",
          url: "/guides/best-way-to-watch-crunchyroll-with-friends",
        },
      ]}
      title="Best way to watch Crunchyroll with friends"
      description="Method verdict: sync vs async vs screen share for Crunchyroll anime nights."
      url="/guides/best-way-to-watch-crunchyroll-with-friends"
      datePublished="2026-07-19"
      dateModified="2026-07-19"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta={true}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Best Way to Watch Crunchyroll With Friends (2026 Verdict)
      </h1>

      <h2
        id="verdict"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Verdict
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          The best way for most anime groups is AniDachi: everyone streams
          Crunchyroll in their own browser while a watchroom handles sync, chat,
          and optional async catch-up.
        </strong>{" "}
        Screen share loses on quality and legality-of-access hygiene. Live-only
        free extensions are fine for same-time nights — until schedules diverge.
        This is a decision page, not a clone of the{" "}
        <Link
          href="/guides/how-to-watch-crunchyroll-with-friends"
          className="text-brand-orange hover:underline"
        >
          how-to watch Crunchyroll with friends
        </Link>{" "}
        setup guide.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        {PRICING_COMPARE_OVERVIEW} Full details on{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          /pricing
        </Link>
        .
      </p>

      <h2
        id="methods"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Method comparison
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "livefree", label: "Live-only extension" },
          { id: "screenshare", label: "Screen share" },
        ]}
        rows={[
          {
            feature: "Full Crunchyroll quality",
            values: { anidachi: "yes", livefree: "yes", screenshare: "no" },
          },
          {
            feature: "Live sync",
            values: { anidachi: "yes", livefree: "yes", screenshare: "partial" },
          },
          {
            feature: "Async catch-up",
            values: { anidachi: "yes", livefree: "no", screenshare: "no" },
          },
          {
            feature: "Everyone has own controls",
            values: { anidachi: "yes", livefree: "yes", screenshare: "no" },
          },
          {
            feature: "Best for time zones",
            values: { anidachi: "yes", livefree: "no", screenshare: "no" },
          },
        ]}
      />

      <h2
        id="decision"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Decision tree
      </h2>
      <ul className="list-disc pl-6 space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>Everyone can start within 5 minutes tonight?</strong> Live sync
          (AniDachi or a free live-only tool) is enough.
        </li>
        <li>
          <strong>Someone always watches tomorrow?</strong> Pick AniDachi async —
          do not rely on Discord Go Live recordings.
        </li>
        <li>
          <strong>Only one person has Crunchyroll?</strong> Fix accounts first;
          screen share is not a sustainable answer.
        </li>
        <li>
          <strong>You need a host playbook?</strong> Jump to{" "}
          <Link
            href="/guides/how-to-host-a-crunchyroll-watch-party"
            className="text-brand-orange hover:underline"
          >
            how to host a Crunchyroll watch party
          </Link>
          .
        </li>
      </ul>

      <h2
        id="next"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        What to do next
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Choose AniDachi, review{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          pricing
        </Link>
        , then follow the pillar{" "}
        <Link
          href="/watch-crunchyroll-together"
          className="text-brand-orange hover:underline"
        >
          Watch Crunchyroll Together
        </Link>{" "}
        for setup depth. Comparing Teleparty? Start with{" "}
        <Link
          href="/guides/best-teleparty-alternatives-for-anime"
          className="text-brand-orange hover:underline"
        >
          Teleparty alternatives for anime
        </Link>
        .
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
            href="/guides/how-to-watch-crunchyroll-with-friends"
            className="hover:underline"
          >
            How to watch Crunchyroll with friends (setup)
          </Link>
        </li>
        <li>
          <Link
            href="/guides/how-to-host-a-crunchyroll-watch-party"
            className="hover:underline"
          >
            How to host a Crunchyroll watch party
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
