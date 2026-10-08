import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
  title: "Discord Screen Share Not Working — Button and Permissions",
  description:
    "If Discord screen share is not working, check the call, the share permission, and the window. For a full Crunchyroll or YouTube episode, use voice in Discord and AniDachi for the video.",
  alternates: { canonical: "/guides/discord-screen-share-not-working" },
  openGraph: {
    title: "Discord Screen Share Not Working",
    description: "The share control and permission checks, then a better watch.",
    url: "/guides/discord-screen-share-not-working",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Discord Screen Share Not Working",
    description: "Fix the share control, then move a long episode off it.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Why is Discord screen share not working?",
    answer:
      "You may be outside a voice call, the server may block sharing, or the computer may be denying screen recording. A black window is a different problem: the share started, but the picture is empty.",
  },
  {
    question: "Where is the share button?",
    answer:
      "It is in the voice call controls, after you have joined a channel or a call. It is not on a text channel by itself.",
  },
  {
    question: "Should I keep fixing the share for a whole episode?",
    answer:
      "No. Use the share for a short look. Watch Crunchyroll or YouTube with AniDachi so each person plays the video on their own account, and leave Discord for voice.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "checks", label: "Checks", level: 2 },
  { id: "episode", label: "When the episode should leave the share", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordScreenShareNotWorkingPage() {
  return (
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
          Discord screen share not working usually means the share never
          starts: no button, a permission prompt, or a server that blocks it.
          A picture that is already black is the{" "}
          <Link href="/guides/discord-screen-share-black-screen">
            black screen
          </Link>{" "}
          case. Either way, a full episode belongs on a{" "}
          <Link href="/discord-watch-party">Discord watch party</Link> with
          AniDachi, not on the share.
        </p>
      </SeoGuideAnswer>
      <h2 id="checks" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What to check
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "You are in a call",
            body: "Join a voice channel or start a call. The share control sits with those call buttons.",
          },
          {
            title: "The computer allowed it",
            body: "macOS and Windows can block screen recording. If Discord asks and you deny it, the share cannot start.",
          },
          {
            title: "The server allows it",
            body: "A server can turn off sharing for your role. A direct call is the quick test.",
          },
        ]}
      />
      <h2 id="episode" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        When the episode should leave the share
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        The share steps are on{" "}
        <Link
          href="/guides/how-to-screen-share-on-discord"
          className="text-brand-orange hover:underline"
        >
          how to screen share on Discord
        </Link>
        . Once the button works, stop using it for the episode. Each person
        opens the same Crunchyroll episode or full YouTube watch page and
        joins the AniDachi room. Install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        . Netflix is coming soon and is not supported yet.
      </p>
      <SeoGuideRelated
        links={[
          { href: "/discord-watch-party", label: "Discord watch party" },
          {
            href: "/guides/discord-screen-share-black-screen",
            label: "Discord screen share black screen",
          },
          {
            href: "/guides/how-to-screen-share-on-discord",
            label: "How to screen share on Discord",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
