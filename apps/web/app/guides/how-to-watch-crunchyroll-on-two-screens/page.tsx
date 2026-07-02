import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "How to Watch Crunchyroll on Two Screens — 2026",
  description:
    "Watch Crunchyroll on two screens with synced playback — AniDachi keeps laptops and TVs aligned, or use casting with a sync extension for group sessions.",
  alternates: { canonical: "/guides/how-to-watch-crunchyroll-on-two-screens" },
  openGraph: {
    title: "How to Watch Crunchyroll on Two Screens — 2026",
    description:
      "Sync Crunchyroll across two devices or two viewers with watchroom tools.",
    url: "/guides/how-to-watch-crunchyroll-on-two-screens",
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Watch Crunchyroll on Two Screens — 2026",
    description: "Keep Crunchyroll aligned when watching on multiple screens.",
  },
};

const faq = [
  {
    question: "Can two people watch Crunchyroll on different screens in sync?",
    answer:
      "Yes — each person opens Crunchyroll on their own device (laptop, tablet, or TV browser) and joins the same AniDachi watchroom. Playback timestamps stay aligned without one person screen-sharing to the other.",
  },
  {
    question: "How do you watch Crunchyroll on a TV and laptop at the same time?",
    answer:
      "Cast Crunchyroll to your TV from a phone or use the TV browser app, then join an AniDachi watchroom from a laptop. Both devices stream from the same account or separate accounts in the same room — the watchroom keeps timestamps matched if friends are watching remotely on two screens.",
  },
  {
    question: "Why does Crunchyroll drift out of sync on two screens?",
    answer:
      "Manual play/pause on one screen without a sync tool causes drift. AniDachi propagates pause and seek events to every connected device in the watchroom so two-screen setups stay aligned.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "method-anidachi", label: "Method 1: AniDachi watchroom", level: 2 },
  { id: "method-cast", label: "Method 2: Cast plus sync", level: 2 },
  { id: "method-same-room", label: "Method 3: Same room, two screens", level: 2 },
  { id: "steps", label: "Step-by-step setup", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Confirm catalog access",
    text: "Make sure both screens can play the same Crunchyroll episode — check region and subscription tier.",
  },
  {
    name: "Install AniDachi on the host device",
    text: "Add the Chrome extension on the device that will create the watchroom.",
  },
  {
    name: "Open Crunchyroll on each screen",
    text: "Navigate both devices to the same episode before starting playback.",
  },
  {
    name: "Create and share the watchroom",
    text: "Generate an invite link and open it on the second screen's browser if a friend is remote.",
  },
  {
    name: "Start from the host",
    text: "Let the watchroom host press play first so sync anchors to one timeline.",
  },
  {
    name: "Pause from any connected device",
    text: "Use AniDachi sync so bathroom breaks pause both screens simultaneously.",
  },
];

export default function HowToWatchCrunchyrollOnTwoScreensPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch Crunchyroll on two screens with AniDachi"
        description="Keep Crunchyroll playback aligned when watching on multiple devices or with a remote friend on a second screen."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/watch-anime-together" },
          {
            name: "How to watch Crunchyroll on two screens",
            url: "/guides/how-to-watch-crunchyroll-on-two-screens",
          },
        ]}
        title="How to Watch Crunchyroll on Two Screens"
        description="Sync Crunchyroll across two devices with AniDachi watchrooms."
        url="/guides/how-to-watch-crunchyroll-on-two-screens"
        datePublished="2026-07-02"
        dateModified="2026-07-02"
        faq={faq}
        headings={tocHeadings}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to Watch Crunchyroll on Two Screens
        </h1>

        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            Watching Crunchyroll on two screens is possible by casting to a TV
            while controlling sync from a laptop, or by joining the same
            AniDachi watchroom from two devices. The easiest way for remote
            friends is AniDachi because playback stays aligned without screen
            sharing.
          </strong>
        </p>

        <h2 id="method-anidachi" className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24">
          Method 1: AniDachi Watchroom (remote two-screen sync)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Each person opens Crunchyroll on their own screen and joins one
          watchroom. Timestamps stay matched — one viewer on a laptop, another on
          a TV browser, both paused when someone hits pause in the extension.
        </p>

        <h2 id="method-cast" className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24">
          Method 2: Cast Plus Sync Extension
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Cast Crunchyroll from a phone to Chromecast or AirPlay while a laptop
          runs AniDachi for remote friends. Local casting handles the big screen;
          the watchroom handles friends who are not in the room.
        </p>

        <h2 id="method-same-room" className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24">
          Method 3: Same Room, Two Screens
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Couples or roommates sometimes want individual headphones on two
          laptops while watching the same episode. Join one watchroom from both
          devices — reactions stay in chat without fighting over one audio output.
        </p>

        <h2 id="steps" className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24">
          Step-by-Step Setup
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
          <li><Link href="/guides/how-to-sync-crunchyroll-with-friends" className="hover:underline">How to sync Crunchyroll with friends</Link></li>
          <li><Link href="/guides/how-to-watch-crunchyroll-with-friends" className="hover:underline">How to watch Crunchyroll with friends</Link></li>
          <li><Link href="/guides/how-to-fix-watch-party-audio-delay" className="hover:underline">Fix watch party audio delay</Link></li>
          <li><Link href="/watch-crunchyroll-together" className="hover:underline">Watch Crunchyroll together hub</Link></li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
