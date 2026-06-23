import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { genreHubItemList } from "@/lib/genre-hub-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Anime Watch Party Toolkit — Guides, Glossary & Compare (2026)",
  description:
    "Start here for Crunchyroll anime watch parties: install AniDachi, read a setup guide, compare alternatives, and learn the key terms — all in one place.",
  alternates: { canonical: "/anime-watch-party-toolkit" },
  openGraph: {
    title: "Anime Watch Party Toolkit",
    description:
      "Curated links for planning, etiquette, and tooling for anime watch parties.",
    url: "/anime-watch-party-toolkit",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Watch Party Toolkit",
    description: "Hub of guides and resources for Crunchyroll watch parties.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is the best anime watch party setup for Crunchyroll?",
    answer:
      "The best Crunchyroll watch party setup is AniDachi — a Chrome extension that syncs playback, adds real-time chat, and supports async watching. Install it on each participant's device, open any Crunchyroll episode, create a watchroom, and share the invite link.",
  },
  {
    question: "Can you do an anime watch party without everyone being online at the same time?",
    answer:
      "Yes — AniDachi supports async watching. Each person watches at their own pace, marks episodes as done, and leaves timestamped reactions. Others see those reactions when they finish the same episode. No scheduling required.",
  },
  {
    question: "Is Teleparty better than AniDachi for anime watch parties?",
    answer:
      "Teleparty supports more streaming platforms but has no async mode. AniDachi is purpose-built for Crunchyroll with async watching, auto anime detection, and per-person progress tracking. For Crunchyroll-first groups, AniDachi is the better choice.",
  },
  {
    question: "When should I open this toolkit instead of the long-form pillars?",
    answer:
      "Use it when you already know you need a Crunchyroll stack but want fast orientation — compare tools, skim definitions, and dive into one deep guide without hunting the footer.",
  },
  {
    question: "Do I need a Crunchyroll subscription to join an AniDachi watchroom?",
    answer:
      "Yes — each participant needs their own Crunchyroll account to stream. AniDachi provides the sync, watchroom, and chat layer on top. The host creates the room; everyone else joins via invite link using their own Crunchyroll login.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "pillars", label: "Big-picture guides", level: 2 },
  { id: "genre-hubs", label: "Browse by genre", level: 2 },
  { id: "playbooks", label: "Playbooks & checklists", level: 2 },
  { id: "compare", label: "Compare approaches", level: 2 },
  { id: "glossary", label: "Glossary quick links", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const toolkitItemList = [
  { name: "Watch Anime Together (pillar)", url: "/watch-anime-together", position: 1 },
  { name: "Watch Crunchyroll Together (pillar)", url: "/watch-crunchyroll-together", position: 2 },
  { name: "Chrome extension guide", url: "/guides/crunchyroll-watch-party-chrome-extension", position: 3 },
  {
    name: "First watch party checklist",
    url: "/guides/first-anime-watch-party-checklist",
    position: 4,
  },
];

export default function AnimeWatchPartyToolkitPage() {
  const extraGuides = getGuideLinks({
    includeTags: ["how-to-core"],
    excludeHref: "/guides/first-anime-watch-party-checklist",
    limit: 6,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        {
          name: "Anime watch party toolkit",
          url: "/anime-watch-party-toolkit",
        },
      ]}
      title="Anime watch party toolkit"
      description="Structured starting point for Crunchyroll group watching with AniDachi."
      url="/anime-watch-party-toolkit"
      datePublished="2026-05-08"
      dateModified="2026-06-23"
      faq={faq}
      headings={tocHeadings}
      itemList={[...toolkitItemList, ...genreHubItemList(toolkitItemList.length + 1)]}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
        Anime watch party toolkit
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-gray-900 mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-gray-700 leading-relaxed mb-10">
        <strong>
          The fastest path to an anime watch party on Crunchyroll: install
          AniDachi, open any episode, create a watchroom, share the link.
        </strong>{" "}
        This toolkit organizes every guide, glossary term, and comparison in
        one place — so you can orient quickly and get to watching.
      </p>

      <h2
        id="pillars"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Big-picture guides
      </h2>
      <ul className="space-y-2 text-purple-600 mb-8">
        <li>
          <Link href="/watch-anime-together" className="hover:underline">
            Watch Anime Together — complete online guide
          </Link>
        </li>
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll Together hub
          </Link>
        </li>
      </ul>

      <h2
        id="genre-hubs"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Browse anime by genre
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        Genre hubs group the best Crunchyroll titles for group watchrooms — each links to a dedicated watch page with setup steps and spoiler tips.
      </p>
      <ul className="space-y-2 text-purple-600 mb-8">
        <li>
          <Link href="/watch-action-anime-with-friends" className="hover:underline">
            Watch action anime with friends
          </Link>
        </li>
        <li>
          <Link href="/watch-romance-anime-with-friends" className="hover:underline">
            Watch romance anime with friends
          </Link>
        </li>
        <li>
          <Link href="/watch-comedy-anime-with-friends" className="hover:underline">
            Watch comedy anime with friends
          </Link>
        </li>
        <li>
          <Link href="/watch-sports-anime-with-friends" className="hover:underline">
            Watch sports anime with friends
          </Link>
        </li>
        <li>
          <Link href="/watch-mystery-anime-with-friends" className="hover:underline">
            Watch mystery anime with friends
          </Link>
        </li>
        <li>
          <Link href="/guides/best-isekai-anime-to-watch-with-friends" className="hover:underline">
            Best isekai anime to watch with friends
          </Link>
        </li>
      </ul>

      <h2
        id="playbooks"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Playbooks &amp; checklists
      </h2>
      <ul className="space-y-2 text-purple-600 mb-4">
        {toolkitItemList.slice(2).map((row) => (
          <li key={row.url}>
            <Link href={row.url} className="hover:underline">
              {row.name.replace(/\s*\(.*\)\s*$/, "")}
            </Link>
          </li>
        ))}
        {extraGuides.map((g) => (
          <li key={g.href}>
            <Link href={g.href} className="hover:underline">
              {g.label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-gray-700 text-sm mb-8">
        ItemList JSON-LD mirrors the numbered resources above for crawlers.
      </p>

      <h2
        id="compare"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Compare approaches
      </h2>
      <ul className="space-y-2 text-purple-600 mb-8">
        <li>
          <Link
            href="/compare/anidachi-vs-crunchyroll-party"
            className="hover:underline"
          >
            AniDachi vs Crunchyroll Party
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
          </Link>
        </li>
        <li>
          <Link
            href="/compare/anidachi-vs-discord-screen-share"
            className="hover:underline"
          >
            AniDachi vs Discord screen share
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-watch2gether" className="hover:underline">
            AniDachi vs Watch2Gether
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-roll-together" className="hover:underline">
            AniDachi vs Roll Together
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-syncplay" className="hover:underline">
            AniDachi vs Syncplay
          </Link>
        </li>
        <li>
          <Link
            href="/compare/anidachi-vs-anime-watch-parties-extension"
            className="hover:underline"
          >
            AniDachi vs Anime Watch Parties extension
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-kast" className="hover:underline">
            AniDachi vs Kast
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-scener" className="hover:underline">
            AniDachi vs Scener
          </Link>
        </li>
      </ul>

      <h2
        id="glossary"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Glossary quick links
      </h2>
      <ul className="space-y-2 text-purple-600 mb-8">
        <li>
          <Link href="/glossary/watchroom" className="hover:underline">
            What is a watchroom?
          </Link>
        </li>
        <li>
          <Link href="/glossary/asynchronous-watching" className="hover:underline">
            Asynchronous watching
          </Link>
        </li>
        <li>
          <Link href="/glossary/crunchyroll-mega-fan" className="hover:underline">
            Crunchyroll Mega Fan tier
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}
