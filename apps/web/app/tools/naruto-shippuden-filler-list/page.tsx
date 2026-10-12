import type { Metadata } from "next";
import { SeoGuideAnswer, SeoGuideNote, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { FillerSeriesBody } from "@/components/tools/filler-series-body";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { FILLER_SERIES } from "@/lib/tools/filler-arcs";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const url = "/tools/naruto-shippuden-filler-list";
const series = FILLER_SERIES["naruto-shippuden"];

export const metadata: Metadata = {
  title: "Naruto Shippuden Filler List — Canon Arcs Only",
  description:
    "Naruto Shippuden filler guide: the 203 filler episodes of 500 to skip, and the 297 episodes to watch without filler, by range.",
  alternates: { canonical: url },
  openGraph: {
    title: "Naruto Shippuden Filler List",
    description: "203 filler episodes to skip and every range to watch.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
};

const faq = [
  {
    question: "How much of Shippuden is filler?",
    answer:
      "203 of 500 episodes are in the usual filler ranges, about 41 percent. Mixed episodes that still adapt the manga are not in that 203.",
  },
  {
    question: "How many episodes is Shippuden without filler?",
    answer: "297. That count keeps mixed episodes, because they still adapt the manga.",
  },
  {
    question: "Which Shippuden arcs are canon?",
    answer:
      "The manga story is every range in the watch list on this page. Pain, the Five Kage Summit, and the war's manga chapters sit outside the filler blocks.",
  },
  {
    question: "Is Naruto Kai the same as skipping filler?",
    answer:
      "Naruto Kai is a later edit that drops most of these anime-original episodes. This page is the skip list for the original 500-episode broadcast, not a Kai episode map.",
  },
];

const headings: TocHeading[] = [
  { id: "skip", label: "Filler to skip", level: 2 },
  { id: "watch", label: "Episodes to watch", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function ShippudenFillerListPage() {
  return (
    <>
      <ToolWebAppJsonLd
        name="Naruto Shippuden filler list"
        description="Shippuden filler ranges to skip and the ranges to watch."
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Anime filler", url: "/glossary/anime-filler" },
          { name: "Naruto Shippuden filler list", url },
        ]}
        title="Naruto Shippuden filler list"
        description="Shippuden filler ranges to skip and the ranges to watch."
        url={url}
        datePublished="2026-10-09"
        dateModified="2026-10-11"
        faq={faq}
        headings={headings}
        articleImage={`${getResolvedSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>Naruto Shippuden filler list</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>Naruto Shippuden has 203 filler episodes out of 500.</strong> Skip them and the
            group watches 297.
          </p>
        </SeoGuideAnswer>
        <SeoGuideNote>
          Watching Naruto Kai instead? Kai is a later edit that already drops most of these
          episodes. This list is for the original 500-episode broadcast.
        </SeoGuideNote>
        <FillerSeriesBody
          series={series}
          skipHeading="Shippuden filler episodes to skip"
          watchHeading="Naruto Shippuden without filler: episodes to watch"
          watchIntro="Watch these ranges in order. They keep mixed episodes, because those still adapt the manga."
          related={[
            { href: "/tools/naruto-filler-list", label: "Naruto filler list" },
            { href: "/watch/naruto-with-friends", label: "How to watch Naruto with friends" },
            { href: "/glossary/anime-filler", label: "What is anime filler?" },
            { href: "/tools/one-piece-filler-list", label: "One Piece filler list" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
