import type { Metadata } from "next";
import Link from "next/link";
import { AlternativesGuide } from "@/components/alternatives-guide";

/**
 * Kosmi alternatives (ANI-44 step 4 / ANI-79, owner-approved 23 Nov 2026). Was "AniDachi vs
 * Kosmi"; "anidachi vs kosmi" gets no searches, while this URL already ranked for "kosmi
 * alternative" (position 9.0). The URL is kept for its rankings. Keyword Planner, 23 Nov
 * 2026 (worldwide / US per month): "kosmi alternative" 110 / 30, "apps like kosmi" 50 / 10,
 * "sites like kosmi" 40 / 10.
 */
const PAGE_PATH = "/compare/anidachi-vs-kosmi";
const PAGE_TITLE = "Best Kosmi Alternatives: 6 Sites Like Kosmi (2026)";
const PAGE_DESCRIPTION =
  "Kosmi alternatives compared: which sync Netflix and Crunchyroll on everyone's own account, which run on phones, and which have free voice and video chat.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description: "Sites and apps like Kosmi, compared from each company's own pages.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "AniDachi, SyncUp, Watch2Gether, Teleparty, Hyperbeam and Discord compared with Kosmi.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is the best Kosmi alternative?",
    answer:
      "For Netflix, YouTube or Crunchyroll on each person's own account, with calls on the player, AniDachi in desktop Chrome. For free web rooms plus a streaming extension, SyncUp. For free YouTube rooms with no account, Watch2Gether. For the most streaming services with text chat, Teleparty.",
  },
  {
    question: "What's the difference between Kosmi and AniDachi?",
    answer:
      "Kosmi plays streaming sites in a shared browser that everyone watches. AniDachi syncs each person's own Netflix, YouTube or Crunchyroll player, so everyone watches on their own account at their own quality, with voice and video calls on the player. Kosmi works on phones; AniDachi is desktop Chrome only.",
  },
  {
    question: "Is there a site like Kosmi for phones?",
    answer:
      "SyncUp works in phone browsers and has apps, Watch2Gether rooms open in a phone browser, and Discord works on every phone for the call. Kosmi itself has a mobile app but recommends a desktop or tablet.",
  },
  {
    question: "Does Kosmi work with Crunchyroll?",
    answer:
      "Kosmi's pages don't name Crunchyroll (checked 23 Nov 2026). AniDachi, Rave and SyncUp's extension list it, and Teleparty needs Premium for it.",
  },
];

export default function KosmiAlternativesPage() {
  return (
    <AlternativesGuide
      path={PAGE_PATH}
      subject="kosmi"
      alternatives={["anidachi", "syncup", "watch2gether", "teleparty", "hyperbeam", "discord"]}
      breadcrumbName="Kosmi alternatives"
      layoutTitle="Best Kosmi alternatives"
      description={PAGE_DESCRIPTION}
      h1="Best Kosmi Alternatives (2026)"
      datePublished="2026-10-19"
      faq={faq}
      answer={
        <p>
          <strong>
            Kosmi is a free room with a shared browser and video chat. Switch to
            AniDachi when you want Netflix, YouTube or Crunchyroll on each
            person&apos;s own account with calls on the player, to SyncUp for free
            web rooms plus a streaming extension, or to Watch2Gether for YouTube
            with no account.
          </strong>{" "}
          Every competitor detail here comes from that company&apos;s own site,
          checked on 23 Nov 2026.
        </p>
      }
      sections={[
        {
          id: "anidachi-vs-kosmi",
          label: "AniDachi vs Kosmi",
          content: (
            <p className="mb-8 leading-relaxed text-ani-muted">
              The core difference is where the video plays. Kosmi streams one
              shared browser to the room, so the quality everyone sees depends on
              that stream, and Kosmi&apos;s pages don&apos;t name Crunchyroll.
              AniDachi plays the video on each person&apos;s own Netflix, YouTube or
              Crunchyroll account and only syncs play, pause and seek, so everyone
              gets full quality, with voice and video calls on the player. Kosmi
              wins on phones and no install; AniDachi needs desktop Chrome. Setup:{" "}
              <Link href="/watch-crunchyroll-together">Crunchyroll watch party</Link>{" "}
              and <Link href="/netflix-watch-party">Netflix watch party</Link>.
            </p>
          ),
        },
      ]}
      stay={
        <p>
          If your group mixes phones, tablets and computers, wants free video chat
          and games, and doesn&apos;t want to install anything, Kosmi already
          covers that.
        </p>
      }
      related={[
        { href: "/guides/best-teleparty-alternatives-for-anime", label: "Best Teleparty alternatives" },
        { href: "/guides/watch2gether-alternatives-for-anime", label: "Watch2Gether alternatives" },
        { href: "/compare/anidachi-vs-hyperbeam", label: "Hyperbeam alternatives" },
        { href: "/virtual-movie-night", label: "Virtual movie night" },
      ]}
    />
  );
}
