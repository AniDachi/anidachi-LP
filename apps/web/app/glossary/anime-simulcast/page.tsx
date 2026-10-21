import type { Metadata } from "next";
import Link from "next/link";
import { SeoGuideAnswer, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { CRUNCHYROLL_DUB_WEEK, dubLagSummary } from "@/lib/tools/crunchyroll-dub-schedule";
import { CRUNCHYROLL_WEEK } from "@/lib/tools/crunchyroll-schedule";

const url = "/glossary/anime-simulcast";
const headingClass = "mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";
const linkClass = "font-medium text-ani-text underline decoration-ani-line underline-offset-4";
const dubs = dubLagSummary(CRUNCHYROLL_DUB_WEEK);
const typicalGap = dubs.typicalGap ?? 2;

const title = "Simulcast Meaning: What Is an Anime Simulcast?";
const description =
  "Simulcast meaning: a new anime episode streams outside Japan within hours of its TV broadcast. How Crunchyroll simulcasts work, and when subs and dubs arrive.";

export const metadata: Metadata = {
  title: "Simulcast Meaning: What Is an Anime Simulcast?",
  description,
  alternates: { canonical: url },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],
    title,
    description: "What a simulcast is, how Crunchyroll simulcasts work, and when sub and dub episodes arrive.",
    url,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: "What a simulcast is, how Crunchyroll simulcasts work, and when sub and dub episodes arrive.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What does simulcast mean in anime?",
    answer:
      "A simulcast is a new anime episode released to viewers outside Japan at the same time as its Japanese TV broadcast, or within a few hours of it, usually with subtitles. Seasonal shows simulcast one episode a week.",
  },
  {
    question: "What is a simulcast on Crunchyroll?",
    answer:
      "On Crunchyroll, a simulcast is a current-season show whose new subtitled episodes appear on the service shortly after they air in Japan. Crunchyroll lists them on its simulcast calendar, one slot per show each week.",
  },
  {
    question: "Is a simulcast subbed or dubbed?",
    answer: `Usually subbed. Some English dubs stream at the same time as the sub (same-day dubs), but most start later. This week ${dubs.sameDay} of ${dubs.total} English dubs on Crunchyroll are same-day; most of the rest trail the sub by about ${typicalGap} episodes.`,
  },
  {
    question: "Why do simulcast times change on my clock?",
    answer:
      "Simulcast slots follow the broadcast in Japan, which has no daylight saving time. When your clocks change, the same episode unlocks an hour earlier or later in your local time.",
  },
  {
    question: "Can I watch simulcast episodes with friends using AniDachi?",
    answer:
      "Yes. A Plus, Pro or trial host creates an AniDachi room once the episode is out on Crunchyroll. Friends join free with their own Crunchyroll access, in desktop Chrome. Anyone who misses the session watches on their own before the next one.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Simulcast meaning", level: 2 },
  { id: "timing", label: "Sub vs dub timing", level: 2 },
  { id: "crunchyroll", label: "Simulcasts on Crunchyroll", level: 2 },
  { id: "watch-parties", label: "Why simulcasts matter for groups", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

const timingRows = [
  {
    release: "Japanese TV broadcast",
    when: "The episode airs in Japan, usually late at night Japan time.",
  },
  {
    release: "Subtitled simulcast",
    when: "Streams outside Japan at the same time or within a few hours, on a fixed weekly slot.",
  },
  {
    release: "Same-day dub",
    when: "An English dub that streams alongside the sub, at the same time every week.",
  },
  {
    release: "Later dub",
    when: `Starts a few weeks after the sub, then keeps a weekly pace. On Crunchyroll this is usually about ${typicalGap} episodes behind.`,
  },
];

export default function AnimeSimulcastGlossaryPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Glossary", url: "/glossary" },
        { name: "Anime Simulcast", url },
      ]}
      title="What Is an Anime Simulcast?"
      description="Simulcast meaning, how Crunchyroll simulcasts work, and when sub and dub episodes arrive."
      url={url}
      datePublished="2026-04-23"
      dateModified="2026-10-20"
      faq={faq}
      headings={tocHeadings}
    >
      <SeoGuideTitle>What is an anime simulcast?</SeoGuideTitle>
      <SeoGuideAnswer id="answer" className="scroll-mt-24">
        <p>
          <strong>
            A simulcast is a new anime episode released outside Japan at the same time as its
            Japanese TV broadcast, or within a few hours, usually with subtitles. On Crunchyroll,
            each seasonal show gets one weekly slot, so fans worldwide can watch the day it airs.
          </strong>
        </p>
        <p className="mt-3 text-base">
          See{" "}
          <Link href="/tools/crunchyroll-schedule">this week&apos;s simulcast calendar</Link> for
          the {CRUNCHYROLL_WEEK.slots.length} episodes on Crunchyroll right now, or learn how to{" "}
          <Link href="/guides/how-to-watch-seasonal-anime-together">
            watch seasonal anime together
          </Link>{" "}
          with friends.
        </p>
      </SeoGuideAnswer>

      <p className="mb-4 leading-relaxed text-ani-muted">
        The word combines &quot;simultaneous&quot; and &quot;broadcast&quot;. Before simulcasts,
        international fans waited months for an official release or watched unofficial fan subs.
        Today most new TV anime reaches licensed streaming services in the same week it airs in
        Japan.
      </p>

      <h2 id="timing" className={headingClass}>
        Sub vs dub timing
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        A simulcast is almost always the subtitled version. English dubs follow one of two
        patterns, and which one a show uses decides when a dub-watching group can meet.
      </p>
      <div className="not-prose mb-4 overflow-hidden rounded-[16px] border border-ani-line">
        <table className="w-full text-sm">
          <caption className="sr-only">When each version of a new anime episode arrives</caption>
          <thead className="bg-ani-panel text-left text-xs text-ani-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Release
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                When it arrives
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ani-line">
            {timingRows.map((row) => (
              <tr key={row.release}>
                <th scope="row" className="px-4 py-2.5 text-left align-top font-medium text-ani-text">
                  {row.release}
                </th>
                <td className="px-4 py-2.5 leading-relaxed text-ani-muted">{row.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-10 leading-relaxed text-ani-muted">
        This week on Crunchyroll, {dubs.sameDay} of {dubs.total} English dub episodes are
        same-day. The{" "}
        <Link href="/tools/crunchyroll-dub-schedule" className={linkClass}>
          Crunchyroll dub schedule
        </Link>{" "}
        lists each dub&apos;s time and how far it trails the sub.
      </p>

      <h2 id="crunchyroll" className={headingClass}>
        Simulcasts on Crunchyroll
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Crunchyroll is the largest simulcast service for anime and streams most seasonal series
        within hours of their Japanese broadcast. Seasons start in January, April, July and October,
        and each show releases one episode a week for roughly 12 to 24 weeks. A show&apos;s slot is
        tied to Japan time, so it moves an hour on your clock when daylight saving starts or ends
        where you live.
      </p>
      <p className="mb-10 leading-relaxed text-ani-muted">
        Other services carry some simulcasts too, including HIDIVE and, for select titles,
        Netflix, which sometimes holds episodes back and releases them in batches.
      </p>

      <h2 id="watch-parties" className={headingClass}>
        Why simulcasts matter for watch parties
      </h2>
      <p className="mb-10 leading-relaxed text-ani-muted">
        A weekly slot gives a group a natural meeting time: everyone watches the new episode
        together, reacts live and talks theories until next week. With Plus or Pro, including
        during a trial, you can create an AniDachi room in desktop Chrome and invite friends for
        free. Everyone needs their own access to the episode on{" "}
        <Link href="/watch-crunchyroll-together" className={linkClass}>
          Crunchyroll
        </Link>
        .
      </p>

      <h2 id="related" className={headingClass}>
        Related
      </h2>
      <ul className="mb-8 space-y-2">
        <li>
          <Link href="/glossary/watchroom" className={linkClass}>
            What is a watchroom?
          </Link>
        </li>
        <li>
          <Link href="/glossary/dub-vs-sub-watch-party" className={linkClass}>
            Dub vs sub watch party
          </Link>
        </li>
        <li>
          <Link href="/watch-crunchyroll-together" className={linkClass}>
            Watch Crunchyroll together
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}
