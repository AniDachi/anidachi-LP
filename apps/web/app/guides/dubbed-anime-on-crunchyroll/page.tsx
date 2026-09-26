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
  title: "Dubbed Anime on Crunchyroll — Watch the English Dub Together",
  description:
    "Find dubbed anime on Crunchyroll, pick the English audio, and watch that version together with AniDachi. Each person uses their own account.",
  alternates: { canonical: "/guides/dubbed-anime-on-crunchyroll" },
  openGraph: {
    title: "Dubbed Anime on Crunchyroll",
    description: "English dubs on Crunchyroll, then a synced watchroom.",
    url: "/guides/dubbed-anime-on-crunchyroll",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dubbed Anime on Crunchyroll",
    description: "Same English dub for the group, in each person’s own tab.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Does Crunchyroll have English dubs?",
    answer:
      "Yes for many series and films. Open the title, choose the English audio if it is listed, and confirm the episode is the dub before you invite friends.",
  },
  {
    question: "Does everyone need Crunchyroll?",
    answer:
      "Yes. Each person streams from their own Crunchyroll account in desktop Chrome. AniDachi syncs playback. It does not share one login.",
  },
  {
    question: "What if a friend only wants subs?",
    answer:
      "Decide before the live room. Mixed audio makes reactions miss each other. Read sub vs dub, then stick to one version.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "start", label: "Start the dub", level: 2 },
  { id: "audio", label: "English dub", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DubbedAnimeOnCrunchyrollPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Sub vs dub", url: "/sub-vs-dub" },
        {
          name: "Dubbed anime on Crunchyroll",
          url: "/guides/dubbed-anime-on-crunchyroll",
        },
      ]}
      title="Dubbed anime on Crunchyroll"
      description="Watch a Crunchyroll English dub together."
      url="/guides/dubbed-anime-on-crunchyroll"
      datePublished="2026-09-26"
      dateModified="2026-09-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Dubbed anime on Crunchyroll</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          Crunchyroll carries English dubs for a lot of series. Choose that
          audio, make sure the group is on the same episode, and sync it with
          AniDachi. The <Link href="/sub-vs-dub">sub vs dub</Link> choice should
          be settled before anyone hits play.
        </p>
      </SeoGuideAnswer>
      <h2 id="start" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Start the dub
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Open the title",
            body: "Use your own Crunchyroll account in desktop Chrome.",
          },
          {
            title: "Select English",
            body: "If the player lists an English dub, switch to it and check the episode title.",
          },
          {
            title: "Share a room",
            body: "Install from /extension, create a watchroom, and send the link. Friends open the same dub.",
          },
        ]}
      />
      <h2 id="audio" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Switch to the English dub
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        On the Crunchyroll player, open the audio or language control and choose
        English when that track exists. If English is missing, that episode is
        sub only. Do not start the room until everyone sees the same audio name.
        Crunchyroll dubs and the English dub label are the same catalog, not a
        second site.
      </p>
      <SeoGuideRelated
        links={[
          { href: "/sub-vs-dub", label: "Sub vs dub" },
          {
            href: "/guides/best-dubbed-anime-to-watch-with-friends",
            label: "Best dubbed anime with friends",
          },
          {
            href: "/watch-crunchyroll-together",
            label: "Crunchyroll watch party",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
