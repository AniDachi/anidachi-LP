import type { Metadata } from "next";
import { SeoGuideAnswer, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { WatchOrderBody } from "@/components/tools/watch-order-body";
import { WATCH_ORDERS } from "@/lib/tools/watch-orders";
import { getSeoSiteOrigin } from "@/lib/site-url";

const url = "/tools/fate-watch-order";
const order = WATCH_ORDERS.fate;

export const metadata: Metadata = {
  title: "Fate Watch Order for a First Watch",
  description:
    "Fate series watch order for a group starting fresh: which route to watch, where Fate/Zero goes, and what to leave for later.",
  alternates: { canonical: url },
  openGraph: {
    title: "Fate Watch Order",
    description: "Unlimited Blade Works, Heaven's Feel, Fate/Zero, then strange Fake.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
};

const faq = [
  {
    question: "Where do we start the Fate series?",
    answer:
      "Fate/stay night: Unlimited Blade Works (2014), starting at episode #00. It introduces the war, the rules, and the cast without spoiling anything.",
  },
  {
    question: "Do we watch Fate/Zero first?",
    answer:
      "Not on a first watch. Fate/Zero is a prequel, but it answers the mysteries that Unlimited Blade Works and Heaven's Feel set up. Watch it third and the reveals still land.",
  },
  {
    question: "Which Fate entries are optional on a first pass?",
    answer:
      "Everything outside the four steps: the 2006 Studio DEEN series, Fate/Apocrypha, Fate/Grand Order, Fate/Extra Last Encore, Lord El-Melloi II's Case Files, and the comedy spinoffs.",
  },
  {
    question: "Where does Fate/stay night: Heaven's Feel go?",
    answer:
      "Right after Unlimited Blade Works. It is the darker third route of the same war and expects the group to know the cast already.",
  },
];

const headings: TocHeading[] = [
  { id: "order", label: "First-watch order", level: 2 },
  { id: "later", label: "Leave for later", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function FateWatchOrderPage() {
  return (
    <>
      <ToolWebAppJsonLd
        name="Fate watch order"
        description="First-watch order for the Fate series, with what to leave for later."
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch anime together", url: "/watch-anime-together" },
          { name: "Fate watch order", url },
        ]}
        title="Fate watch order"
        description="First-watch order for the Fate series, with what to leave for later."
        url={url}
        datePublished="2026-10-12"
        dateModified="2026-10-12"
        faq={faq}
        headings={headings}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>Fate watch order</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>
              Watch Unlimited Blade Works, then the Heaven&apos;s Feel films, then Fate/Zero, then
              Fate/strange Fake.
            </strong>{" "}
            This is a first-watch order for a group starting fresh, not every spinoff.
          </p>
        </SeoGuideAnswer>
        <WatchOrderBody
          order={order}
          url={url}
          orderHeading="Fate series watch order"
          orderIntro="Four steps, in this order. Fate/Zero comes third because it is a prequel that gives away the twists of the first two."
          laterHeading="Fate entries to leave for later"
          laterIntro="Side stories and other takes on the same world. Each one works after the core four, in any order."
          related={[
            {
              href: "/watch/fate-stay-night-unlimited-blade-works-with-friends",
              label: "How to watch Unlimited Blade Works with friends",
            },
            { href: "/watch/fate-zero-with-friends", label: "How to watch Fate/Zero with friends" },
            { href: "/tools/monogatari-watch-order", label: "Monogatari series watch order" },
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
