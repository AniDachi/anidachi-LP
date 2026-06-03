import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";

export const metadata: Metadata = {
  title: "How to Watch Crunchyroll with Friends (2026 Guide)",
  description:
    "Step-by-step guide to watching Crunchyroll with friends online. Learn about Chrome extensions, Discord, and async watchrooms to enjoy anime together.",
  alternates: { canonical: "/guides/how-to-watch-crunchyroll-with-friends" },
  openGraph: {
    title: "How to Watch Crunchyroll with Friends (2026 Guide)",
    description: "Every method to watch Crunchyroll together, compared and explained.",
    url: "/guides/how-to-watch-crunchyroll-with-friends",
  },
};

const faq = [
  {
    question: "Can two people watch Crunchyroll at the same time?",
    answer:
      "Yes, but each person needs their own Crunchyroll account. Free accounts are limited, while Mega Fan and Ultimate Fan plans support multiple simultaneous streams. Watch party tools like AniDachi work on top of individual accounts.",
  },
  {
    question: "What is the best free way to watch Crunchyroll together?",
    answer:
      "The easiest free option is Discord screen sharing (Go Live). It requires only one Crunchyroll account but the viewer quality is lower. For better quality, the free Crunchyroll Party Chrome extension syncs each person's own stream.",
  },
  {
    question: "How do I set up a Crunchyroll watch party on Discord?",
    answer:
      "Join a voice channel, start streaming your browser window with Crunchyroll open, and your friends watch via screen share. Quality may be limited and there's no automatic sync — if someone pauses, you'll need to coordinate manually.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "method-anidachi", label: "Method 1: AniDachi", level: 2 },
  { id: "method-discord", label: "Method 2: Discord", level: 2 },
  { id: "method-cr-party", label: "Method 3: Crunchyroll Party", level: 2 },
  { id: "which-method", label: "Which method to choose", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToWatchWithFriendsPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["how-to-core", "online", "time-zones"],
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Guides", url: "/watch-anime-together" },
        { name: "How to Watch Crunchyroll with Friends", url: "/guides/how-to-watch-crunchyroll-with-friends" },
      ]}
      title="How to Watch Crunchyroll with Friends"
      description="Every method to watch Crunchyroll together, compared and explained."
      url="/guides/how-to-watch-crunchyroll-with-friends"
      datePublished="2026-04-23"
      dateModified="2026-04-24"
      faq={faq}
      headings={tocHeadings}
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        How to Watch Crunchyroll with Friends in 2026
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          The best way to watch Crunchyroll with friends is using a Chrome
          extension like AniDachi that syncs playback and adds real-time chat.
        </strong>{" "}
        Since Crunchyroll has no built-in watch party feature, you need a
        third-party tool. This guide covers every option — from free Discord
        screen sharing to premium async watchrooms.
      </p>

      <h2
        id="method-anidachi"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Method 1: AniDachi Chrome Extension (Best for Groups)
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        AniDachi offers the most feature-rich experience for watching
        Crunchyroll together. It auto-detects anime, creates watchrooms with
        one click, and uniquely supports async watching — friends don&apos;t
        need to be online at the same time.
      </p>
      <ol className="list-decimal pl-6 space-y-2 text-gray-700 mb-6">
        <li>Install the AniDachi extension from the Chrome Web Store.</li>
        <li>Navigate to any anime episode on Crunchyroll.</li>
        <li>Click &quot;Detect Anime&quot; — AniDachi identifies the show automatically.</li>
        <li>Create a watchroom and share the invite link.</li>
        <li>Watch together with synced playback and live chat.</li>
      </ol>

      <h2
        id="method-discord"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Method 2: Discord Screen Sharing (Free, Quick)
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        Discord&apos;s Go Live feature lets you share your Crunchyroll browser
        tab with friends in a voice channel. It&apos;s free and fast, but
        quality is limited (often 720p) and there&apos;s no automatic playback
        sync. Best for informal viewing with friends already on a Discord
        server.
      </p>

      <h2
        id="method-cr-party"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Method 3: Crunchyroll Party Extension (Free, Live Sync)
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        Crunchyroll Party is a free Chrome extension that syncs playback across
        multiple browsers. Each person watches on their own Crunchyroll account
        in full quality. It includes basic text chat but lacks async features,
        progress tracking, or auto-detection.
      </p>

      <h2
        id="which-method"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Which Method Should You Choose?
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-8">
        <li><strong>For async groups across time zones:</strong> AniDachi</li>
        <li><strong>For free one-off sessions:</strong> Discord screen sharing</li>
        <li><strong>For free live sync:</strong> Crunchyroll Party</li>
      </ul>

      <h2
        id="related"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Related Guides
      </h2>
      <ul className="space-y-2 text-purple-600">
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll Together (Pillar Guide)
          </Link>
        </li>
        <li>
          <Link href="/guides/crunchyroll-watch-party-chrome-extension" className="hover:underline">
            Best Crunchyroll Watch Party Chrome Extensions
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
          </Link>
        </li>
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
