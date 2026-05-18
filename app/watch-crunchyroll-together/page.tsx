import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";

export const metadata: Metadata = {
  title: "Watch Crunchyroll Together — Sync Anime with Friends in 2026",
  description:
    "Learn how to watch Crunchyroll together with friends using AniDachi. Create watchrooms, sync playback, and chat in real-time — even asynchronously. The complete guide.",
  alternates: { canonical: "/watch-crunchyroll-together" },
  openGraph: {
    title: "Watch Crunchyroll Together — Sync Anime with Friends",
    description:
      "The complete guide to watching Crunchyroll with friends. Watchrooms, sync, chat, and async watching.",
    url: "/watch-crunchyroll-together",
  },
};

const faq = [
  {
    question: "Can you watch Crunchyroll together with friends?",
    answer:
      "Yes! While Crunchyroll has no built-in watch party feature, tools like AniDachi let you create watchrooms, sync playback, and chat in real-time while watching any anime on Crunchyroll.",
  },
  {
    question: "Is there a free way to watch Crunchyroll together?",
    answer:
      "Free options include Discord screen sharing and the free Crunchyroll Party Chrome extension. AniDachi offers unique async-watching and progress tracking features starting at $8/month with a full refund guarantee.",
  },
  {
    question: "Do all my friends need Crunchyroll accounts?",
    answer:
      "Yes, each person needs their own Crunchyroll account to stream the anime. AniDachi provides the sync, watchroom, and chat layer on top of Crunchyroll.",
  },
  {
    question: "What is asynchronous anime watching?",
    answer:
      "Asynchronous watching means friends don't need to be online at the same time. Each person watches at their own pace, marks episodes as watched, and leaves reactions or comments for others to see later.",
  },
  {
    question: "Does Crunchyroll have a built-in watch party feature?",
    answer:
      "No. Crunchyroll does not offer a native watch-together or watch-party feature. You need a third-party tool like AniDachi, Teleparty, or Discord screen sharing.",
  },
  {
    question: "How is AniDachi different from Crunchyroll Party?",
    answer:
      "Crunchyroll Party only supports live, synchronized watching. AniDachi adds asynchronous group watching, auto anime detection, individual progress tracking, and persistent chat that friends can read later.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "no-native-watch-party", label: "Why no built-in watch party", level: 2 },
  { id: "step-by-step", label: "Step-by-step", level: 2 },
  { id: "compare-methods", label: "Compare methods", level: 2 },
  { id: "anidachi-difference", label: "What makes AniDachi different", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function WatchCrunchyrollTogetherPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-crunchyroll", "how-to-core", "time-zones"],
    limit: 7,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
      ]}
      title="Watch Crunchyroll Together — Sync Anime with Friends"
      description="The complete guide to watching Crunchyroll with friends using sync, chat, and async watchrooms."
      url="/watch-crunchyroll-together"
      datePublished="2026-04-23"
      dateModified="2026-04-24"
      faq={faq}
      headings={tocHeadings}
    >
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
        Watch Crunchyroll Together with Friends
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          You can watch Crunchyroll together with friends using AniDachi —
          a Chrome extension that syncs playback, creates watchrooms, and adds
          real-time chat on top of your existing Crunchyroll account.
        </strong>{" "}
        Unlike Discord screen sharing, everyone watches in full quality on their
        own account. Unlike Teleparty, you can watch asynchronously — no
        scheduling required.
      </p>

      <h2
        id="no-native-watch-party"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Why Crunchyroll Doesn&apos;t Have a Watch Party Feature
      </h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        As of 2026, Crunchyroll still has no built-in watch-together or
        watch-party feature — unlike Amazon Prime Video or Hulu. This means
        anime fans must rely on third-party tools to create shared viewing
        sessions. The most popular options are Chrome extensions like AniDachi
        and Crunchyroll Party, or screen sharing via Discord.
      </p>

      <h2
        id="step-by-step"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        How to Watch Crunchyroll Together (Step by Step)
      </h2>
      <ol className="space-y-4 text-gray-700 mb-8">
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-sm font-bold flex items-center justify-center">1</span>
          <span><strong>Install the AniDachi Chrome extension</strong> from the Chrome Web Store. It takes seconds.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-sm font-bold flex items-center justify-center">2</span>
          <span><strong>Navigate to any anime on Crunchyroll</strong> and click &quot;Detect Anime.&quot; AniDachi identifies the show and episode.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-sm font-bold flex items-center justify-center">3</span>
          <span><strong>Create a watchroom</strong> with one click and share the invite link with friends.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-sm font-bold flex items-center justify-center">4</span>
          <span><strong>Watch together</strong> — playback stays synced. Chat, react, and discuss in real-time.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-sm font-bold flex items-center justify-center">5</span>
          <span><strong>Or watch asynchronously</strong> — mark episodes as watched and leave reactions for friends to see later.</span>
        </li>
      </ol>

      <h2
        id="compare-methods"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Best Ways to Watch Crunchyroll with Friends
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        Here are the most popular methods for watching Crunchyroll anime
        together, ranked by feature richness:
      </p>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm border-collapse border border-gray-200 rounded-lg">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-4 py-2 text-left">Method</th>
              <th className="border border-gray-200 px-4 py-2 text-left">Sync</th>
              <th className="border border-gray-200 px-4 py-2 text-left">Async</th>
              <th className="border border-gray-200 px-4 py-2 text-left">Chat</th>
              <th className="border border-gray-200 px-4 py-2 text-left">Free</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 px-4 py-2 font-medium">AniDachi</td>
              <td className="border border-gray-200 px-4 py-2">Yes</td>
              <td className="border border-gray-200 px-4 py-2">Yes</td>
              <td className="border border-gray-200 px-4 py-2">Yes</td>
              <td className="border border-gray-200 px-4 py-2">$8/mo</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-200 px-4 py-2 font-medium">Crunchyroll Party</td>
              <td className="border border-gray-200 px-4 py-2">Yes</td>
              <td className="border border-gray-200 px-4 py-2">No</td>
              <td className="border border-gray-200 px-4 py-2">Yes</td>
              <td className="border border-gray-200 px-4 py-2">Free</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2 font-medium">Teleparty</td>
              <td className="border border-gray-200 px-4 py-2">Yes</td>
              <td className="border border-gray-200 px-4 py-2">No</td>
              <td className="border border-gray-200 px-4 py-2">Yes</td>
              <td className="border border-gray-200 px-4 py-2">Freemium</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-200 px-4 py-2 font-medium">Discord</td>
              <td className="border border-gray-200 px-4 py-2">Manual</td>
              <td className="border border-gray-200 px-4 py-2">No</td>
              <td className="border border-gray-200 px-4 py-2">Voice/Text</td>
              <td className="border border-gray-200 px-4 py-2">Free</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2
        id="anidachi-difference"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        What Makes AniDachi Different
      </h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        AniDachi is the only Crunchyroll watch-party tool designed for
        <strong> asynchronous watching</strong>. Friends don&apos;t need to be
        online at the same time. Each person watches at their own pace, marks
        episodes, and leaves time-stamped reactions. This solves the biggest
        problem with live watch parties: scheduling across time zones and busy
        lives.
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Related Guides
      </h2>
      <ul className="space-y-2 text-purple-600">
        {relatedGuideLinks.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href} className="hover:underline">
              {guide.label}
            </Link>
          </li>
        ))}
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
            AniDachi vs Teleparty: Which Is Better?
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-watch2gether" className="hover:underline">
            AniDachi vs Watch2Gether
          </Link>
        </li>
        <li>
          <Link href="/guides/asynchronous-vs-live-watch-party" className="hover:underline">
            Asynchronous vs Live Watch Parties: Which Is Right for You?
          </Link>
        </li>
        <li>
          <Link href="/watch-anime-together#genre-hubs" className="hover:underline">
            Browse anime by genre (action, romance, comedy, sports, mystery)
          </Link>
        </li>
        <li>
          <Link href="/guides/best-isekai-anime-to-watch-with-friends" className="hover:underline">
            Best isekai anime to watch with friends
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}
