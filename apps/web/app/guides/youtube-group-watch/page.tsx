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
  title: "YouTube Group Watch — How to Watch YouTube Together (2026) | AniDachi",
  description:
    "YouTube group watch without a native feature: run AniDachi watchrooms on full YouTube pages for synced playback, chat, and async catch-up.",
  alternates: { canonical: "/guides/youtube-group-watch" },
  openGraph: {
    title: "YouTube Group Watch",
    description:
      "Set up a YouTube group watch with synced watchrooms — live or async.",
    url: "/guides/youtube-group-watch",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Group Watch",
    description: "Synced YouTube group nights with AniDachi watchrooms.",
    images: [BRAND_OG_PATH],
  },
};

const howToSteps = [
  {
    name: "Get AniDachi",
    text: "Open /pricing for early access and install the Chrome extension.",
  },
  {
    name: "Open the video",
    text: "Navigate to a full youtube.com/watch page everyone agreed on.",
  },
  {
    name: "Create the group watchroom",
    text: "Create a YouTube watchroom from the overlay and copy the invite.",
  },
  {
    name: "Invite the group",
    text: "Share the link so each friend joins on their own YouTube session.",
  },
  {
    name: "Watch live or async",
    text: "Sync for a live hang, or leave reactions when schedules diverge.",
  },
];

const faq = [
  {
    question: "How do you do a YouTube group watch?",
    answer:
      "YouTube has no native group watch. Install AniDachi, open the same full watch page, create a watchroom, and share the invite so everyone’s playback stays aligned.",
  },
  {
    question: "Is YouTube group watch free?",
    answer: `Free to join with limited hosting. ${PRICING_YT_PRICING_SNIPPET}`,
  },
  {
    question: "Can we use Discord for a YouTube group watch?",
    answer:
      "Use Discord for voice. Avoid relying on Go Live as the video path for long sessions — see can you screen share YouTube on Discord.",
  },
  {
    question: "Does this work on Shorts?",
    answer:
      "AniDachi YouTube rooms work on full youtube.com/watch pages in desktop Chrome — not Shorts, embeds, or the native mobile app.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "why", label: "Why a sync layer", level: 2 },
  { id: "steps", label: "Step-by-step", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function YoutubeGroupWatchPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/guides/youtube-group-watch",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to run a YouTube group watch"
        description="Create an AniDachi YouTube watchroom for synced group watching."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: "/watch-youtube-together" },
          { name: "YouTube group watch", url: "/guides/youtube-group-watch" },
        ]}
        title="YouTube group watch"
        description="How to run a YouTube group watch with AniDachi watchrooms — live or async."
        url="/guides/youtube-group-watch"
        datePublished="2026-07-26"
        dateModified="2026-07-26"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          YouTube Group Watch (2026 Guide)
        </h1>

        <h2 id="answer" className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">
          Short Answer
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-6">
          <strong>
            A YouTube group watch needs a third-party watchroom — YouTube has no native
            group-watch button.
          </strong>{" "}
          AniDachi pins a room to a full YouTube watch page so friends sync live or catch
          up async. Pillar overview:{" "}
          <Link href="/watch-youtube-together" className="text-brand-orange hover:underline">
            YouTube Watch Party
          </Link>
          .
        </p>

        <h2 id="why" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
          Why a Sync Layer Beats Screen Share
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Group watch means everyone hears the same punchline at the same second —
          without one friend uploading video for the room. Keep Discord for chat; let
          each browser stream YouTube directly.
        </p>

        <h2 id="steps" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
          Step-by-Step
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
