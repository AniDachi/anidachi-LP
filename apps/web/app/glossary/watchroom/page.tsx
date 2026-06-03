import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";

export const metadata: Metadata = {
  title: "What Is a Watchroom? — Anime Watch Party Glossary",
  description:
    "A watchroom is a shared virtual space where friends watch the same anime together, either in real-time or asynchronously. Learn how watchrooms work in AniDachi.",
  alternates: { canonical: "/glossary/watchroom" },
};

const faq = [
  {
    question: "What is a watchroom?",
    answer:
      "A watchroom is a shared virtual room where a group of friends watches the same anime together. It tracks which episodes each person has watched, syncs playback for live viewing, and provides a chat space for reactions and discussions.",
  },
  {
    question: "How do I create a watchroom?",
    answer:
      "In AniDachi, navigate to any anime on Crunchyroll, click 'Detect Anime' in the extension, then click 'Create Watchroom.' Share the generated invite link with friends.",
  },
  {
    question: "Can a watchroom work asynchronously?",
    answer:
      "Yes. AniDachi watchrooms support both live sync and async watching. Each person watches at their own pace, marks episodes, and sees friends' reactions when they catch up.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "how-anidachi", label: "How it works in AniDachi", level: 2 },
  { id: "vs-watch-party", label: "Watchroom vs watch party", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function WatchroomGlossaryPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Glossary", url: "/watch-anime-together" },
        { name: "Watchroom", url: "/glossary/watchroom" },
      ]}
      title="What Is a Watchroom?"
      description="Definition and explanation of anime watchrooms."
      url="/glossary/watchroom"
      datePublished="2026-04-23"
      dateModified="2026-04-24"
      faq={faq}
      headings={tocHeadings}
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        What Is a Watchroom?
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          A watchroom is a shared virtual space where friends watch the same
          anime together — either at the same time with synced playback, or
          asynchronously at their own pace.
        </strong>{" "}
        Think of it as a group chat that also tracks what everyone has watched
        and lets you leave reactions on specific episodes.
      </p>

      <h2
        id="how-anidachi"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        How Watchrooms Work in AniDachi
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        When you create a watchroom in AniDachi, it&apos;s linked to a specific
        anime series. The watchroom tracks each member&apos;s progress,
        provides episode-level chat and reactions, and optionally syncs
        playback for live viewing sessions. Everyone sees the same episode list
        and can mark episodes as watched independently.
      </p>

      <h2
        id="vs-watch-party"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Watchroom vs Watch Party
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        A &quot;watch party&quot; typically implies everyone watching at the
        same time. A watchroom is more flexible — it persists over days or weeks
        and supports both synchronous and asynchronous watching. It&apos;s
        designed for ongoing series, not just one-off sessions.
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-purple-600">
        <li><Link href="/glossary/asynchronous-watching" className="hover:underline">What Is Asynchronous Watching?</Link></li>
        <li><Link href="/watch-anime-together" className="hover:underline">Watch Anime Together Guide</Link></li>
        <li><Link href="/watch-crunchyroll-together" className="hover:underline">Watch Crunchyroll Together</Link></li>
      </ul>
    </SeoPageLayout>
  );
}
