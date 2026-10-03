import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";

export const metadata: Metadata = {
  title: "What Is a Watchroom? — Anime Watch Party Glossary (2026)",
  description:
    "A watchroom is a shared virtual space for watching together. Learn how AniDachi live rooms combine synchronized playback, chat, reactions, and calls.",
  alternates: { canonical: "/glossary/watchroom" },
};

const faq = [
  {
    question: "What is a watchroom?",
    answer:
      "A watchroom is a shared virtual room for watching together. In AniDachi, it synchronizes each person's video and provides live chat, reactions, and voice or video calls.",
  },
  {
    question: "How do I create a watchroom?",
    answer:
      "Install AniDachi in desktop Chrome and sign in. With Plus or Pro, including during a trial, open a Crunchyroll episode or full YouTube watch page and click 'Create room' in the extension. Share the invite with friends, who join for free with their own access to the video.",
  },
  {
    question: "Can a watchroom work asynchronously?",
    answer:
      "AniDachi watchrooms currently work live. Built-in async catch-up, shared group progress, and replayed reactions are coming soon. For now, friends who miss a session can watch independently and discuss it with the group afterward.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
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
      dateModified="2026-10-01"
      faq={faq}
      headings={tocHeadings}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        What Is a Watchroom?
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-8">
        <strong>
          A watchroom is a shared virtual space where friends watch the same
          video together with synced playback and live conversation.
        </strong>{" "}
        Everyone opens the video on their own account; AniDachi keeps the
        players in sync and adds chat, reactions, and calls.
      </p>

      <h2
        id="how-anidachi"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        How Watchrooms Work in AniDachi
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        A Plus, Pro or trial host creates the room from a Crunchyroll episode
        or full YouTube watch page. Friends join for free using the extension
        and their own access to the video. Personal history is separate:
        recording it requires each viewer&apos;s own Plus or Pro access and
        permission in the extension. Shared group progress and async catch-up
        are coming soon.
      </p>

      <h2
        id="vs-watch-party"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Watchroom vs Watch Party
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        A &quot;watch party&quot; typically implies everyone watching at the
        same time. A watchroom is the online space used for that session.
        AniDachi rooms are live; a persistent room with async discussion is
        not available today.
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange">
        <li><Link href="/glossary/asynchronous-watching" className="hover:underline">What Is Asynchronous Watching?</Link></li>
        <li><Link href="/watch-anime-together" className="hover:underline">Watch Anime Together Guide</Link></li>
        <li><Link href="/watch-crunchyroll-together" className="hover:underline">Watch Crunchyroll Together</Link></li>
      </ul>
    </SeoPageLayout>
  );
}
