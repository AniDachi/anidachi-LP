import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getGuideLinks } from "@/lib/guide-links";
import {
  PRICING_ASYNC_HOST_SNIPPET,
  PRICING_PLUS_PRICE_LINE,
} from "@/lib/pricing-copy";

export const metadata: Metadata = {
  title: "Best Crunchyroll Watch Party Chrome Extensions (2026)",
  description:
    "Compare the top Crunchyroll watch party Chrome extensions: AniDachi, Crunchyroll Party, Teleparty, Roll Together, and Anime Watch Parties. Features, pricing, and setup guide.",
  alternates: { canonical: "/guides/crunchyroll-watch-party-chrome-extension" },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "Best Crunchyroll Watch Party Chrome Extensions (2026)",
    description:
      "Detailed comparison of every Chrome extension for watching Crunchyroll with friends.",
    url: "/guides/crunchyroll-watch-party-chrome-extension",
  },
};

const faq = [
  {
    question: "What is the best Chrome extension for Crunchyroll watch parties?",
    answer:
      "It depends on your needs. AniDachi offers live rooms and personal progress tracking. Crunchyroll Party is the most popular free option for live sync. Teleparty works across multiple streaming services but has limited Crunchyroll-specific features.",
  },
  {
    question: "Are Crunchyroll watch party extensions safe?",
    answer:
      "Start from the AniDachi install page (/extension): download the official zip and Load unpacked in Chrome. AniDachi is not on the Chrome Web Store yet. Always check permissions and publisher info before installing any extension.",
  },
  {
    question: "Do watch party extensions work with Crunchyroll ads?",
    answer:
      "Some extensions may not sync properly during ad breaks. For the best experience, a Crunchyroll premium account (ad-free) is recommended when using any watch party extension.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "anidachi", label: "AniDachi", level: 2 },
  { id: "cr-party", label: "Crunchyroll Party", level: 2 },
  { id: "teleparty", label: "Teleparty", level: 2 },
  { id: "roll-together", label: "Roll Together & others", level: 2 },
  { id: "comparison-table", label: "Quick comparison", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function CrunchyrollExtensionsPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["how-to-core", "online", "watch-party"],
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
        { name: "Crunchyroll Watch Party Extensions", url: "/guides/crunchyroll-watch-party-chrome-extension" },
      ]}
      title="Best Crunchyroll Watch Party Chrome Extensions"
      description="Detailed comparison of Chrome extensions for watching Crunchyroll with friends."
      url="/guides/crunchyroll-watch-party-chrome-extension"
      datePublished="2026-04-23"
      dateModified="2026-04-24"
      faq={faq}
      headings={tocHeadings}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Best Crunchyroll Watch Party Chrome Extensions in 2026
      </h1>

      <p className="text-xl text-foreground/80 leading-relaxed mb-8">
        <strong>
          The best Crunchyroll watch party Chrome extension depends on whether
          you need live sync, personal history, or multi-platform support.
        </strong>{" "}
        Here are the main options and their current uses.
      </p>

      <h2
        id="anidachi"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        1. AniDachi — Live Rooms and Personal History
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        AniDachi detects the current title on Crunchyroll and lets you create a live room with chat, reactions, cameras, and microphones. Personal history on Plus or Pro helps each viewer resume their own progress. {PRICING_ASYNC_HOST_SNIPPET}
      </p>
      <ul className="list-disc pl-6 space-y-1 text-foreground/80 mb-6">
        <li>Auto anime detection</li>
        <li>Live sync; Async planned</li>
        <li>Per-user progress tracking</li>
        <li>Real-time chat</li>
      </ul>

      <h2
        id="cr-party"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        2. Crunchyroll Party — Best Free Option
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        A simple, free extension that syncs Crunchyroll playback and adds text
        chat. No account required for the extension — just install, create a
        room, and share the link. It lacks async features, progress tracking,
        and auto-detection.
      </p>

      <h2
        id="teleparty"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        3. Teleparty (Netflix Party) — Best for Multi-Platform
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Teleparty (formerly Netflix Party) works across Netflix, Disney+, Hulu,
        HBO Max, and Crunchyroll. Great if your group watches on multiple
        platforms. The free tier offers basic sync; premium adds audio/video
        chat.
      </p>

      <h2
        id="roll-together"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        4. Roll Together &amp; Anime Watch Parties
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Smaller extensions with basic Crunchyroll sync. Roll Together is simple
        and reliable. Anime Watch Parties supports multiple anime platforms
        (Crunchyroll, Funimation, Wakanim). Both are free but have smaller user
        bases and fewer features.
      </p>

      <h2
        id="comparison-table"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        Quick Comparison
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "cr-party", label: "CR Party" },
          { id: "teleparty", label: "Teleparty" },
          { id: "roll-together", label: "Roll Together" },
        ]}
        rows={[
          { feature: "Async", values: { anidachi: "Planned", "cr-party": "no", teleparty: "no", "roll-together": "no" } },
          { feature: "Auto-detect", values: { anidachi: "yes", "cr-party": "no", teleparty: "no", "roll-together": "no" } },
          { feature: "Progress", values: { anidachi: "yes", "cr-party": "no", teleparty: "no", "roll-together": "no" } },
          {
            feature: "Price",
            values: {
              anidachi: PRICING_PLUS_PRICE_LINE,
              "cr-party": "Free",
              teleparty: "Freemium",
              "roll-together": "Free",
            },
          },
        ]}
      />

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        Related Guides
      </h2>
      <ul className="space-y-2 text-brand-orange">
        <li><Link href="/watch-crunchyroll-together" className="hover:underline">Watch Crunchyroll Together (Complete Guide)</Link></li>
        <li><Link href="/guides/how-to-watch-crunchyroll-with-friends" className="hover:underline">How to Watch Crunchyroll with Friends</Link></li>
        <li><Link href="/compare/anidachi-vs-teleparty" className="hover:underline">AniDachi vs Teleparty</Link></li>
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
