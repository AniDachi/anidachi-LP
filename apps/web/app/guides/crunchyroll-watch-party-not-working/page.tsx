import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Crunchyroll Watch Party Not Working? Fixes (2026)",
  description:
    "Fix Crunchyroll watch party sync issues: extension not detecting, playback drift, region mismatch, and when to switch to AniDachi watchrooms.",
  alternates: { canonical: "/guides/crunchyroll-watch-party-not-working" },
  openGraph: {
    title: "Crunchyroll Watch Party Not Working — Troubleshooting",
    description:
      "Step-by-step fixes when your watch party extension won't sync, detect Crunchyroll, or keep everyone on the same timestamp.",
    url: "/guides/crunchyroll-watch-party-not-working",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crunchyroll Watch Party Not Working?",
    description: "Sync, detection, and region troubleshooting for anime watch parties.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Why is my Crunchyroll watch party not syncing?",
    answer:
      "The most common causes are: one member on a different episode, browser extension conflicts, Crunchyroll tab not in focus, or network lag causing playback drift. Have everyone confirm the same series and episode number first, then restart the watch party session from a shared pause point.",
  },
  {
    question: "Why won't the watch party extension detect Crunchyroll?",
    answer:
      "Check that you're on crunchyroll.com (not a regional mirror), the extension is enabled for the site, and no ad blockers are interfering with the player. Hard-refresh the Crunchyroll tab and re-open the extension popup. If detection still fails, try a clean Chrome profile without other streaming extensions.",
  },
  {
    question: "Does Crunchyroll have a built-in watch party?",
    answer:
      "Crunchyroll does not offer a native watch party feature. Groups rely on third-party Chrome extensions (Teleparty, Crunchyroll Party, AniDachi, etc.) or screen sharing. Each tool has different sync reliability and feature sets.",
  },
  {
    question: "When should I switch from a free extension to AniDachi?",
    answer:
      "Switch when sync keeps breaking across sessions, your group spans time zones and needs async catch-up, or you want per-person progress tracking and episode-scoped spoiler controls. AniDachi is built specifically for Crunchyroll anime groups with mixed schedules.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "symptoms", label: "Common symptoms", level: 2 },
  { id: "howto", label: "HowTo: fix sync issues", level: 2 },
  { id: "detection", label: "Extension not detecting Crunchyroll", level: 2 },
  { id: "upgrade", label: "When to upgrade your setup", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Confirm everyone is on the same episode",
    text: "Before debugging sync, verify every member is watching the same series and episode number on Crunchyroll. Season selectors and auto-play can silently put people on different episodes.",
  },
  {
    name: "Pause and resync manually",
    text: "Pause on a black frame or title card, countdown from three, and press play together. This cheap resync fixes most minor drift without restarting the session.",
  },
  {
    name: "Disable conflicting extensions",
    text: "Turn off other streaming or ad-blocking extensions temporarily. Multiple watch-party extensions fighting for player control is a common cause of sync failure.",
  },
  {
    name: "Hard-refresh Crunchyroll",
    text: "Close the Crunchyroll tab, clear cache if needed, and reopen the episode. Rejoin the watch party from scratch rather than trying to recover a broken session.",
  },
  {
    name: "Switch to per-user streaming",
    text: "If sync keeps breaking, install AniDachi so each person streams from their own Crunchyroll player with a shared watchroom layer — no single host bottleneck.",
  },
];

export default function CrunchyrollWatchPartyNotWorkingPage() {
  return (
    <>
      <HowToJsonLd
        name="Fix Crunchyroll watch party not working"
        description="Troubleshoot sync drift, extension detection failures, and migrate to reliable per-user Crunchyroll watchrooms."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/watch-anime-together" },
          {
            name: "Crunchyroll watch party not working",
            url: "/guides/crunchyroll-watch-party-not-working",
          },
        ]}
        title="Crunchyroll watch party not working — troubleshooting"
        description="Fix sync, detection, and region issues with Crunchyroll watch party extensions."
        url="/guides/crunchyroll-watch-party-not-working"
        datePublished="2026-06-08"
        dateModified="2026-06-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Crunchyroll watch party not working? Here&apos;s how to fix it
        </h1>
        <p className="text-xl text-gray-700 leading-relaxed mb-8">
          <strong>
            When your watch party won&apos;t sync, won&apos;t detect Crunchyroll,
            or keeps drifting mid-episode, the fix is usually simpler than
            switching tools — confirm the episode, resync manually, and eliminate
            extension conflicts. If problems persist every session, it&apos;s
            time to upgrade your setup.
          </strong>
        </p>

        <h2
          id="symptoms"
          className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
        >
          Common symptoms
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-8">
          <li>
            <strong>Playback drift</strong> — reactions arrive before the
            cliffhanger lands on someone&apos;s screen.
          </li>
          <li>
            <strong>Extension won&apos;t detect Crunchyroll</strong> — the popup
            shows &quot;no video found&quot; even with an episode playing.
          </li>
          <li>
            <strong>Host-only sync</strong> — only the person who started the
            party controls playback; others can&apos;t pause without breaking sync.
          </li>
          <li>
            <strong>Region mismatch</strong> — some members can&apos;t access the
            same series, so sync fails silently.
          </li>
          <li>
            <strong>Session drops mid-episode</strong> — the party disconnects
            when someone refreshes or switches tabs.
          </li>
        </ul>

        <h2
          id="howto"
          className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
        >
          HowTo: fix sync issues
        </h2>
        <ol className="list-decimal pl-6 space-y-3 text-gray-700 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <span className="font-medium text-gray-900">{step.name}.</span>{" "}
              {step.text}
            </li>
          ))}
        </ol>

        <h2
          id="detection"
          className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
        >
          Extension not detecting Crunchyroll
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Detection failures usually come from browser environment issues, not
          Crunchyroll itself:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-8">
          <li>
            Make sure you&apos;re on{" "}
            <strong>crunchyroll.com/watch/</strong> with the video player visible
            — not the browse or home page.
          </li>
          <li>
            Disable ad blockers and privacy extensions on Crunchyroll temporarily.
          </li>
          <li>
            Update Chrome and the extension to the latest version.
          </li>
          <li>
            If you run multiple watch-party extensions, disable all but one —
            they compete for player hooks.
          </li>
        </ul>

        <h2
          id="upgrade"
          className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
        >
          When to upgrade your setup
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Free extensions work for occasional live sync, but recurring groups hit
          limits fast. Consider AniDachi when:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-8">
          <li>Sync breaks every session and manual resync becomes routine.</li>
          <li>Your group spans time zones and needs async catch-up.</li>
          <li>You want per-person progress tracking on long series.</li>
          <li>Spoiler leaks from early watchers ruin the group experience.</li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-8">
          Compare options:{" "}
          <Link href="/compare/anidachi-vs-teleparty" className="text-purple-600 hover:underline">
            AniDachi vs Teleparty
          </Link>
          {" · "}
          <Link href="/compare/anidachi-vs-crunchyroll-party" className="text-purple-600 hover:underline">
            AniDachi vs Crunchyroll Party
          </Link>
          {" · "}
          <Link href="/compare/crunchyroll-party-vs-teleparty-for-anime" className="text-purple-600 hover:underline">
            Crunchyroll Party vs Teleparty
          </Link>
        </p>

        <h2
          id="related"
          className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
        >
          Related guides
        </h2>
        <ul className="space-y-2 text-purple-600 mb-8">
          <li>
            <Link href="/guides/how-to-fix-watch-party-audio-delay" className="hover:underline">
              How to fix watch party audio delay
            </Link>
          </li>
          <li>
            <Link href="/guides/crunchyroll-watch-party-chrome-extension" className="hover:underline">
              Best Crunchyroll watch party Chrome extensions
            </Link>
          </li>
          <li>
            <Link href="/watch-crunchyroll-together" className="hover:underline">
              Watch Crunchyroll together — complete guide
            </Link>
          </li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
