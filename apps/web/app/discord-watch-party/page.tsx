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
  title: "Discord Watch Party — Voice on Discord, Sync on AniDachi",
  description:
    "Run a Discord watch party without a soft screen share. Keep the voice call in Discord and sync Crunchyroll or YouTube with AniDachi.",
  alternates: { canonical: "/discord-watch-party" },
  openGraph: {
    title: "Discord Watch Party",
    description: "Discord for voice. AniDachi for synced Crunchyroll and YouTube.",
    url: "/discord-watch-party",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Discord Watch Party",
    description: "Keep Discord voice. Sync playback in each person’s own tab.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Can Discord host a watch party?",
    answer:
      "Discord can share a screen during a voice call. For Crunchyroll and YouTube, that share is often soft, late, or black because of video protection. AniDachi syncs each person’s own tab instead.",
  },
  {
    question: "Should we leave the Discord call?",
    answer:
      "No. Stay in the Discord voice call if you want to talk. Use AniDachi only for playback, chat in the room, and reactions.",
  },
  {
    question: "Does AniDachi sync Netflix inside Discord?",
    answer:
      "No. AniDachi syncs Crunchyroll catalog pages and full YouTube watch pages in desktop Chrome. It does not sync Netflix.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "options", label: "Two ways to watch", level: 2 },
  { id: "crunchyroll", label: "Crunchyroll on Discord", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordWatchPartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Discord watch party", url: "/discord-watch-party" },
      ]}
      title="Discord watch party"
      description="Discord voice plus synced Crunchyroll or YouTube."
      url="/discord-watch-party"
      datePublished="2026-09-26"
      dateModified="2026-09-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
      itemList={[
        {
          name: "How to screen share on Discord",
          url: "/guides/how-to-screen-share-on-discord",
          position: 1,
        },
        {
          name: "Watch Crunchyroll together",
          url: "/watch-crunchyroll-together",
          position: 2,
        },
      ]}
    >
      <SeoGuideTitle>Discord watch party without the blurry share</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          Keep the Discord call for voice. Sync the video with AniDachi so
          everyone plays Crunchyroll or YouTube in their own tab. Screen share
          still works for a quick demo. It is a poor way to watch a whole
          episode.
        </p>
      </SeoGuideAnswer>
      <h2 id="options" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Two ways to watch
      </h2>
      <SeoGuideOptions
        options={[
          {
            title: "Discord screen share",
            body: (
              <>
                One person shares a window. The steps are on{" "}
                <Link href="/guides/how-to-screen-share-on-discord">
                  how to screen share on Discord
                </Link>
                . Expect lower quality, delay, and a black screen on some
                protected players.
              </>
            ),
          },
          {
            title: "Discord voice plus AniDachi",
            body: (
              <>
                Everyone installs from <Link href="/extension">/extension</Link>
                , opens the same Crunchyroll episode or YouTube video, and
                joins one watchroom. Talk stays in Discord.
              </>
            ),
            highlight: true,
          },
        ]}
      />
      <h2 id="crunchyroll" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Crunchyroll on Discord
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        A Crunchyroll share often goes black because the player blocks capture.
        Leave the voice channel up. Each person opens the same episode on their
        own Crunchyroll account, then joins the AniDachi room from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        . YouTube works the same way on a full watch page, not Shorts.
      </p>
      <SeoGuideRelated
        links={[
          {
            href: "/guides/how-to-watch-anime-with-friends-on-discord",
            label: "Watch anime on Discord",
          },
          {
            href: "/watch-crunchyroll-together",
            label: "Crunchyroll watch party",
          },
          { href: "/watch-youtube-together", label: "YouTube watch party" },
        ]}
      />
    </SeoPageLayout>
  );
}
