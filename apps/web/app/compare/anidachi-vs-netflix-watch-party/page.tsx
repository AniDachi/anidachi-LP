import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_FREE_TIER_TABLE } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Netflix Watch Party for Anime (2026) | AniDachi",
  description:
    "AniDachi vs Netflix Teleparty watch parties for anime — Crunchyroll catalog, async watching, and which tool fits anime friend groups.",
  alternates: { canonical: "/compare/anidachi-vs-netflix-watch-party" },
  openGraph: {
    title: "AniDachi vs Netflix Watch Party for Anime",
    description:
      "Compare AniDachi (Crunchyroll-first) with Netflix watch party tools for anime groups.",
    url: "/compare/anidachi-vs-netflix-watch-party",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Netflix Watch Party for Anime",
    description:
      "Crunchyroll vs Netflix anime catalog and group-watch features compared.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does Netflix have a watch party for anime?",
    answer:
      "Netflix does not ship a native watch party feature. Most Netflix groups use Teleparty (formerly Netflix Party) or Discord screen sharing for live sync. Netflix's anime catalog is smaller than Crunchyroll's for current simulcasts — titles like Demon Slayer, Jujutsu Kaisen, and Haikyuu!! are Crunchyroll exclusives.",
  },
  {
    question: "Can AniDachi sync Netflix anime?",
    answer:
      "No — AniDachi does not sync Netflix. It supports Crunchyroll and YouTube watchrooms. If your anime is on Netflix only (some films and select series), use Teleparty or Netflix's regional alternatives. For most popular anime catalogs, Crunchyroll plus AniDachi is the correct stack; for YouTube videos use AniDachi's YouTube watchrooms.",
  },
  {
    question: "Which is better for anime watch parties, AniDachi or Netflix Teleparty?",
    answer:
      "For Crunchyroll anime — which includes most current hits — AniDachi wins on async catch-up, episode progress tracking, and anime-specific detection. Teleparty on Netflix works when your group's show is Netflix-exclusive and everyone can watch live at the same time.",
  },
  {
    question: "What anime is on Netflix vs Crunchyroll?",
    answer:
      "Netflix carries select anime films (Your Name on some regions, Neon Genesis Evangelion in certain territories) and Netflix Original anime (Cyberpunk: Edgerunners, Castlevania). Crunchyroll has the largest simulcast and shonen catalog — One Piece, Naruto, Demon Slayer, Jujutsu Kaisen, Attack on Titan, and most seasonal premieres.",
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "feature-comparison", label: "Feature comparison", level: 2 },
  { id: "catalog", label: "Anime catalog: Netflix vs Crunchyroll", level: 2 },
  { id: "when-anidachi", label: "When to choose AniDachi", level: 2 },
  { id: "when-netflix", label: "When to use Netflix watch parties", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsNetflixWatchPartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        { name: "AniDachi vs Netflix Watch Party", url: "/compare/anidachi-vs-netflix-watch-party" },
      ]}
      title="AniDachi vs Netflix Watch Party"
      description="Side-by-side comparison for anime watch parties on Crunchyroll vs Netflix."
      url="/compare/anidachi-vs-netflix-watch-party"
      datePublished="2026-07-02"
      dateModified="2026-07-02"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs Netflix Watch Party for Anime (2026)
      </h1>

      <h2 id="answer" className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          AniDachi is built for Crunchyroll — where most popular anime lives.
          Netflix watch parties (usually via Teleparty) work for Netflix-only
          titles when everyone can watch live. Pick the tool that matches where
          your group&apos;s anime actually streams.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-8 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-foreground/80 mb-6">
        <strong>TL;DR:</strong> For Demon Slayer, Jujutsu Kaisen, Haikyuu!!,
        One Piece, and current simulcasts — use AniDachi on Crunchyroll.
        Netflix Teleparty fits Netflix Original anime or regional Netflix
        exclusives when your whole group subscribes to Netflix and schedules align.
      </p>

      <h2 id="feature-comparison" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Feature comparison
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "netflix", label: "Netflix + Teleparty" },
        ]}
        rows={[
          { feature: "Crunchyroll support", values: { anidachi: "yes", netflix: "No" } },
          { feature: "Netflix support", values: { anidachi: "No — CR & YouTube only", netflix: "yes" } },
          { feature: "Asynchronous watching", values: { anidachi: "yes", netflix: "no" } },
          { feature: "Live synchronized playback", values: { anidachi: "yes", netflix: "yes" } },
          { feature: "Per-user episode progress", values: { anidachi: "yes", netflix: "no" } },
          { feature: "Auto anime detection", values: { anidachi: "yes", netflix: "no" } },
          { feature: "Built-in chat", values: { anidachi: "yes", netflix: "yes" } },
          { feature: "Requires streaming subscription", values: { anidachi: "Crunchyroll", netflix: "Netflix" } },
          { feature: "Host cost", values: { anidachi: PRICING_FREE_TIER_TABLE, netflix: "Teleparty free tier" } },
        ]}
      />

      <h2 id="catalog" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Anime Catalog: Netflix vs Crunchyroll
      </h2>
      <ul className="space-y-4 text-foreground/80 mb-8">
        <li>
          <strong>Netflix anime (partial):</strong> Cyberpunk: Edgerunners,
          Castlevania, select films and classics depending on region. Catalog
          varies significantly by country.
        </li>
        <li>
          <strong>Crunchyroll anime (larger for groups):</strong>{" "}
          <Link href="/watch/demon-slayer-with-friends" className="text-brand-orange hover:underline">Demon Slayer</Link>,{" "}
          <Link href="/watch/jujutsu-kaisen-with-friends" className="text-brand-orange hover:underline">Jujutsu Kaisen</Link>,{" "}
          <Link href="/watch/attack-on-titan-with-friends" className="text-brand-orange hover:underline">Attack on Titan</Link>,{" "}
          <Link href="/watch/haikyuu-with-friends" className="text-brand-orange hover:underline">Haikyuu!!</Link>, and most seasonal simulcasts.
        </li>
      </ul>

      <h2 id="when-anidachi" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        When to choose AniDachi
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-6">
        <li>Your group watches on Crunchyroll — the default for most anime clubs.</li>
        <li>You need async catch-up across time zones or busy schedules.</li>
        <li>You want episode-level spoiler controls for long-run series.</li>
        <li>You host recurring watchrooms and want anime-specific tooling.</li>
      </ul>

      <h2 id="when-netflix" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        When to use Netflix Watch Parties
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-6">
        <li>The show is Netflix-exclusive in your region and not on Crunchyroll.</li>
        <li>Everyone already has Netflix and can watch live at the same time.</li>
        <li>You only need basic sync — no async progress tracking.</li>
      </ul>
      <p className="text-foreground/80 mb-8">
        For Netflix-only long-distance viewing (non-anime or mixed catalogs), see{" "}
        <Link href="/watch-netflix-together-long-distance" className="text-brand-orange hover:underline">
          how to watch Netflix together long distance
        </Link>.
      </p>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange">
        <li><Link href="/compare/anidachi-vs-teleparty" className="hover:underline">AniDachi vs Teleparty</Link></li>
        <li><Link href="/compare/anidachi-vs-amazon-watch-party" className="hover:underline">AniDachi vs Amazon Watch Party</Link></li>
        <li><Link href="/anime-watch-party" className="hover:underline">Anime watch party guide</Link></li>
        <li><Link href="/watch-crunchyroll-together" className="hover:underline">Watch Crunchyroll together</Link></li>
      </ul>
    </SeoPageLayout>
  );
}
