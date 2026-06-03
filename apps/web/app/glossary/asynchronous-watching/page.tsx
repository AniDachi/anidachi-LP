import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";

export const metadata: Metadata = {
  title: "What Is Asynchronous Anime Watching? — Glossary",
  description:
    "Asynchronous anime watching means friends watch the same show at their own pace and share reactions later. Learn how it works and which tools support it.",
  alternates: { canonical: "/glossary/asynchronous-watching" },
};

const faq = [
  {
    question: "What does asynchronous watching mean?",
    answer:
      "Asynchronous watching means each person in a group watches anime episodes on their own schedule, not at the same time. They share progress, reactions, and comments through a persistent watchroom that everyone can access whenever they watch.",
  },
  {
    question: "Which apps support asynchronous anime watching?",
    answer:
      "AniDachi is currently the only anime watch-party tool that fully supports asynchronous watching with per-user progress tracking and persistent chat. Other tools like Teleparty and Crunchyroll Party only support live synchronized watching.",
  },
  {
    question: "Is async watching better than live watching?",
    answer:
      "Neither is universally better. Async works well for groups with different schedules or time zones. Live watching is better for premieres and finales where simultaneous reactions are the point. AniDachi supports both in the same watchroom.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "how-it-works", label: "How it works", level: 2 },
  { id: "why-growing", label: "Why it is growing", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AsyncWatchingGlossaryPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["how-to-core", "time-zones", "long-distance", "spoilers"],
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Glossary", url: "/watch-anime-together" },
        { name: "Asynchronous Watching", url: "/glossary/asynchronous-watching" },
      ]}
      title="What Is Asynchronous Anime Watching?"
      description="How async anime watching works and why it's growing."
      url="/glossary/asynchronous-watching"
      datePublished="2026-04-23"
      dateModified="2026-04-24"
      faq={faq}
      headings={tocHeadings}
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        What Is Asynchronous Anime Watching?
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          Asynchronous anime watching means friends watch the same anime at
          their own pace — not at the same time — and share reactions, comments,
          and progress through a shared watchroom.
        </strong>{" "}
        It&apos;s like a book club for anime: everyone reads at their own speed,
        then discusses.
      </p>

      <h2
        id="how-it-works"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        How Async Watching Works
      </h2>
      <ol className="list-decimal pl-6 space-y-2 text-gray-700 mb-6">
        <li>Someone creates a watchroom for a specific anime.</li>
        <li>Everyone joins via invite link.</li>
        <li>Each person watches episodes whenever they have time.</li>
        <li>After watching, they mark the episode and leave reactions or comments.</li>
        <li>Friends see those reactions when they watch the same episode later.</li>
      </ol>

      <h2
        id="why-growing"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Why Async Is Growing
      </h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Coordinating schedules across time zones is the number-one pain point
        for anime watch groups. Async watching removes that friction entirely.
        It&apos;s especially popular for long-running series (One Piece, Naruto)
        where different people are at different points.
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-purple-600">
        <li><Link href="/glossary/watchroom" className="hover:underline">What Is a Watchroom?</Link></li>
        <li><Link href="/guides/asynchronous-vs-live-watch-party" className="hover:underline">Async vs Live Watch Parties</Link></li>
        <li><Link href="/watch-anime-together" className="hover:underline">Watch Anime Together Guide</Link></li>
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
