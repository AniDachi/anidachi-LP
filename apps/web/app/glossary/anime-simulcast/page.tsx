import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";

export const metadata: Metadata = {
  title: "What Is an Anime Simulcast? — Glossary",
  description:
    "An anime simulcast is when an episode airs in Japan and becomes available internationally at the same time. Learn how simulcasts work on Crunchyroll and why they matter for watch parties.",
  alternates: { canonical: "/glossary/anime-simulcast" },
};

const faq = [
  {
    question: "What does simulcast mean in anime?",
    answer:
      "A simulcast means an anime episode is broadcast internationally at the same time (or within hours) as its original Japanese airing. Crunchyroll simulcasts most seasonal anime, making new episodes available worldwide simultaneously.",
  },
  {
    question: "Can I watch simulcast episodes with friends using AniDachi?",
    answer:
      "Yes! Create an AniDachi watchroom for a simulcast anime. When a new episode drops, watch it together in real-time with synced playback, or let friends catch up asynchronously.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "watch-parties", label: "Why simulcasts matter", level: 2 },
  { id: "where", label: "Where to watch", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AnimeSimulcastGlossaryPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Glossary", url: "/watch-anime-together" },
        { name: "Anime Simulcast", url: "/glossary/anime-simulcast" },
      ]}
      title="What Is an Anime Simulcast?"
      description="Definition of anime simulcasts and how they work."
      url="/glossary/anime-simulcast"
      datePublished="2026-04-23"
      dateModified="2026-04-24"
      faq={faq}
      headings={tocHeadings}
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        What Is an Anime Simulcast?
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          An anime simulcast is when a new episode airs in Japan and becomes
          available to international viewers on platforms like Crunchyroll at
          the same time or within hours.
        </strong>{" "}
        This means fans worldwide can watch new episodes the day they air,
        without waiting weeks for localization.
      </p>

      <h2
        id="watch-parties"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Why Simulcasts Matter for Watch Parties
      </h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Simulcasts make group watching exciting because everyone can react to
        new episodes at the same time — no spoiler risk. Create an AniDachi
        watchroom for a seasonal simulcast anime, and your group gets the
        shared premiere experience every week.
      </p>

      <h2
        id="where"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Where to Watch Simulcasts
      </h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Crunchyroll is the largest simulcast platform for anime, streaming most
        seasonal series within hours of their Japanese broadcast. Other options
        include HIDIVE and Netflix (for select titles with delayed availability).
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-purple-600">
        <li><Link href="/glossary/watchroom" className="hover:underline">What Is a Watchroom?</Link></li>
        <li><Link href="/glossary/dub-vs-sub-watch-party" className="hover:underline">Dub vs Sub Watch Party</Link></li>
        <li><Link href="/watch-crunchyroll-together" className="hover:underline">Watch Crunchyroll Together</Link></li>
      </ul>
    </SeoPageLayout>
  );
}
