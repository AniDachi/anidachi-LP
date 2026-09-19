import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { PRICING_COMPARE_OVERVIEW } from "@/lib/pricing-copy";

export const metadata: Metadata = {
  title: "How to Watch Anime Long Distance — 2026",
  description:
    "The easiest way is AniDachi live watchrooms on Crunchyroll. Keep chat and progress aligned when you are far apart. Takes under 2 minutes.",
  alternates: { canonical: "/guides/how-to-watch-anime-long-distance" },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "How to Watch Anime Long Distance — 2026",
    description:
      "Stay close to your watch group across cities with synced live Crunchyroll watchrooms.",
    url: "/guides/how-to-watch-anime-long-distance",
  },
  twitter: {
    images: ["/opengraph-image.png"],
    card: "summary_large_image",
    title: "How to Watch Anime Long Distance — 2026",
    description:
      "AniDachi live watchrooms keep long-distance anime nights social at an agreed start time.",
  },
};

const faq = [
  {
    question: "Is screen sharing good enough for long-distance anime dates?",
    answer:
      "It works for casual viewing but depends on one person's upload speed and often reduces resolution. Per-user streaming with a sync or async watchroom usually looks sharper for everyone.",
  },
  {
    question: "How do we avoid spoilers when we are long distance and on different schedules?",
    answer:
      "Agree on episode boundaries in chat, mute notifications until you finish, and use a watchroom that tracks per-person progress so nobody posts ahead of where you are.",
  },
  {
    question: "Do long-distance watch groups need the same streaming region?",
    answer:
      "Catalog overlap matters. If a title is geo-locked differently, pick a show available in both regions or use a service both sides can access legally.",
  },
  {
    question: "What is the best app for long-distance couples watching anime?",
    answer:
      "AniDachi is the best app for long-distance couples watching anime together on Crunchyroll. Its live room syncs playback when you are online together. Async catch-up is planned; viewers can currently catch up independently and meet for the next live session.",
  },
  {
    question: "Can long-distance couples watch anime together for free?",
    answer:
      `Yes — for free, Discord screen share works over any distance. For full video quality without one person's stream limiting the other, Crunchyroll Party (free) or AniDachi (Free limited hosting; Plus for unlimited hosting) give everyone independent full-quality streams. ${PRICING_COMPARE_OVERVIEW} AniDachi Async catch-up is planned; current rooms are live.`,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "method-anidachi", label: "Method 1: AniDachi", level: 2 },
  { id: "method-discord", label: "Method 2: Discord", level: 2 },
  { id: "method-calendar", label: "Method 3: Calendar + live sync", level: 2 },
  { id: "steps-anidachi", label: "Step-by-step with AniDachi", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Pick a show",
    text: "Choose a series both sides can stream on Crunchyroll to avoid catalog mismatches.",
  },
  {
    name: "Install AniDachi",
    text: "Open /extension, download the official zip, then Load unpacked in Chrome on each participant's laptop.",
  },
  {
    name: "Create a shared watchroom",
    text: "Open the first episode, detect the anime in AniDachi, and create a room.",
  },
  {
    name: "Share the invite",
    text: "Send the watchroom link through text, email, or Discord DMs.",
  },
  {
    name: "Choose a shared start time",
    text: "Use live sync when you share a start time; if schedules differ, catch up independently before the next meeting.",
  },
  {
    name: "Chat episode by episode",
    text: "Use live chat during the session and agree on an episode boundary before discussing later events.",
  },
];

export default function HowToWatchAnimeLongDistancePage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch anime long distance with AniDachi"
        description="Set up a Crunchyroll watchroom that supports friends in different places with live sync and personal progress."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Anime Together", url: "/watch-anime-together" },
          {
            name: "How to Watch Anime Long Distance",
            url: "/guides/how-to-watch-anime-long-distance",
          },
        ]}
        title="How to Watch Anime Long Distance"
        description="Watch anime long distance with scheduled live watchrooms or Discord."
        url="/guides/how-to-watch-anime-long-distance"
        datePublished="2026-04-27"
        dateModified="2026-06-23"
        faq={faq}
        headings={tocHeadings}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to Watch Anime Long Distance
        </h1>

        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            Watching anime long distance is possible by streaming on each
            person&apos;s device with a shared chat layer, or by one-way screen
            share. AniDachi syncs playback when everyone is online together. For different schedules, catch up independently before the next live meeting.
          </strong>
        </p>

        <h2
          id="method-anidachi"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Method 1: AniDachi (live watchrooms)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Choose a shared start time and open the same episode in your own Crunchyroll tabs. AniDachi syncs playback and live chat in the room. Personal history on Plus or Pro saves each viewer&apos;s progress separately. Async catch-up with replayed reactions is planned, not available today.
        </p>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Point partners to official{" "}
          <a
            href="https://www.crunchyroll.com/help"
            className="text-brand-orange hover:underline"
            rel="noopener noreferrer"
          >
            Crunchyroll Help
          </a>{" "}
          articles if they need account or playback troubleshooting. Install
          AniDachi from{" "}
          <Link href="/extension" className="text-brand-orange hover:underline">
            the AniDachi install page
          </Link>{" "}
          so everyone loads the same official zip.
        </p>

        <h2
          id="method-discord"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Method 2: Discord (voice-first hangouts)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Discord keeps cross-country friend groups in one place. Combine a
          voice channel with either Go Live screen share or a synced extension
          everyone agrees on. Voice latency is low, but video still rides on one
          person&apos;s upload unless everyone streams locally.
        </p>

        <h2
          id="method-calendar"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Method 3: Shared calendar plus live sync
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Some long-distance clubs only want live premieres. Pick a weekly slot
          in Google Calendar, then use any Crunchyroll-capable sync extension for
          that window. This works when time zones still overlap for an hour, but
          it collapses if travel schedules change every week.
        </p>

        <h2
          id="steps-anidachi"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Step-by-step with AniDachi
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <strong>{step.name}.</strong> {step.text}
            </li>
          ))}
        </ol>

        <h2
          id="related"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Related guides
        </h2>
        <ul className="space-y-2 text-brand-orange">
          <li>
            <Link href="/" className="hover:underline">
              AniDachi home
            </Link>
          </li>
          <li>
            <Link href="/watch-crunchyroll-together" className="hover:underline">
              Watch Crunchyroll Together
            </Link>
          </li>
          <li>
            <Link
              href="/guides/how-to-watch-anime-with-friends-online"
              className="hover:underline"
            >
              How to Watch Anime With Friends Online
            </Link>
          </li>
          <li>
            <Link href="/guides/anime-watch-party-ideas" className="hover:underline">
              Anime Watch Party Ideas
            </Link>
          </li>
          <li>
            <Link
              href="/watch-crunchyroll-together-long-distance"
              className="hover:underline"
            >
              Watch Crunchyroll Together Long Distance
            </Link>
          </li>
          <li>
            <Link
              href="/timezone-friendly-anime-watch-parties"
              className="hover:underline"
            >
              Anime Watch Parties Across Time Zones — The Async Guide
            </Link>
          </li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
