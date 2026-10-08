import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
  title: "Romance Anime Dubbed — Pick the English Track First",
  description:
    "Romance anime dubbed means the English audio is on before the room starts. Confirm the track on each person’s Crunchyroll or YouTube player, then watch together with AniDachi.",
  alternates: { canonical: "/guides/romance-anime-dubbed" },
  openGraph: {
    title: "Romance Anime Dubbed",
    description: "A romance night only works live when everyone is on the dub.",
    url: "/guides/romance-anime-dubbed",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Romance Anime Dubbed",
    description: "Same episode, English audio, then press play.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is romance anime dubbed?",
    answer:
      "A romance title whose English voice track you can select. If the audio menu has no English option, that episode is not a dub watch.",
  },
  {
    question: "Where is the list of romance anime to watch with friends?",
    answer:
      "The general romance picks stay on best romance anime to watch with friends. This page is only the dub check before a live room.",
  },
  {
    question: "Can half the couple watch the sub?",
    answer:
      "The players allow it, and the line will land at different times. For a live romance episode, pick one audio. Async catch-up is planned and is not available today.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "check", label: "Check the dub", level: 2 },
  { id: "picks", label: "Dubbed romance versus the romance list", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function RomanceAnimeDubbedPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Sub vs dub", url: "/sub-vs-dub" },
        { name: "Romance anime dubbed", url: "/guides/romance-anime-dubbed" },
      ]}
      title="Romance anime dubbed"
      description="Confirm the English audio on a romance episode before the room starts."
      url="/guides/romance-anime-dubbed"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Romance anime dubbed for a live room</SeoGuideTitle>
      <h2 id="answer" className="scroll-mt-24">
        Short answer
      </h2>
      <SeoGuideAnswer>
        <p>
          Romance anime dubbed only works as a shared watch when everyone is
          on the English audio. Agree on that track before play. The{" "}
          <Link href="/sub-vs-dub">sub vs dub</Link> choice is the whole night
          if one person is reading and the other is listening.
        </p>
      </SeoGuideAnswer>
      <h2 id="check" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        How to check the dub
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Open the episode yourself",
            body: "Your own Crunchyroll account, or a full YouTube watch page, in desktop Chrome.",
          },
          {
            title: "Look for English audio",
            body: "On Crunchyroll, English has to be in the audio menu. On YouTube, open the upload that is the dub. No English track means stay on subs or pick another episode.",
          },
          {
            title: "Then start the room",
            body: "Each person confirms the same episode and the same audio, then joins the AniDachi watchroom.",
          },
        ]}
      />
      <h2 id="picks" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Dubbed romance versus the romance list
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Titles people try when an English track is listed include Toradora,
        Fruits Basket, and Spy x Family. That is not a ranking, and a title
        can lose the English option on a given episode. The group list stays
        on{" "}
        <Link
          href="/guides/best-romance-anime-to-watch-with-friends"
          className="text-brand-orange hover:underline"
        >
          best romance anime to watch with friends
        </Link>
        . How to switch audio is on{" "}
        <Link
          href="/guides/watch-anime-dub"
          className="text-brand-orange hover:underline"
        >
          watch anime dub
        </Link>
        . If the group should stay on Japanese audio, use{" "}
        <Link href="/guides/subbed-anime" className="text-brand-orange hover:underline">
          subbed anime
        </Link>
        . Install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/sub-vs-dub", label: "Sub vs dub" },
          {
            href: "/guides/best-romance-anime-to-watch-with-friends",
            label: "Best romance anime to watch with friends",
          },
          { href: "/guides/subbed-anime", label: "Subbed anime" },
        ]}
      />
    </SeoPageLayout>
  );
}
