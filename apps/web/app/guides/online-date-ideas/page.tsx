import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
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
    name: "Put one activity on the calendar",
    text: "Online date ideas work when both of you know the start and the stop. One recipe, one episode, or one short game. Not all three.",
  },
  {
    name: "Open the call first",
    text: "FaceTime or Discord stays up for voices. The browser is for the shared thing, not a second conversation.",
  },
  {
    name: "Use two computers for the same title",
    text: "If the date is a watch, each person opens the same Crunchyroll episode or full YouTube movie in desktop Chrome.",
  },
  {
    name: "Keep playback together",
    text: `${INSTALL_HOWTO_STEP_TEXT_VIA_HUB} AniDachi syncs that player. Netflix is coming soon and is not on the public extension yet.`,
  },
];

export const metadata: Metadata = {
  title: "Online Date Ideas — Two Computers, One Evening",
  description:
    "Online date ideas from two computers: one call, one shared activity, and a stop time. A Crunchyroll episode or YouTube movie can be the activity, synced with AniDachi.",
  alternates: { canonical: "/guides/online-date-ideas" },
  openGraph: {
    title: "Online Date Ideas",
    description: "One activity on two computers, with a clear ending.",
    url: "/guides/online-date-ideas",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Online Date Ideas",
    description: "Dates that happen in two browsers.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What are good online date ideas?",
    answer:
      "Cook the same recipe, watch one episode, play one short game, or show each other a walk on camera. Pick one, and decide when it ends.",
  },
  {
    question: "How is this different from virtual date ideas?",
    answer:
      "Virtual date ideas is the wider list, including long-distance wording. This page is the version that happens from two computers.",
  },
  {
    question: "Can the online date be a movie?",
    answer:
      "Yes. Use a YouTube movie or a Crunchyroll episode, each person on their own account, in desktop Chrome. AniDachi keeps playback together. Netflix is coming soon and is not on the public extension yet.",
  },
  {
    question: "Do we both need a paid AniDachi plan?",
    answer:
      "The host needs Plus or Pro, including a trial, to create the room. The other person can join free and still needs their own streaming account.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "ideas", label: "Ideas", level: 2 },
  { id: "steps", label: "Run one date", level: 2 },
  { id: "watch", label: "When it is a watch", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function OnlineDateIdeasPage() {
  return (
    <>
      <HowToJsonLd
        name="How to run an online date"
        description="Pick one activity on two computers, keep a call open, and stop on time."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          {
            name: "Watch movies long distance",
            url: "/watch-movies-together-long-distance",
          },
          { name: "Online date ideas", url: "/guides/online-date-ideas" },
        ]}
        title="Online date ideas"
        description="Dates from two computers, including one synced watch."
        url="/guides/online-date-ideas"
        datePublished="2026-10-08"
        dateModified="2026-10-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>Online date ideas from two computers</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            Online date ideas are one activity you both start from your own
            computer, with a call already open and a time to stop. The wider
            list is{" "}
            <Link href="/guides/virtual-date-ideas">virtual date ideas</Link>.
            When the activity is a film, use{" "}
            <Link href="/watch-movies-together-long-distance">
              watch movies together long distance
            </Link>
            .
          </p>
        </SeoGuideAnswer>
        <h2 id="ideas" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Ideas that fit two browsers
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "The same recipe",
              body: "Open the recipe on both screens, cook, and eat on the call. End when the plates are done.",
            },
            {
              title: "One episode",
              body: "Same title and same audio. Each person uses their own Crunchyroll or YouTube account. AniDachi keeps the moment together.",
            },
            {
              title: "A ten-minute tour",
              body: "Point the camera at a room, a street, or a pet. It is a visit, and it has a natural end.",
            },
            {
              title: "A short game",
              body: "Twenty minutes. A second unplanned activity makes the date longer than you agreed.",
            },
          ]}
        />
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How to run one
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="watch" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          When the online date is a watch
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Voice stays on FaceTime or Discord. The picture stays in Chrome.
          Hosting the room needs Plus or Pro. See{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing
          </Link>
          . A single evening built around the movie is{" "}
          <Link
            href="/guides/long-distance-date-night-ideas"
            className="text-brand-orange hover:underline"
          >
            long distance date night ideas
          </Link>
          . More things to do are on{" "}
          <Link
            href="/guides/things-to-do-long-distance"
            className="text-brand-orange hover:underline"
          >
            things to do long distance
          </Link>
          . Install from{" "}
          <Link href="/extension" className="text-brand-orange hover:underline">
            /extension
          </Link>
          .
        </p>
        <SeoGuideRelated
          links={[
            { href: "/guides/virtual-date-ideas", label: "Virtual date ideas" },
            {
              href: "/watch-movies-together-long-distance",
              label: "Watch movies long distance",
            },
            {
              href: "/guides/apps-for-long-distance-couples",
              label: "Apps for long distance couples",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
