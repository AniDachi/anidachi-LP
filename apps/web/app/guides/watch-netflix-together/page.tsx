import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getSeoSiteOrigin } from "@/lib/site-url";

const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const PAGE_TITLE = "Watch Netflix Together: 4 Ways Compared";
const PAGE_DESCRIPTION =
  "Four ways to watch Netflix together online: a countdown on a call, Discord screen share, Teleparty and AniDachi. Pros, cons and a decision table for 2026.";

export const metadata: Metadata = {
  title: "Watch Netflix Together: 4 Ways Compared",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/guides/watch-netflix-together" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/guides/watch-netflix-together",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How can I watch Netflix together with someone far away?",
    answer:
      "Each of you opens the same title on your own Netflix account, then you keep the players in sync. A countdown on a call works for short films; a sync extension such as AniDachi or Teleparty keeps you together through pauses and buffering.",
  },
  {
    question: "Can you watch Netflix together for free?",
    answer:
      "Yes, if everyone already has Netflix. A countdown on a video call costs nothing, and Teleparty's free tier syncs Netflix with text chat. AniDachi is free to join, but the host needs Plus or Pro, including a 3-day trial for eligible accounts.",
  },
  {
    question: "Why is Netflix black when I share my screen?",
    answer:
      "Netflix protects its video from capture, so screen sharing in Discord, Zoom or similar apps often shows a black box to viewers. Syncing each person's own Netflix player avoids the problem.",
  },
  {
    question: "Is there a way to watch Netflix together with video chat?",
    answer:
      "Yes. AniDachi rooms include voice and video on top of synced Netflix playback, with up to four cameras on at once. Teleparty also offers video chat, on its Premium plan.",
  },
  {
    question: "Can we watch Netflix together on our phones?",
    answer:
      "Not with AniDachi, which runs in desktop Chrome only. Teleparty lists Android and iOS apps, and a countdown on a call works on any device.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "decision", label: "Decision table", level: 2 },
  { id: "countdown", label: "Countdown on a call", level: 2 },
  { id: "discord", label: "Discord screen share", level: 2 },
  { id: "teleparty", label: "Teleparty", level: 2 },
  { id: "anidachi", label: "AniDachi", level: 2 },
  { id: "pick", label: "Which one to pick", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function WatchNetflixTogetherPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        { name: "Watch Netflix together", url: "/guides/watch-netflix-together" },
      ]}
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      url="/guides/watch-netflix-together"
      datePublished="2026-10-08"
      dateModified="2026-10-20"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Watch Netflix Together: 4 Ways Compared</SeoGuideTitle>
      <SeoGuideAnswer id="answer">
        <p>
          <strong>
            There are four common ways to watch Netflix together: press play on a
            countdown during a call, share a screen on Discord, use Teleparty, or use
            AniDachi. Only the last two keep playback synced automatically, and every
            method works best when each person has their own Netflix.
          </strong>{" "}
          The table below shows the trade-offs.
        </p>
      </SeoGuideAnswer>

      <h2 id="decision" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Decision table
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Teleparty details are from its support FAQ, checked October 20, 2026.
        Discord and countdown rows describe how those setups behave in general, not
        a specific product plan.
      </p>
      <ResponsiveCompareTable
        columns={[
          { id: "countdown", label: "Countdown + call" },
          { id: "discord", label: "Discord share" },
          { id: "teleparty", label: "Teleparty" },
          { id: "anidachi", label: "AniDachi", highlight: true },
        ]}
        rows={[
          {
            feature: "Stays in sync by itself",
            values: { countdown: "no", discord: "One shared stream", teleparty: "yes", anidachi: "yes" },
          },
          {
            feature: "Picture quality for viewers",
            values: {
              countdown: "Full",
              discord: "Often black or compressed",
              teleparty: "Full",
              anidachi: "Full",
            },
          },
          {
            feature: "Everyone needs Netflix",
            values: { countdown: "yes", discord: "Only the sharer", teleparty: "yes", anidachi: "yes" },
          },
          {
            feature: "Voice and video",
            values: {
              countdown: "Your call app",
              discord: "yes",
              teleparty: "Premium only",
              anidachi: "Included",
            },
          },
          {
            feature: "Cost beyond Netflix",
            values: {
              countdown: "Free",
              discord: "Free",
              teleparty: "Free; Premium $6.59/mo",
              anidachi: "Free to join; host needs Plus or Pro",
            },
          },
          {
            feature: "Phones",
            values: { countdown: "yes", discord: "yes", teleparty: "yes", anidachi: "no" },
          },
        ]}
      />

      <h2 id="countdown" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        1. A countdown on a video call
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Everyone opens the title, scrubs to 0:00, and someone counts &quot;3, 2,
        1, play&quot;. You talk on FaceTime, WhatsApp, Zoom or a phone call. It is
        the oldest method and needs no installs.
      </p>
      <SeoGuideBulletList
        items={[
          { title: "Pros", body: "Free, works on any device including TVs and phones, nothing to set up." },
          {
            title: "Cons",
            body: "You drift. One buffer or a bathroom break puts you seconds apart, and every pause means another countdown. The call audio can also leak the movie's sound back as an echo, so headphones help.",
          },
          { title: "Best for", body: "Two people, one short film, a spare TV in each home." },
        ]}
      />

      <h2 id="discord" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        2. Sharing Netflix on Discord
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        One person plays Netflix and shares the window or screen with Go Live.
        Everyone else watches that stream. It is tempting because only one person
        needs to press play.
      </p>
      <SeoGuideBulletList
        items={[
          {
            title: "Pros",
            body: "One player controls everything, and the group is already in a voice channel.",
          },
          {
            title: "Cons",
            body: "Netflix often appears as a black screen to viewers because of its copy protection. When it does show, quality depends on the sharer's upload speed and Discord's stream limits. Netflix says accounts are for one household, so friends elsewhere should have their own.",
          },
          { title: "Best for", body: "Voice only. Keep the call on Discord and sync the video another way." },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        The fixes people try, and why they fall short, are in{" "}
        <Link
          href="/guides/how-to-screen-share-netflix-on-discord"
          className="text-brand-orange hover:underline"
        >
          how to stream Netflix on Discord
        </Link>
        .
      </p>

      <h2 id="teleparty" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        3. Teleparty
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Teleparty, formerly <Link href="/netflix-party" className="text-brand-orange hover:underline">Netflix Party</Link>,
        is a browser extension and app that syncs each person&apos;s own Netflix and
        adds a chat sidebar.
      </p>
      <SeoGuideBulletList
        items={[
          {
            title: "Pros",
            body: "Free tier covers Netflix with sync and text chat. Runs in Chrome, Edge, Safari and Opera, with Android and iOS apps. Supports many other services, and parties can be very large.",
          },
          {
            title: "Cons",
            body: "Voice and video chat need Teleparty Premium, so a group that wants to see each other either pays or runs a separate call.",
          },
          { title: "Best for", body: "Mixed devices, big groups, or services beyond Netflix." },
        ]}
      />

      <h2 id="anidachi" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        4. AniDachi
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        AniDachi is a Chrome extension that syncs Netflix movies and episodes, as
        well as Crunchyroll and YouTube, with chat, emoji reactions, voice and
        video on the player.
      </p>
      <SeoGuideBulletList
        items={[
          {
            title: "Pros",
            body: "Voice and video are part of the room, with push-to-talk on the V key. Friends join free. Each viewer gets full Netflix quality from their own account.",
          },
          {
            title: "Cons",
            body: "Desktop Chrome only, no phones. The host needs Plus or Pro (a 3-day trial for eligible accounts). Rooms hold up to 6 people with Plus or 15 with Pro.",
          },
          { title: "Best for", body: "Friends or couples on laptops who want to see and hear each other while they watch." },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        Want to try the fourth option?{" "}
        <InstallLink href="/extension" className="text-brand-orange hover:underline">
          Add AniDachi to Chrome
        </InstallLink>
        , then follow the four steps on the{" "}
        <Link href="/netflix-watch-party" className="text-brand-orange hover:underline">
          Netflix watch party
        </Link>{" "}
        hub.
      </p>

      <h2 id="pick" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Which one to pick
      </h2>
      <SeoGuideOptions
        options={[
          {
            title: "Two laptops, want to see each other",
            body: "AniDachi. Sync and a video call in one place, and only one of you pays to host.",
            highlight: true,
          },
          {
            title: "Someone is on a phone or Safari",
            body: "Teleparty, or a countdown if it is a one-off.",
          },
          {
            title: "Already in a Discord server",
            body: (
              <>
                Keep Discord for voice and sync video with AniDachi or Teleparty. See{" "}
                <Link href="/compare/anidachi-vs-netflix-watch-party">
                  AniDachi vs screen share and countdown
                </Link>{" "}
                for the head-to-head.
              </>
            ),
          },
          {
            title: "Five or more friends",
            body: (
              <>
                Read <Link href="/guides/netflix-group-watch">Netflix group watch</Link>{" "}
                for room size and microphone etiquette before choosing.
              </>
            ),
          },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        Already decided and need the clicks? The step-by-step setup with a
        troubleshooting box is{" "}
        <Link
          href="/guides/how-to-watch-netflix-with-friends"
          className="text-brand-orange hover:underline"
        >
          how to watch Netflix with friends
        </Link>
        . Couples in different cities can also read{" "}
        <Link
          href="/watch-netflix-together-long-distance"
          className="text-brand-orange hover:underline"
        >
          watch Netflix together long distance
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/netflix-watch-party", label: "Netflix watch party hub" },
          {
            href: "/guides/how-to-watch-netflix-with-friends",
            label: "How to watch Netflix with friends, step by step",
          },
          { href: "/guides/does-netflix-have-a-watch-party", label: "Does Netflix have a watch party?" },
          { href: "/compare/anidachi-vs-teleparty", label: "AniDachi vs Teleparty" },
        ]}
      />
      <p className="mt-6 text-sm leading-relaxed text-ani-muted">
        Sources, checked October 20, 2026:{" "}
        <a
          href="https://www.teleparty.com/support"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-orange hover:underline"
        >
          Teleparty support FAQ
        </a>
        ,{" "}
        <a
          href="https://help.netflix.com/en/node/123277"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-orange hover:underline"
        >
          Netflix Help: sharing your account
        </a>
        .
      </p>
    </SeoPageLayout>
  );
}
