import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { SeoGuideAnswer, SeoGuideNote, SeoGuideRelated, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ReleaseSchedule } from "@/components/tools/release-schedule";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { CRUNCHYROLL_DUB_WEEK, dubLagSummary, ONE_PIECE_DUB } from "@/lib/tools/crunchyroll-dub-schedule";
import { CRUNCHYROLL_WEEK, ONE_PIECE_STATUS } from "@/lib/tools/crunchyroll-schedule";
import { slotAnchor, slotInstant, weekRangeLabel } from "@/lib/tools/schedule-time";
import { getSeoSiteOrigin } from "@/lib/site-url";

const url = "/tools/crunchyroll-schedule";
const headingClass = "mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";
const linkClass = "font-medium text-ani-text underline decoration-ani-line underline-offset-4";
const week = CRUNCHYROLL_WEEK;
const showCount = week.slots.length;
const weekLabel = weekRangeLabel(week);
const shortWeekLabel = weekRangeLabel(week, false);
const dubs = dubLagSummary(CRUNCHYROLL_DUB_WEEK);
const dubsCurrent = CRUNCHYROLL_DUB_WEEK.weekStart === week.weekStart;
const linkedShows = week.slots.filter((slot) => slot.watchSlug);

// The layout appends " | AniDachi" (11 characters): 49 + 11 = 60. The week goes in the H1.
const pageTitle = "Crunchyroll Release Schedule & Simulcast Calendar";
const pageDescription = `Crunchyroll release schedule for ${shortWeekLabel}: ${showCount} simulcast episodes with unlock times in ET, PT, UK, CET, IST or JST, plus this week's English dubs.`;

export const metadata: Metadata = {
  title: "Crunchyroll Release Schedule & Simulcast Calendar",
  description: pageDescription,
  alternates: { canonical: url },
  openGraph: {
    title: pageTitle,
    description: `${showCount} Crunchyroll simulcasts for ${weekLabel}, in your time zone.`,
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: `${showCount} Crunchyroll simulcasts for ${weekLabel}, in your time zone.`,
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is the Crunchyroll simulcast calendar?",
    answer: `It is the weekly list of new subtitled episodes that Crunchyroll streams shortly after they air in Japan. This page lists ${showCount} of them for ${weekLabel}, with each unlock time converted to ET, PT, UK, CET, IST, JST or your own time zone.`,
  },
  {
    question: "What time do new Crunchyroll episodes come out?",
    answer:
      "Each show has its own slot, usually within a few hours of its Japanese broadcast. Most land between morning and early afternoon US Eastern time. Pick your time zone above the schedule to see the exact unlock time for every show.",
  },
  {
    question: "When do English dubs come out on Crunchyroll?",
    answer: dubsCurrent
      ? `This week ${dubs.total} English dub episodes are scheduled. ${dubs.sameDay} release the same day as the sub; most others trail it by about ${dubs.typicalGap ?? 2} episodes. The Crunchyroll dub schedule lists every dub time.`
      : "Some dubs release the same day as the sub; most others trail it by a few weeks. The Crunchyroll dub schedule lists every dub time.",
  },
  {
    question: "When does the new One Piece episode come out?",
    answer: `${ONE_PIECE_STATUS} The English dub continues weekly on Tuesdays at ${ONE_PIECE_DUB.releaseTime}.`,
  },
  {
    question: "Does everyone need their own Crunchyroll login to watch together?",
    answer:
      "Yes. Each person watches on their own Crunchyroll account in desktop Chrome. AniDachi keeps the room in sync. It does not re-stream the video.",
  },
  {
    question: "Can a group watch the new episode together?",
    answer:
      "Yes. One person hosts with Plus or Pro, including a trial. Friends join free. Everyone opens the same episode once it unlocks.",
  },
];

const headings: TocHeading[] = [
  { id: "schedule", label: `This week: ${shortWeekLabel}`, level: 2 },
  { id: "dubs", label: "English dubs this week", level: 2 },
  { id: "how-it-works", label: "How unlock times work", level: 2 },
  { id: "one-piece", label: "One Piece release schedule", level: 2 },
  { id: "plan", label: "Plan a weekly watch night", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function CrunchyrollSchedulePage() {
  const itemList = [...week.slots]
    .sort((a, b) => slotInstant(week, a).getTime() - slotInstant(week, b).getTime())
    .map((slot, i) => ({
      name: slot.title,
      url: `${url}#${slotAnchor(slot)}`,
      position: i + 1,
    }));

  return (
    <>
      <ToolWebAppJsonLd
        name="Crunchyroll release schedule"
        description={`Crunchyroll simulcasts for ${weekLabel}, converted to your time zone.`}
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Crunchyroll watch party", url: "/watch-crunchyroll-together" },
          { name: "Crunchyroll release schedule", url },
        ]}
        title="Crunchyroll release schedule & simulcast calendar"
        description={`Crunchyroll simulcasts for ${weekLabel}, converted to your time zone.`}
        url={url}
        datePublished="2026-10-12"
        dateModified="2026-10-20"
        faq={faq}
        headings={headings}
        itemList={itemList}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>
          Crunchyroll release schedule &amp; simulcast calendar: {shortWeekLabel}
        </SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>
              This week&apos;s Crunchyroll release schedule covers {weekLabel}: {showCount} subtitled
              simulcast episodes, each listed at its planned unlock time.
            </strong>{" "}
            Times start in US Eastern (ET) and switch to your device&apos;s zone when the page
            loads; you can also pick PT, UK, CET, IST or JST. We check the list against
            Crunchyroll&apos;s calendar every Monday. Last checked {week.checked}.
          </p>
        </SeoGuideAnswer>

        <h2 id="schedule" className={headingClass}>
          Crunchyroll simulcast schedule: {weekLabel}
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          This is a manually maintained schedule, not a live feed. Subtitled releases only, sorted by
          planned unlock time. Shows can slip a week, so check the episode in the app before the group
          starts. Titles with a link have a guide to watching that show with friends.
        </p>
        <div className="mb-10">
          <ReleaseSchedule week={week} />
        </div>

        <h2 id="dubs" className={headingClass}>
          English dubs this week
        </h2>
        <SeoGuideNote>
          {dubsCurrent ? (
            <>
              <strong className="text-ani-text">
                {dubs.total} English dub episodes are scheduled on Crunchyroll this week.
              </strong>{" "}
              {dubs.sameDay} of them release the same day as the subtitled episode, and most of the
              rest trail it by about {dubs.typicalGap ?? 2} episodes. The{" "}
              <Link href="/tools/crunchyroll-dub-schedule">English dub schedule</Link> lists every dub
              time in your zone, including One Piece, which is back with episode{" "}
              {ONE_PIECE_DUB.thisWeekEpisode} on {ONE_PIECE_DUB.thisWeekDate}.
            </>
          ) : (
            <>
              Looking for English audio? The{" "}
              <Link href="/tools/crunchyroll-dub-schedule">English dub schedule</Link> lists this
              week&apos;s dub episodes and their times in your zone.
            </>
          )}
        </SeoGuideNote>

        <div className="not-prose mb-10 rounded-[20px] border border-ani-line bg-ani-panel px-5 py-5 sm:px-7">
          <p className="text-lg font-semibold tracking-[-0.01em] text-ani-text">
            Watch this week&apos;s episodes together
          </p>
          <p className="mt-2 leading-relaxed text-ani-muted">
            Pick a slot above, then{" "}
            <InstallLink href="/extension" className={linkClass}>
              add AniDachi to desktop Chrome
            </InstallLink>{" "}
            and open the episode on Crunchyroll when it unlocks. One person hosts with Plus or Pro,
            including a trial; friends join free on their own Crunchyroll accounts, and play, pause
            and seek stay in sync with voice and chat in the room.
          </p>
        </div>

        <h2 id="how-it-works" className={headingClass}>
          How unlock times work
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Every simulcast slot is tied to its broadcast in Japan, which does not use daylight saving
          time. When clocks change where you live, the same show unlocks an hour earlier or later on
          your clock even though nothing moved in Japan. In Europe clocks go back on Sunday,
          October 25; in the US they go back on Sunday, November 1. From November 1, a show that
          unlocked at 11:00 AM ET unlocks at 10:00 AM ET, and European times shift the same way a
          week earlier.
        </p>
        <p className="mb-4 leading-relaxed text-ani-muted">
          A late-night slot in Japan often lands on the previous evening in the Americas. A Sunday
          00:30 UTC release, for example, shows up on Saturday evening in New York and Los Angeles.
          The day headings above follow your chosen zone, so the list already accounts for that.
        </p>
        <p className="mb-10 leading-relaxed text-ani-muted">
          New to the term? Read{" "}
          <Link href="/glossary/anime-simulcast" className={linkClass}>
            what a simulcast is
          </Link>{" "}
          and how sub and dub timing differ.
        </p>

        <h2 id="one-piece" className={headingClass}>
          One Piece release schedule
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          {ONE_PIECE_STATUS} The English dub is still running: episode{" "}
          {ONE_PIECE_DUB.thisWeekEpisode} streams on {ONE_PIECE_DUB.thisWeekDate} at{" "}
          {ONE_PIECE_DUB.releaseTime}, with a new dub episode every Tuesday after that (see the{" "}
          <Link href="/tools/crunchyroll-dub-schedule" className={linkClass}>
            One Piece dub release time
          </Link>
          ).
        </p>
        <p className="mb-10 leading-relaxed text-ani-muted">
          Use the break to catch up: see{" "}
          <Link href="/tools/one-piece-how-many-episodes" className={linkClass}>
            how many episodes One Piece has
          </Link>{" "}
          and the{" "}
          <Link href="/tools/one-piece-filler-list" className={linkClass}>
            filler to skip
          </Link>
          .
        </p>

        <h2 id="plan" className={headingClass}>
          Plan a weekly watch night
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Groups that follow a season tend to stick with one or two shows and meet at the same time
          each week, a few hours after the episode unlocks. Use the time-zone buttons to find a slot
          that works for everyone, then settle sub or dub before the first night. Our guide on how to{" "}
          <Link href="/guides/how-to-watch-seasonal-anime-together" className={linkClass}>
            watch seasonal anime together
          </Link>{" "}
          covers spoiler rules and catch-up rules for people who miss a week.
        </p>
        {linkedShows.length > 0 ? (
          <p className="mb-4 leading-relaxed text-ani-muted">
            This week&apos;s shows with a group-watch guide:{" "}
            {linkedShows.map((slot, i) => (
              <span key={slot.title}>
                {i > 0 ? (i === linkedShows.length - 1 ? " and " : ", ") : null}
                <Link href={`/watch/${slot.watchSlug}-with-friends`} className={linkClass}>
                  {slot.title}
                </Link>
              </span>
            ))}
            .
          </p>
        ) : null}
        <p className="mb-10 leading-relaxed text-ani-muted">
          Between seasons, browse{" "}
          <Link href="/tools" className={linkClass}>
            more anime tools
          </Link>
          : filler lists, watch orders and a random anime picker.
        </p>

        <h2 id="related" className={headingClass}>
          Related
        </h2>
        <SeoGuideRelated
          className="mb-8"
          links={[
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
            { href: "/tools/crunchyroll-dub-schedule", label: "Crunchyroll dub schedule" },
            {
              href: "/guides/how-to-watch-seasonal-anime-together",
              label: "How to watch seasonal anime together",
            },
            { href: "/glossary/anime-simulcast", label: "What is an anime simulcast?" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
