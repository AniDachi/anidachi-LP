import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { PRICING_CRUNCHYROLL_GUIDE_PAID_MENTION, PRICING_GROUP_ONBOARDING } from "@/lib/pricing-copy";

export const metadata: Metadata = {
  title: "How to Watch Crunchyroll with Friends — Crunchyroll Watch Party Guide (2026)",
  description:
    "Step-by-step guide to watching Crunchyroll with friends in 2026. Does Crunchyroll have a watch party feature? Can you group watch on Crunchyroll? Every method — Chrome extensions, Discord screen share, and async watchrooms — compared and explained.",
  alternates: { canonical: "/guides/how-to-watch-crunchyroll-with-friends" },
  openGraph: {
    title: "How to Watch Crunchyroll with Friends — Watch Party Guide (2026)",
    description: "Does Crunchyroll have a watch party? No — but here's how to do it anyway. Every method compared.",
    url: "/guides/how-to-watch-crunchyroll-with-friends",
  },
};

const faq = [
  {
    question: "Does Crunchyroll have a watch party feature in 2026?",
    answer:
      "No. As of 2026, Crunchyroll still does not have a built-in watch party or group watch feature. You need to use a third-party tool — Chrome extensions like AniDachi or Crunchyroll Party, or Discord screen sharing. This guide covers all three options step by step.",
  },
  {
    question: "How do I watch Crunchyroll with friends online?",
    answer:
      "Install the AniDachi Chrome extension, open any anime on Crunchyroll, click Detect Anime, and create a watchroom. Share the invite link. Each friend joins with their own Crunchyroll account and playback stays in sync automatically. Alternatively, use the free Crunchyroll Party extension for a live-sync-only option.",
  },
  {
    question: "Does Crunchyroll have a group watch or watch together option?",
    answer:
      `Crunchyroll does not have a native group watch or watch together feature. Third-party Chrome extensions fill this gap: ${PRICING_CRUNCHYROLL_GUIDE_PAID_MENTION}, Crunchyroll Party (sync + basic chat, free), and Teleparty (cross-platform sync, freemium). All of them work with each person's own Crunchyroll account.`,
  },
  {
    question: "Can you do a watch party on Crunchyroll?",
    answer:
      "Yes, but only through a third-party extension. Install Crunchyroll Party (free) or AniDachi (Free to join; Plus/Pro to host) and you can host a Crunchyroll watch party with synced playback and chat. Crunchyroll itself does not have a watch party button or built-in feature.",
  },
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
  {
    question: "How do I watch anime with friends on Crunchyroll?",
    answer:
      "Since Crunchyroll has no native watch-together feature, install a Chrome extension: AniDachi for the best experience (sync, chat, and async watching), or Crunchyroll Party for a free live-sync option. Each person needs their own Crunchyroll account — free or paid — to stream the video.",
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
      dateModified="2026-06-08"
      faq={faq}
      headings={tocHeadings}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        How to Watch Crunchyroll with Friends — Crunchyroll Watch Party Guide (2026)
      </h1>

      <p className="text-xl text-foreground/80 leading-relaxed mb-8">
        <strong>
          Crunchyroll does not have a built-in watch party feature in 2026 —
          but you can easily create a Crunchyroll watch party using a Chrome
          extension like AniDachi or Crunchyroll Party.
        </strong>{" "}
        Each method syncs playback so everyone watches the same frame in full
        quality on their own account. This guide covers every option — from free
        Discord screen sharing to premium async watchrooms — and explains which
        to choose for your group.
      </p>

      <h2
        id="method-anidachi"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        Method 1: AniDachi Chrome Extension (Best for Groups)
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        AniDachi offers the most feature-rich experience for watching
        Crunchyroll together. It auto-detects anime, creates watchrooms with
        one click, and uniquely supports async watching — friends don&apos;t
        need to be online at the same time.
      </p>
      <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-6">
        <li>Install the AniDachi extension from the Chrome Web Store.</li>
        <li>Navigate to any anime episode on Crunchyroll.</li>
        <li>Click &quot;Detect Anime&quot; — AniDachi identifies the show automatically.</li>
        <li>Create a watchroom and share the invite link.</li>
        <li>Watch together with synced playback and live chat.</li>
      </ol>

      <h2
        id="method-discord"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        Method 2: Discord Screen Sharing (Free, Quick)
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Discord&apos;s Go Live feature lets you share your Crunchyroll browser
        tab with friends in a voice channel. It&apos;s free and fast, but
        quality is limited (often 720p) and there&apos;s no automatic playback
        sync. Best for informal viewing with friends already on a Discord
        server.
      </p>

      <h2
        id="method-cr-party"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        Method 3: Crunchyroll Party Extension (Free, Live Sync)
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Crunchyroll Party is a free Chrome extension that syncs playback across
        multiple browsers. Each person watches on their own Crunchyroll account
        in full quality. It includes basic text chat but lacks async features,
        progress tracking, or auto-detection.
      </p>

      <h2
        id="which-method"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        Which Method Should You Choose?
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li><strong>For async groups across time zones:</strong> AniDachi</li>
        <li><strong>For free one-off sessions:</strong> Discord screen sharing</li>
        <li><strong>For free live sync:</strong> Crunchyroll Party</li>
      </ul>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
      >
        Related Guides
      </h2>
      <ul className="space-y-2 text-brand-orange">
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
