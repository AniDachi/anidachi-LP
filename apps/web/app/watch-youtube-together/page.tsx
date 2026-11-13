import type { Metadata } from "next";
import { languageAlternates } from "@/lib/hreflang";
import Link from "next/link";
import { getPlanPolicy } from "@anidachi/protocol";
import { HubCtaBand } from "@/components/hub-cta-band";
import {
  HUB_INSTALL_STEP,
  HubFeatureGrid,
  HubLandingLayout,
} from "@/components/hub-landing-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoGuideRelated } from "@/components/seo-guide-blocks";
import type { TocHeading } from "@/components/table-of-contents";
import { getSeoSiteOrigin } from "@/lib/site-url";
import {
  PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
  PRICING_PLUS_PRICE_LINE,
} from "@/lib/pricing-copy";

const PAGE_PATH = "/watch-youtube-together";

const SITE_URL = getSeoSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "YouTube Watch Party: Watch YouTube Together",
  description:
    "YouTube watch party hub: Add AniDachi from the Chrome Web Store, open a full youtube.com/watch page, and sync with friends. Teleparty and Discord compared.",
  alternates: languageAlternates({ en: "/watch-youtube-together", de: "/de/youtube-watchparty" }, "en"),
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "YouTube Watch Party: Watch YouTube Together",
    description:
      "Create a YouTube watch party from the Chrome Web Store. Live sync on full videos.",
    url: "/watch-youtube-together",
  },
  twitter: {
    images: ["/opengraph-image.png"],
    card: "summary_large_image",
    title: "YouTube Watch Party: Watch YouTube Together",
    description:
      "Live YouTube rooms with AniDachi. Free friends join a Free, Plus, or Pro host.",
  },
};

const faq = [
  {
    question: "Does YouTube have a watch party feature?",
    answer:
      "YouTube supports SharePlay on iPhone and iPad, with a Premium member starting the session. On desktop there is no watch-together button for regular videos, so groups use AniDachi, Watch2Gether or Teleparty for live sync.",
  },
  {
    question: "What is the best app to watch YouTube with friends?",
    answer:
      "On desktop Chrome, AniDachi is an extension that syncs YouTube, Crunchyroll and Netflix, with chat, voice and video in the room. Watch2Gether is a free browser room where you paste a YouTube link. Teleparty is an extension many people already use for Netflix. On iPhone and iPad, YouTube supports SharePlay; the person starting the session needs YouTube Premium.",
  },
  {
    question: "How do I watch YouTube together with friends?",
    answer:
      "Install AniDachi and open a full youtube.com/watch page. A Free, Plus or Pro host chooses Create room and shares the invite; friends join free. Everyone watches on their own YouTube player with live sync and chat. Shorts, embeds and the homepage feed are not supported.",
  },
  {
    question: "Is there a YouTube watch party extension?",
    answer:
      "Yes. AniDachi is a Chrome extension from the Chrome Web Store. It syncs full youtube.com/watch pages, not Shorts, embeds or the homepage feed.",
  },
  {
    question: "Is AniDachi free for YouTube watch parties?",
    answer: PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
  },
  {
    question: "Does Teleparty work with YouTube?",
    answer:
      "Yes, for live sync. AniDachi also runs live YouTube rooms today; async catch-up is planned.",
  },
  {
    question: "Can you watch YouTube together asynchronously?",
    answer:
      "You can watch separately and discuss the video later. AniDachi rooms sync live playback; async catch-up with replayed reactions is planned.",
  },
  {
    question: "What is a watch party?",
    answer:
      "A watch party is watching the same video at the same time with people in other places. Each person plays it on their own screen, a tool keeps play and pause in sync, and you chat or talk while you watch.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "step-by-step", label: "How it works", level: 2 },
  { id: "no-native", label: "Watching together on desktop", level: 2 },
  { id: "compare-methods", label: "Compare methods", level: 2 },
  { id: "start-here", label: "Start here", level: 2 },
  { id: "anidachi-difference", label: "What makes AniDachi different", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const startHereItemList = [
  {
    name: "How to watch YouTube with friends",
    url: "/guides/how-to-watch-youtube-with-friends",
    position: 1,
  },
  {
    name: "Can you screen share YouTube on Discord?",
    url: "/guides/can-you-screen-share-youtube-on-discord",
    position: 2,
  },
  {
    name: "Free YouTube watch party options",
    url: "/guides/youtube-watch-party-free",
    position: 3,
  },
  {
    name: "Best Teleparty alternatives for YouTube",
    url: "/guides/best-teleparty-alternatives-for-youtube",
    position: 4,
  },
  {
    name: "How to host a YouTube watch party",
    url: "/guides/how-to-host-a-youtube-watch-party",
    position: 5,
  },
];

/** One step list for the visible "How it works" section and the HowTo JSON-LD, so they always match. */
const howToSteps = [
  HUB_INSTALL_STEP,
  {
    name: "Open a YouTube watch page",
    text: "Go to a full youtube.com/watch page in desktop Chrome, not Shorts, embeds or the homepage feed.",
  },
  {
    name: "Create a room and invite friends",
    text: "With Free, Plus or Pro access, choose Create room and share the invite link. Friends join free.",
  },
  {
    name: "Watch together",
    text: "Friends open the same video on their own YouTube players. Playback stays in sync, with live chat and reactions.",
  },
];

export default function WatchYoutubeTogetherPage() {
  return (
    <>
      <HowToJsonLd
        name="How to host a YouTube watch party with AniDachi"
        description="Set up a YouTube watchroom with AniDachi for synced live co-watching."
        steps={howToSteps}
      />
      <HubLandingLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: PAGE_PATH },
        ]}
        title="YouTube Watch Party: Watch YouTube Together"
        description="The complete guide to YouTube watch parties: live sync, chat, and every alternative compared."
        url={PAGE_PATH}
        datePublished="2026-07-25"
        dateModified="2026-11-07"
        faq={faq}
        headings={tocHeadings}
        itemList={startHereItemList}
        articleImage={articleImageAbsolute}
        h1="YouTube Watch Party: Watch YouTube Together"
        heroLead="YouTube on desktop has no watch party. AniDachi adds one."
        heroCtaLabel="Start a YouTube Watch Party"
        heroWorksOn={["YouTube", "Crunchyroll", "Netflix"]}
        heroFinePrint="20 free minutes a day. Friends join free."
        answer={
          <>
            <strong>
              To host a YouTube watch party, install AniDachi in desktop Chrome,
              open the video on youtube.com/watch, choose Create room and send
              the invite. Everyone watches on their own player, and play, pause
              and seeking stay in sync.
            </strong>{" "}
            Step-by-step:{" "}
            <Link href="/guides/how-to-watch-youtube-with-friends">
              how to watch YouTube with friends
            </Link>
            .
          </>
        }
        steps={{
          id: "step-by-step",
          heading: "How to Watch YouTube Together",
          items: howToSteps,
        }}
      >
        <h2 id="no-native" className="scroll-mt-24">
          Watching YouTube Together on Desktop
        </h2>
        <p>
          YouTube has no built-in watch-together button for regular videos on
          desktop. On iPhone and iPad,{" "}
          <a
            href="https://support.google.com/youtube/answer/13323543"
            rel="noopener noreferrer"
            target="_blank"
          >
            SharePlay
          </a>{" "}
          is an option when the person starting the session has YouTube
          Premium. On desktop, people use extensions or room sites. AniDachi
          runs on full <strong>youtube.com/watch</strong> pages (not Shorts,
          embeds or the homepage feed) and adds the same watchroom it uses for{" "}
          <Link href="/watch-crunchyroll-together">Crunchyroll</Link>.
        </p>

        <h2 id="compare-methods" className="scroll-mt-24">
          Best Ways to Run a YouTube Watch Party
        </h2>
        <p>How the main options compare for a YouTube night:</p>
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
              feature: "Full YouTube quality",
              values: {
                anidachi: "yes",
                w2g: "yes",
                teleparty: "yes",
                discord: "Compressed if Go Live",
              },
            },
            {
              feature: "How it runs",
              values: {
                anidachi: "Chrome extension",
                w2g: "Web room",
                teleparty: "Chrome extension",
                discord: "App",
              },
            },
            {
              feature: "Price",
              values: {
                anidachi: PRICING_PLUS_PRICE_LINE,
                w2g: "Free + paid",
                teleparty: "Freemium",
                discord: "Free",
              },
            },
          ]}
        />
        <p className="mt-6">
          More detail:{" "}
          <Link href="/guides/best-apps-to-watch-youtube-together">
            best apps to watch YouTube together
          </Link>{" "}
          and{" "}
          <Link href="/guides/watch2gether-alternatives-for-youtube">
            Watch2Gether alternatives for YouTube
          </Link>
          . If your group already meets in Discord, the{" "}
          <Link href="/discord-watch-party">Discord watch party guide</Link>{" "}
          compares Watch Together, Go Live and a synced extension.
        </p>

        <HubCtaBand
          pagePath={PAGE_PATH}
          ctaLabel="Start a YouTube Watch Party"
          heading="Start your YouTube watch party"
          body="Install AniDachi, open a video and send the invite. 20 free minutes a day, and friends join free."
        />

        <h2 id="start-here" className="scroll-mt-24">
          Start Here
        </h2>
        <SeoGuideRelated
          links={startHereItemList.map((item) => ({ href: item.url, label: item.name }))}
        />

        <h2 id="anidachi-difference" className="scroll-mt-24">
          What Makes AniDachi Different for YouTube
        </h2>
        <HubFeatureGrid
          items={[
            {
              title: "One extension, three platforms",
              body: (
                <>
                  The same watchroom works on YouTube, on{" "}
                  <Link href="/watch-crunchyroll-together">Crunchyroll</Link> and
                  for a <Link href="/netflix-watch-party">Netflix watch party</Link>.
                  Friends install it once.
                </>
              ),
            },
            {
              title: "Chat, reactions, camera and mic",
              body: "Everything happens on top of the YouTube player, so nobody needs a second app open to talk.",
            },
            {
              title: "Rooms that fit your group",
              body: `Free rooms hold up to ${getPlanPolicy("free").maxParticipants} people, including you. Plus holds ${getPlanPolicy("plus").maxParticipants} and Pro holds ${getPlanPolicy("pro").maxParticipants}. Friends join free.`,
            },
            {
              title: "Your own watch history",
              body: "With Plus or Pro, recording permission and the YouTube recording toggle on, AniDachi keeps your own history of videos watched in rooms.",
            },
          ]}
        />
        <p className="text-sm">
          Not here yet: async catch-up, for friends who watch at different
          times, is planned and not available today.
        </p>

        <h2 id="related" className="scroll-mt-24">
          Related Guides
        </h2>
        <SeoGuideRelated
          className="divide-y-0 sm:grid sm:grid-cols-2 sm:gap-x-10 [&>li]:border-b [&>li]:border-ani-line"
          links={[
            { href: "/guides/youtube-watch-party-chrome-extension", label: "YouTube watch party Chrome extension" },
            { href: "/guides/does-youtube-have-watch-party", label: "Does YouTube have a watch party?" },
            { href: "/guides/does-teleparty-work-with-youtube", label: "Does Teleparty work with YouTube?" },
            { href: "/guides/youtube-group-watch", label: "YouTube group watch" },
            { href: "/compare/anidachi-vs-watch2gether", label: "AniDachi vs Watch2Gether" },
            { href: "/watch-youtube-together-long-distance", label: "Watch YouTube together long distance" },
            { href: "/netflix-watch-party", label: "Netflix watch party" },
            { href: "/prime-video-watch-party", label: "Prime Video watch party" },
            { href: "/watch-anime-together", label: "Watch anime together" },
            { href: "/pricing", label: "AniDachi pricing" },
          ]}
        />
      </HubLandingLayout>
    </>
  );
}
