import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { getGuideLinks } from "@/lib/guide-links";
import {
  PRICING_CR_PRICING_SNIPPET,
  PRICING_CRUNCHYROLL_GUIDE_PAID_MENTION,
} from "@/lib/pricing-copy";

export const metadata: Metadata = {
  title: "How to Watch Crunchyroll with Friends — Crunchyroll Watch Party Guide (2026)",
  description:
    "Step-by-step: watch Crunchyroll with friends using AniDachi watchrooms — live sync or async. Free Discord and Crunchyroll Party options compared.",
  alternates: { canonical: "/guides/how-to-watch-crunchyroll-with-friends" },
  openGraph: {
    title: "How to Watch Crunchyroll with Friends — Watch Party Guide (2026)",
    description:
      "Create a Crunchyroll watchroom in minutes — synced playback, chat, and async catch-up.",
    url: "/guides/how-to-watch-crunchyroll-with-friends",
  },
};

const faq = [
  {
    question: "Does Crunchyroll have a watch party feature in 2026?",
    answer:
      "No. As of 2026, Crunchyroll still does not have a built-in watch party or group watch feature. You need a third-party tool — AniDachi, Crunchyroll Party, or Discord screen sharing.",
  },
  {
    question: "How do I watch Crunchyroll with friends online?",
    answer:
      "Open /pricing for AniDachi early access, install the Chrome extension, open any anime on Crunchyroll, detect the show, and create a watchroom. Share the invite link so each friend joins on their own Crunchyroll account.",
  },
  {
    question: "Does Crunchyroll have a group watch or watch together option?",
    answer:
      `Crunchyroll does not have a native group watch feature. Third-party Chrome extensions fill this gap: ${PRICING_CRUNCHYROLL_GUIDE_PAID_MENTION}, Crunchyroll Party (sync + basic chat, free), and Teleparty (cross-platform sync, freemium).`,
  },
  {
    question: "Is AniDachi free for Crunchyroll watch parties?",
    answer: PRICING_CR_PRICING_SNIPPET,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Step-by-step (AniDachi)", level: 2 },
  { id: "method-discord", label: "Discord alternative", level: 2 },
  { id: "method-cr-party", label: "Crunchyroll Party", level: 2 },
  { id: "which-method", label: "Which method to choose", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Get AniDachi",
    text: "Open /pricing for early access and install the AniDachi Chrome extension.",
  },
  {
    name: "Open Crunchyroll",
    text: "Navigate to any anime episode on Crunchyroll in desktop Chrome.",
  },
  {
    name: "Detect and create a watchroom",
    text: "Click Detect Anime, then Create Room so the room is linked to the show and episode.",
  },
  {
    name: "Invite friends",
    text: "Share the invite link so each friend joins on their own Crunchyroll account.",
  },
  {
    name: "Watch live or async",
    text: "Sync for a live hang, or leave reactions when someone watches later.",
  },
];

export default function HowToWatchWithFriendsPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-crunchyroll"],
    excludeHref: "/guides/how-to-watch-crunchyroll-with-friends",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to watch Crunchyroll with friends"
        description="Set up an AniDachi Crunchyroll watchroom for synced or async co-watching."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
          {
            name: "How to Watch Crunchyroll with Friends",
            url: "/guides/how-to-watch-crunchyroll-with-friends",
          },
        ]}
        title="How to Watch Crunchyroll with Friends"
        description="Every method to watch Crunchyroll together, compared and explained."
        url="/guides/how-to-watch-crunchyroll-with-friends"
        datePublished="2026-04-23"
        dateModified="2026-07-26"
        faq={faq}
        headings={tocHeadings}
        aboveFoldCta
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to Watch Crunchyroll with Friends — Crunchyroll Watch Party Guide
          (2026)
        </h1>

        <h2
          id="answer"
          className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
        >
          Short Answer
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            Create an AniDachi Crunchyroll watchroom, share the invite, and watch
            on each person&apos;s own Crunchyroll tab — synced for live hangs,
            async when schedules conflict.
          </strong>{" "}
          Full hub:{" "}
          <Link
            href="/watch-crunchyroll-together"
            className="text-brand-orange hover:underline"
          >
            Watch Crunchyroll Together
          </Link>
          . Checkout:{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing / early access
          </Link>
          .
        </p>

        <PrimaryCheckoutCta
          pagePath="/guides/how-to-watch-crunchyroll-with-friends"
          pageTemplate="guide"
          placement="content_mid"
          className="my-10"
        />

        <h2
          id="steps"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Step-by-step (AniDachi)
        </h2>
        <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <strong>{step.name}.</strong> {step.text}
            </li>
          ))}
        </ol>

        <h2
          id="method-discord"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Discord screen sharing (free, lower quality)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Discord&apos;s Go Live can share a Crunchyroll tab, but quality is
          limited and capture often fails. Prefer Discord for voice only — see{" "}
          <Link
            href="/guides/can-you-screen-share-crunchyroll-on-discord"
            className="text-brand-orange hover:underline"
          >
            can you screen share Crunchyroll on Discord
          </Link>
          .
        </p>

        <h2
          id="method-cr-party"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Crunchyroll Party (free, live sync only)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Crunchyroll Party syncs live playback on each person&apos;s account
          with basic chat. It lacks async catch-up and host room upgrades —
          fine for same-time nights; upgrade path when schedules drift is AniDachi.
        </p>

        <h2
          id="which-method"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Which Method Should You Choose?
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            <strong>For async groups across time zones:</strong> AniDachi
          </li>
          <li>
            <strong>For free one-off sessions:</strong> Discord voice + free sync
            tool (not Go Live as the video pipe)
          </li>
          <li>
            <strong>For free live sync:</strong> Crunchyroll Party
          </li>
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
            <Link
              href="/guides/crunchyroll-watch-party-free"
              className="hover:underline"
            >
              Free Crunchyroll watch party options
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="hover:underline">
              AniDachi pricing
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
    </>
  );
}
