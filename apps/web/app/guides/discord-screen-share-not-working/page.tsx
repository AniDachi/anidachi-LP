import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { HowToJsonLd } from "@/components/json-ld";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { INSTALL_HOWTO_STEP_TEXT_VIA_HUB } from "@/lib/install-cta";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
  {
    name: "Join a voice channel first",
    text: "Discord screen share not working often means you are still in a text channel. The share control sits with the call buttons after you join voice or start a call.",
  },
  {
    name: "Allow screen recording",
    text: "If the computer denied Discord, the share cannot start. macOS Screen Recording and the Windows prompt are the usual blocks. Allow Discord, then rejoin the call.",
  },
  {
    name: "Test outside the server",
    text: "A role can turn sharing off. A direct call tells you whether the button exists when the server is not involved.",
  },
  {
    name: "Move the episode off the share",
    text: `${INSTALL_HOWTO_STEP_TEXT_VIA_HUB} Each person opens the same Crunchyroll episode or full YouTube watch page and joins one room. Discord stays the voice call.`,
  },
];

export const metadata: Metadata = {
  title: "Discord Screen Share Not Working — Button and Permissions",
  description:
    "If Discord screen share is not working, join a voice call, allow screen recording, and test a direct call. For a full Crunchyroll or YouTube episode, sync it with AniDachi instead.",
  alternates: { canonical: "/guides/discord-screen-share-not-working" },
  openGraph: {
    title: "Discord Screen Share Not Working",
    description: "The share never starts. Check the call and the permission.",
    url: "/guides/discord-screen-share-not-working",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Discord Screen Share Not Working",
    description: "Fix the button, then watch without the share.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Why is Discord screen share not working?",
    answer:
      "You are outside a voice call, the computer blocked screen recording, or the server turned sharing off for your role. The share control is with the call buttons.",
  },
  {
    question: "Where is the share button?",
    answer:
      "In the voice call controls, after you join a channel or start a call. It is not on a text channel by itself.",
  },
  {
    question: "Is a black window the same problem?",
    answer:
      "No. A black window means the share started and the picture is empty. That page is Discord screen share black screen.",
  },
  {
    question: "Should I keep repairing the share for a whole episode?",
    answer:
      "Use it for a short look. A Crunchyroll episode or full YouTube video should play on each person’s own account in an AniDachi room, with Discord left on for voice.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Checks", level: 2 },
  { id: "episode", label: "After the button works", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordScreenShareNotWorkingPage() {
  return (
    <>
      <HowToJsonLd
        name="Fix Discord screen share not working"
        description="Find the share button, allow screen recording, then move a long episode off the share."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Discord watch party", url: "/discord-watch-party" },
          {
            name: "Screen share not working",
            url: "/guides/discord-screen-share-not-working",
          },
        ]}
        title="Discord screen share not working"
        description="Share button and permission failures, then a watch that does not need the share."
        url="/guides/discord-screen-share-not-working"
        datePublished="2026-10-08"
        dateModified="2026-10-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>Discord screen share not working</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            Discord screen share not working means the share never starts: no
            button, a denied permission, or a server that blocks it. A picture
            that is already black is{" "}
            <Link href="/guides/discord-screen-share-black-screen">
              Discord screen share black screen
            </Link>
            . Either way, a full episode belongs on a{" "}
            <Link href="/discord-watch-party">Discord watch party</Link> with
            AniDachi.
          </p>
        </SeoGuideAnswer>
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          What to check
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="episode" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          After the button works
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          The click path for a normal share is{" "}
          <Link
            href="/guides/how-to-screen-share-on-discord"
            className="text-brand-orange hover:underline"
          >
            how to screen share on Discord
          </Link>
          . Once you can share, stop using it for the episode. Each person
          opens the same Crunchyroll catalog page or full YouTube watch page.
          Hosting needs Plus or Pro. Friends can join free. Prices are on{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing
          </Link>
          . Install from{" "}
          <Link href="/extension" className="text-brand-orange hover:underline">
            /extension
          </Link>
          . Netflix is coming soon and is not on the public extension yet.
        </p>
        <SeoGuideRelated
          links={[
            { href: "/discord-watch-party", label: "Discord watch party" },
            {
              href: "/guides/discord-screen-share-black-screen",
              label: "Discord screen share black screen",
            },
            {
              href: "/guides/how-to-watch-anime-with-friends-on-discord",
              label: "Watch anime on Discord",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
