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
  title: "Subbed Anime — When the Group Should Stay on Subs",
  description:
    "Subbed anime is the original audio with on-screen text. Stay on it when there is no English dub, or when the group wants those performances. Then start the AniDachi room on that version.",
  alternates: { canonical: "/guides/subbed-anime" },
  openGraph: {
    title: "Subbed Anime",
    description: "When a live room should stay on the original audio.",
    url: "/guides/subbed-anime",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Subbed Anime",
    description: "One subtitle track for the whole room.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is subbed anime?",
    answer:
      "The original language audio with subtitles. For most series that is Japanese audio and English text, on your own Crunchyroll or YouTube player.",
  },
  {
    question: "When should a group watch subs?",
    answer:
      "When the episode has no English audio, or when everyone can read and wants the original performances. Do not mix subs and dubs in a live room.",
  },
  {
    question: "Is subbed the same decision as sub vs dub?",
    answer:
      "Sub vs dub is the choice. This page is the case for staying on subs. The hub still holds the comparison.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "stay", label: "When to stay on subs", level: 2 },
  { id: "room", label: "Start the room on that version", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function SubbedAnimePage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Sub vs dub", url: "/sub-vs-dub" },
        { name: "Subbed anime", url: "/guides/subbed-anime" },
      ]}
      title="Subbed anime"
      description="When a group should watch the original audio together."
      url="/guides/subbed-anime"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Subbed anime when the group can read together</SeoGuideTitle>
      <h2 id="answer" className="scroll-mt-24">
        Short answer
      </h2>
      <SeoGuideAnswer>
        <p>
          Subbed anime is the original audio plus the on-screen text. Use it
          for a live room when that is the version everyone will follow. The
          comparison with a dub stays on{" "}
          <Link href="/sub-vs-dub">sub vs dub</Link>.
        </p>
      </SeoGuideAnswer>
      <h2 id="stay" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        When the group should stay on subs
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "There is no English track",
            body: "If the audio menu has no English row, the episode is sub only. Do not wait for a dub that is not there.",
          },
          {
            title: "The group wants the original performances",
            body: "Everyone has to be able to keep up with the text. One person reading and one person listening will laugh at different times.",
          },
          {
            title: "You already started on subs",
            body: "Switching audio mid-series changes voices. Finish the cour on the version you opened.",
          },
        ]}
      />
      <h2 id="room" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Start the room on the sub
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Each person opens the same episode on their own Crunchyroll account or
        a full YouTube watch page, confirms the audio is the original, and
        joins the AniDachi room. If the night should be English instead, use{" "}
        <Link
          href="/guides/romance-anime-dubbed"
          className="text-brand-orange hover:underline"
        >
          romance anime dubbed
        </Link>{" "}
        for that genre, or{" "}
        <Link href="/guides/watch-anime-dub" className="text-brand-orange hover:underline">
          watch anime dub
        </Link>{" "}
        for the switch. Install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/sub-vs-dub", label: "Sub vs dub" },
          { href: "/guides/watch-anime-dub", label: "Watch anime dub" },
          {
            href: "/glossary/dub-vs-sub-watch-party",
            label: "Dub vs sub glossary",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
