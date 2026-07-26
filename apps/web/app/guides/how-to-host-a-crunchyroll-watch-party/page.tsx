import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  PRICING_HOST_MODEL,
  PRICING_PLUS_VS_PRO_ANSWER,
  PRICING_PLUS_SHORT,
  PRICING_PRO_SHORT,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "How to Host a Crunchyroll Watch Party (2026 Host Guide) | AniDachi",
  description:
    "Host framing: create a Crunchyroll watchroom, share invites, and understand who pays (hosts upgrade; guests Free). Plan limits + step-by-step HowTo.",
  alternates: { canonical: "/guides/how-to-host-a-crunchyroll-watch-party" },
  openGraph: {
    title: "How to Host a Crunchyroll Watch Party",
    description:
      "CR-specific host playbook with entitlements — distinct from general anime watch party creation.",
    url: "/guides/how-to-host-a-crunchyroll-watch-party",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Host a Crunchyroll Watch Party",
    description: "Hosts pay for room limits; guests join Free. Step-by-step.",
    images: [BRAND_OG_PATH],
  },
};

const howToSteps = [
  {
    name: "Confirm Crunchyroll access for the group",
    text: "Every guest needs their own Crunchyroll login for the episode you will host — AniDachi does not stream the video for them.",
  },
  {
    name: "Choose your AniDachi host plan",
    text: "Free hosts get limited daily hosting; Plus and Pro raise room size and remove the free time cap when you host weekly nights.",
  },
  {
    name: "Open the exact Crunchyroll episode",
    text: "Load the series page so AniDachi can detect the anime title and attach the watchroom to the right show.",
  },
  {
    name: "Create the watchroom as host",
    text: "Generate the room from the extension, enable chat, and decide live vs async pacing before invites go out.",
  },
  {
    name: "Share the invite with host notes",
    text: "Paste the link plus episode number, start window, and spoiler rules into Discord or chat.",
  },
  {
    name: "Start playback and moderate",
    text: "Count down in chat for live nights, or leave async markers for late joiners. Upgrade to Pro if you need invite-only rooms and mods.",
  },
];

const faq = [
  {
    question: "Who pays to host a Crunchyroll watch party on AniDachi?",
    answer: `${PRICING_HOST_MODEL} See /pricing for Plus (${PRICING_PLUS_SHORT}) and Pro (${PRICING_PRO_SHORT}).`,
  },
  {
    question: "Do guests need paid AniDachi accounts?",
    answer: PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  },
  {
    question: "Plus or Pro for club hosts?",
    answer: PRICING_PLUS_VS_PRO_ANSWER,
  },
  {
    question: "How is this different from creating a general anime watch party?",
    answer:
      "The general create guide covers multi-method hosting. This page is Crunchyroll-host-specific: entitlements, plan limits, and CR episode detection so hosts know what they pay for before invite night.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "who-pays", label: "Who pays (hosts)", level: 2 },
  { id: "steps", label: "Host steps", level: 2 },
  { id: "limits", label: "Plan limits to know", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToHostACrunchyrollWatchPartyPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["crunchyroll", "how-to-core", "watch-party"],
    excludeHref: "/guides/how-to-host-a-crunchyroll-watch-party",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to host a Crunchyroll watch party with AniDachi"
        description="Host a Crunchyroll watchroom with clear entitlements: hosts upgrade for room limits while guests can stay Free."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
          {
            name: "How to host a Crunchyroll watch party",
            url: "/guides/how-to-host-a-crunchyroll-watch-party",
          },
        ]}
        title="How to host a Crunchyroll watch party"
        description="CR-specific host playbook with plan limits — distinct from general anime watch party creation."
        url="/guides/how-to-host-a-crunchyroll-watch-party"
        datePublished="2026-07-19"
        dateModified="2026-07-19"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta={true}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to Host a Crunchyroll Watch Party
        </h1>

        <h2
          id="answer"
          className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
        >
          Short Answer
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-6">
          <strong>
            To host a Crunchyroll watch party with AniDachi, open the episode,
            create a watchroom, and share one invite — while you (the host) carry
            the AniDachi plan limits and every guest streams on their own
            Crunchyroll account.
          </strong>{" "}
          This is the host/entitlements guide. For a broader multi-method create
          flow, see{" "}
          <Link
            href="/guides/how-to-create-an-anime-watch-party"
            className="text-brand-orange hover:underline"
          >
            how to create an anime watch party
          </Link>
          .
        </p>

        <h2
          id="who-pays"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Who pays (hosts)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          {PRICING_HOST_MODEL} Guests do not need Plus to join. Full tiers live on{" "}
          <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
            /pricing
          </Link>
          .
        </p>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Free hosting is capped (about 30 minutes/day and smaller rooms). Weekly
          club hosts usually move to Plus ({PRICING_PLUS_SHORT}) or Pro (
          {PRICING_PRO_SHORT}) during pre-launch.
        </p>

        <h2
          id="steps"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Host steps
        </h2>
        <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <span className="font-medium text-foreground">{step.name}.</span>{" "}
              {step.text}
            </li>
          ))}
        </ol>

        <h2
          id="limits"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Plan limits to know before invite night
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            <strong>Free:</strong> join anytime; host with daily time and room
            size caps.
          </li>
          <li>
            <strong>Plus:</strong> unlimited hosting, up to 6 people, 4 video
            seats — regular watch nights.
          </li>
          <li>
            <strong>Pro:</strong> up to 15 people, invite-only rooms, moderator
            controls — club hosts.
          </li>
        </ul>

        <h2
          id="related"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Related guides
        </h2>
        <ul className="space-y-2 text-brand-orange mb-8">
          <li>
            <Link href="/pricing" className="hover:underline">
              AniDachi pricing
            </Link>
          </li>
          <li>
            <Link
              href="/guides/best-way-to-watch-crunchyroll-with-friends"
              className="hover:underline"
            >
              Best way to watch Crunchyroll with friends
            </Link>
          </li>
          <li>
            <Link
              href="/guides/how-to-create-an-anime-watch-party"
              className="hover:underline"
            >
              How to create an anime watch party
            </Link>
          </li>
          <li>
            <Link href="/watch-crunchyroll-together" className="hover:underline">
              Watch Crunchyroll together
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
