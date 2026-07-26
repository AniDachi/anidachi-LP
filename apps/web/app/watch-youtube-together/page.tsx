import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_ASYNC_HOST_SNIPPET,
  PRICING_EARLY_ACCESS_PRICE,
  PRICING_IS_ANIDACHI_FREE_ANSWER,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "YouTube Watch Party — Watch YouTube Together With Friends (2026)",
  description:
    "YouTube has no native watch party. Use AniDachi for synced YouTube watchrooms with chat and async catch-up — or compare Watch2Gether, Teleparty, and Discord.",
  alternates: { canonical: "/watch-youtube-together" },
  openGraph: {
    title: "YouTube Watch Party — Watch YouTube Together",
    description:
      "Create a YouTube watch party with sync, chat, and async support. Every method compared.",
    url: "/watch-youtube-together",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Watch Party — Watch YouTube Together",
    description:
      "Synced YouTube watchrooms with AniDachi — live or async. Methods compared.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does YouTube have a watch party feature?",
    answer:
      "No. As of 2026, YouTube does not offer a built-in watch party or co-watching feature. You need a third-party tool such as AniDachi, Watch2Gether, or Teleparty to keep playback aligned.",
  },
  {
    question: "What is the best YouTube watch party app?",
    answer:
      "For groups that want a Chrome extension watchroom with live sync and async catch-up, AniDachi is the strongest fit. Watch2Gether wins for free browser-only live rooms. Teleparty works if you already use it for Netflix nights.",
  },
  {
    question: "How do I watch YouTube together with friends?",
    answer:
      "Install AniDachi, open a full youtube.com/watch page, create a watchroom, and share the invite link. Everyone watches on their own YouTube session while playback and chat stay in the room. Shorts, embeds, and homepage feeds are not supported.",
  },
  {
    question: "Can you watch YouTube together asynchronously?",
    answer:
      "Yes with AniDachi. Friends can watch the same video on their own schedule and leave reactions without spoiling each other. Most free YouTube party tools are live-only.",
  },
  {
    question: "Is AniDachi free for YouTube watch parties?",
    answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
  },
  {
    question: "Does Teleparty work with YouTube?",
    answer:
      "Yes for live sync. Teleparty does not offer AniDachi-style async YouTube watchrooms. See our Teleparty for YouTube guide for details.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "no-native", label: "Why no built-in watch party", level: 2 },
  { id: "step-by-step", label: "Step-by-step", level: 2 },
  { id: "compare-methods", label: "Compare methods", level: 2 },
  { id: "anidachi-difference", label: "What makes AniDachi different", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Install AniDachi",
    text: "Add the AniDachi Chrome extension and start early access from pricing if you are not already set up.",
  },
  {
    name: "Open a YouTube watch page",
    text: "Go to a full youtube.com/watch?v= page — not Shorts, embeds, or the homepage feed.",
  },
  {
    name: "Create a watchroom",
    text: "Create a YouTube watchroom in AniDachi linked to the video you are watching.",
  },
  {
    name: "Share the invite link",
    text: "Copy the invite and send it via Discord, text, or email so friends join on their own YouTube accounts.",
  },
  {
    name: "Watch live or asynchronously",
    text: "Sync playback for a live YouTube watch party, or use async mode to leave reactions when schedules do not overlap.",
  },
];

export default function WatchYoutubeTogetherPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/watch-youtube-together",
    limit: 6,
  });

  const hardCodedRelated = [
    { href: "/watch-anime-together", label: "Watch Anime Together" },
    { href: "/watch-crunchyroll-together", label: "Crunchyroll Watch Party" },
    {
      href: "/guides/how-to-watch-youtube-with-friends",
      label: "How to watch YouTube with friends",
    },
    {
      href: "/guides/netflix-party-for-youtube",
      label: "Netflix Party for YouTube",
    },
    {
      href: "/guides/does-teleparty-work-with-youtube",
      label: "Does Teleparty work with YouTube?",
    },
    {
      href: "/guides/youtube-watch-party-chrome-extension",
      label: "YouTube watch party Chrome extension",
    },
    {
      href: "/guides/youtube-watch-party-with-discord",
      label: "YouTube watch party with Discord",
    },
    {
      href: "/watch-youtube-together-long-distance",
      label: "Watch YouTube together long distance",
    },
    {
      href: "/compare/anidachi-vs-watch2gether",
      label: "AniDachi vs Watch2Gether",
    },
  ] as const;

  const hardCodedHrefs = new Set<string>(
    hardCodedRelated.map((l) => l.href),
  );
  const dynamicRelated = relatedGuideLinks.filter(
    (g) => !hardCodedHrefs.has(g.href),
  );

  return (
    <>
      <HowToJsonLd
        name="How to host a YouTube watch party with AniDachi"
        description="Set up a YouTube watchroom with AniDachi for synced or async co-watching."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        ]}
        title="YouTube Watch Party — Watch YouTube Together"
        description="The complete guide to YouTube watch parties: sync, chat, async, and every alternative compared."
        url="/watch-youtube-together"
        datePublished="2026-07-25"
        dateModified="2026-07-25"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
          YouTube Watch Party — Watch YouTube Together With Friends
        </h1>

        <h2
          id="answer"
          className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
        >
          Short Answer
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            Host a YouTube watch party with AniDachi — a Chrome extension that
            creates watchrooms on full YouTube videos with synced playback, chat,
            and async catch-up.
          </strong>{" "}
          YouTube has no native co-watching feature. Watch2Gether and Teleparty
          remain solid free live-only options; Discord voice pairs well with any
          sync tool. Start from{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing / early access
          </Link>
          .
        </p>

        <h2
          id="no-native"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Why YouTube Doesn&apos;t Have a Built-In Watch Party
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-6">
          As of 2026, YouTube still has no official watch-together or party mode
          for standard videos. Viewers rely on third-party extensions and room
          sites. AniDachi mounts on full <strong>youtube.com/watch</strong> pages
          (not Shorts, embeds, or homepage feeds) and adds the same watchroom
          layer it uses for{" "}
          <Link
            href="/watch-crunchyroll-together"
            className="text-brand-orange hover:underline"
          >
            Crunchyroll
          </Link>
          .
        </p>

        <h2
          id="step-by-step"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          How to Watch YouTube Together (Step by Step)
        </h2>
        <ol className="space-y-4 text-foreground/80 mb-8">
          {howToSteps.map((step, index) => (
            <li key={step.name} className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-orange/15 text-brand-orange text-sm font-bold flex items-center justify-center">
                {index + 1}
              </span>
              <span>
                <strong>{step.name}.</strong> {step.text}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Prefer a dedicated how-to? See{" "}
          <Link
            href="/guides/how-to-watch-youtube-with-friends"
            className="text-brand-orange hover:underline"
          >
            how to watch YouTube with friends
          </Link>
          .
        </p>

        <h2
          id="compare-methods"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Best Ways to Run a YouTube Watch Party
        </h2>
        <ResponsiveCompareTable
          columns={[
            { id: "anidachi", label: "AniDachi", highlight: true },
            { id: "w2g", label: "Watch2Gether" },
            { id: "teleparty", label: "Teleparty" },
            { id: "discord", label: "Discord" },
          ]}
          rows={[
            {
              feature: "Live sync",
              values: {
                anidachi: "yes",
                w2g: "yes",
                teleparty: "yes",
                discord: "Manual / Go Live",
              },
            },
            {
              feature: "Async catch-up",
              values: {
                anidachi: "yes",
                w2g: "no",
                teleparty: "no",
                discord: "no",
              },
            },
            {
              feature: "Full YouTube quality",
              values: {
                anidachi: "yes",
                w2g: "yes",
                teleparty: "yes",
                discord: "Compressed if Go Live",
              },
            },
            {
              feature: "Chrome extension",
              values: {
                anidachi: "yes",
                w2g: "no (web room)",
                teleparty: "yes",
                discord: "App",
              },
            },
            {
              feature: "Pricing",
              values: {
                anidachi: PRICING_EARLY_ACCESS_PRICE,
                w2g: "Free + paid",
                teleparty: "Freemium",
                discord: "Free",
              },
            },
          ]}
        />
        <p className="text-foreground/80 leading-relaxed mt-6 mb-8">
          Ranked apps detail:{" "}
          <Link
            href="/guides/best-apps-to-watch-youtube-together"
            className="text-brand-orange hover:underline"
          >
            best apps to watch YouTube together
          </Link>
          . Watch2Gether roundup:{" "}
          <Link
            href="/guides/watch2gether-alternatives-for-youtube"
            className="text-brand-orange hover:underline"
          >
            Watch2Gether alternatives for YouTube
          </Link>
          .
        </p>

        <h2
          id="anidachi-difference"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          What Makes AniDachi Different for YouTube
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Most YouTube party tools assume everyone is online at once. AniDachi
          adds <strong>asynchronous watching</strong> — friends mark progress and
          leave reactions when schedules conflict. The same extension also covers
          Crunchyroll anime nights, so dual-platform groups stay in one product.
        </p>
        <p className="text-foreground/80 leading-relaxed mb-8">
          {PRICING_ASYNC_HOST_SNIPPET} Details on{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing / early access
          </Link>
          .
        </p>

        <h2
          id="related"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Related Guides
        </h2>
        <ul className="space-y-2 text-brand-orange mb-4">
          {hardCodedRelated.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:underline">
                {link.label}
              </Link>
            </li>
          ))}
          {dynamicRelated.map((guide) => (
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
