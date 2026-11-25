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
  title: "Watch YouTube Together: YouTube Watch Party",
  description:
    "Watch YouTube together in sync: a YouTube watch party in desktop Chrome with chat, voice and video on any full video page. Friends join free.",
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

    title: "Watch YouTube Together: YouTube Watch Party",
    description:
      "Create a YouTube watch party from the Chrome Web Store. Live sync on full videos.",
    url: "/watch-youtube-together",
  },
  twitter: {
    images: ["/opengraph-image.png"],
    card: "summary_large_image",
    title: "Watch YouTube Together: YouTube Watch Party",
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
      "Yes. Teleparty is free on YouTube with synced playback and text chat; its voice and video chat need Premium ($6.59 a month when we checked on November 23, 2026). AniDachi includes calls in every room.",
  },
  {
    question: "Does a YouTube watch party work on Shorts?",
    answer:
      "Not with AniDachi. Rooms work on full youtube.com/watch pages in desktop Chrome, not on Shorts, embedded players or the YouTube phone app.",
  },
  {
    question: "Do all viewers need a YouTube account?",
    answer:
      "Most public videos play without signing in, but each person needs their own browser tab on the full watch page. AniDachi does not re-stream the video. Signing in keeps each person's own settings and YouTube Premium.",
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
  { id: "with-friends", label: "How to watch YouTube with friends online", level: 2 },
  { id: "no-native", label: "Does YouTube have a watch party?", level: 2 },
  { id: "watch2gether-or-anidachi", label: "Watch2Gether or AniDachi?", level: 2 },
  { id: "compare-methods", label: "Compare methods", level: 2 },
  { id: "extension", label: "YouTube watch party extension", level: 2 },
  { id: "start-here", label: "Start here", level: 2 },
  { id: "anidachi-difference", label: "What makes AniDachi different", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const startHereItemList = [
  {
    name: "How to stream YouTube on Discord",
    url: "/guides/can-you-screen-share-youtube-on-discord",
    position: 1,
  },
  {
    name: "Best apps to watch YouTube together",
    url: "/guides/best-apps-to-watch-youtube-together",
    position: 2,
  },
  {
    name: "Teleparty not working on YouTube?",
    url: "/guides/teleparty-not-working-youtube",
    position: 3,
  },
  {
    name: "Best Teleparty alternatives",
    url: "/guides/best-teleparty-alternatives-for-anime#youtube",
    position: 4,
  },
  {
    name: "Discord watch party",
    url: "/discord-watch-party",
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
        title="Watch YouTube Together: YouTube Watch Party"
        description="The complete guide to YouTube watch parties: live sync, chat, and every alternative compared."
        url={PAGE_PATH}
        datePublished="2026-07-25"
        dateModified="2026-11-24"
        faq={faq}
        headings={tocHeadings}
        itemList={startHereItemList}
        articleImage={articleImageAbsolute}
        h1="Watch YouTube Together: YouTube Watch Party"
        heroLead="Everyone watches on their own YouTube tab and account. AniDachi keeps play, pause and seeking in sync, with chat and calls on top."
        heroCtaLabel="Start a YouTube Watch Party"
        heroWorksOn={["YouTube", "Crunchyroll", "Netflix"]}
        heroFinePrint="20 free minutes a day. Friends join free."
        answer={
          <>
            <strong>
              To watch YouTube together, install AniDachi in desktop Chrome,
              open the video on youtube.com/watch, choose Create room and send
              the invite: that starts a YouTube watch party. Everyone watches on
              their own player, and play, pause and seeking stay in sync.
            </strong>{" "}
            Step-by-step:{" "}
            <a href="#with-friends">how to watch YouTube with friends online</a>.
          </>
        }
        steps={{
          id: "step-by-step",
          heading: "How to Watch YouTube Together",
          items: howToSteps,
        }}
      >
        <h2 id="with-friends" className="scroll-mt-24">
          How to Watch YouTube with Friends Online
        </h2>
        <p>
          To watch YouTube with friends online, everyone opens the same video on a
          full youtube.com/watch page in desktop Chrome. One person hosts an
          AniDachi room and sends the invite link. Friends join free, and the room
          keeps every player on the same moment, with chat, reactions, and voice
          and video calls.
        </p>
        <p>
          Most public videos play without signing in, but signing in keeps each
          person&apos;s own settings and YouTube Premium, so nobody sees ads they
          already pay to skip. Rooms don&apos;t work on Shorts, embedded players or
          the YouTube phone app. AniDachi is a{" "}
          <Link href="/">watch party app</Link> that also runs Crunchyroll and
          Netflix rooms, so a group can stay in one room format across services.
        </p>

        <h2 id="no-native" className="scroll-mt-24">
          Does YouTube Have a Watch Party?
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

        <h2 id="watch2gether-or-anidachi" className="scroll-mt-24">
          Watch2Gether or AniDachi for YouTube?
        </h2>
        <p>
          Both keep a YouTube video in sync for friends. Which one fits
          depends on your group.
        </p>
        <p>
          <strong>Pick Watch2Gether if your friends won&apos;t install
          anything.</strong> Its rooms open in the browser with no account,
          and it has webcam and audio chat built in. The free site shows
          Watch2Gether&apos;s own banner ads, and its{" "}
          <a href="https://w2g.tv/en/upgrade/" rel="noopener noreferrer" target="_blank">
            upgrade page
          </a>{" "}
          says YouTube&apos;s own ads may still play inside a room even on
          its paid plan. Its{" "}
          <a
            href="https://community.w2g.tv/t/faq-why-wont-age-restricted-content-play-in-w2g/149401"
            rel="noopener noreferrer"
            target="_blank"
          >
            help page
          </a>{" "}
          (from 2021) says age-restricted YouTube videos don&apos;t play in
          its embedded player without its W2gSync add-on. Watch2Gether
          details were checked on its own pages on 19 Nov 2026.
        </p>
        <p>
          <strong>Pick AniDachi if everyone is on a computer with
          Chrome.</strong> Each person watches on their own youtube.com tab,
          signed in to their own account, so their own YouTube settings and
          YouTube Premium apply. Chat, reactions, camera and mic sit on top
          of the player, and the same room also works for Crunchyroll and
          Netflix. Hosting is free for 20 minutes a day, and friends join
          free. The full side-by-side is in{" "}
          <Link href="/guides/watch2gether-alternatives-for-anime">Watch2Gether alternatives</Link>.
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
              feature: "Join without installing anything",
              values: {
                anidachi: "no",
                w2g: "Yes (browser)",
                teleparty: "no",
                discord: "Browser or app",
              },
            },
            {
              feature: "Each person watches on youtube.com itself",
              values: {
                anidachi: "yes",
                w2g: "no",
                teleparty: "yes",
                discord: "no",
              },
            },
            {
              feature: "Price",
              values: {
                anidachi: PRICING_PLUS_PRICE_LINE,
                w2g: "Free + paid",
                teleparty: "Free on YouTube; calls need Premium",
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
          <Link href="/guides/watch2gether-alternatives-for-anime">
            Watch2Gether alternatives
          </Link>
          . If your group already meets in Discord, the{" "}
          <Link href="/discord-watch-party">Discord watch party guide</Link>{" "}
          compares Watch Together, Go Live and a synced extension.
        </p>

        <h2 id="extension" className="scroll-mt-24">
          YouTube Watch Party Extension
        </h2>
        <p>
          A YouTube watch party extension adds a shared room to each
          person&apos;s own YouTube tab. It keeps play, pause and seeking in step,
          so nobody watches a compressed copy of someone else&apos;s screen.
          AniDachi is one, installed from the Chrome Web Store; Teleparty is
          another, free on YouTube with text chat.
        </p>
        <p>
          With AniDachi, chat, reactions and calls sit on top of the player, and
          the same extension works on Crunchyroll and Netflix. It needs desktop
          Chrome and a full youtube.com/watch page. If your friends won&apos;t
          install anything, a room site such as Watch2Gether is the better fit;
          see <a href="#watch2gether-or-anidachi">Watch2Gether or AniDachi</a>.
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
            { href: "/guides/teleparty-not-working-youtube", label: "Does Teleparty work with YouTube?" },
            { href: "/guides/watch2gether-alternatives-for-anime", label: "Watch2Gether alternatives" },
            { href: "/guides/rave-alternatives-for-youtube", label: "Rave alternatives" },
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
