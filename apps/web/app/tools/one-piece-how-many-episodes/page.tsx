import type { Metadata } from "next";
import { SeoGuideAnswer, SeoGuideRelated, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { StatStrip } from "@/components/tools/stat-strip";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { WeekPace } from "@/components/tools/week-pace";
import { episodesOfKind, FILLER_SERIES } from "@/lib/tools/filler-arcs";
import {
  ONE_PIECE_EPISODE_COUNT,
  ONE_PIECE_MINUTES_PER_EPISODE,
  ONE_PIECE_SEASONS,
  watchHours,
} from "@/lib/tools/one-piece-count";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const url = "/tools/one-piece-how-many-episodes";
const fillerEpisodes = episodesOfKind(FILLER_SERIES["one-piece"].arcs, "filler");
const withoutFiller = ONE_PIECE_EPISODE_COUNT - fillerEpisodes;
const hours = watchHours(ONE_PIECE_EPISODE_COUNT, ONE_PIECE_MINUTES_PER_EPISODE);
const asOfLabel = "September 27, 2026";
const headingClass = "mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";

export const metadata: Metadata = {
  title: "How Many Episodes Does One Piece Have? (1,180)",
  description:
    "One Piece has 1,180 episodes as of September 27, 2026: about 472 hours. See episodes by arc and a finish date for your weekly pace.",
  alternates: { canonical: url },
  openGraph: {
    title: "How Many Episodes Does One Piece Have?",
    description: "1,180 episodes, about 472 hours, and a finish date for your weekly pace.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
};

const faq = [
  {
    question: "How many episodes does One Piece have right now?",
    answer: `The Japanese broadcast has aired ${ONE_PIECE_EPISODE_COUNT.toLocaleString()} episodes as of ${asOfLabel}. Episode 1180 was the last new episode of 2026. The next episode is scheduled for 2027.`,
  },
  {
    question: "How many hours is One Piece?",
    answer: `About ${hours} hours if you count ${ONE_PIECE_MINUTES_PER_EPISODE} minutes per episode. Recaps and specials are shorter or longer, so treat this as an estimate.`,
  },
  {
    question: "How long is One Piece if we skip filler?",
    answer: `The standalone anime-original arcs on the filler list add up to ${fillerEpisodes} episodes, which leaves ${withoutFiller.toLocaleString()}. Recap episodes inside canon arcs are not all in that count.`,
  },
  {
    question: "How long would it take to watch One Piece?",
    answer: `${ONE_PIECE_EPISODE_COUNT.toLocaleString()} episodes at two a week is 590 weeks, a little over 11 years. At 14 a week it is 85 weeks. Pick a pace on this page to see your own finish date.`,
  },
];

const headings: TocHeading[] = [
  { id: "pace", label: "Finish date", level: 2 },
  { id: "by-arc", label: "Episodes by arc", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function OnePieceEpisodeCountPage() {
  return (
    <>
      <ToolWebAppJsonLd
        name="One Piece episode count"
        description="Current One Piece episode count, estimated hours, and a weekly finish date."
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch anime together", url: "/watch-anime-together" },
          { name: "One Piece episode count", url },
        ]}
        title="How many episodes does One Piece have?"
        description="Current One Piece episode count, estimated hours, and a weekly finish date."
        url={url}
        datePublished="2026-10-09"
        dateModified="2026-10-11"
        faq={faq}
        headings={headings}
        articleImage={`${getResolvedSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>How many episodes does One Piece have?</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>One Piece has {ONE_PIECE_EPISODE_COUNT.toLocaleString()} episodes</strong> as of{" "}
            {asOfLabel}. That is about {hours} hours. Episode 1180 closed the 2026 broadcast, and
            the next episode is in 2027.
          </p>
        </SeoGuideAnswer>

        <StatStrip
          stats={[
            { label: "Episodes aired", value: ONE_PIECE_EPISODE_COUNT.toLocaleString() },
            { label: `Hours at ${ONE_PIECE_MINUTES_PER_EPISODE} min each`, value: `~${hours}` },
            { label: "Without filler arcs", value: withoutFiller.toLocaleString() },
            { label: "Next new episode", value: "2027" },
          ]}
        />

        <h2 id="pace" className={headingClass}>
          How long would it take to watch One Piece?
        </h2>
        <p className="mb-5 leading-relaxed text-ani-muted">
          Pick how many episodes your group watches a week. Turn on skip filler to drop the{" "}
          {fillerEpisodes} anime-original episodes.
        </p>
        <WeekPace
          episodes={ONE_PIECE_EPISODE_COUNT}
          fillerEpisodes={fillerEpisodes}
          minutesPerEpisode={ONE_PIECE_MINUTES_PER_EPISODE}
        />

        <h2 id="by-arc" className={headingClass}>
          One Piece episodes by arc
        </h2>
        <p className="mb-5 leading-relaxed text-ani-muted">
          Counts are the Japanese TV run, grouped the way the home-media seasons are, from the{" "}
          <a
            href="https://en.wikipedia.org/wiki/List_of_One_Piece_episodes"
            className="text-ani-text underline decoration-ani-line underline-offset-2"
          >
            Wikipedia episode list
          </a>{" "}
          as of {asOfLabel}. Crunchyroll numbering can lag in some regions.
        </p>
        <div className="not-prose mb-10 overflow-hidden rounded-[16px] border border-ani-line">
          <table className="w-full text-sm">
            <caption className="sr-only">One Piece episodes by arc</caption>
            <thead className="bg-ani-panel text-left text-xs text-ani-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Arc
                </th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                  Aired
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Episodes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ani-line">
              {ONE_PIECE_SEASONS.map((season) => (
                <tr key={season.arc}>
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-ani-text">
                    {season.arc}
                  </th>
                  <td className="hidden px-4 py-2.5 tabular-nums text-ani-muted sm:table-cell">
                    {season.years}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ani-text">
                    {season.episodes}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-ani-control-border bg-ani-panel">
              <tr>
                <th scope="row" className="px-4 py-2.5 text-left font-semibold text-ani-text">
                  Total
                </th>
                <td className="hidden sm:table-cell" />
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ani-text">
                  {ONE_PIECE_EPISODE_COUNT.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <h2 id="related" className={headingClass}>
          Related
        </h2>
        <SeoGuideRelated
          className="mb-8"
          links={[
            { href: "/tools/one-piece-filler-list", label: "One Piece filler list" },
            { href: "/watch/one-piece-with-friends", label: "How to watch One Piece with friends" },
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
            { href: "/tools/random-anime-generator", label: "Random anime generator" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
