import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
  title: "Sub vs Dub — Which Audio Should a Watch Party Use?",
  description:
    "Sub vs dub for a group: pick one Crunchyroll or YouTube version so reactions land together, then start an AniDachi watchroom.",
  alternates: { canonical: "/sub-vs-dub" },
  openGraph: {
    title: "Sub vs Dub for a Watch Party",
    description: "Choose one audio track, then watch it in sync.",
    url: "/sub-vs-dub",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sub vs Dub for a Watch Party",
    description: "One version for the group, then a synced room.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Should a watch party use sub or dub?",
    answer:
      "Use the version the group can follow together. Dubs are easier if people want to look up and talk. Subs keep the original performances. Pick one and stay on it for a live room.",
  },
  {
    question: "Can each person play a different audio track?",
    answer:
      "Not if you want live reactions to match. AniDachi syncs playback, and a live room works best when everyone is on the same sub or dub. Async catch-up is planned, not available today.",
  },
  {
    question: "Where do we find dubbed anime?",
    answer:
      "Crunchyroll carries many English dubs. See dubbed anime on Crunchyroll, then open that version in desktop Chrome.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "choose", label: "How to choose", level: 2 },
  { id: "same-version", label: "Live room", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function SubVsDubPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Sub vs dub", url: "/sub-vs-dub" },
      ]}
      title="Sub vs dub"
      description="Pick one audio version, then watch it together."
      url="/sub-vs-dub"
      datePublished="2026-09-26"
      dateModified="2026-09-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
      itemList={[
        {
          name: "Dubbed anime on Crunchyroll",
          url: "/guides/dubbed-anime-on-crunchyroll",
          position: 1,
        },
        {
          name: "Dub vs sub for watch parties",
          url: "/glossary/dub-vs-sub-watch-party",
          position: 2,
        },
      ]}
    >
      <SeoGuideTitle>Sub vs dub: pick one version for the group</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          Subbed versus dubbed is the same choice: which audio the group will
          follow. Agree before you press play. A live AniDachi room stays in
          step when everyone is on that same Crunchyroll or YouTube version.
        </p>
      </SeoGuideAnswer>
      <h2 id="choose" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        How to choose
      </h2>
      <SeoGuideOptions
        options={[
          {
            title: "Dub",
            body: (
              <>
                Easier when people want to talk without reading. Start with{" "}
                <Link href="/guides/dubbed-anime-on-crunchyroll">
                  dubbed anime on Crunchyroll
                </Link>
                .
              </>
            ),
            highlight: true,
          },
          {
            title: "Sub",
            body: "Better when the group wants the original performances and can keep up with the text.",
          },
        ]}
      />
      <h2 id="same-version" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Subbed versus dubbed in a live room
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        “Sub vs dub” and “subbed vs dubbed” are the same decision. If half the
        room is reading and half is listening, the joke lands at different
        times. Pick one audio track, confirm the episode number, then start the
        room. Async catch-up, where someone could watch the other version later,
        is planned and not available today.
      </p>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Group picks are on{" "}
        <Link
          href="/guides/best-dubbed-anime-to-watch-with-friends"
          className="text-brand-orange hover:underline"
        >
          best dubbed anime to watch with friends
        </Link>
        . Install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>{" "}
        and open{" "}
        <Link
          href="/watch-crunchyroll-together"
          className="text-brand-orange hover:underline"
        >
          a Crunchyroll watch party
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          {
            href: "/guides/dubbed-anime-on-crunchyroll",
            label: "Dubbed anime on Crunchyroll",
          },
          {
            href: "/glossary/dub-vs-sub-watch-party",
            label: "Dub vs sub glossary",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
