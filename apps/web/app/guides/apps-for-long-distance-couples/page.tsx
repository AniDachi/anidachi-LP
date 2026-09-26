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
  title: "Apps for Long Distance Couples — Watch Together Included",
  description:
    "Apps for long distance couples: a call for voice, and AniDachi when you want to watch Crunchyroll or YouTube in sync.",
  alternates: { canonical: "/guides/apps-for-long-distance-couples" },
  openGraph: {
    title: "Apps for Long Distance Couples",
    description: "Use a call for talking and AniDachi for the show.",
    url: "/guides/apps-for-long-distance-couples",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Apps for Long Distance Couples",
    description: "Voice in one app. Synced video in AniDachi.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What app should long distance couples use to watch together?",
    answer:
      "Use FaceTime, Discord, or another call for voice. Use AniDachi to sync Crunchyroll or a full YouTube video in desktop Chrome. Each person needs their own streaming account.",
  },
  {
    question: "Is there an anime-only list of long distance apps?",
    answer:
      "Yes. Best apps to watch anime together long distance covers the anime night in more detail. This page is the wider couple setup.",
  },
  {
    question: "Does one subscription cover both people?",
    answer:
      "No. AniDachi does not share a Crunchyroll or YouTube login. Plus or Pro on AniDachi is for the person who wants to record their own watch progress.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "stack", label: "A simple stack", level: 2 },
  { id: "relationship-apps", label: "Relationship apps", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AppsForLongDistanceCouplesPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        {
          name: "Watch movies long distance",
          url: "/watch-movies-together-long-distance",
        },
        {
          name: "Apps for long distance couples",
          url: "/guides/apps-for-long-distance-couples",
        },
      ]}
      title="Apps for long distance couples"
      description="A call plus a synced Crunchyroll or YouTube room."
      url="/guides/apps-for-long-distance-couples"
      datePublished="2026-09-26"
      dateModified="2026-09-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Apps for long distance couples</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          You need two jobs, not one mega-app. A call carries your voices.
          AniDachi syncs the Crunchyroll episode or YouTube video. Date plans
          that use that pair are on{" "}
          <Link href="/guides/long-distance-date-ideas">
            long distance date ideas
          </Link>
          .
        </p>
      </SeoGuideAnswer>
      <h2 id="stack" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        A simple stack
      </h2>
      <SeoGuideOptions
        options={[
          {
            title: "FaceTime or Discord",
            body: "Stay on the call the whole episode. This is only for talking.",
          },
          {
            title: "AniDachi",
            body: (
              <>
                Install from <Link href="/extension">/extension</Link>. Each
                person opens the same video and joins the watchroom. Playback
                stays on their own account.
              </>
            ),
            highlight: true,
          },
          {
            title: "Anime-only nights",
            body: (
              <>
                If the date is only anime, use{" "}
                <Link href="/best-apps-watch-anime-together-long-distance">
                  best apps to watch anime together long distance
                </Link>
                .
              </>
            ),
          },
        ]}
      />
      <h2 id="relationship-apps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Long distance relationship apps
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        That phrase is the same list: a call app plus a way to watch. AniDachi
        is the watch half for Crunchyroll and YouTube. It does not replace your
        messages, and it does not sync Netflix.
      </p>
      <SeoGuideRelated
        links={[
          {
            href: "/watch-movies-together-long-distance",
            label: "Watch movies long distance",
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
