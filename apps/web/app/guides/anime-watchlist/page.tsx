import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
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
    name: "Write the titles you mean to start",
    text: "An anime watchlist is a personal plan, not a public ranking. Keep my anime watchlist to titles you will actually open.",
  },
  {
    name: "Split off the next few",
    text: "Put only the next three to five on an animes to watch list. A long watchlist is the backlog. The short queue is what you start this week.",
  },
  {
    name: "Open the real player",
    text: "Use your own Crunchyroll account, or a full youtube.com/watch page, in desktop Chrome. Shorts, embeds, and the YouTube mobile app are not the episode.",
  },
  {
    name: "Save the episode after you press play",
    text: `${INSTALL_HOWTO_STEP_TEXT_VIA_HUB} Plus or Pro can record that place when you allow it. YouTube recording is a separate switch. Free can open saved history, Resume, and delete it. Adding a title to the list does not mark it watched.`,
  },
];

export const metadata: Metadata = {
  title: "Anime Watchlist — My Anime Watchlist, Then Press Play",
  description:
    "Build an anime watchlist of titles you plan to start. My anime watchlist stays personal. AniDachi records the Crunchyroll episode or YouTube video only after you play it.",
  alternates: { canonical: "/guides/anime-watchlist" },
  openGraph: {
    title: "Anime Watchlist",
    description: "A plan-to-watch list. Progress starts when the player does.",
    url: "/guides/anime-watchlist",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Watchlist",
    description: "Plan the titles. AniDachi records the episode you play.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is an anime watchlist?",
    answer:
      "A personal list of titles you intend to start. It is not a scoreboard and not a public profile. Checking a title onto the list does not mean you watched it.",
  },
  {
    question: "Is my anime watchlist the same search?",
    answer:
      "Yes. My anime watchlist is the same plan, kept on your account. Friends in a watchroom do not share that list.",
  },
  {
    question: "When does a watchlist title become progress?",
    answer:
      "When you play it on your own Crunchyroll or YouTube tab in desktop Chrome. Recording needs your own Plus or Pro access, including a trial, and your permission. Free can still open saved history, Resume, and delete it.",
  },
  {
    question: "How is this different from a queue or a diary?",
    answer:
      "The watchlist is the backlog you plan to start. The animes to watch list is the next few. The anime diary and anime checklist are for titles you have already played.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "How to use it", level: 2 },
  { id: "mine", label: "My anime watchlist", level: 2 },
  { id: "played", label: "After you press play", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AnimeWatchlistPage() {
  return (
    <>
      <HowToJsonLd
        name="How to keep an anime watchlist"
        description="Plan titles you will start, then let AniDachi record the episode you actually play."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Anime tracker", url: "/anime-tracker" },
          { name: "Anime watchlist", url: "/guides/anime-watchlist" },
        ]}
        title="Anime watchlist"
        description="A personal plan-to-watch list for Crunchyroll and YouTube."
        url="/guides/anime-watchlist"
        datePublished="2026-10-08"
        dateModified="2026-10-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>Anime watchlist for titles you plan to start</SeoGuideTitle>
        <h2 id="answer" className="scroll-mt-24">
          Short answer
        </h2>
        <SeoGuideAnswer>
          <p>
            An anime watchlist is the personal set of titles you mean to open
            later. <Link href="/anime-tracker">AniDachi</Link> does not treat
            that list as watched. Progress starts when the Crunchyroll episode
            or YouTube video is playing in desktop Chrome.
          </p>
        </SeoGuideAnswer>
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How to keep the list useful
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="mine" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          My anime watchlist
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "It is yours",
              body: "My anime watchlist is the same idea with the owner named. A watchroom does not copy it onto anyone else’s account.",
            },
            {
              title: "It is not the next episode",
              body: "Park the long plan here. Move only the next few titles to the animes to watch list so you know what to open.",
            },
            {
              title: "It is not a group ranking",
              body: "If the night is for friends, start from best anime to watch with friends, then come back here for what you personally still owe yourself.",
            },
          ]}
        />
        <h2 id="played" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          After you press play
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Plus or Pro records the episode when recording is allowed. YouTube
          has its own switch. Free can open what was already saved, Resume,
          and delete it. Prices are on{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing
          </Link>
          . Finished notes belong in the{" "}
          <Link href="/guides/anime-diary" className="text-brand-orange hover:underline">
            anime diary
          </Link>{" "}
          or on the{" "}
          <Link
            href="/guides/anime-checklist"
            className="text-brand-orange hover:underline"
          >
            anime checklist
          </Link>
          . Crunchyroll’s own episode list is a different page,{" "}
          <Link
            href="/crunchyroll-watch-history"
            className="text-brand-orange hover:underline"
          >
            Crunchyroll watch history
          </Link>
          . Install from{" "}
          <Link href="/extension" className="text-brand-orange hover:underline">
            /extension
          </Link>
          .
        </p>
        <SeoGuideRelated
          links={[
            { href: "/anime-tracker", label: "Anime tracker" },
            { href: "/guides/animes-to-watch-list", label: "Animes to watch list" },
            {
              href: "/guides/best-anime-to-watch-with-friends",
              label: "Best anime to watch with friends",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
