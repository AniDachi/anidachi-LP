import type { Metadata } from "next";
import Link from "next/link";
import { AlternativesGuide } from "@/components/alternatives-guide";

/**
 * One Kast alternatives page for every platform (ANI-44 step 4 / ANI-79, owner-approved
 * 23 Nov 2026). The URL keeps "-for-youtube" because it holds the rankings ("kast
 * alternatives" position 8.7); the anime twin and the compare page 308 here. Keyword
 * Planner, 23 Nov 2026: "kast alternative" 70 / 20 worldwide / US per month. kast.gg said
 * "Kast is joining the Amaze family" on 23 Nov 2026, with no product described.
 */
const PAGE_PATH = "/guides/kast-alternatives-for-youtube";
const PAGE_TITLE = "Best Kast Alternatives (2026): Apps Like Kast";
const PAGE_DESCRIPTION =
  "Kast's site now says it's joining Amaze. Apps like Kast for watching Netflix, YouTube and anime together, with free voice and video chat. Checked Nov 2026.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description: "What kast.gg says now, and apps like Kast compared from each company's own pages.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "Kosmi, Hyperbeam, AniDachi, SyncUp, Watch2Gether and Discord as Kast alternatives.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Is Kast shutting down?",
    answer:
      "Kast hasn't said so on its site. On 23 Nov 2026, kast.gg showed only a notice that Kast is joining the Amaze family and a form to hear what's next. It no longer describes a watch party app, so plan a backup.",
  },
  {
    question: "What is the best Kast alternative?",
    answer:
      "For a shared room with free video chat on any device, Kosmi. For one cloud browser everyone controls, Hyperbeam. For Netflix, YouTube or Crunchyroll on each person's own account with calls on the player, AniDachi in desktop Chrome.",
  },
  {
    question: "Is there a free alternative to Kast?",
    answer:
      "Yes. Kosmi is free with voice and video chat, Watch2Gether and SyncUp have free rooms with no account, and Discord is free for the call. On AniDachi, friends join free and a Free host gets 20 minutes a day for up to 4 people.",
  },
];

export default function KastAlternativesPage() {
  return (
    <AlternativesGuide
      path={PAGE_PATH}
      subject="kast"
      alternatives={["kosmi", "hyperbeam", "anidachi", "syncup", "watch2gether", "discord"]}
      breadcrumbName="Kast alternatives"
      layoutTitle="Best Kast alternatives"
      description={PAGE_DESCRIPTION}
      h1="Best Kast Alternatives (2026)"
      datePublished="2026-07-19"
      faq={faq}
      answer={
        <p>
          <strong>
            kast.gg now says Kast is joining the Amaze family and no longer
            describes a watch party app. The closest match is Kosmi, a free shared
            room with video chat on any device. Hyperbeam offers a shared cloud
            browser, and AniDachi syncs Netflix, YouTube or Crunchyroll on each
            person&apos;s own account with calls on the player.
          </strong>{" "}
          Every competitor detail here comes from that company&apos;s own site,
          checked on 23 Nov 2026.
        </p>
      }
      sections={[
        {
          id: "shared-screen",
          label: "Shared screen or synced players?",
          content: (
            <p className="mb-8 leading-relaxed text-ani-muted">
              Rooms that share one screen or stream with everyone are easy, but
              paid services such as Netflix and Crunchyroll often block
              it, the same reason a Discord screen share goes black. Synced players
              (AniDachi, Teleparty, SyncUp&apos;s extension) play the video on each
              person&apos;s own account in full quality and only share play, pause
              and seek. Kosmi and Hyperbeam use a shared browser instead. More on
              the black screen:{" "}
              <Link href="/discord-watch-party">Discord watch party</Link>.
            </p>
          ),
        },
      ]}
      stay={
        <p>
          If your Kast rooms still open, nothing on kast.gg says they&apos;ll stop
          today, but nothing confirms they&apos;ll keep working either. Try one of
          the free options above before your next planned night.
        </p>
      }
      related={[
        { href: "/compare/anidachi-vs-kosmi", label: "Kosmi alternatives" },
        { href: "/compare/anidachi-vs-hyperbeam", label: "Hyperbeam alternatives" },
        { href: "/guides/watch2gether-alternatives-for-anime", label: "Watch2Gether alternatives" },
        { href: "/watch-youtube-together", label: "YouTube watch party" },
      ]}
    />
  );
}
