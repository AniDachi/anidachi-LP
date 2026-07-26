import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_YT_PRICING_SNIPPET } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "How to Sync YouTube With Friends (2026) | AniDachi",
  description:
    "Sync YouTube playback with friends using AniDachi watchrooms — each person streams full quality on their own tab. Setup in minutes.",
  alternates: { canonical: "/guides/how-to-sync-youtube-with-friends" },
  openGraph: {
    title: "How to Sync YouTube With Friends",
    description:
      "Keep YouTube videos aligned across your group with synced watchrooms and chat.",
    url: "/guides/how-to-sync-youtube-with-friends",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Sync YouTube With Friends",
    description: "Step-by-step YouTube sync for watch parties.",
    images: [BRAND_OG_PATH],
  },
};

const howToSteps = [
  {
    name: "Install AniDachi",
    text: "Add the Chrome extension on every device that will join the sync session.",
  },
  {
    name: "Open the same YouTube video",
    text: "Each person opens the full youtube.com/watch URL — not Shorts or embeds.",
  },
  {
    name: "Create or join the watchroom",
    text: "Host creates the room; friends join via invite so timestamps stay aligned.",
  },
  {
    name: "Start playback together",
    text: "Host plays; AniDachi syncs. Use Catch up if someone drifts a few seconds.",
  },
  {
    name: "Keep voice separate",
    text: "Use Discord or another call for talking — mute conflicting tabs as needed.",
  },
];

const faq = [
  {
    question: "Can you sync YouTube with friends without screen sharing?",
    answer:
      "Yes — AniDachi syncs playback timestamps while each person streams from their own YouTube tab at full quality. No host upload bottleneck.",
  },
  {
    question: "Does YouTube have built-in sync with friends?",
    answer:
      "No native watch party. Third-party tools (AniDachi, Teleparty, Watch2Gether) provide sync on full watch pages.",
  },
  {
    question: "What if friends fall out of sync during a YouTube session?",
    answer:
      "Pause and use AniDachi’s catch-up / resync controls to realign. For members who miss entire sessions, async mode lets them catch up later without spoilers in chat.",
  },
  {
    question: "Is AniDachi free for YouTube sync?",
    answer: `Free to join with limited hosting. ${PRICING_YT_PRICING_SNIPPET}`,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "methods", label: "Sync methods", level: 2 },
  { id: "steps", label: "Step-by-step", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToSyncYoutubeWithFriendsPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube", "how-to-core"],
    excludeHref: "/guides/how-to-sync-youtube-with-friends",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to sync YouTube with friends"
        description="Sync YouTube playback across friends with an AniDachi watchroom."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: "/watch-youtube-together" },
          {
            name: "How to sync YouTube with friends",
            url: "/guides/how-to-sync-youtube-with-friends",
          },
        ]}
        title="How to sync YouTube with friends"
        description="Keep YouTube videos aligned across your group with AniDachi watchrooms."
        url="/guides/how-to-sync-youtube-with-friends"
        datePublished="2026-07-26"
        dateModified="2026-07-26"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to Sync YouTube With Friends
        </h1>

        <h2 id="answer" className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">
          Short Answer
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-6">
          <strong>
            Sync YouTube with friends by pinning an AniDachi watchroom to the same full
            watch page — everyone streams locally while playback stays aligned.
          </strong>{" "}
          Skip Discord screen share for the video path; keep it for voice. Start at{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            /pricing
          </Link>
          .
        </p>

        <h2 id="methods" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
          Sync Methods Compared
        </h2>
        <ul className="space-y-3 text-foreground/80 mb-8">
          <li>
            <strong>AniDachi:</strong> Live sync + async catch-up on YouTube (and
            Crunchyroll).
          </li>
          <li>
            <strong>Teleparty:</strong> Live-only YouTube sync — see{" "}
            <Link
              href="/guides/does-teleparty-work-with-youtube"
              className="text-brand-orange hover:underline"
            >
              Does Teleparty work with YouTube?
            </Link>
            .
          </li>
          <li>
            <strong>Discord Go Live:</strong> Works but compresses video — see{" "}
            <Link
              href="/guides/can-you-screen-share-youtube-on-discord"
              className="text-brand-orange hover:underline"
            >
              screen share YouTube on Discord
            </Link>
            .
          </li>
        </ul>

        <h2 id="steps" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
          Step-by-Step Sync Setup
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <strong>{step.name}:</strong> {step.text}
            </li>
          ))}
        </ol>

        <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
          Related Guides
        </h2>
        <ul className="space-y-2 mb-8">
          {relatedGuideLinks.map((guide) => (
            <li key={guide.href}>
              <Link href={guide.href} className="text-brand-orange hover:underline">
                {guide.label}
              </Link>
            </li>
          ))}
        </ul>
      </SeoPageLayout>
    </>
  );
}
