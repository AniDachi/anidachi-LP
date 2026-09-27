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
  title: "English Dubbed Anime — Same Audio for the Whole Room",
  description:
    "English dubbed anime means the English voice track. Confirm it on each person’s Crunchyroll or YouTube player before you start an AniDachi room.",
  alternates: { canonical: "/guides/english-dubbed-anime" },
  openGraph: {
    title: "English Dubbed Anime",
    description: "Find the English audio, then watch it together.",
    url: "/guides/english-dubbed-anime",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "English Dubbed Anime",
    description: "One English track for the group, on your own accounts.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What counts as English dubbed anime?",
    answer:
      "The episode’s English voice track, not translated comments under a Japanese video. On Crunchyroll that is an audio option when the title has one. On YouTube it is the upload that is actually the dub.",
  },
  {
    question: "Where is the best English dubbed anime list?",
    answer:
      "Ranked group picks stay on best dubbed anime to watch with friends. This page is how to recognize an English dub and start a room on it.",
  },
  {
    question: "Do we all need the English track selected?",
    answer:
      "For a live watch, yes. If one person is on Japanese audio with subtitles, the line arrives at a different time. AniDachi syncs playback. It does not force one audio choice.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "find", label: "Where the English audio is", level: 2 },
  { id: "list", label: "A list versus a ranking", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function EnglishDubbedAnimePage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Sub vs dub", url: "/sub-vs-dub" },
        { name: "English dubbed anime", url: "/guides/english-dubbed-anime" },
      ]}
      title="English dubbed anime"
      description="How to tell you are on the English audio before a watchroom starts."
      url="/guides/english-dubbed-anime"
      datePublished="2026-09-27"
      dateModified="2026-09-27"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>English dubbed anime for a live room</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          English dubbed anime is the English voice track on the episode you
          opened. Check that track on every screen before you start.{" "}
          <Link href="/sub-vs-dub">Sub vs dub</Link> only works live when the
          group is on one version.
        </p>
      </SeoGuideAnswer>
      <h2 id="find" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Where the English audio lives
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Crunchyroll",
            body: "Open the episode on your account. If English is in the audio menu, choose it. No English row means that episode is not dubbed there.",
          },
          {
            title: "YouTube",
            body: "Use a full watch page that is the dub. A clip, a Short, or an embed is not the episode.",
          },
          {
            title: "The room",
            body: "After the audio matches, create the AniDachi watchroom. Each person keeps their own login.",
          },
        ]}
      />
      <h2 id="list" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        English dubbed anime is not the best-of list
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        This page is the category: English audio, confirmed, then play. Ranked
        picks for a group stay on{" "}
        <Link
          href="/guides/best-dubbed-anime-to-watch-with-friends"
          className="text-brand-orange hover:underline"
        >
          best dubbed anime to watch with friends
        </Link>
        . The Crunchyroll language control is on{" "}
        <Link
          href="/guides/dubbed-anime-on-crunchyroll"
          className="text-brand-orange hover:underline"
        >
          dubbed anime on Crunchyroll
        </Link>
        . The steps to switch and start are on{" "}
        <Link
          href="/guides/watch-anime-dub"
          className="text-brand-orange hover:underline"
        >
          watch anime dub
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
            href: "/guides/best-dubbed-anime-to-watch-with-friends",
            label: "Best dubbed anime to watch with friends",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
