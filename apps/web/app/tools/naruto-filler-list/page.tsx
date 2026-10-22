import type { Metadata } from "next";
import { SeoGuideAnswer, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { FillerSeriesBody } from "@/components/tools/filler-series-body";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { FILLER_SERIES } from "@/lib/tools/filler-arcs";
import { getSeoSiteOrigin } from "@/lib/site-url";

const url = "/tools/naruto-filler-list";
const series = FILLER_SERIES.naruto;

export const metadata: Metadata = {
  title: "Naruto Filler List — Episodes to Skip and Watch",
  description:
    "Naruto filler list: 90 of 220 episodes to skip, the 130 episodes to watch without filler, and the canon handoff to Shippuden at episode 220.",
  alternates: { canonical: url },
  openGraph: {
    title: "Naruto Filler List",
    description: "90 filler episodes to skip and the 130 to watch.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
};

const faq = [
  {
    question: "How many original Naruto episodes are filler?",
    answer:
      "90 of 220. That is episode 26, episode 97, episodes 101–106, episodes 136–140, and episodes 143–219. Episode 141 is mixed. Episode 220 is canon.",
  },
  {
    question: "How many episodes is Naruto without filler?",
    answer: "130. The watch list keeps mixed episode 141 and canon episode 220.",
  },
  {
    question: "Where does Naruto hand off to Shippuden?",
    answer:
      "Episode 220, Departure, is the canon ending of this series and the handoff into Shippuden. The long filler run stops at episode 219.",
  },
  {
    question: "Should a group watch Naruto filler once?",
    answer:
      "Land of Tea is the arc some groups still watch. The missions from 143 to 219 are the usual skip. Agree before episode 101 so the room does not split.",
  },
];

const headings: TocHeading[] = [
  { id: "skip", label: "Filler to skip", level: 2 },
  { id: "watch", label: "Episodes to watch", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function NarutoFillerListPage() {
  return (
    <>
      <ToolWebAppJsonLd
        name="Naruto filler list"
        description="Original Naruto filler ranges to skip and the ranges to watch."
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Tools", url: "/tools" },
          { name: "Naruto filler list", url },
        ]}
        title="Naruto filler list"
        description="Original Naruto filler ranges to skip and the ranges to watch."
        url={url}
        datePublished="2026-10-09"
        dateModified="2026-10-11"
        faq={faq}
        headings={headings}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>Naruto filler list</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>Original Naruto has 90 filler episodes out of 220.</strong> Skip them and the
            group watches 130. Episode 220 is canon and leads into Shippuden.
          </p>
        </SeoGuideAnswer>
        <FillerSeriesBody
          series={series}
          skipHeading="Naruto filler episodes to skip"
          watchHeading="Naruto without filler: episodes to watch"
          watchIntro="Watch these ranges in order, then start the Shippuden list after episode 220."
          related={[
            { href: "/tools/naruto-shippuden-filler-list", label: "Naruto Shippuden filler list" },
            { href: "/watch/naruto-with-friends", label: "How to watch Naruto with friends" },
            { href: "/glossary/anime-filler", label: "What is anime filler?" },
            { href: "/tools/one-piece-filler-list", label: "One Piece filler list" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
