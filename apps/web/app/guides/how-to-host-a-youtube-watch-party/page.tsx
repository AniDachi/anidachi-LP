import type { Metadata } from "next";
import Link from "next/link";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_FRIENDS_NEED_YOUTUBE_ANSWER,
  PRICING_HOST_MODEL,
  PRICING_PLUS_VS_PRO_ANSWER,
  PRICING_PLUS_SHORT,
  PRICING_PRO_SHORT,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "How to Host a YouTube Watch Party (2026 Host Guide) | AniDachi",
  description:
    "Host a YouTube watch party: create a watchroom, share invites, and understand who pays (hosts upgrade; guests Free). Step-by-step HowTo.",
  alternates: { canonical: "/guides/how-to-host-a-youtube-watch-party" },
  openGraph: {
    title: "How to Host a YouTube Watch Party",
    description:
      "Host playbook for YouTube watchrooms — plan limits and invite tips.",
    url: "/guides/how-to-host-a-youtube-watch-party",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Host a YouTube Watch Party",
    description: "Hosts pay for room limits; guests join Free. Step-by-step.",
    images: [BRAND_OG_PATH],
  },
};

const howToSteps = [
  {
    name: "Confirm everyone can open the video",
    text: "Pick a public or shared YouTube video on a full watch page — not Shorts or embeds.",
  },
  {
    name: "Choose your AniDachi host plan",
    text: "Free hosts get limited daily hosting; Plus and Pro raise room size for weekly nights.",
  },
  {
    name: "Open the exact YouTube URL",
    text: "Load youtube.com/watch so the extension can pin the watchroom to that video.",
  },
  {
    name: "Create the watchroom as host",
    text: "Generate the room from the overlay, enable chat, and decide live vs async before invites.",
  },
  {
    name: "Share the invite with host notes",
    text: "Paste the link plus start time and spoiler rules into Discord or chat.",
  },
  {
    name: "Start playback and moderate",
    text: "Countdown in chat for live nights, or leave async markers for late joiners.",
  },
];

const faq = [
  {
    question: "Who pays to host a YouTube watch party on AniDachi?",
    answer: `${PRICING_HOST_MODEL} See /pricing for Plus (${PRICING_PLUS_SHORT}) and Pro (${PRICING_PRO_SHORT}).`,
  },
  {
    question: "Do guests need paid AniDachi accounts?",
    answer: PRICING_FRIENDS_NEED_YOUTUBE_ANSWER,
  },
  {
    question: "Plus or Pro for club hosts?",
    answer: PRICING_PLUS_VS_PRO_ANSWER,
  },
  {
    question: "How is this different from how to watch YouTube with friends?",
    answer:
      "The general how-to covers joining and watching. This page is host-specific: entitlements, plan limits, and invite hygiene before party night.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "who-pays", label: "Who pays (hosts)", level: 2 },
  { id: "steps", label: "Host steps", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToHostAYoutubeWatchPartyPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube", "how-to-core"],
    excludeHref: "/guides/how-to-host-a-youtube-watch-party",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to host a YouTube watch party"
        description="Host an AniDachi YouTube watchroom with invites and plan limits."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: "/watch-youtube-together" },
          {
            name: "How to host a YouTube watch party",
            url: "/guides/how-to-host-a-youtube-watch-party",
          },
        ]}
        title="How to host a YouTube watch party"
        description="Host framing for YouTube watchrooms — who pays, plan limits, and steps."
        url="/guides/how-to-host-a-youtube-watch-party"
        datePublished="2026-07-26"
        dateModified="2026-08-11"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to Host a YouTube Watch Party
        </h1>

        <h2 id="answer" className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">
          Short Answer
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-6">
          <strong>
            Hosting a YouTube watch party means creating the AniDachi room, sharing the
            invite, and owning the start time — guests can stay on Free.
          </strong>{" "}
          YouTube itself has no host button. Start from{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            /pricing
          </Link>
          .
        </p>

        <h2
          id="who-pays"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Who Pays (Hosts)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">{PRICING_HOST_MODEL}</p>

        <h2 id="steps" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
          Host Steps
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <strong>{step.name}:</strong> {step.text}
            </li>
          ))}
        </ol>

        <PrimaryCheckoutCta
          pagePath="/guides/how-to-host-a-youtube-watch-party"
          pageTemplate="guide"
          placement="content_mid"
          className="my-10"
        />

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
