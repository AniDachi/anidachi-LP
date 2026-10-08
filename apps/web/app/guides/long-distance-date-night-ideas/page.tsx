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
    name: "Book one evening in both time zones",
    text: "Long distance date night ideas fail when the start time is only written in one city. Put the same clock time on both calendars.",
  },
  {
    name: "Choose one film or one episode",
    text: "Send the title before the call. A YouTube movie or a Crunchyroll episode is enough. A second feature was not the plan.",
  },
  {
    name: "Open the call, then the player",
    text: "FaceTime or Discord stays up for voices. Each person opens that title on their own account in desktop Chrome.",
  },
  {
    name: "Press play together and stop at the end",
    text: `${INSTALL_HOWTO_STEP_TEXT_VIA_HUB} AniDachi keeps the picture in step. Hang up when the credits or the episode ends. Netflix is coming soon and is not on the public extension yet.`,
  },
];

export const metadata: Metadata = {
  title: "Long Distance Date Night Ideas — One Movie or Episode",
  description:
    "Long distance date night ideas for one evening: a shared start time, a call, and one YouTube movie or Crunchyroll episode synced with AniDachi.",
  alternates: { canonical: "/guides/long-distance-date-night-ideas" },
  openGraph: {
    title: "Long Distance Date Night Ideas",
    description: "One evening, one film or episode, then stop.",
    url: "/guides/long-distance-date-night-ideas",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Long Distance Date Night Ideas",
    description: "Build the night around one watch.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What are long distance date night ideas?",
    answer:
      "One planned evening in both time zones. A call stays open. You eat, or you watch one movie or episode, and you stop when that is done.",
  },
  {
    question: "What should we watch?",
    answer:
      "A YouTube movie or a Crunchyroll episode, each person on their own account in desktop Chrome. AniDachi keeps playback together. Netflix is coming soon and is not on the public extension yet.",
  },
  {
    question: "Is this the anime date night list?",
    answer:
      "No. Anime-only evenings stay on long distance anime date night ideas. This page is the shape of the evening, whether the watch is a film or an episode.",
  },
  {
    question: "Who pays for AniDachi?",
    answer:
      "The person who creates the room needs Plus or Pro, including a trial. The other person can join free and still needs their own streaming account.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "One evening", level: 2 },
  { id: "anime", label: "When the night is anime", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function LongDistanceDateNightIdeasPage() {
  return (
    <>
      <HowToJsonLd
        name="How to plan a long distance date night"
        description="Set one time in both zones, watch one title, and stop when it ends."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          {
            name: "Watch movies long distance",
            url: "/watch-movies-together-long-distance",
          },
          {
            name: "Long distance date night ideas",
            url: "/guides/long-distance-date-night-ideas",
          },
        ]}
        title="Long distance date night ideas"
        description="One evening built around a movie or episode."
        url="/guides/long-distance-date-night-ideas"
        datePublished="2026-10-08"
        dateModified="2026-10-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>Long distance date night ideas for one evening</SeoGuideTitle>
        <h2 id="answer" className="scroll-mt-24">
          Short answer
        </h2>
        <SeoGuideAnswer>
          <p>
            Long distance date night ideas come down to one block of time, not
            a pile of apps. Put it on the calendar in both time zones. Watch
            one YouTube movie or one Crunchyroll episode with{" "}
            <Link href="/watch-movies-together-long-distance">
              watch movies together long distance
            </Link>{" "}
            when the film is the whole plan.
          </p>
        </SeoGuideAnswer>
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How to spend the evening
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="anime" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          When the date night is anime
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Anime evenings stay on{" "}
          <Link
            href="/long-distance-anime-date-night-ideas"
            className="text-brand-orange hover:underline"
          >
            long distance anime date night ideas
          </Link>
          . Other computer dates are on{" "}
          <Link
            href="/guides/online-date-ideas"
            className="text-brand-orange hover:underline"
          >
            online date ideas
          </Link>
          . A film that is not framed as a date is{" "}
          <Link
            href="/guides/watch-movies-together-online"
            className="text-brand-orange hover:underline"
          >
            watch movies together online
          </Link>
          . Hosting needs Plus or Pro, on{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing
          </Link>
          . Install from{" "}
          <Link href="/extension" className="text-brand-orange hover:underline">
            /extension
          </Link>
          .
        </p>
        <SeoGuideRelated
          links={[
            {
              href: "/watch-movies-together-long-distance",
              label: "Watch movies long distance",
            },
            {
              href: "/guides/long-distance-date-ideas",
              label: "Long distance date ideas",
            },
            {
              href: "/long-distance-anime-date-night-ideas",
              label: "Long distance anime date night ideas",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
