import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";

export const metadata: Metadata = {
  title: "What Is Asynchronous Anime Watching? — Glossary (2026)",
  description:
    "Asynchronous anime watching means friends watch the same show on their own schedules and discuss it later. Learn the routine and what AniDachi supports today.",
  alternates: { canonical: "/glossary/asynchronous-watching" },
};

const faq = [
  {
    question: "What does asynchronous watching mean?",
    answer:
      "Asynchronous watching means each person watches episodes on their own schedule, then discusses them with the group. You can organize it with an agreed episode target and a separate chat; it does not require a live watchroom.",
  },
  {
    question: "Which apps support asynchronous anime watching?",
    answer:
      "You can arrange asynchronous watching with a group chat and an agreed episode target. AniDachi currently supports live rooms and personal history for viewers with their own Plus or Pro access and recording permission. Built-in async catch-up, shared group progress, and replayed reactions are coming soon.",
  },
  {
    question: "Is async watching better than live watching?",
    answer:
      "Neither is universally better. Async works well for different schedules or time zones. Live watching suits premieres and finales where simultaneous reactions are the point. AniDachi rooms currently support live watching; built-in async catch-up is planned.",
  },
  {
    question: "Can long-distance couples use asynchronous watching?",
    answer:
      "Yes. Agree on an episode, watch when each person is free, then discuss it in a separate chat after both have finished. AniDachi does not yet replay a partner's reactions during later viewing.",
  },
  {
    question: "Does asynchronous watching spoil plot twists for slower watchers?",
    answer:
      "It can if people discuss episodes before others finish. Agree on a spoiler boundary and label episode discussions clearly in your separate chat. AniDachi live chat does not automatically hide comments based on each person's progress.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
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
      dateModified="2026-10-01"
      faq={faq}
      headings={tocHeadings}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        What Is Asynchronous Anime Watching?
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-8">
        <strong>
          Asynchronous anime watching means friends watch the same anime at
          their own pace — not at the same time — and share reactions, comments,
          and progress afterward in a group conversation.
        </strong>{" "}
        It&apos;s like a book club for anime: everyone reads at their own speed,
        then discusses. AniDachi supports live rooms today; built-in async
        catch-up is coming soon.
      </p>

      <h2
        id="how-it-works"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        How Async Watching Works
      </h2>
      <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-6">
        <li>Choose an anime and agree on an episode target.</li>
        <li>Pick a separate group chat for discussion.</li>
        <li>Each person watches episodes whenever they have time.</li>
        <li>Tell the group when you have finished the agreed episodes.</li>
        <li>Discuss them after everyone has caught up, keeping later spoilers out.</li>
      </ol>

      <h2
        id="why-growing"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Why Async Is Growing
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-6">
        Coordinating schedules across time zones is the number-one pain point
        for anime watch groups. Async watching removes that friction entirely.
        It&apos;s especially popular for long-running series (One Piece, Naruto)
        where different people are at different points.
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange">
        <li><Link href="/glossary/watchroom" className="hover:underline">What Is a Watchroom?</Link></li>
        <li><Link href="/guides/asynchronous-vs-live-watch-party" className="hover:underline">Async vs Live Watch Parties</Link></li>
        <li><Link href="/timezone-friendly-anime-watch-parties" className="hover:underline">Timezone-Friendly Anime Watch Parties for Long-Distance Couples</Link></li>
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
