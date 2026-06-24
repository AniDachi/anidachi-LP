import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "How to Fix Anime Watch Party Audio Delay (2026)",
  description:
    "Troubleshoot lag between voice chat and Crunchyroll video: isolate Discord, switch from screen share to synced streams, and resync your group.",
  alternates: { canonical: "/guides/how-to-fix-watch-party-audio-delay" },
  openGraph: {
    title: "Fix Watch Party Audio Delay",
    description:
      "Step-by-step fixes when reactions arrive before the cliffhanger lands.",
    url: "/guides/how-to-fix-watch-party-audio-delay",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Fix Watch Party Audio Delay",
    description: "Discord, screen share, and per-user stream troubleshooting.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Why does Discord voice sound ahead of my Crunchyroll tab?",
    answer:
      "Screen-captured video often buffers more than ultralight voice packets. If one person is broadcasting video while others talk, voices feel early relative to the blurry stream they are watching.",
  },
  {
    question: "Does AniDachi remove audio delay automatically?",
    answer:
      "AniDachi keeps each viewer on their own Crunchyroll player with playback sync options, which sidesteps the upload bottleneck of one-way screen shares. You still need headsets and agreed resync rituals for perfect alignment.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "isolate", label: "Isolate the bottleneck", level: 2 },
  { id: "howto", label: "HowTo: recover together", level: 2 },
  { id: "upgrade", label: "Upgrade path", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Mute overlapping audio",
    text: "Turn off second audio sources (embedded stream sound, duplicate browser tabs) so you only hear Discord or one player output.",
  },
  {
    name: "Measure drift",
    text: "Count seconds between a visible on-screen cue and when the host hears cheers in voice chat to know if the problem is universal or one viewer.",
  },
  {
    name: "Restart the shared session",
    text: "Pause on a black frame, countdown, and press play together after everyone buffers—cheap resync for screen-share groups.",
  },
  {
    name: "Switch inputs",
    text: "Ask the broadcaster to share Crunchyroll as a window (not full desktop) and cap resolution to reduce encoder delay.",
  },
  {
    name: "Move to per-user streaming",
    text: "Install AniDachi, have each person open the same episode locally, and reuse voice chat only for reactions so video latency matches for everyone.",
  },
];

export default function HowToFixWatchPartyAudioDelayPage() {
  return (
    <>
      <HowToJsonLd
        name="Fix anime watch party audio delay"
        description="Diagnose Discord vs video lag and migrate to synced per-user Crunchyroll streams when screen share falls apart."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/watch-anime-together" },
          {
            name: "Fix watch party audio delay",
            url: "/guides/how-to-fix-watch-party-audio-delay",
          },
        ]}
        title="How to fix watch party audio delay"
        description="Troubleshooting guide for lag between voice chat and Crunchyroll playback."
        url="/guides/how-to-fix-watch-party-audio-delay"
        datePublished="2026-05-08"
        dateModified="2026-05-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to fix anime watch party audio delay
        </h1>
        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            Delay usually means one person is hauling video through an upload pipe
            while everyone else only sends voice. Separate the problem, resync
            manually, then graduate to per-player streaming when it keeps happening.
          </strong>
        </p>

        <h2
          id="isolate"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Isolate the bottleneck
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Confirm whether only the host sees early voice or if every participant
          hears the same mismatch. If it is host-only, blame screen-share encoding;
          if universal, check browser audio passthrough or Bluetooth headphones.
        </p>

        <h2
          id="howto"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          HowTo: recover with your crew
        </h2>
        <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
          {howToSteps.map((s) => (
            <li key={s.name}>
              <span className="font-medium text-foreground">{s.name}. </span>
              {s.text}
            </li>
          ))}
        </ol>

        <h2
          id="upgrade"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Upgrade path when lag returns every week
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Stable groups eventually move everyone to legal per-user playback plus a
          watchroom Extension. Pair this guide with{" "}
          <Link
            href="/compare/anidachi-vs-discord-screen-share"
            className="text-brand-orange hover:underline"
          >
            AniDachi vs Discord screen share
          </Link>{" "}
          and{" "}
          <Link href="/guides/how-to-watch-crunchyroll-with-friends" className="text-brand-orange hover:underline">
            how to watch Crunchyroll with friends
          </Link>
          .
        </p>
        <p className="text-foreground/80 leading-relaxed mb-8">
          When you land on per-user playback, grab{" "}
          <Link href="/#pricing" className="text-brand-orange font-medium hover:underline">
            current AniDachi pricing
          </Link>{" "}
          and spin up your first Crunchyroll watchroom directly from episode pages.
        </p>

        <h2
          id="related"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Related guides
        </h2>
        <ul className="space-y-2 text-brand-orange">
          <li>
            <Link href="/guides/how-to-watch-anime-with-friends-on-discord" className="hover:underline">
              How to watch anime with friends on Discord
            </Link>
          </li>
          <li>
            <Link href="/guides/first-anime-watch-party-checklist" className="hover:underline">
              First anime watch party checklist
            </Link>
          </li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
