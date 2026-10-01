import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { genreHubItemList } from "@/lib/genre-hub-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_ASYNC_HOST_SNIPPET,
  PRICING_STARTING_AT,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Anime Watch Party — Host on Crunchyroll With Friends (2026)",
  description:
    "Start a live anime watch party on Crunchyroll with AniDachi. A Plus, Pro, or trial host invites Free friends for synced playback, chat, and reactions.",
  alternates: { canonical: "/anime-watch-party" },
  openGraph: {
    title: "Anime Watch Party — Crunchyroll Group Watching (2026)",
    description:
      "Host a live anime watch party with synced Crunchyroll playback, chat, reactions, and voice/video.",
    url: "/anime-watch-party",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Watch Party — Crunchyroll Group Watching (2026)",
    description:
      "Host a live anime watch party with synced playback, chat, reactions, and voice/video on Crunchyroll.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is the best way to host an anime watch party?",
    answer:
      "Install AniDachi on desktop Chrome and open the same Crunchyroll episode. A Plus, Pro, or trial host creates a room and shares its invite link; Free friends can join. Each person streams from their own account while playback stays synced, with live chat, reactions, and voice/video.",
  },
  {
    question: "Do you need Crunchyroll for an anime watch party?",
    answer:
      "For AniDachi watchrooms, yes — each participant needs their own active Crunchyroll subscription to stream the video. AniDachi provides the watchroom, sync, and chat layer on top. Free alternatives like Discord screen sharing work but cap quality and have no playback sync.",
  },
  {
    question: "Can you run an anime watch party without everyone being online at once?",
    answer:
      "You can watch independently and discuss later in a separate chat. AniDachi currently supports live rooms that need everyone online together. Built-in async catch-up, shared group progress, and replayed timestamped reactions are coming soon.",
  },
  {
    question: "How is this different from the anime watch party toolkit?",
    answer:
      "This page is the fast commercial path to hosting — setup steps and pricing. The toolkit at /anime-watch-party-toolkit is a deeper resource hub with compare pages, glossary terms, and extended guides when you want to research before committing.",
  },
  {
    question: "Is AniDachi free for anime watch parties?",
    answer: PRICING_ASYNC_HOST_SNIPPET,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "setup", label: "Set up in 5 steps", level: 2 },
  { id: "live-vs-async", label: "Live vs async watch parties", level: 2 },
  { id: "picks", label: "What to watch first", level: 2 },
  { id: "resources", label: "Deeper resources", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const pillarItemList = [
  { name: "Set up your watchroom", url: "/anime-watch-party#setup", position: 1 },
  { name: "Live vs async watch parties", url: "/anime-watch-party#live-vs-async", position: 2 },
  { name: "Anime watch party toolkit", url: "/anime-watch-party-toolkit", position: 3 },
  { name: "Watch anime together guide", url: "/watch-anime-together", position: 4 },
];

export default function AnimeWatchPartyPage() {
  const setupGuides = getGuideLinks({
    includeTags: ["watch-party", "how-to-core"],
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Anime watch party", url: "/anime-watch-party" },
      ]}
      title="Anime watch party on Crunchyroll"
      description="Host a live anime watch party with synced playback, chat, reactions, and voice/video."
      url="/anime-watch-party"
      datePublished="2026-07-02"
      dateModified="2026-10-01"
      faq={faq}
      headings={tocHeadings}
      itemList={[...pillarItemList, ...genreHubItemList(pillarItemList.length + 1).slice(0, 4)]}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
        Anime Watch Party
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-8">
        <strong>
          With Plus, Pro, or trial access, open a Crunchyroll episode in
          AniDachi, create a live room, and share the link. Free friends can
          join for synchronized playback, chat, reactions, and voice/video.
        </strong>{" "}
        Each person streams on their own Crunchyroll account at full quality.
        Choose an episode and a shared start time before sending invitations.
      </p>

      <p className="text-foreground/80 mb-8">
        Ready to host?{" "}
        <Link href="/#pricing" className="text-brand-orange font-medium hover:underline">
          See AniDachi pricing — Free to join, Plus from {PRICING_STARTING_AT} to host
        </Link>
        .
      </p>

      <h2
        id="setup"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        How to Set Up an Anime Watch Party (5 Steps)
      </h2>
      <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
        <li>
          <span className="font-medium text-foreground">Install AniDachi</span>{" "}
          on Chrome for every participant who will join the watch party.
        </li>
        <li>
          <span className="font-medium text-foreground">Pick a series on Crunchyroll</span>{" "}
          and open episode one — confirm everyone in the group has catalog access.
        </li>
        <li>
          <span className="font-medium text-foreground">Create a watchroom</span>{" "}
          with active Plus, Pro, or trial access and copy the invite link.
        </li>
        <li>
          <span className="font-medium text-foreground">Share the link</span>{" "}
          in Discord, group chat, or email so friends can join before you press play.
        </li>
        <li>
          <span className="font-medium text-foreground">Watch live together</span>{" "}
          — start once everyone has joined and opened the same episode.
        </li>
      </ol>

      <h2
        id="live-vs-async"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Live vs Async Anime Watch Parties
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        <strong>Live watch parties</strong> keep everyone on the same timestamp —
        ideal for season finales, tournament episodes, and premiere drops.{" "}
        <strong>Async watch parties</strong> let each person watch when they can;
        arrange those discussions in a separate chat today. AniDachi&apos;s
        built-in async catch-up and replayed reactions are coming soon.
      </p>
      <p className="text-foreground/80 mb-8">
        Read the full breakdown:{" "}
        <Link
          href="/guides/asynchronous-vs-live-watch-party"
          className="text-brand-orange hover:underline"
        >
          async vs live watch parties
        </Link>
        .
      </p>

      <h2
        id="picks"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        What Anime Should Your Watch Party Start With?
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link href="/guides/best-anime-to-watch-in-a-watch-party" className="hover:underline">
            Best anime for a watch party — curated picks
          </Link>
        </li>
        <li>
          <Link href="/guides/best-anime-to-watch-asynchronously" className="hover:underline">
            Best anime to watch asynchronously
          </Link>
        </li>
        <li>
          <Link href="/watch-shonen-anime-with-friends" className="hover:underline">
            Shonen anime watch party hub
          </Link>
        </li>
        <li>
          <Link href="/watch-action-anime-with-friends" className="hover:underline">
            Action anime watch party hub
          </Link>
        </li>
      </ul>

      <h2
        id="resources"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Deeper Resources
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link href="/anime-watch-party-toolkit" className="hover:underline">
            Anime watch party toolkit — guides, compare, glossary
          </Link>
        </li>
        <li>
          <Link href="/watch-anime-together" className="hover:underline">
            Watch anime together — complete online guide
          </Link>
        </li>
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll together hub
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
          </Link>
        </li>
        {setupGuides.map((g) => (
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
