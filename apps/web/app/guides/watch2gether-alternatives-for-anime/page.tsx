import type { Metadata } from "next";
import Link from "next/link";
import { AlternativesGuide } from "@/components/alternatives-guide";
import { languageAlternates } from "@/lib/hreflang";

/**
 * One Watch2Gether alternatives page for every platform (ANI-44 step 4 / ANI-79,
 * owner-approved 23 Nov 2026). The URL keeps "-for-anime" because it holds the rankings
 * ("watch2gether alternatives" position 7.2); the YouTube twin and the compare page 308 here.
 * Keyword Planner, 23 Nov 2026 (worldwide / US per month): "watch2gether alternative"
 * 480 / 70, "watch2gether netflix" 720 / 40.
 */
const PAGE_PATH = "/guides/watch2gether-alternatives-for-anime";
const PAGE_TITLE = "Best Watch2Gether Alternatives: 6 Sites Like W2G";
const PAGE_DESCRIPTION =
  "Watch2Gether alternatives and sites like Watch2Gether compared: which work with Netflix and Crunchyroll, which run on phones, and which have video chat.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: languageAlternates({ en: PAGE_PATH, de: "/de/watch2gether-alternative" }, "en"),
  openGraph: {
    title: PAGE_TITLE,
    description: "Sites and apps like Watch2Gether for Netflix, Crunchyroll and YouTube, compared.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "AniDachi, Kosmi, SyncUp, Teleparty, Rave and Discord compared with Watch2Gether.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is the best Watch2Gether alternative?",
    answer:
      "For Netflix or Crunchyroll with voice and video calls on the player, AniDachi. For free rooms with video chat on any device, Kosmi. For free web rooms plus a streaming extension, SyncUp. For the most streaming services with text chat, Teleparty.",
  },
  {
    question: "Does Watch2Gether work with Netflix?",
    answer:
      "Watch2Gether says Netflix, Amazon and Disney+ are supported through its browser extension (checked 23 Nov 2026). Each viewer needs their own Netflix account. AniDachi, Teleparty and SyncUp's extension also sync Netflix.",
  },
  {
    question: "Can you watch anime on Watch2Gether?",
    answer:
      "Watch2Gether's site doesn't name Crunchyroll. For Crunchyroll, AniDachi syncs each person's own player and friends join free; Rave and SyncUp's extension also list Crunchyroll, and Teleparty needs Premium for it.",
  },
  {
    question: "Is there a free site like Watch2Gether?",
    answer:
      "Yes. Kosmi is free with voice and video chat, and SyncUp has free rooms for YouTube and web videos with no account. On AniDachi, friends join free and a Free host gets 30 minutes a day for up to 4 people.",
  },
];

export default function Watch2GetherAlternativesPage() {
  return (
    <AlternativesGuide
      path={PAGE_PATH}
      subject="watch2gether"
      alternatives={["anidachi", "kosmi", "syncup", "teleparty", "rave", "discord"]}
      breadcrumbName="Watch2Gether alternatives"
      layoutTitle="Best Watch2Gether alternatives"
      description={PAGE_DESCRIPTION}
      h1="Best Watch2Gether Alternatives (2026)"
      datePublished="2026-07-19"
      faq={faq}
      answer={
        <p>
          <strong>
            Watch2Gether is great for free YouTube rooms. The best Watch2Gether
            alternative depends on what you want: Netflix or Crunchyroll with
            calls (AniDachi), free video chat on any device (Kosmi), free web
            rooms plus a streaming extension (SyncUp), or the most streaming
            services (Teleparty).
          </strong>{" "}
          Every competitor detail here comes from that company&apos;s own site,
          checked on 23 Nov 2026.
        </p>
      }
      sections={[
        {
          id: "by-platform",
          label: "Sites like Watch2Gether, by platform",
          content: (
            <>
              <h3 id="netflix" className="mt-6 scroll-mt-24 text-xl font-semibold text-ani-text">
                Netflix
              </h3>
              <p className="mb-4 leading-relaxed text-ani-muted">
                Watch2Gether says Netflix works through its browser extension, and
                everyone needs their own account. If you want to talk while you
                watch, AniDachi puts voice and video calls on the player, and
                Teleparty is free on Netflix with text chat. Setup:{" "}
                <Link href="/netflix-watch-party">Netflix watch party</Link>.
              </p>
              <h3 id="anime" className="mt-6 scroll-mt-24 text-xl font-semibold text-ani-text">
                Crunchyroll and anime
              </h3>
              <p className="mb-4 leading-relaxed text-ani-muted">
                Watch2Gether doesn&apos;t name Crunchyroll. AniDachi syncs each
                person&apos;s own Crunchyroll player and friends join free; Rave and
                SyncUp&apos;s extension also list it. Setup:{" "}
                <Link href="/watch-crunchyroll-together">Crunchyroll watch party</Link>.
              </p>
              <h3 id="youtube" className="mt-6 scroll-mt-24 text-xl font-semibold text-ani-text">
                YouTube
              </h3>
              <p className="mb-4 leading-relaxed text-ani-muted">
                For quick playlists, Watch2Gether is hard to beat; SyncUp is the
                closest free match. Discord&apos;s Watch Together plays YouTube
                inside a call. AniDachi keeps everyone on their own signed-in
                youtube.com watch page, Premium included, with calls on the
                player. Setup:{" "}
                <Link href="/watch-youtube-together">YouTube watch party</Link>.
              </p>
            </>
          ),
        },
      ]}
      stay={
        <p>
          If your group mostly watches YouTube, wants no account and no install,
          and is happy with text chat and webcams, Watch2Gether already does the
          job for free, on phones too.
        </p>
      }
      related={[
        { href: "/guides/best-teleparty-alternatives-for-anime", label: "Best Teleparty alternatives" },
        { href: "/compare/anidachi-vs-kosmi", label: "Kosmi alternatives" },
        { href: "/watch-youtube-together", label: "YouTube watch party" },
        { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
      ]}
    />
  );
}
