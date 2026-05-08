import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://anidachi.app";
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Anime Watch Party Toolkit — Guides, Glossary & Compare (2026)",
  description:
    "One hub for Crunchyroll group watching: pillars, how-to guides, glossary terms, and competitor context—before you install AniDachi.",
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
    question: "When should I open this toolkit instead of the long-form pillars?",
    answer:
      "Use it when you already know you need a Crunchyroll stack but want fast orientation—compare tools, skim definitions, and dive into one deep guide without hunting the footer.",
  },
  {
    question: "Does the toolkit replace the Chrome extension install?",
    answer:
      "No. It explains what to read before install. You still add AniDachi from the Chrome Web Store and sign into Crunchyroll on each device.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "pillars", label: "Big-picture guides", level: 2 },
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
      dateModified="2026-05-08"
      faq={faq}
      headings={tocHeadings}
      itemList={toolkitItemList}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
        Anime watch party toolkit
      </h1>
      <p className="text-xl text-gray-700 leading-relaxed mb-10">
        <strong>
          Built for hosts who need orientation fast: read a pillar, skim a checklist,
          compare tools, then install AniDachi when you are ready for watchrooms.
        </strong>
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
