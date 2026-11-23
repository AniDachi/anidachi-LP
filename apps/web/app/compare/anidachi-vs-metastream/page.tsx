import type { Metadata } from "next";
import Link from "next/link";
import { AlternativesGuide } from "@/components/alternatives-guide";

/**
 * Metastream alternatives (ANI-44 step 4 / ANI-79, owner-approved 23 Nov 2026). Was
 * "AniDachi vs Metastream"; "anidachi vs metastream" gets no searches, while this URL
 * already ranked for "metastream alternative" (position 5.8). The URL is kept. Keyword
 * Planner, 23 Nov 2026: "metastream alternative" 210 / 140 worldwide / US per month.
 */
const PAGE_PATH = "/compare/anidachi-vs-metastream";
const PAGE_TITLE = "Best Metastream Alternatives for Watching Together";
const PAGE_DESCRIPTION =
  "Metastream alternatives compared: which work with Netflix, YouTube and Crunchyroll, which run on phones, and which have free voice and video chat.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description: "Apps like Metastream, compared from each company's own pages.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "Watch2Gether, SyncUp, Kosmi, AniDachi, Teleparty and Discord compared with Metastream.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is the best Metastream alternative?",
    answer:
      "For a shared queue of web videos, Watch2Gether or SyncUp, both free with no account. For a free room with video chat on any device, Kosmi. For Netflix, YouTube or Crunchyroll on each person's own account with calls on the player, AniDachi in desktop Chrome.",
  },
  {
    question: "Is Metastream still working?",
    answer:
      "Its site was online on 23 Nov 2026, but it shows no release date, version or price, and says popular websites are supported without naming them. Test it with your group before a planned night.",
  },
  {
    question: "Which Metastream alternative works with Netflix?",
    answer:
      "AniDachi, Teleparty and SyncUp's extension sync Netflix on each person's own account, and Watch2Gether lists Netflix through its extension. Everyone needs their own Netflix access.",
  },
];

export default function MetastreamAlternativesPage() {
  return (
    <AlternativesGuide
      path={PAGE_PATH}
      subject="metastream"
      alternatives={["watch2gether", "syncup", "kosmi", "anidachi", "teleparty", "discord"]}
      breadcrumbName="Metastream alternatives"
      layoutTitle="Best Metastream alternatives"
      description={PAGE_DESCRIPTION}
      h1="Best Metastream Alternatives (2026)"
      datePublished="2026-07-19"
      faq={faq}
      answer={
        <p>
          <strong>
            For a shared queue of web videos like Metastream&apos;s, use
            Watch2Gether or SyncUp, both free with no account. For free video chat
            on any device, use Kosmi. For Netflix, YouTube or Crunchyroll on
            everyone&apos;s own account with calls on the player, use AniDachi.
          </strong>{" "}
          Every competitor detail here comes from that company&apos;s own site,
          checked on 23 Nov 2026.
        </p>
      }
      sections={[
        {
          id: "queue",
          label: "Queue-style rooms or synced players?",
          content: (
            <p className="mb-8 leading-relaxed text-ani-muted">
              Metastream, Watch2Gether and SyncUp&apos;s web rooms are built around
              a shared queue of videos from around the web, which suits YouTube
              nights and music. Paid services such as Netflix and Crunchyroll need
              each viewer signed in to their own account, which is what synced
              players such as AniDachi, Teleparty and SyncUp&apos;s extension do.
              Setup: <Link href="/watch-youtube-together">YouTube watch party</Link>{" "}
              and <Link href="/netflix-watch-party">Netflix watch party</Link>.
            </p>
          ),
        },
      ]}
      stay={
        <p>
          If Metastream still plays the sites your group uses and a shared queue
          with chat is all you need, there&apos;s no reason to move.
        </p>
      }
      related={[
        { href: "/guides/watch2gether-alternatives-for-anime", label: "Watch2Gether alternatives" },
        { href: "/compare/anidachi-vs-kosmi", label: "Kosmi alternatives" },
        { href: "/guides/best-teleparty-alternatives-for-anime", label: "Best Teleparty alternatives" },
        { href: "/watch-youtube-together", label: "YouTube watch party" },
      ]}
    />
  );
}
