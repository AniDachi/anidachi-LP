import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "How to Sync Crunchyroll With Friends — 2026",
  description:
    "Sync Crunchyroll playback with friends using AniDachi watchrooms — each person streams full quality on their own account. Setup takes under two minutes.",
  alternates: { canonical: "/guides/how-to-sync-crunchyroll-with-friends" },
  openGraph: {
    title: "How to Sync Crunchyroll With Friends — 2026",
    description:
      "Keep Crunchyroll episodes aligned across your group with synced watchrooms and chat.",
    url: "/guides/how-to-sync-crunchyroll-with-friends",
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Sync Crunchyroll With Friends — 2026",
    description: "Step-by-step Crunchyroll sync for anime watch parties.",
  },
};

const faq = [
  {
    question: "Can you sync Crunchyroll with friends without screen sharing?",
    answer:
      "Yes — AniDachi syncs playback timestamps while each person streams from their own Crunchyroll tab at full quality. No host upload bottleneck and no resolution cap from screen share.",
  },
  {
    question: "Does Crunchyroll have built-in sync with friends?",
    answer:
      "Crunchyroll Party is a separate Chrome extension for live sync. AniDachi adds sync plus async catch-up, episode-scoped chat, and per-person progress tracking for anime-focused groups.",
  },
  {
    question: "What if friends fall out of sync during a Crunchyroll session?",
    answer:
      "Pause and use AniDachi's resync controls to realign timestamps. If someone rewinds for a missed line, the room catches up before resuming. For members who miss entire sessions, async mode lets them catch up later.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "method-anidachi", label: "Method 1: AniDachi", level: 2 },
  { id: "method-party", label: "Method 2: Crunchyroll Party", level: 2 },
  { id: "method-discord", label: "Method 3: Discord screen share", level: 2 },
  { id: "steps", label: "Step-by-step sync setup", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Install AniDachi",
    text: "Add the Chrome extension on every device that will join the sync session.",
  },
  {
    name: "Open the same Crunchyroll episode",
    text: "Each person signs into their own Crunchyroll account and navigates to the same episode.",
  },
  {
    name: "Create a watchroom",
    text: "Use AniDachi to detect the anime and create a shared watchroom from the extension.",
  },
  {
    name: "Share the invite link",
    text: "Send the watchroom URL so friends join before anyone presses play.",
  },
  {
    name: "Start playback together",
    text: "The host starts the episode; AniDachi keeps everyone's timestamps aligned during pauses and seeks.",
  },
  {
    name: "Use chat for reactions",
    text: "Keep reactions in the watchroom thread so sync and discussion stay in one place.",
  },
];

export default function HowToSyncCrunchyrollWithFriendsPage() {
  return (
    <>
      <HowToJsonLd
        name="How to sync Crunchyroll with friends using AniDachi"
        description="Set up synced Crunchyroll playback for an anime watch party with per-user full-quality streams."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/watch-anime-together" },
          {
            name: "How to sync Crunchyroll with friends",
            url: "/guides/how-to-sync-crunchyroll-with-friends",
          },
        ]}
        title="How to Sync Crunchyroll With Friends"
        description="Sync Crunchyroll playback across your group with AniDachi watchrooms."
        url="/guides/how-to-sync-crunchyroll-with-friends"
        datePublished="2026-07-02"
        dateModified="2026-07-02"
        faq={faq}
        headings={tocHeadings}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to Sync Crunchyroll With Friends
        </h1>

        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            Syncing Crunchyroll with friends means keeping everyone on the same
            episode timestamp while each person streams independently. The
            easiest way is AniDachi because it aligns playback, adds chat, and
            supports async catch-up when live sync is not possible.
          </strong>
        </p>

        <h2 id="method-anidachi" className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24">
          Method 1: AniDachi (recommended)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          AniDachi&apos;s Chrome extension syncs Crunchyroll playback across
          watchroom members. Everyone watches in full quality on their own
          account — no screen sharing required. Async mode lets members who miss
          a session catch up without breaking spoiler boundaries.
        </p>

        <h2 id="method-party" className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24">
          Method 2: Crunchyroll Party
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Crunchyroll Party is a free Chrome extension for live sync on
          Crunchyroll. It works for same-time viewing but lacks async progress
          tracking and episode-scoped chat. See our{" "}
          <Link href="/compare/anidachi-vs-crunchyroll-party" className="text-brand-orange hover:underline">
            AniDachi vs Crunchyroll Party comparison
          </Link>.
        </p>

        <h2 id="method-discord" className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24">
          Method 3: Discord screen share
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          One person shares their Crunchyroll tab via Discord Go Live. Free and
          quick, but quality depends on upload speed and there is no automatic
          playback sync — viewers manually pause when the host pauses.
        </p>

        <h2 id="steps" className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24">
          Step-by-Step Sync Setup
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <span className="font-medium text-foreground">{step.name}.</span>{" "}
              {step.text}
            </li>
          ))}
        </ol>

        <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
          Related Guides
        </h2>
        <ul className="space-y-2 text-brand-orange mb-8">
          <li><Link href="/guides/how-to-watch-crunchyroll-with-friends" className="hover:underline">How to watch Crunchyroll with friends</Link></li>
          <li><Link href="/guides/how-to-watch-crunchyroll-on-two-screens" className="hover:underline">How to watch Crunchyroll on two screens</Link></li>
          <li><Link href="/anime-watch-party" className="hover:underline">Anime watch party guide</Link></li>
          <li><Link href="/watch-crunchyroll-together" className="hover:underline">Watch Crunchyroll together hub</Link></li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
