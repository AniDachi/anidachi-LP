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
  title: "Watch Movies Together Online — YouTube and Anime Films",
  description:
    "Watch movies together online on YouTube or as anime films on Crunchyroll. AniDachi syncs each person’s own tab in desktop Chrome.",
  alternates: { canonical: "/guides/watch-movies-together-online" },
  openGraph: {
    title: "Watch Movies Together Online",
    description: "A shared YouTube movie or Crunchyroll film, in sync.",
    url: "/guides/watch-movies-together-online",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch Movies Together Online",
    description: "Same movie, separate accounts, one watchroom.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do I watch movies together online?",
    answer:
      "Open the same full YouTube movie, or the same anime film on Crunchyroll, in desktop Chrome. Install AniDachi, create a watchroom, and share the link.",
  },
  {
    question: "Does this work for Netflix movies?",
    answer:
      "No. AniDachi does not sync Netflix, Disney+, Hulu, or Prime Video. Use a YouTube movie page or a Crunchyroll film.",
  },
  {
    question: "What if we are in different cities?",
    answer:
      "The same room works. The long-distance setup, including the call, is on watch movies together long distance.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "pick", label: "Pick the movie", level: 2 },
  { id: "websites", label: "Websites and apps", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function WatchMoviesTogetherOnlinePage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch party app", url: "/watch-party-app" },
        {
          name: "Watch movies together online",
          url: "/guides/watch-movies-together-online",
        },
      ]}
      title="Watch movies together online"
      description="Sync a YouTube movie or Crunchyroll film."
      url="/guides/watch-movies-together-online"
      datePublished="2026-09-26"
      dateModified="2026-09-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Watch movies together online</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          Open one full YouTube movie page, or one anime film on Crunchyroll.
          AniDachi, the{" "}
          <Link href="/watch-party-app">watch party app</Link>, keeps those
          tabs on the same moment. Each person still uses their own account.
        </p>
      </SeoGuideAnswer>
      <h2 id="pick" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Pick the movie
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "YouTube",
            body: "Use a youtube.com/watch URL. Shorts and the mobile app are not supported.",
          },
          {
            title: "Crunchyroll films",
            body: "Anime movies on Crunchyroll work the same way as episodes. Everyone needs their own login.",
          },
          {
            title: "Different cities",
            body: "Stay on a call and follow watch movies together long distance for the couple setup.",
          },
        ]}
      />
      <h2 id="websites" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Websites and apps that watch movies together
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        “Website to watch movies together” and “apps to watch movies together”
        are this same job. AniDachi is the Chrome piece for a YouTube movie or a
        Crunchyroll film. If you are in different cities, use{" "}
        <Link
          href="/watch-movies-together-long-distance"
          className="text-brand-orange hover:underline"
        >
          watch movies together long distance
        </Link>{" "}
        for the call plus the room.
      </p>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        . YouTube nights also start at{" "}
        <Link
          href="/watch-youtube-together"
          className="text-brand-orange hover:underline"
        >
          the YouTube watch party
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/watch-party-app", label: "Watch party app" },
          {
            href: "/watch-movies-together-long-distance",
            label: "Watch movies long distance",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
