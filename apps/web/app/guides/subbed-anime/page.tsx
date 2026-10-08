import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { HowToJsonLd } from "@/components/json-ld";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { INSTALL_HOWTO_STEP_TEXT_VIA_HUB } from "@/lib/install-cta";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
  {
    name: "Open the episode on your account",
    text: "Subbed anime is the original audio plus on-screen text. Use your own Crunchyroll account or a full YouTube watch page in desktop Chrome.",
  },
  {
    name: "Confirm there is no English track, or that you are leaving it off",
    text: "If the audio menu has no English row, the episode is sub only. If English is there and the group still wants the original performances, leave that track unselected.",
  },
  {
    name: "Make sure everyone can read",
    text: "A live room only stays together when the whole group is on that subtitle version. One person on the dub hears the line at a different time.",
  },
  {
    name: "Start the room on that version",
    text: `${INSTALL_HOWTO_STEP_TEXT_VIA_HUB} Share the room link after the episode number and the audio match.`,
  },
];

export const metadata: Metadata = {
  title: "Subbed Anime — When the Group Should Stay on Subs",
  description:
    "Subbed anime is the original audio with on-screen text. Stay on it when there is no English dub, or when everyone wants those performances, then start an AniDachi room.",
  alternates: { canonical: "/guides/subbed-anime" },
  openGraph: {
    title: "Subbed Anime",
    description: "Original audio, matching subtitles, then the watchroom.",
    url: "/guides/subbed-anime",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Subbed Anime",
    description: "When a live room should stay on subs.",
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
    question: "When should a group watch subbed anime?",
    answer:
      "When the episode has no English audio, or when everyone can read and wants the original performances. Do not mix subs and a dub in a live room.",
  },
  {
    question: "Is subbed anime the same decision as sub vs dub?",
    answer:
      "Sub vs dub is the comparison. This page is the case for staying on subs. The hub still holds both sides.",
  },
  {
    question: "Can we switch to the dub later?",
    answer:
      "You can, on a later episode, if English audio exists. Switching mid-episode changes the voices the group has been following. Async catch-up for someone who missed the night is planned and is not available today.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Stay on subs", level: 2 },
  { id: "versus", label: "Subbed versus dubbed", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function SubbedAnimePage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch subbed anime together"
        description="Confirm the original audio, then start an AniDachi room on that version."
        steps={howToSteps}
      />
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
        <SeoGuideAnswer>
          <p>
            Subbed anime is the original audio plus the on-screen text. Use it
            for a live AniDachi room when that is the version everyone will
            follow. The comparison with a dub stays on{" "}
            <Link href="/sub-vs-dub">sub vs dub</Link>.
          </p>
        </SeoGuideAnswer>
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How to stay on subs
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="versus" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Subbed versus dubbed in the same room
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          If English audio exists and the group wants to talk without reading,
          switch on{" "}
          <Link href="/guides/watch-anime-dub" className="text-brand-orange hover:underline">
            watch anime dub
          </Link>
          . Romance titles are on{" "}
          <Link
            href="/guides/romance-anime-dubbed"
            className="text-brand-orange hover:underline"
          >
            romance anime dubbed
          </Link>
          . The short definition is the{" "}
          <Link
            href="/glossary/dub-vs-sub-watch-party"
            className="text-brand-orange hover:underline"
          >
            dub vs sub glossary
          </Link>
          . Hosting the room needs Plus or Pro, on{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing
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
            { href: "/guides/watch-anime-dub", label: "Watch anime dub" },
            {
              href: "/watch-crunchyroll-together",
              label: "Crunchyroll watch party",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
