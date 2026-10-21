import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { HowToJsonLd } from "@/components/json-ld";
import { InstallLink } from "@/components/install-link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { INSTALL_HOWTO_STEP_TEXT } from "@/lib/install-cta";
import { PRICING_PLUS_SHORT, PRICING_PRO_SHORT } from "@/lib/pricing-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/guides/how-to-screen-share-netflix-on-discord";
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const SOURCES = [
  {
    href: "https://support.discord.com/hc/en-us/articles/360040816151-Go-Live-and-Screen-Share",
    label: "Discord: Go Live and Screen Share",
  },
  {
    href: "https://support.discord.com/hc/en-us/articles/360058862134--Mobile-Screenshare-FAQ",
    label: "Discord: Mobile Screenshare FAQ",
  },
  {
    href: "https://support-apps.discord.com/hc/en-us/articles/26502500234519-Watch-Together-FAQ",
    label: "Discord: Watch Together FAQ",
  },
  {
    href: "https://help.netflix.com/legal/termsofuse",
    label: "Netflix Terms of Use",
  },
  {
    href: "https://help.netflix.com/en/node/27451",
    label: "Netflix Help: error M7701-1003 (Widevine in Chrome)",
  },
];

const howToSteps = [
  {
    name: "Stay in the Discord call for voice",
    text: "Keep the voice channel, DM call or group call you already use. Do not start Go Live on the Netflix tab; Discord is only carrying your voices.",
  },
  {
    name: "Install AniDachi in desktop Chrome",
    text: `${INSTALL_HOWTO_STEP_TEXT} Everyone who watches does this once, from /extension.`,
  },
  {
    name: "Open the same Netflix title on your own account",
    text: "Each person signs in to their own Netflix account in Chrome and opens the same movie or episode watch page.",
  },
  {
    name: "Create the room and paste the invite in Discord",
    text: "The host (Plus, Pro or an active trial) clicks the capsule at the top-right of the player, chooses Create room and pastes the invite in the Discord chat. Friends join free, and play, pause and seek stay in sync.",
  },
];

export const metadata: Metadata = {
  title: { absolute: "How to Stream Netflix on Discord (Black Screen Fix)" },
  description:
    "Netflix goes black on Discord because the video is DRM-protected. Why it happens, what people try, mobile limits, and how to watch in sync with friends.",
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: "How to Stream Netflix on Discord (Black Screen Fix)",
    description:
      "Why Netflix shows a black screen on Discord, and how to keep Discord for voice while everyone watches in sync.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Stream Netflix on Discord (Black Screen Fix)",
    description:
      "Why Netflix goes black on Discord, and the way to watch together that works.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do you stream Netflix on Discord without a black screen?",
    answer:
      "There is no supported way. Netflix video is DRM-protected, so Discord's capture usually shows black. Keep Discord for voice and have each person play the title on their own Netflix account, synced with a watch-party extension such as AniDachi in desktop Chrome.",
  },
  {
    question: "Why is Netflix a black screen on Discord?",
    answer:
      "Netflix plays through protected content decryption (Widevine in Chrome). Discord records the pixels of a window or screen, and protected video is withheld from that capture, so friends see black while audio may still come through.",
  },
  {
    question: "Can you screen share Netflix on Discord mobile?",
    answer:
      "No. Discord's Mobile Screenshare FAQ says Netflix does not allow screenshare or audioshare from its app and that Discord does not support screensharing it. On a phone, use Discord for voice and watch Netflix on a computer or your own device.",
  },
  {
    question: "Is it illegal to stream Netflix on Discord?",
    answer:
      "We can't give legal advice. Netflix's Terms of Use say the service is for personal, non-commercial use and may not be shared outside your household, and they prohibit circumventing content protections. Watching on each person's own account avoids that problem.",
  },
  {
    question: "Does turning off hardware acceleration fix the Netflix black screen?",
    answer:
      "Sometimes people report a different result, but it is not a fix we recommend or document. It depends on how the browser handles protected video, it can change after any update, and working around content protection conflicts with Netflix's terms.",
  },
  {
    question: "Does everyone need Netflix to watch together on Discord?",
    answer:
      "Yes, for a synced watch party. Each person needs their own Netflix access to the same title in their region. With AniDachi, only the host needs Plus, Pro or a trial; friends join the room free.",
  },
  {
    question: "How do you watch movies on Discord with friends?",
    answer:
      "For YouTube videos, Discord's Watch Together activity plays them inside Discord. For Netflix films, keep Discord for voice and sync each person's own Netflix player with AniDachi in desktop Chrome.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "why-black", label: "Why Netflix goes black", level: 2 },
  { id: "what-people-try", label: "What people try", level: 2 },
  { id: "watch-in-sync", label: "Watch in sync instead", level: 2 },
  { id: "compare", label: "Screen share vs AniDachi", level: 2 },
  { id: "mobile", label: "Netflix on Discord mobile", level: 2 },
  { id: "movies", label: "How to watch movies on Discord", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToScreenShareNetflixOnDiscordPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch Netflix together on Discord without screen share"
        description="Keep Discord for voice and sync each person's own Netflix player with AniDachi in desktop Chrome."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Netflix watch party", url: "/netflix-watch-party" },
          { name: "Stream Netflix on Discord", url: PAGE_PATH },
        ]}
        title="How to stream Netflix on Discord"
        description="Why Netflix shows a black screen on Discord, what people try, and how to watch in sync with Discord for voice."
        url={PAGE_PATH}
        datePublished="2026-10-08"
        dateModified="2026-10-20"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>How to Stream Netflix on Discord (and Fix the Black Screen)</SeoGuideTitle>
        <h2 id="answer" className="scroll-mt-24">
          Short answer
        </h2>
        <SeoGuideAnswer>
          <p>
            <strong>
              You usually can&apos;t. Netflix video is DRM-protected, so when you
              share it with Discord Go Live, friends see a black screen and
              sometimes hear only the audio. The setup that works: stay in the
              Discord call for voice, and have each person play the same title
              on their own Netflix account, kept in sync by a watch-party
              extension.
            </strong>{" "}
            AniDachi does that in desktop Chrome, and friends join a{" "}
            <Link href="/netflix-watch-party">Netflix watch party</Link> free.
          </p>
        </SeoGuideAnswer>

        <h2 id="why-black" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Why Netflix goes black on Discord
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Discord&apos;s Go Live and Screen Share work by recording the pixels of
          an app window or your whole screen, encoding them as a video stream
          and sending that stream to everyone watching in the call. That is
          fine for a game, a slideshow or a browser tab with a news article.
        </p>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Netflix is different. In Chrome, Netflix plays through protected
          content decryption: Netflix&apos;s own help pages tell you to keep the
          Widevine Content Decryption Module up to date and to allow sites to
          play protected content. Protected video is decoded in a way that
          screen capture is not allowed to read. So Discord captures everything
          around the player (subtitles, the progress bar, your cursor) and a
          black rectangle where the picture should be. Audio is handled
          separately, which is why friends often hear the movie but can&apos;t
          see it.
        </p>
        <p className="mb-8 leading-relaxed text-ani-muted">
          This is the same reason{" "}
          <Link href="/guides/can-you-screen-share-crunchyroll-on-discord">
            Crunchyroll goes black on Discord
          </Link>
          . It is not a broken Discord install, a missing permission or a bad
          graphics driver. It is the streaming service protecting its video,
          and it is working as intended.
        </p>

        <h2 id="what-people-try" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          What people try, and the limits
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Search for &quot;Netflix black screen Discord&quot; and you&apos;ll
          find the same handful of suggestions. Here is what each one is, and
          why we don&apos;t treat any of them as a fix.
        </p>
        <SeoGuideBulletList
          items={[
            {
              title: "Turning off hardware acceleration",
              body: "Some people report the picture appears after they change this browser setting. It depends on how a particular browser version handles protected video, it can stop working after an update, and it can make playback worse. We don't give steps for it.",
            },
            {
              title: "Sharing the whole screen instead of the window",
              body: "Capturing the full screen instead of the Chrome window does not change how protected video is handled. Most of the time the result is the same black rectangle, just with your desktop around it.",
            },
            {
              title: "Switching browsers or using the Discord web app",
              body: "Results vary by browser and change over time. Netflix also supports only certain browsers, so a browser that shares a picture may not play Netflix well in the first place.",
            },
            {
              title: "Recording tools or virtual cameras",
              body: "Anything designed to get around content protection is outside what Netflix allows. Its Terms of Use prohibit circumventing content protections and say the service may not be shared outside your household.",
            },
          ]}
        />
        <SeoGuideNote>
          Even when a share does show a picture, it has the limits of any Go
          Live stream: one person&apos;s upload carries the movie for everyone,
          Discord caps standard streams at 720p and 30 fps (Nitro raises
          that), and only the streamer can pause or skip. For a whole film,
          the screen share is the wrong tool.
        </SeoGuideNote>

        <h2 id="watch-in-sync" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Watch in sync instead: voice in Discord, video through AniDachi
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          The fix is to stop sending the video through Discord at all. Discord
          keeps doing what it is good at, which is voice. The movie plays on
          each person&apos;s own Netflix account in their own Chrome tab, at
          full quality, and AniDachi keeps those players on the same moment.
          Nobody captures anything, so there is nothing to go black.
        </p>
        <SeoGuideSteps steps={howToSteps} />
        <p className="mb-8 leading-relaxed text-ani-muted">
          Ready to try it? <InstallLink href="/extension">Add AniDachi to Chrome</InstallLink>{" "}
          and open a Netflix movie or episode page. If you&apos;d rather talk
          inside the room, AniDachi has its own voice and video calls with
          push-to-talk (hold V), on-player chat and reactions, so a Discord
          call is optional.
        </p>

        <h2 id="compare" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Discord screen share vs AniDachi for Netflix
        </h2>
        <ResponsiveCompareTable
          columns={[
            { id: "share", label: "Discord screen share" },
            { id: "anidachi", label: "Discord voice + AniDachi", highlight: true },
          ]}
          rows={[
            {
              feature: "Picture on Netflix",
              values: {
                share: "Usually black (DRM-protected video)",
                anidachi: "Each person's own Netflix player",
              },
            },
            {
              feature: "Picture quality",
              values: {
                share: "Up to 720p/30fps; Nitro up to 4K/60fps",
                anidachi: "Whatever each person's Netflix plan and connection allow",
              },
            },
            {
              feature: "Movie audio",
              values: {
                share: "Mixed into the stream; no audio capture on Linux",
                anidachi: "From each person's own player",
              },
            },
            {
              feature: "Lag",
              values: {
                share: "Viewers watch an encoded copy behind the streamer",
                anidachi: "Players kept on the same moment; play, pause and seek sync",
              },
            },
            {
              feature: "Does everyone need Netflix?",
              values: {
                share: "Netflix's terms limit an account to one household",
                anidachi: "Yes, each person uses their own Netflix access",
              },
            },
            {
              feature: "What the host uploads",
              values: {
                share: "The whole movie, for every viewer",
                anidachi: "No video; Netflix streams to each person",
              },
            },
            {
              feature: "Group size",
              values: {
                share: "Up to 50 viewers per Go Live stream",
                anidachi: "Up to 6 people (Plus) or 15 (Pro), host included",
              },
            },
            {
              feature: "Cost",
              values: {
                share: "Free; Nitro for higher quality",
                anidachi: `Friends join free; host needs Plus ${PRICING_PLUS_SHORT}, Pro ${PRICING_PRO_SHORT} or a trial`,
              },
            },
            {
              feature: "Devices",
              values: {
                share: "Desktop, browser and mobile Discord",
                anidachi: "Desktop Chrome only",
              },
            },
          ]}
        />
        <p className="mb-8 leading-relaxed text-ani-muted">
          The trade-off is clear. Screen share costs nothing and works for a
          quick look at a menu or a trailer, but on Netflix it rarely shows a
          picture. AniDachi needs everyone in desktop Chrome with their own
          Netflix access and a host with a paid plan or trial, and in return
          the film looks the way Netflix sends it. For the general Discord
          side of a movie night, see{" "}
          <Link href="/discord-watch-party">Discord watch party</Link>.
        </p>

        <h2 id="mobile" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How to stream Netflix on Discord mobile
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          On a phone the answer is a firm no. Discord&apos;s Mobile Screenshare
          FAQ lists Netflix among the streaming apps that don&apos;t allow
          screenshare or audioshare, and says Discord does not support
          screensharing them. So starting a mobile screen share from the
          Netflix app gets you nothing useful.
        </p>
        <p className="mb-8 leading-relaxed text-ani-muted">
          AniDachi has no mobile app either; it runs in desktop Chrome. What
          does work is splitting the devices: join the Discord voice call on
          your phone, and play Netflix in Chrome on a laptop or desktop with
          AniDachi keeping the group in sync. If you only have a phone, the
          most honest option is to start the same episode on everyone&apos;s
          own Netflix app at the same time and talk in Discord. It won&apos;t
          stay synced after a pause, but it is within the rules.
        </p>

        <h2 id="movies" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How to watch movies on Discord
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Discord does have one built-in way to watch video together: the
          Watch Together activity. It is YouTube only. Discord&apos;s FAQ
          describes it as a shared YouTube playlist that handles the syncing
          for you, played through YouTube&apos;s embedded player. You
          can&apos;t sign in to your YouTube account inside it, so YouTube
          Premium members still see ads. Playback is limited to 180 minutes
          per person when watching with a group, followed by a 10-minute
          cool-down. It won&apos;t open Netflix, Crunchyroll or any other
          service. More on it in{" "}
          <Link href="/guides/discord-watch-together">Discord Watch Together</Link>.
        </p>
        <p className="mb-8 leading-relaxed text-ani-muted">
          So the practical answer depends on where the movie lives. For a
          YouTube film or video, the activity is the quickest option inside
          Discord. For a Netflix movie, use Discord for voice and an AniDachi
          room for the film. Anime films on Crunchyroll work the same way;
          start from{" "}
          <Link href="/watch-crunchyroll-together">watching Crunchyroll together</Link>.
          For picking the film itself, see{" "}
          <Link href="/guides/netflix-movie-night">Netflix movie night</Link>.
        </p>

        <h2 id="sources" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Sources
        </h2>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Discord and Netflix details checked 20 Oct 2026:{" "}
          {SOURCES.map((source, index) => (
            <span key={source.href}>
              {index > 0 ? ", " : null}
              <a href={source.href} target="_blank" rel="noopener noreferrer">
                {source.label}
              </a>
            </span>
          ))}
          . AniDachi is not affiliated with Netflix or Discord.
        </p>

        <SeoGuideRelated
          links={[
            { href: "/netflix-watch-party", label: "Netflix watch party" },
            { href: "/discord-watch-party", label: "Discord watch party" },
            {
              href: "/guides/can-you-screen-share-crunchyroll-on-discord",
              label: "Can you screen share Crunchyroll on Discord?",
            },
            {
              href: "/guides/discord-screen-share-black-screen",
              label: "Discord screen share black screen",
            },
            {
              href: "/compare/anidachi-vs-discord-screen-share",
              label: "AniDachi vs Discord screen share",
            },
            { href: "/guides/teleparty-netflix", label: "Teleparty on Netflix" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
