import type { Metadata } from "next";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getSeoSiteOrigin } from "@/lib/site-url";

/**
 * Prime Video on Discord (ANI-52 step 1, owner-approved 2026-11-11). Prime Video is NOT a supported
 * AniDachi platform yet: the steps below work without AniDachi. On launch day, add the AniDachi
 * route to the steps and the comparison table.
 */
const PAGE_PATH = "/guides/how-to-stream-prime-video-on-discord";
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const PAGE_TITLE = "How to Stream Prime Video on Discord (Black Screen Fix)";

const SOURCES = [
  {
    href: "https://support.discord.com/hc/en-us/articles/360040816151-Go-Live-and-Screen-Share",
    label: "Discord: Go Live and Screen Share",
  },
  {
    href: "https://support.discord.com/hc/en-us/articles/360058862134--Mobile-Screenshare-FAQ",
    label: "Discord: Mobile Screenshare FAQ",
  },
  { href: "https://www.primevideo.com/help?nodeId=G202095490", label: "Prime Video Terms of Use" },
  { href: "https://www.primevideo.com/help?nodeId=G202095500", label: "Prime Video Usage Rules" },
  { href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
];

const howToSteps = [
  {
    name: "Stay in the Discord call for voice",
    text: "Keep the voice channel, DM call or group call you already use. Don't start Go Live on the Prime Video tab; Discord only carries your voices.",
  },
  {
    name: "Open the same title on your own Prime Video",
    text: "Each person signs in to their own Amazon account and opens the same movie or episode. Check the episode number out loud, and check that the title is available in everyone's country.",
  },
  {
    name: "Sync the players",
    text: "Use a browser extension that lists Prime Video support, such as Teleparty, so play, pause and seek stay together. Without one, count down in the call and press play at the same moment.",
  },
];

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Prime Video goes black on Discord because it is DRM-protected. Why it happens, what people try, mobile limits, and how to watch together with Discord voice.",
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Why Prime Video shows a black screen on Discord, and how to keep Discord for voice while everyone watches on their own account.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "Why Prime Video goes black on Discord, and the way to watch together that works.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do you stream Prime Video on Discord without a black screen?",
    answer:
      "There's no supported way. Prime Video protects its video with DRM, so Discord's capture usually shows black. Keep Discord for voice and have each person play the title on their own Amazon account, kept together with a sync extension or a countdown.",
  },
  {
    question: "Why is Prime Video a black screen on Discord?",
    answer:
      "Discord's Go Live records the pixels of a window or screen. Prime Video plays through a digital rights management (DRM) system, and protected video is withheld from that capture, so friends see black while the audio may still come through.",
  },
  {
    question: "Can you screen share Prime Video on Discord mobile?",
    answer:
      "Don't count on it. Discord's Mobile Screenshare FAQ says some streaming apps don't allow screenshare or audioshare and that Discord doesn't support sharing them. Prime Video protects its video the same way. Join the call on your phone and watch on your own device.",
  },
  {
    question: "Is it against Prime Video's rules to stream it on Discord?",
    answer:
      "We can't give legal advice. Prime Video's Terms of Use license the content for personal, non-commercial, private use and forbid broadcasting it or circumventing its DRM. Watching on each person's own account avoids that problem.",
  },
  {
    question: "Can friends share one Amazon account to watch together?",
    answer:
      "Only two of you on the same title. Prime Video's Usage Rules allow up to three streams at once per Amazon account, but the same video on no more than two devices at a time.",
  },
  {
    question: "Does AniDachi work for Prime Video on Discord?",
    answer:
      "Not yet. AniDachi's Prime Video support is coming in an update. Today it syncs Crunchyroll, Netflix and YouTube in desktop Chrome, with its own voice and video calls, so groups can use it alongside Discord for those.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "why-black", label: "Why Prime Video goes black", level: 2 },
  { id: "what-people-try", label: "What people try", level: 2 },
  { id: "watch-together", label: "Watch together instead", level: 2 },
  { id: "compare", label: "Screen share vs own accounts", level: 2 },
  { id: "mobile", label: "Prime Video on Discord mobile", level: 2 },
  { id: "anidachi", label: "AniDachi and Prime Video", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToStreamPrimeVideoOnDiscordPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch Prime Video together on Discord without screen share"
        description="Keep Discord for voice and have each person play the same Prime Video title on their own account, kept in sync."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Prime Video Watch Party", url: "/prime-video-watch-party" },
          { name: "Stream Prime Video on Discord", url: PAGE_PATH },
        ]}
        title="How to stream Prime Video on Discord"
        description="Why Prime Video shows a black screen on Discord, what people try, and how to watch together with Discord for voice."
        url={PAGE_PATH}
        datePublished="2026-11-11"
        dateModified="2026-11-11"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        ctaCopy="guide"
        aboveFoldCta
      >
        <SeoGuideTitle>How to Stream Prime Video on Discord (and Fix the Black Screen)</SeoGuideTitle>
        <h2 id="answer" className="scroll-mt-24">
          Short answer
        </h2>
        <SeoGuideAnswer>
          <p>
            <strong>
              You usually can&apos;t. Prime Video is DRM-protected, so when you
              share it with Discord Go Live, friends see a black screen and
              sometimes hear only the audio. The setup that works: stay in the
              Discord call for voice, and have each person play the same title
              on their own Amazon account, kept in sync by a watch-party
              extension or a countdown.
            </strong>{" "}
            Prime Video itself has had no watch party since 2024; see{" "}
            <Link href="/prime-video-watch-party">Prime Video watch party</Link>{" "}
            for the options.
          </p>
        </SeoGuideAnswer>

        <h2 id="why-black" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Why Prime Video goes black on Discord
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Discord&apos;s Go Live and Screen Share record the pixels of an app
          window or your whole screen, encode them as video and send that stream
          to everyone in the call. That works for a game or a browser tab with
          an article.
        </p>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Prime Video plays through a digital rights management (DRM) system,
          and protected video is decoded in a way screen capture isn&apos;t
          allowed to read. Discord captures everything around the player
          (subtitles, the progress bar, your cursor) and a black rectangle where
          the picture should be. Audio is handled separately, which is why
          friends often hear the film but can&apos;t see it. The same thing
          happens with{" "}
          <Link href="/guides/how-to-screen-share-netflix-on-discord">
            Netflix on Discord
          </Link>
          . Reinstalling Discord or changing its permissions won&apos;t change
          it.
        </p>

        <h2 id="what-people-try" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          What people try, and the limits
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "Turning off hardware acceleration",
              body: "Some people report the picture appears after changing this setting in the browser or in Discord. It depends on the browser version, can stop working after an update, and can make playback worse. We don't give steps for it.",
            },
            {
              title: "Sharing the whole screen instead of the window",
              body: "Capturing the full screen doesn't change how protected video is handled. Most of the time the result is the same black rectangle, with your desktop around it.",
            },
            {
              title: "Extensions that force software DRM, or recording tools",
              body: "Anything built to get around content protection is outside what Amazon allows. Prime Video's Terms of Use forbid circumventing its digital rights management or broadcasting the content.",
            },
          ]}
        />
        <SeoGuideNote>
          Even when a share shows a picture, it has the limits of any Go Live
          stream: one person&apos;s upload carries the film for everyone,
          standard streams are capped at 720p and 30 fps (Nitro raises that),
          and only the streamer can pause or skip.
        </SeoGuideNote>

        <h2 id="watch-together" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Watch together instead: voice in Discord, video on your own account
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Stop sending the video through Discord. Discord keeps doing what
          it&apos;s good at, which is voice, and each person plays the film on
          their own Prime Video at full quality. Nobody captures anything, so
          there&apos;s nothing to go black.
        </p>
        <SeoGuideSteps steps={howToSteps} />
        <p className="mb-8 leading-relaxed text-ani-muted">
          Teleparty&apos;s FAQ lists Prime Video among the services its free
          version can host, with video sync and text chat. Like every sync
          tool, it needs each viewer to have their own access to Prime Video.
        </p>

        <h2 id="compare" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Discord screen share vs watching on your own accounts
        </h2>
        <ResponsiveCompareTable
          columns={[
            { id: "share", label: "Discord screen share" },
            { id: "own", label: "Discord voice + own accounts", highlight: true },
          ]}
          rows={[
            {
              feature: "Picture on Prime Video",
              values: {
                share: "Usually black (DRM-protected video)",
                own: "Each person's own Prime Video player",
              },
            },
            {
              feature: "Picture quality",
              values: {
                share: "Up to 720p/30fps; higher with Nitro",
                own: "Whatever each person's connection allows",
              },
            },
            {
              feature: "Staying in sync",
              values: {
                share: "Viewers watch an encoded copy behind the streamer",
                own: "With a sync extension; a countdown drifts after pauses",
              },
            },
            {
              feature: "Does everyone need Prime Video?",
              values: {
                share: "Only the streamer, but the terms forbid broadcasting",
                own: "Yes; one account plays a title on two devices at most",
              },
            },
            {
              feature: "What the host uploads",
              values: {
                share: "The whole film, for every viewer",
                own: "No video; Prime Video streams to each person",
              },
            },
          ]}
        />

        <h2 id="mobile" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How to stream Prime Video on Discord mobile
        </h2>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Don&apos;t count on it. Discord&apos;s Mobile Screenshare FAQ says some
          streaming apps don&apos;t allow screenshare or audioshare, and that
          Discord doesn&apos;t support sharing them. Prime Video protects its
          video the same way. What works is splitting the devices: join the
          Discord call on your phone, and play Prime Video on your own laptop,
          TV or tablet at the same moment as everyone else.
        </p>

        <h2 id="anidachi" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          AniDachi and Prime Video
        </h2>
        <p className="mb-8 leading-relaxed text-ani-muted">
          AniDachi&apos;s Prime Video support is coming in an update. Today it
          syncs Crunchyroll, Netflix and YouTube in desktop Chrome, with its own
          voice and video calls, so a Discord call is optional for those. If
          your group watches anime on Discord, start with{" "}
          <Link href="/guides/can-you-screen-share-crunchyroll-on-discord">
            Crunchyroll on Discord
          </Link>
          ; for the general setup, see{" "}
          <Link href="/discord-watch-party">Discord watch party</Link>.
        </p>

        <h2 id="sources" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Sources
        </h2>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Prime Video and Teleparty details checked 11 Nov 2026; Discord details
          checked 20 Oct 2026:{" "}
          {SOURCES.map((source, index) => (
            <span key={source.href}>
              {index > 0 ? ", " : null}
              <a href={source.href} target="_blank" rel="noopener noreferrer">
                {source.label}
              </a>
            </span>
          ))}
          . AniDachi is not affiliated with Amazon, Prime Video, Discord or
          Teleparty.
        </p>

        <SeoGuideRelated
          links={[
            { href: "/prime-video-watch-party", label: "Prime Video watch party" },
            { href: "/discord-watch-party", label: "Discord watch party" },
            {
              href: "/guides/how-to-screen-share-netflix-on-discord",
              label: "How to stream Netflix on Discord",
            },
            {
              href: "/guides/discord-screen-share-black-screen",
              label: "Discord screen share black screen",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
