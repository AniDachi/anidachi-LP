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
  title: "Netflix Group Watch — More Than Two People, Own Accounts",
  description:
    "A Netflix group watch is three or more people on the same title at the same time. Each person needs Netflix. AniDachi group rooms for Netflix are coming to desktop Chrome.",
  alternates: { canonical: "/guides/netflix-group-watch" },
  openGraph: {
    title: "Netflix Group Watch",
    description: "A group on one Netflix title, each on their own account.",
    url: "/guides/netflix-group-watch",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Netflix Group Watch",
    description: "How a group watches one Netflix title together.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is a Netflix group watch?",
    answer:
      "Several people watch the same Netflix movie or episode at the same time and talk during it. It is the group version of a Netflix watch party.",
  },
  {
    question: "Can the group share one Netflix account?",
    answer:
      "Plan on one login per person. AniDachi does not send one person’s Netflix picture to the others.",
  },
  {
    question: "Is AniDachi ready for a Netflix group?",
    answer:
      "Not yet. Netflix rooms are being added for desktop Chrome. Crunchyroll and YouTube groups can use the public extension now.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "size", label: "What changes with a group", level: 2 },
  { id: "start", label: "How to start", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function NetflixGroupWatchPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        { name: "Netflix group watch", url: "/guides/netflix-group-watch" },
      ]}
      title="Netflix group watch"
      description="Three or more people on one Netflix title."
      url="/guides/netflix-group-watch"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Netflix group watch</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          A Netflix group watch is more than two people on the same title at
          the same time. It is still a{" "}
          <Link href="/netflix-watch-party">Netflix watch party</Link>. The
          extra people are why the title and the start time have to be settled
          before the call. AniDachi’s Netflix rooms are not public yet.
        </p>
      </SeoGuideAnswer>
      <h2 id="size" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What changes when the group is bigger
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "One title, sent early",
            body: "If the group is still choosing at start time, half the people are in the wrong episode.",
          },
          {
            title: "One login each",
            body: "Every person opens Netflix on their own account in desktop Chrome.",
          },
          {
            title: "One voice channel",
            body: "Discord is enough for talk. Sharing the Netflix window from that call often goes black.",
          },
        ]}
      />
      <h2 id="start" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Where the steps are
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Friend-group steps are on{" "}
        <Link
          href="/guides/how-to-watch-netflix-with-friends"
          className="text-brand-orange hover:underline"
        >
          how to watch Netflix with friends
        </Link>
        . A pair should use{" "}
        <Link
          href="/guides/watch-netflix-together"
          className="text-brand-orange hover:underline"
        >
          watch Netflix together
        </Link>
        . Whether Netflix includes this mode is answered on{" "}
        <Link
          href="/guides/does-netflix-have-a-watch-party"
          className="text-brand-orange hover:underline"
        >
          does Netflix have a watch party
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/netflix-watch-party", label: "Netflix watch party" },
          {
            href: "/guides/how-to-watch-netflix-with-friends",
            label: "How to watch Netflix with friends",
          },
          {
            href: "/guides/does-netflix-have-a-watch-party",
            label: "Does Netflix have a watch party?",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
