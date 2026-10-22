import type { Metadata } from "next";
import { SeoGuideAnswer, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { FillerSeriesBody } from "@/components/tools/filler-series-body";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { FILLER_SERIES } from "@/lib/tools/filler-arcs";
import { getSeoSiteOrigin } from "@/lib/site-url";

const url = "/tools/bleach-filler-list";
const series = FILLER_SERIES.bleach;

export const metadata: Metadata = {
  title: "Bleach Filler List — Canon Arcs and Episodes",
  description:
    "Bleach filler arcs to skip, canon episodes to keep, and the path into the Thousand-Year Blood War. 163 of 366 episodes are filler.",
  alternates: { canonical: url },
  openGraph: {
    title: "Bleach Filler List",
    description: "163 filler episodes to skip and the 203 to watch.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
};

const faq = [
  {
    question: "Which Bleach arcs are filler?",
    answer:
      "The Bount arc (64–108), Stolen Hōgyoku (128–137), Menos Forest (147–149), New Captain Amagai (168–189), Zanpakutō Unknown Tales and Beast Swords (230–265), and Gotei 13 Invasion (317–341), plus a handful of standalone episodes. That is 163 of 366.",
  },
  {
    question: "How many episodes is Bleach without filler?",
    answer:
      "203. That keeps mixed episodes such as 109 and 342, which still adapt the manga and lead into the next canon arc.",
  },
  {
    question: "Is the Thousand-Year Blood War filler?",
    answer:
      "No. Thousand-Year Blood War adapts the manga's final arc and picks up right after episode 366. It has no filler arcs.",
  },
  {
    question: "Can the group skip the Bount arc?",
    answer:
      "Yes. It is anime-original and nothing in it carries into canon. Jump from episode 63 to 109 and the group misses no story.",
  },
];

const headings: TocHeading[] = [
  { id: "skip", label: "Filler to skip", level: 2 },
  { id: "watch", label: "Episodes to watch", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function BleachFillerListPage() {
  return (
    <>
      <ToolWebAppJsonLd
        name="Bleach filler list"
        description="Bleach filler ranges to skip and the canon ranges to watch."
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Tools", url: "/tools" },
          { name: "Bleach filler list", url },
        ]}
        title="Bleach filler list"
        description="Bleach filler ranges to skip and the canon ranges to watch."
        url={url}
        datePublished="2026-10-12"
        dateModified="2026-10-12"
        faq={faq}
        headings={headings}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>Bleach filler list</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>Bleach has 163 filler episodes out of 366.</strong> Skip them and the group
            watches 203. The Bount arc is the big one. Thousand-Year Blood War is all canon.
          </p>
        </SeoGuideAnswer>
        <FillerSeriesBody
          series={series}
          skipHeading="Bleach filler episodes to skip"
          watchHeading="Bleach without filler: episodes to watch"
          watchIntro="Watch these ranges in order, then go straight into Thousand-Year Blood War after episode 366."
          related={[
            { href: "/watch/bleach-with-friends", label: "How to watch Bleach with friends" },
            { href: "/glossary/anime-filler", label: "What is anime filler?" },
            { href: "/tools/naruto-shippuden-filler-list", label: "Naruto Shippuden filler list" },
            { href: "/tools/one-piece-filler-list", label: "One Piece filler list" },
            { href: "/tools/black-clover-filler-list", label: "Black Clover filler list" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
