import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { HowToJsonLd } from "@/components/json-ld";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
  {
    name: "Join a Discord voice channel",
    text: "Open the call with the people who will watch. Voice is the part Discord is for.",
  },
  {
    name: "Share the browser window",
    text: "Choose Share Your Screen in the call, then pick the Chrome window that has the Netflix title. Do not share an empty desktop.",
  },
  {
    name: "Ask what they see",
    text: "If the window is black, or only the audio comes through, Netflix is blocking the capture. Stop the share.",
  },
  {
    name: "Leave Discord for talking",
    text: "A full movie should play on each person’s own Netflix account. A sync extension is what people use today. AniDachi’s Netflix rooms are not on the public extension yet.",
  },
];

export const metadata: Metadata = {
  title: "How to Screen Share Netflix on Discord",
  description:
    "How to screen share Netflix on Discord: join a voice channel, share the Chrome window, and stop if the picture is black. A long watch belongs on each person’s own Netflix account.",
  alternates: { canonical: "/guides/how-to-screen-share-netflix-on-discord" },
  openGraph: {
    title: "How to Screen Share Netflix on Discord",
    description: "Share the window, then stop when Netflix goes black.",
    url: "/guides/how-to-screen-share-netflix-on-discord",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Screen Share Netflix on Discord",
    description: "The share steps, and why the movie should leave Discord.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do you screen share Netflix on Discord?",
    answer:
      "Join a voice channel, share the Chrome window with Netflix, and check that friends see the picture. A black window means the player blocked capture.",
  },
  {
    question: "Why is Netflix a black screen on Discord?",
    answer:
      "Netflix blocks a lot of screen capture. Friends can hear audio and see black. Sharing a different monitor or a blank window does the same thing.",
  },
  {
    question: "Should a whole movie stay on the share?",
    answer:
      "No. The picture is late and often black. Keep Discord for voice. Each person should play Netflix on their own account.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Steps", level: 2 },
  { id: "black", label: "Black screen", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToScreenShareNetflixOnDiscordPage() {
  return (
    <>
      <HowToJsonLd
        name="How to screen share Netflix on Discord"
        description="Share the Netflix window in a Discord call, and stop if the capture is black."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Netflix watch party", url: "/netflix-watch-party" },
          {
            name: "Screen share Netflix on Discord",
            url: "/guides/how-to-screen-share-netflix-on-discord",
          },
        ]}
        title="How to screen share Netflix on Discord"
        description="Discord voice plus a Netflix window, and when to stop the share."
        url="/guides/how-to-screen-share-netflix-on-discord"
        datePublished="2026-10-08"
        dateModified="2026-10-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>How to screen share Netflix on Discord</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            Join a Discord voice channel and share the Chrome window that has
            Netflix. If friends see black, the share is not a movie night.
            Keep the call for voices and play the title on each person’s own
            account. That night is a{" "}
            <Link href="/netflix-watch-party">Netflix watch party</Link>.
          </p>
        </SeoGuideAnswer>
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Steps
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="black" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Netflix on Discord, including a black screen
        </h2>
        <SeoGuideNote>
          “Netflix Discord,” “watch Netflix on Discord,” and “Discord Netflix
          black screen” are this same problem. The general share steps, for
          any window, are on{" "}
          <Link href="/guides/how-to-screen-share-on-discord">
            how to screen share on Discord
          </Link>
          . AniDachi does not sync Netflix on the public extension yet. The
          extension people use in the meantime is{" "}
          <Link href="/guides/teleparty-netflix">Teleparty Netflix</Link>.
          Crunchyroll and YouTube can use AniDachi now from{" "}
          <Link href="/extension">/extension</Link>.
        </SeoGuideNote>
        <SeoGuideRelated
          links={[
            { href: "/netflix-watch-party", label: "Netflix watch party" },
            {
              href: "/guides/how-to-screen-share-on-discord",
              label: "How to screen share on Discord",
            },
            { href: "/discord-watch-party", label: "Discord watch party" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
