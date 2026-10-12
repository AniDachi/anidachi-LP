import type { Metadata } from "next";
import { SeoGuideAnswer, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { FillerSeriesBody } from "@/components/tools/filler-series-body";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { episodesOfKind, FILLER_SERIES } from "@/lib/tools/filler-arcs";
import { getSeoSiteOrigin } from "@/lib/site-url";

const url = "/tools/one-piece-filler-list";
const series = FILLER_SERIES["one-piece"];
const filler = episodesOfKind(series.arcs, "filler");
const withoutFiller = series.totalEpisodes - filler;

export const metadata: Metadata = {
  title: "One Piece Filler List — Canon Episodes to Watch",
  description: `One Piece filler list: ${filler} anime-original episodes to skip, and the ${withoutFiller.toLocaleString()} episodes to watch without filler, by range.`,
  alternates: { canonical: url },
  openGraph: {
    title: "One Piece Filler List",
    description: `${filler} filler episodes to skip and every canon range to watch.`,
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
};

const faq = [
  {
    question: "Which One Piece episodes are filler?",
    answer: `The arcs on this page are the standalone anime-original runs, ${filler} episodes in total. Recap episodes inside canon arcs are not all listed. G-8 is anime-original, and some groups still watch it.`,
  },
  {
    question: "How many episodes is One Piece without filler?",
    answer: `${withoutFiller.toLocaleString()} of ${series.totalEpisodes.toLocaleString()} as of September 27, 2026. That still includes recap episodes inside canon arcs.`,
  },
  {
    question: "Can a group skip One Piece filler?",
    answer:
      "Yes. These arcs are not required for the manga story. Copy the skip list into the group chat before the session so nobody starts an episode the room will jump past.",
  },
  {
    question: "Does skipping filler spoil later canon?",
    answer:
      "No. These arcs are written so the main story can continue without them. Film tie-ins, including the Film Red episodes, are separate from the weekly manga run.",
  },
];

const headings: TocHeading[] = [
  { id: "skip", label: "Filler to skip", level: 2 },
  { id: "watch", label: "Episodes to watch", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function OnePieceFillerListPage() {
  return (
    <>
      <ToolWebAppJsonLd
        name="One Piece filler list"
        description="Anime-original One Piece arcs to skip and the canon ranges to watch."
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Anime filler", url: "/glossary/anime-filler" },
          { name: "One Piece filler list", url },
        ]}
        title="One Piece filler list"
        description="Anime-original One Piece arcs to skip and the canon ranges to watch."
        url={url}
        datePublished="2026-10-09"
        dateModified="2026-10-11"
        faq={faq}
        headings={headings}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>One Piece filler list</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>
              One Piece has {filler} filler episodes out of {series.totalEpisodes.toLocaleString()}
            </strong>
            , in {series.arcs.length} anime-original arcs. Skip them and you watch{" "}
            {withoutFiller.toLocaleString()} episodes.
          </p>
        </SeoGuideAnswer>
        <FillerSeriesBody
          series={series}
          skipHeading="One Piece filler episodes to skip"
          watchHeading="One Piece without filler: episodes to watch"
          watchIntro="Watch these ranges in order. They are every episode outside the filler arcs above, East Blue through Elbaph."
          related={[
            {
              href: "/tools/one-piece-how-many-episodes",
              label: "How many episodes One Piece has",
            },
            { href: "/watch/one-piece-with-friends", label: "How to watch One Piece with friends" },
            { href: "/glossary/anime-filler", label: "What is anime filler?" },
            { href: "/tools/naruto-shippuden-filler-list", label: "Naruto Shippuden filler list" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
