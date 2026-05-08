import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://anidachi.app";
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "What Is Crunchyroll Mega Fan? — Glossary for Watch Parties",
  description:
    "Plain-language primer on Crunchyroll’s Mega Fan subscription tier—what it affects for multi-device watchers and how watch party tools plug in afterward.",
  alternates: { canonical: "/glossary/crunchyroll-mega-fan" },
  openGraph: {
    title: "Crunchyroll Mega Fan glossary entry",
    description:
      "Understand Mega Fan perks before you coordinate group watches.",
    url: "/glossary/crunchyroll-mega-fan",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "What is Crunchyroll Mega Fan?",
    description: "Subscription basics for synced anime crews.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Do I need Mega Fan specifically to install AniDachi?",
    answer:
      "AniDachi is billed separately via the homepage checkout flow. Mega Fan—or any plan that unlocks the catalog you want—is about Crunchyroll access, not the extension itself.",
  },
  {
    question: "Where can I verify current pricing and benefits?",
    answer:
      "Always read Crunchyroll’s official plans page for the latest prices, regional availability, and simultaneous stream limits. Treat this glossary as orientation, not legal advice.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "definition", label: "Definition", level: 2 },
  { id: "watch-parties", label: "How it affects watch parties", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function CrunchyrollMegaFanGlossaryPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Glossary", url: "/watch-anime-together" },
        { name: "Crunchyroll Mega Fan", url: "/glossary/crunchyroll-mega-fan" },
      ]}
      title="What is Crunchyroll Mega Fan?"
      description="Glossary entry describing Crunchyroll Mega Fan in context of group watching."
      url="/glossary/crunchyroll-mega-fan"
      datePublished="2026-05-08"
      dateModified="2026-05-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        What is Crunchyroll Mega Fan?
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          Mega Fan is a paid Crunchyroll subscription tier that bundles ad-free
          streaming with offline downloads and multiple simultaneous streams—check
          Crunchyroll directly for the exact feature list in your region.
        </strong>{" "}
        Watch party hosts care because everyone in the room still needs their own
        legal playback rights before AniDachi can sync or async those sessions.
      </p>

      <h2
        id="definition"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Definition
      </h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Think of Mega Fan as Crunchyroll&apos;s power-user path: more flexibility for
        households or friends who juggle multiple devices. Plans and pricing change;
        confirm what&apos;s live in your country before promising your crew a specific
        dollar amount.
      </p>

      <h2
        id="watch-parties"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        How it affects watch parties
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        Watch party tools never replace private Crunchyroll credentials. They add
        watchrooms, chat, and sync on top of each viewer&apos;s authenticated tab. If
        someone is still on a limited free plan, backlog availability may differ—align
        on tiers before announcing premiere night.
      </p>
      <p className="text-gray-700 leading-relaxed mb-8">
        Once accounts are squared away, browse{" "}
        <Link href="/watch-crunchyroll-together" className="text-purple-600 hover:underline">
          Watch Crunchyroll Together
        </Link>{" "}
        and{" "}
        <Link href="/glossary/watchroom" className="text-purple-600 hover:underline">
          what a watchroom is
        </Link>{" "}
        next.
      </p>

      <h2 id="related" className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-purple-600 mb-8">
        <li>
          <Link href="/guides/how-to-watch-crunchyroll-with-friends" className="hover:underline">
            How to watch Crunchyroll with friends
          </Link>
        </li>
        <li>
          <Link href="/glossary/anime-simulcast" className="hover:underline">
            Anime simulcast glossary entry
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}
