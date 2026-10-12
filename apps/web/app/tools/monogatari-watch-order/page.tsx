import type { Metadata } from "next";
import { SeoGuideAnswer, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { WatchOrderBody } from "@/components/tools/watch-order-body";
import { totalHours, WATCH_ORDERS } from "@/lib/tools/watch-orders";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const url = "/tools/monogatari-watch-order";
const order = WATCH_ORDERS.monogatari;

export const metadata: Metadata = {
  title: "Monogatari Series Watch Order",
  description:
    "Monogatari watch order for a first group watch, including where Kizumonogatari fits and which entries can wait.",
  alternates: { canonical: url },
  openGraph: {
    title: "Monogatari Series Watch Order",
    description: "Release order from Bakemonogatari to Off & Monster Season.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
};

const faq = [
  {
    question: "What order should a new group watch Monogatari in?",
    answer:
      "Release order, starting with Bakemonogatari and ending with Off & Monster Season. The show is written to be watched that way, with reveals placed for viewers who came in at the start.",
  },
  {
    question: "Where does Kizumonogatari go?",
    answer:
      "After Owarimonogatari and before Owarimonogatari II, where it was released. It is a prequel, but it keeps its weight better once the group knows the cast. Owarimonogatari II depends on it, so do not skip it.",
  },
  {
    question: "Should we watch the Kizumonogatari trilogy or Koyomi Vamp?",
    answer:
      "Either. Koyomi Vamp (2024) re-cuts the three films into one of about 2.5 hours. The trilogy runs longer and has more room to breathe.",
  },
  {
    question: "Is novel order or chronological order required?",
    answer:
      "No. Both are for a rewatch. Chronological order puts Kizumonogatari first and reshuffles the rest by in-story date.",
  },
];

const headings: TocHeading[] = [
  { id: "order", label: "First-watch order", level: 2 },
  { id: "later", label: "Leave for later", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function MonogatariWatchOrderPage() {
  return (
    <>
      <ToolWebAppJsonLd
        name="Monogatari series watch order"
        description="First-watch order for the Monogatari series, including where Kizumonogatari fits."
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch anime together", url: "/watch-anime-together" },
          { name: "Monogatari series watch order", url },
        ]}
        title="Monogatari series watch order"
        description="First-watch order for the Monogatari series, including where Kizumonogatari fits."
        url={url}
        datePublished="2026-10-12"
        dateModified="2026-10-12"
        faq={faq}
        headings={headings}
        articleImage={`${getResolvedSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>Monogatari series watch order</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>Watch in release order, starting with Bakemonogatari.</strong> Kizumonogatari
            goes after Owarimonogatari and before Owarimonogatari II. The {order.firstWatch.length}{" "}
            steps take a group about {totalHours(order.firstWatch)} hours.
          </p>
        </SeoGuideAnswer>
        <WatchOrderBody
          order={order}
          url={url}
          orderHeading="Monogatari anime watch order"
          orderIntro="Release order from 2009 to 2024. Hanamonogatari is the one step a group can safely push to the end."
          laterHeading="Monogatari entries to leave for later"
          laterIntro="Short extras that are optional on a first watch."
          related={[
            { href: "/tools/fate-watch-order", label: "Fate watch order" },
            { href: "/watch-anime-together", label: "Watch anime together" },
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
