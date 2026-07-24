import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Does Everyone Need Crunchyroll Premium for a Watch Party? (2026) | AniDachi",
  description:
    "Each person needs their own Crunchyroll login for watch parties — no account sharing. Fan vs Mega Fan vs Premium for simulcast access explained.",
  alternates: {
    canonical: "/guides/does-everyone-need-crunchyroll-premium-for-watch-party",
  },
  openGraph: {
    title: "Does Everyone Need Crunchyroll Premium for Watch Parties?",
    description:
      "Per-user Crunchyroll access for group watch — which tier each friend needs for simulcasts and ad-free nights.",
    url: "/guides/does-everyone-need-crunchyroll-premium-for-watch-party",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crunchyroll Premium for Watch Parties?",
    description: "Fan vs Mega Fan vs Premium — who needs what for group watch.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does everyone need Crunchyroll Premium for a watch party?",
    answer:
      "Everyone needs their own Crunchyroll account with access to the series you are watching — but not necessarily Premium. Fan tier works for most catalog titles; Mega Fan or Premium matters when you need ad-free playback, offline downloads, or same-day simulcast access in your region.",
  },
  {
    question: "Can one person share their Crunchyroll account for a watch party?",
    answer:
      "Account sharing violates Crunchyroll's terms and creates a single-stream bottleneck. The legal, reliable model is per-user playback: each friend streams from their own login while AniDachi (or another sync tool) keeps the room aligned.",
  },
  {
    question: "What is the difference between Fan and Mega Fan for watch parties?",
    answer:
      "Fan tier includes ad-supported streaming on most devices. Mega Fan removes ads and adds offline viewing — better for weekly club nights where mid-episode ad breaks ruin sync. For simulcast premiere nights, confirm your region's simulcast tier requirements.",
  },
  {
    question: "Do friends need to pay for AniDachi too?",
    answer: PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  },
  {
    question: "Can we watch Crunchyroll together for free?",
    answer:
      "Crunchyroll offers a free ad-supported tier with a limited catalog. If every member has free-tier access to the same series, you can sync with Crunchyroll Party or AniDachi — but ad timing may drift between viewers. See our Crunchyroll watch party free guide for the tradeoffs.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "per-user", label: "Per-user login model", level: 2 },
  { id: "tiers", label: "Fan vs Mega Fan vs Premium", level: 2 },
  { id: "simulcast", label: "Simulcast premiere nights", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DoesEveryoneNeedCrunchyrollPremiumPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["crunchyroll", "watch-party", "pillar-watch-crunchyroll"],
    excludeHref: "/guides/does-everyone-need-crunchyroll-premium-for-watch-party",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Guides", url: "/watch-anime-together" },
        {
          name: "Does everyone need Crunchyroll Premium?",
          url: "/guides/does-everyone-need-crunchyroll-premium-for-watch-party",
        },
      ]}
      title="Does everyone need Crunchyroll Premium for a watch party?"
      description="Per-user Crunchyroll access for group watch — Fan, Mega Fan, and Premium explained."
      url="/guides/does-everyone-need-crunchyroll-premium-for-watch-party"
      datePublished="2026-07-22"
      dateModified="2026-07-22"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta={true}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Does Everyone Need Crunchyroll Premium for a Watch Party?
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Every person needs their own Crunchyroll login with access to the
          series — but not everyone needs Premium.
        </strong>{" "}
        Fan tier covers most back-catalog watch parties. Mega Fan or Premium
        matters when your group wants ad-free sync, offline catch-up, or
        same-day simulcast access. No tool replaces individual streaming rights.
      </p>

      <h2
        id="per-user"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Per-user login model
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Watch party extensions — Teleparty, Crunchyroll Party, AniDachi — sync
        playback across separate Crunchyroll tabs. They do not grant streaming
        access. Each viewer signs into their own account and opens the same
        episode; the tool aligns play/pause and chat on top.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Sharing one login breaks terms of service, caps concurrent streams, and
        turns one person&apos;s connection into the group bottleneck. For the
        legal per-user workflow, read{" "}
        <Link
          href="/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing"
          className="text-brand-orange hover:underline"
        >
          how to watch Crunchyroll with friends without account sharing
        </Link>
        .
      </p>

      <h2
        id="tiers"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Fan vs Mega Fan vs Premium
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-4">
        <li>
          <strong>Fan</strong> — ad-supported streaming on most catalog titles.
          Works for casual group nights if everyone tolerates ad breaks (sync
          tools may drift slightly when ads hit at different times).
        </li>
        <li>
          <strong>Mega Fan</strong> — ad-free playback and offline downloads.
          Best default for weekly clubs that sync live on Sunday simulcasts.
          See our{" "}
          <Link
            href="/glossary/crunchyroll-mega-fan"
            className="text-brand-orange hover:underline"
          >
            Crunchyroll Mega Fan glossary entry
          </Link>{" "}
          for tier details.
        </li>
        <li>
          <strong>Premium (Ultimate Fan)</strong> — adds perks like swag bags
          and priority support; playback access is similar to Mega Fan for watch
          party purposes in most regions.
        </li>
      </ul>
      <p className="text-foreground/80 leading-relaxed mb-8">
        AniDachi pricing is separate — guests can join on Free while each person
        keeps their own Crunchyroll subscription. See{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>
        .
      </p>

      <h2
        id="simulcast"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Simulcast premiere nights
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        For same-day simulcast episodes, confirm every member&apos;s tier
        includes that series in your region before sending invites. A member on
        free tier without simulcast access will silently fall behind — sync
        tools cannot fix missing catalog rights.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Free-tier watch party options exist but trade ad drift for zero
        subscription cost — see{" "}
        <Link
          href="/guides/crunchyroll-watch-party-free"
          className="text-brand-orange hover:underline"
        >
          Crunchyroll watch party free
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
          <Link href="/glossary/crunchyroll-mega-fan" className="hover:underline">
            Crunchyroll Mega Fan — glossary
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
          <Link
            href="/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing"
            className="hover:underline"
          >
            Watch without account sharing
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
