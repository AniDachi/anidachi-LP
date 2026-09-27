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
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
  {
    name: "Open the episode on your account",
    text: "Use your own Crunchyroll account, or a full YouTube watch page, in desktop Chrome.",
  },
  {
    name: "Switch to the dub",
    text: "On Crunchyroll, open the audio or language control and choose English when that track is listed. On YouTube, open the upload that is the dub, not a clip.",
  },
  {
    name: "Match the group",
    text: "Everyone confirms the same episode and the same audio before play. A live room feels off when half the group is reading.",
  },
  {
    name: "Start the watchroom",
    text: "Install AniDachi, create a room, and share the link. Each person keeps their own login.",
  },
];

export const metadata: Metadata = {
  title: "Watch Anime Dub — Start the English Audio, Then the Room",
  description:
    "Watch anime dub by switching to the English audio on your own Crunchyroll or YouTube player, then open an AniDachi room on that same version.",
  alternates: { canonical: "/guides/watch-anime-dub" },
  openGraph: {
    title: "Watch Anime Dub",
    description: "Pick the dub, confirm the group, then start the room.",
    url: "/guides/watch-anime-dub",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch Anime Dub",
    description: "Same episode, same English audio, then press play.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do I watch anime in dub with friends?",
    answer:
      "Each person opens the episode, selects the English audio where it is offered, and joins the same AniDachi watchroom. Agree on that track before you start.",
  },
  {
    question: "Does every title have an English dub?",
    answer:
      "No. If the language menu has no English track, that episode is sub only. Do not start the room until the group has picked the version that exists.",
  },
  {
    question: "Can half the room watch the dub?",
    answer:
      "The players can sit on different audio, but reactions land at different times. For a live watch, pick one version. Async catch-up is planned and is not available today.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Start the dub", level: 2 },
  { id: "where", label: "Dub versus a dub list", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function WatchAnimeDubPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch anime dub with friends"
        description="Select the English audio on your own player, then start an AniDachi watchroom."
        steps={howToSteps}
      />
      <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Sub vs dub", url: "/sub-vs-dub" },
        { name: "Watch anime dub", url: "/guides/watch-anime-dub" },
      ]}
      title="Watch anime dub"
      description="Switch to the English audio, then open a watchroom on that version."
      url="/guides/watch-anime-dub"
      datePublished="2026-09-27"
      dateModified="2026-09-27"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Watch anime dub with the group on one audio</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          To watch anime dub, open the episode on your own account and switch
          to the English audio before anyone presses play. A{" "}
          <Link href="/sub-vs-dub">sub vs dub</Link> room stays together only
          when everyone is on that same version.
        </p>
      </SeoGuideAnswer>
      <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        How to start the dub
      </h2>
      <SeoGuideSteps steps={howToSteps} />
      <h2 id="where" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Watch anime in dub, then pick the title
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        “Watch anime dub” and “watch anime in dub” are the same job: find the
        English track, then start. Where that button sits on Crunchyroll is on{" "}
        <Link
          href="/guides/dubbed-anime-on-crunchyroll"
          className="text-brand-orange hover:underline"
        >
          dubbed anime on Crunchyroll
        </Link>
        . A ranked set of group titles is on{" "}
        <Link
          href="/guides/best-dubbed-anime-to-watch-with-friends"
          className="text-brand-orange hover:underline"
        >
          best dubbed anime to watch with friends
        </Link>
        . A broader English list is on{" "}
        <Link
          href="/guides/english-dubbed-anime"
          className="text-brand-orange hover:underline"
        >
          English dubbed anime
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
            href: "/guides/dubbed-anime-on-crunchyroll",
            label: "Dubbed anime on Crunchyroll",
          },
          { href: "/guides/english-dubbed-anime", label: "English dubbed anime" },
        ]}
      />
    </SeoPageLayout>
    </>
  );
}
