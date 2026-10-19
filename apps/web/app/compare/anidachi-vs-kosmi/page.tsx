import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getSeoSiteOrigin } from "@/lib/site-url";
import { PRICING_FREE_TIER_TABLE } from "@/lib/pricing-copy";

const SITE_URL = getSeoSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;
const PAGE_PATH = "/compare/anidachi-vs-kosmi";

const KOSMI_SOURCES = [
  { href: "https://kosmi.io/", label: "Kosmi home page" },
  { href: "https://kosmi.io/watchparty/", label: "Kosmi watch party page" },
  { href: "https://kosmi.io/teleparty-alternative/", label: "Kosmi Teleparty alternative page" },
  { href: "https://kosmi.io/hyperbeam-alternative/", label: "Kosmi shared browser page" },
  { href: "https://kosmi.io/screen-share-with-friends/", label: "Kosmi screen share page" },
];

export const metadata: Metadata = {
  title: { absolute: "AniDachi vs Kosmi: A Kosmi Alternative for Anime Nights" },
  description:
    "AniDachi vs Kosmi for anime nights: Crunchyroll watchrooms on each viewer's own player vs Kosmi's free browser rooms, shared browser and video chat.",
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: "AniDachi vs Kosmi: A Kosmi Alternative for Anime Nights",
    description:
      "Compare AniDachi's Crunchyroll, YouTube and Netflix watchrooms with Kosmi's free browser rooms.",
    url: PAGE_PATH,
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Kosmi",
    description: "Crunchyroll anime watchrooms vs Kosmi's free browser rooms.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does Kosmi work with Crunchyroll?",
    answer:
      "The Kosmi pages we checked do not mention Crunchyroll. Kosmi says its shared virtual browser can open streaming sites and lists Netflix, YouTube, Disney+, Hulu, HBO Max and Prime Video. AniDachi supports live Crunchyroll rooms through its Chrome extension, with each person using their own access.",
  },
  {
    question: "How is Kosmi different from AniDachi?",
    answer:
      "Kosmi is a browser-based room with a shared virtual browser, screen sharing, video chat and games, and nothing to install. AniDachi is a Chrome extension: each person plays the video in their own Crunchyroll, YouTube or Netflix tab with their own access, and AniDachi syncs playback without re-streaming the video.",
  },
  {
    question: "Is Kosmi free?",
    answer:
      "Kosmi says rooms, syncing, video chat and its games are free, with an optional Premium plan for extras such as 1080p screen sharing. The pages we checked did not list a Premium price. On AniDachi, friends join free and hosting needs the host's Plus (up to 6 people) or Pro (up to 15), including a 3-day trial for eligible accounts.",
  },
  {
    question: "When is Kosmi the better choice than AniDachi?",
    answer:
      "Pick Kosmi if anyone in your group cannot install a Chrome extension, joins from a phone or tablet, or you want free video chat, screen sharing and games in the same room. Pick AniDachi for Crunchyroll, YouTube or Netflix nights in desktop Chrome where everyone watches on their own player.",
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "feature-comparison", label: "Feature comparison", level: 2 },
  { id: "when-kosmi", label: "When Kosmi is the better pick", level: 2 },
  { id: "when-anidachi", label: "When AniDachi is the better pick", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsKosmiPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Party App", url: "/watch-party-app" },
        { name: "AniDachi vs Kosmi", url: PAGE_PATH },
      ]}
      title="AniDachi vs Kosmi"
      description="Compare AniDachi's Crunchyroll, YouTube and Netflix watchrooms with Kosmi's free browser rooms."
      url={PAGE_PATH}
      datePublished="2026-10-19"
      dateModified="2026-10-19"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs Kosmi: A Kosmi Alternative for Anime Nights
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Choose AniDachi for Crunchyroll, YouTube or Netflix nights in desktop Chrome
          where everyone watches on their own player, with synced playback, on-player
          chat and reactions, voice/video calls, and personal watch history. Choose Kosmi
          for a free, no-install hangout room with video chat, screen sharing and games
          that works on phones.
        </strong>
      </p>
      <p className="text-foreground/80 mb-6">
        The two tools work differently. Kosmi brings the video into its room through a
        shared virtual browser or screen share. AniDachi leaves the video on each
        person&apos;s own Crunchyroll, YouTube or Netflix tab and syncs playback without
        re-streaming it.
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-foreground/80 mb-4">
        <strong>Kosmi:</strong> a free, browser-based platform for movie nights, game
        nights and virtual hangouts. Guests join from a link with no account and no
        extension. Rooms include a shared virtual browser that everyone can see and
        click, screen sharing with audio, voice, video and messaging, and games such as
        poker and retro consoles. Kosmi also has a mobile app.
      </p>
      <p className="text-foreground/80 mb-8">
        <strong>AniDachi:</strong> a Chrome extension and web product for watchrooms on
        Crunchyroll, full YouTube watch pages and Netflix movie and episode pages in
        desktop Chrome. Rooms have live synchronized playback, on-player chat and
        reactions, voice/video calls, and personal watch history. Each person uses their
        own access to the video.
      </p>

      <h2
        id="feature-comparison"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Feature comparison
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "kosmi", label: "Kosmi" },
        ]}
        rows={[
          {
            feature: "How it works",
            values: {
              anidachi: "Chrome extension syncs each viewer's own tab",
              kosmi: "Web rooms with shared virtual browser and screen share",
            },
          },
          {
            feature: "Install needed",
            values: { anidachi: "Chrome extension", kosmi: "None (runs in the browser)" },
          },
          {
            feature: "Crunchyroll",
            values: { anidachi: "yes", kosmi: "Not stated" },
          },
          {
            feature: "Netflix",
            values: { anidachi: "Movie and episode pages", kosmi: "Listed by Kosmi" },
          },
          {
            feature: "YouTube",
            values: { anidachi: "Full watch pages", kosmi: "yes" },
          },
          {
            feature: "Disney+, Hulu, Prime Video",
            values: { anidachi: "no", kosmi: "Listed by Kosmi" },
          },
          {
            feature: "Each viewer plays their own stream",
            values: { anidachi: "yes", kosmi: "No, video runs inside the room" },
          },
          {
            feature: "Voice and video calls",
            values: { anidachi: "yes", kosmi: "Yes, free" },
          },
          {
            feature: "Chat and reactions",
            values: { anidachi: "On-player chat and reactions", kosmi: "Messaging built in" },
          },
          {
            feature: "Screen sharing",
            values: { anidachi: "no", kosmi: "Free up to 720p; 1080p on Premium" },
          },
          {
            feature: "Games",
            values: { anidachi: "no", kosmi: "yes" },
          },
          {
            feature: "Personal watch history",
            values: { anidachi: "yes", kosmi: "Not stated" },
          },
          {
            feature: "Phones and tablets",
            values: { anidachi: "No mobile apps", kosmi: "Yes, plus a mobile app" },
          },
          {
            feature: "Room size",
            values: { anidachi: "Plus up to 6, Pro up to 15", kosmi: "Not stated" },
          },
          {
            feature: "Free tier",
            values: {
              anidachi: PRICING_FREE_TIER_TABLE,
              kosmi: "Free; optional Premium (price not stated)",
            },
          },
          {
            feature: "Async catch-up",
            values: { anidachi: "Coming soon", kosmi: "Not stated" },
          },
        ]}
      />

      <h2
        id="when-kosmi"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When Kosmi is the better pick
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>
          Someone in your group cannot install a Chrome extension, for example on a work
          laptop.
        </li>
        <li>
          Friends join from phones or tablets. AniDachi runs in desktop Chrome only.
        </li>
        <li>You want to host for free. AniDachi hosts need Plus or Pro.</li>
        <li>
          You want to watch Disney+, Hulu or Prime Video together, which AniDachi does
          not support.
        </li>
        <li>
          The night is more hangout than show: screen sharing, a shared browser, poker or
          retro games in the same room.
        </li>
      </ul>

      <h2
        id="when-anidachi"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When AniDachi is the better pick
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>
          Your group watches anime on Crunchyroll, which the Kosmi pages we checked do
          not mention.
        </li>
        <li>
          You want everyone on their own Crunchyroll, YouTube or Netflix player, synced,
          instead of watching a shared browser or screen share.
        </li>
        <li>You want chat and reactions on the player you are watching.</li>
        <li>You want a personal watch history of what you watched together.</li>
        <li>
          One host pays and friends join free, in rooms of up to 6 (Plus) or 15 (Pro).
        </li>
      </ul>

      <h2 id="sources" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Sources
      </h2>
      <p className="text-foreground/80 mb-8">
        Competitor details checked 19 Oct 2026 from Kosmi&apos;s own site:{" "}
        {KOSMI_SOURCES.map((source, index) => (
          <span key={source.href}>
            {index > 0 ? ", " : null}
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-orange hover:underline"
            >
              {source.label}
            </a>
          </span>
        ))}
        . &quot;Listed by Kosmi&quot; means Kosmi names the service on those pages; we
        did not test it. &quot;Not stated&quot; means we did not find the detail there.
      </p>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link href="/watch-party-app" className="hover:underline">
            AniDachi watch party app
          </Link>
        </li>
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll together
          </Link>
        </li>
        <li>
          <Link href="/netflix-watch-party" className="hover:underline">
            Netflix watch party
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
          </Link>
        </li>
        <li>
          <Link href="/guides/best-watch-party-apps-for-anime" className="hover:underline">
            Watch party apps for anime
          </Link>
        </li>
        <li>
          <Link href="/pricing" className="hover:underline">
            See pricing and start checkout
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}
