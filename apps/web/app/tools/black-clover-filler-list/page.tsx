import type { Metadata } from "next";
import { SeoGuideAnswer, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { FillerSeriesBody } from "@/components/tools/filler-series-body";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { FILLER_SERIES } from "@/lib/tools/filler-arcs";
import { getSeoSiteOrigin } from "@/lib/site-url";

const url = "/tools/black-clover-filler-list";
const series = FILLER_SERIES["black-clover"];

export const metadata: Metadata = {
  title: "Black Clover Filler List — Episodes to Skip",
  description:
    "Black Clover filler list: 18 of 170 episodes to skip, the mixed episodes to keep, and where Season 2 picks up at episode 171.",
  alternates: { canonical: url },
  openGraph: {
    title: "Black Clover Filler List",
    description: "18 filler episodes to skip and the 152 to watch.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
};

const faq = [
  {
    question: "How many Black Clover episodes are filler?",
    answer:
      "18 of the first 170, about 11%. That is episodes 29, 66, 68, 82, 123–125, 131, 134–135, and 142–149.",
  },
  {
    question: "How many episodes is Black Clover without filler?",
    answer:
      "152. Mixed episodes and anime-original episodes that fit the story stay on the watch list.",
  },
  {
    question: "Is the Heart Kingdom training arc filler?",
    answer:
      "Mostly no. The training is anime-original but fits the story, so it stays. Only the side episodes at 131 and 134–135 and the cult story at 142–149 are skips.",
  },
  {
    question: "Does Season 2 have filler?",
    answer:
      "Season 2 started on 3 Oct 2026 at episode 171 and adapts the manga. No filler has been flagged so far. This list will add it if that changes.",
  },
];

const headings: TocHeading[] = [
  { id: "skip", label: "Filler to skip", level: 2 },
  { id: "watch", label: "Episodes to watch", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function BlackCloverFillerListPage() {
  return (
    <>
      <ToolWebAppJsonLd
        name="Black Clover filler list"
        description="Black Clover filler ranges to skip and the ranges to watch."
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Anime filler", url: "/glossary/anime-filler" },
          { name: "Black Clover filler list", url },
        ]}
        title="Black Clover filler list"
        description="Black Clover filler ranges to skip and the ranges to watch."
        url={url}
        datePublished="2026-10-12"
        dateModified="2026-10-12"
        faq={faq}
        headings={headings}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>Black Clover filler list</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>Black Clover has 18 filler episodes out of 170.</strong> Skip them and the group
            watches 152. Season 2 picks up at episode 171.
          </p>
        </SeoGuideAnswer>
        <FillerSeriesBody
          series={series}
          skipHeading="Black Clover filler episodes to skip"
          watchHeading="Black Clover without filler: episodes to watch"
          watchIntro="Watch these ranges in order, then start Season 2 at episode 171."
          related={[
            {
              href: "/watch/black-clover-with-friends",
              label: "How to watch Black Clover with friends",
            },
            { href: "/glossary/anime-filler", label: "What is anime filler?" },
            { href: "/tools/bleach-filler-list", label: "Bleach filler list" },
            { href: "/tools/naruto-filler-list", label: "Naruto filler list" },
            { href: "/tools/crunchyroll-schedule", label: "Crunchyroll release schedule" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
