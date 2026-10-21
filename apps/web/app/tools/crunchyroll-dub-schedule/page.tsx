import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import {
  SeoGuideAnswer,
  SeoGuideNote,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ReleaseSchedule } from "@/components/tools/release-schedule";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import {
  CRUNCHYROLL_DUB_WEEK,
  DUBS_WITHOUT_DATE,
  FALL_DUB_LIST_SOURCE,
  ONE_PIECE_DUB,
  dubLagSummary,
  dubNote,
  withDubNotes,
} from "@/lib/tools/crunchyroll-dub-schedule";
import { CRUNCHYROLL_WEEK } from "@/lib/tools/crunchyroll-schedule";
import { slotAnchor, slotInstant, weekRangeLabel } from "@/lib/tools/schedule-time";
import { getSeoSiteOrigin } from "@/lib/site-url";

/*
 * UPKEEP: update every Monday with /tools/crunchyroll-schedule. Data, sources and the
 * routine live in lib/tools/crunchyroll-dub-schedule.ts. Bump dateModified below.
 */

const url = "/tools/crunchyroll-dub-schedule";
const headingClass = "mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";
const linkClass = "font-medium text-ani-text underline decoration-ani-line underline-offset-4";
const week = CRUNCHYROLL_DUB_WEEK;
const weekLabel = weekRangeLabel(week);
const shortWeekLabel = weekRangeLabel(week, false);
const lag = dubLagSummary(week);
const typicalGap = lag.typicalGap ?? 2;
const backlog = ONE_PIECE_DUB.japanLatestEpisode - ONE_PIECE_DUB.thisWeekEpisode;
const sameDayTitles = week.slots
  .filter((slot) => slot.episodesBehindSub === 0)
  .map((slot) => slot.title)
  .slice(0, 2);
const hasBlackClover = week.slots.some((slot) => slot.title === "Black Clover Season 2");
const lagRows = [...week.slots]
  .filter((slot) => slot.subTitle)
  .sort(
    (a, b) =>
      (a.episodesBehindSub ?? 0) - (b.episodesBehindSub ?? 0) ||
      slotInstant(week, a).getTime() - slotInstant(week, b).getTime(),
  )
  .map((slot) => ({
    slot,
    sub: CRUNCHYROLL_WEEK.slots.find((s) => s.title === slot.subTitle),
  }));

// Layout appends " | AniDachi": 48 + 11 = 59 characters.
const pageTitle = "Crunchyroll Dub Schedule: English Dubs This Week";
const pageDescription = `Crunchyroll dub schedule for ${shortWeekLabel}: ${lag.total} English dub episodes with release times in your zone, and the next One Piece dub (Tuesdays, 9 a.m. PT).`;

export const metadata: Metadata = {
  title: "Crunchyroll Dub Schedule: English Dubs This Week",
  description: pageDescription,
  alternates: { canonical: url },
  openGraph: {
    title: pageTitle,
    description: `${lag.total} English dub episodes on Crunchyroll for ${weekLabel}, in your time zone.`,
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: `${lag.total} English dub episodes on Crunchyroll for ${weekLabel}, in your time zone.`,
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "When do dubs come out on Crunchyroll?",
    answer: `Each English dub has a weekly slot. This week ${lag.sameDay} of ${lag.total} dubs release at the same time as the subtitled episode, and most of the others trail the sub by about ${typicalGap} episodes. The schedule above lists every dub time in your zone.`,
  },
  {
    question: "When is the next One Piece dub episode?",
    answer: `Episode ${ONE_PIECE_DUB.thisWeekEpisode} streams on ${ONE_PIECE_DUB.thisWeekDate} at ${ONE_PIECE_DUB.releaseTime}, and episode ${ONE_PIECE_DUB.nextEpisode} is due ${ONE_PIECE_DUB.nextDate} at the same time. Crunchyroll says new Elbaph Arc dub episodes stream every Tuesday at ${ONE_PIECE_DUB.releaseTime}.`,
  },
  {
    question: "What time does the One Piece dub come out?",
    answer: `${ONE_PIECE_DUB.releaseTime} every Tuesday, which is noon ET. The dub is available in ${ONE_PIECE_DUB.regions}.`,
  },
  {
    question: "Does Crunchyroll release dubs the same day as subs?",
    answer: `Some. Crunchyroll calls these same-day releases: the dub streams alongside the Japanese version. This week that applies to ${lag.sameDay} shows${sameDayTitles.length ? `, including ${sameDayTitles.join(" and ")}` : ""}. Other dubs start a week or more after the sub.`,
  },
  {
    question: "How long after the sub does the English dub come out?",
    answer: `For dubs that are not same-day, usually a couple of weeks. This week most of them are ${typicalGap} episodes behind the sub, because the dub premiered ${typicalGap} weeks after the Japanese version and then kept a weekly pace.`,
  },
  {
    question: "Can friends who prefer subs watch the dub with us?",
    answer:
      "Agree on one version first. In an AniDachi room everyone opens the same episode on their own Crunchyroll account, so the group should pick sub or dub before the season starts and keep it.",
  },
];

const headings: TocHeading[] = [
  { id: "schedule", label: `Dub times: ${shortWeekLabel}`, level: 2 },
  { id: "one-piece", label: "Next One Piece dub", level: 2 },
  { id: "lag", label: "How far dubs lag the sub", level: 2 },
  { id: "announced", label: "Announced, no date yet", level: 2 },
  { id: "sub-or-dub", label: "Sub or dub for a group", level: 2 },
  { id: "sources", label: "Sources and upkeep", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function CrunchyrollDubSchedulePage() {
  const itemList = [...week.slots]
    .sort((a, b) => slotInstant(week, a).getTime() - slotInstant(week, b).getTime())
    .map((slot, i) => ({
      name: `${slot.title} (English dub)`,
      url: `${url}#${slotAnchor(slot)}`,
      position: i + 1,
    }));

  return (
    <>
      <ToolWebAppJsonLd
        name="Crunchyroll dub schedule"
        description={`English dub episodes on Crunchyroll for ${weekLabel}, converted to your time zone.`}
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Tools", url: "/tools" },
          { name: "Crunchyroll dub schedule", url },
        ]}
        title="Crunchyroll dub schedule"
        description={`English dub episodes on Crunchyroll for ${weekLabel}, converted to your time zone.`}
        url={url}
        datePublished="2026-10-20"
        dateModified="2026-10-20"
        faq={faq}
        headings={headings}
        itemList={itemList}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>Crunchyroll dub schedule: English dubs for {shortWeekLabel}</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>
              {lag.total} English dub episodes are scheduled on Crunchyroll for {weekLabel}.
            </strong>{" "}
            {lag.sameDay} release the same day as the subtitled episode; most others run about{" "}
            {typicalGap} episodes behind it. New One Piece dub episodes stream every Tuesday at{" "}
            {ONE_PIECE_DUB.releaseTime}, starting with episode {ONE_PIECE_DUB.thisWeekEpisode} on{" "}
            {ONE_PIECE_DUB.thisWeekDate}. Last checked {week.checked}.
          </p>
        </SeoGuideAnswer>

        <h2 id="schedule" className={headingClass}>
          English dub release times: {weekLabel}
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Every row is an English dub episode that streams on Crunchyroll this week, sorted by
          release time. The note after each episode says whether it matches the sub or how far it
          trails. Times start in US Eastern and switch to your zone when the page loads. This is a
          manually maintained list; dubs can slip, so check the audio menu on the episode page
          before the group starts.
        </p>
        <div className="mb-10">
          <ReleaseSchedule week={withDubNotes(week)} />
        </div>

        <div className="not-prose mb-10 rounded-[20px] border border-ani-line bg-ani-panel px-5 py-5 sm:px-7">
          <p className="text-lg font-semibold tracking-[-0.01em] text-ani-text">Watch the dub together</p>
          <p className="mt-2 leading-relaxed text-ani-muted">
            Dubs are the easy pick when people want to talk during the episode.{" "}
            <InstallLink href="/extension" className={linkClass}>
              Add AniDachi to desktop Chrome
            </InstallLink>
            , open the dub on Crunchyroll and share the room link. One person hosts with Plus or Pro,
            including a trial; friends join free on their own Crunchyroll accounts.
          </p>
        </div>

        <h2 id="one-piece" className={headingClass}>
          Next One Piece dub episode
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          The One Piece English dub returns with the Elbaph Arc. Episode{" "}
          {ONE_PIECE_DUB.thisWeekEpisode} streams on {ONE_PIECE_DUB.thisWeekDate} at{" "}
          {ONE_PIECE_DUB.releaseTime}. <strong className="text-ani-text">Next: episode{" "}
          {ONE_PIECE_DUB.nextEpisode} on {ONE_PIECE_DUB.nextDate} at {ONE_PIECE_DUB.releaseTime}</strong>,
          according to{" "}
          <a href={ONE_PIECE_DUB.source.url} className={linkClass} rel="noopener">
            Crunchyroll&apos;s announcement
          </a>{" "}
          of a new dub episode every Tuesday. It is available in {ONE_PIECE_DUB.regions}.
        </p>
        <p className="mb-10 leading-relaxed text-ani-muted">
          The Japanese broadcast stopped at episode {ONE_PIECE_DUB.japanLatestEpisode} and returns in
          2027, so the dub has {backlog} aired episodes to work through before it catches up. Because
          the time is set in Pacific time, it moves on other clocks when US daylight saving ends on
          November 1: 9:00 a.m. PT is 16:00 UTC before that date and 17:00 UTC after. New to the
          series? See{" "}
          <Link href="/tools/one-piece-how-many-episodes" className={linkClass}>
            how many episodes One Piece has
          </Link>{" "}
          and{" "}
          <Link href="/watch/one-piece-with-friends" className={linkClass}>
            how to watch One Piece with friends
          </Link>
          .
        </p>

        <h2 id="lag" className={headingClass}>
          How far dubs lag behind the simulcast
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Crunchyroll releases English dubs on two patterns. Same-day dubs stream alongside the
          Japanese version, so the sub and dub land at the same minute every week.
          The others premiere a few weeks into the season and then keep a weekly pace, so they stay
          the same number of episodes behind until the season ends. This week {lag.sameDay} dubs
          are same-day and {lag.behind} trail the sub, most by {typicalGap} episodes. Read{" "}
          <Link href="/glossary/anime-simulcast" className={linkClass}>
            what a simulcast is
          </Link>{" "}
          for the basics.
        </p>
        <div className="not-prose mb-10 overflow-hidden rounded-[16px] border border-ani-line">
          <table className="w-full text-sm">
            <caption className="sr-only">English dub episode compared with the sub this week</caption>
            <thead className="bg-ani-panel text-left text-xs text-ani-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Show
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Sub
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Dub
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Gap
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ani-line">
              {lagRows.map(({ slot, sub }) => (
                <tr key={slot.title}>
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-ani-text">
                    {slot.title}
                  </th>
                  <td className="px-4 py-2.5 tabular-nums text-ani-muted">{sub?.episode ?? "–"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-ani-muted">{slot.episode}</td>
                  <td className="px-4 py-2.5 text-ani-text">{dubNote({ ...slot, note: undefined })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mb-10 text-sm leading-relaxed text-ani-muted">
          {hasBlackClover
            ? "Black Clover's sub keeps the first series' numbering, so Season 2 episodes are listed from Ep 171. "
            : null}
          Shows whose sub is not on this week&apos;s{" "}
          <Link href="/tools/crunchyroll-schedule" className={linkClass}>
            Crunchyroll release schedule
          </Link>{" "}
          are left out of the table.
        </p>

        <h2 id="announced" className={headingClass}>
          Fall 2026 dubs announced without a date yet
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Crunchyroll&apos;s{" "}
          <a href={FALL_DUB_LIST_SOURCE.url} className={linkClass} rel="noopener">
            Fall 2026 dub list
          </a>{" "}
          includes these shows, but none had a weekly dub slot when we checked on {week.checked}.
          They will move into the schedule once Crunchyroll names a date.
        </p>
        <ul className="mb-10 list-disc space-y-1.5 pl-6 text-ani-muted">
          {DUBS_WITHOUT_DATE.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>

        <h2 id="sub-or-dub" className={headingClass}>
          Sub or dub for a group?
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Decide before the first episode and stick with it for the season. Switching halfway means
          someone rewatches or skips episodes, and a dub that trails the sub by two weeks changes
          when the group can meet.
        </p>
        <SeoGuideOptions
          options={[
            {
              title: "Pick the dub",
              body: "When people want to chat or react without missing subtitles, or someone in the group finds reading tiring. Best with same-day dubs, since the group stays on the current episode.",
              highlight: true,
            },
            {
              title: "Pick the sub",
              body: "When the group wants episodes as soon as they unlock, or the dub runs a few weeks behind and people would see spoilers online first.",
            },
            {
              title: "Split the difference",
              body: (
                <>
                  Watch the sub live and rewatch favorite episodes in the dub later. Our{" "}
                  <Link href="/sub-vs-dub">sub vs dub guide</Link> covers the trade-offs for groups.
                </>
              ),
            },
          ]}
        />

        <h2 id="sources" className={headingClass}>
          Sources and upkeep
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Dub times come from the AnimeSchedule.net dub timetable. We keep a row only when Crunchyroll
          News has confirmed that English dub, either in a release-date post or in the season&apos;s dub
          list, and we record both sources for every row. This week was checked on {week.checked} and
          is updated every Monday along with the{" "}
          <Link href="/tools/crunchyroll-schedule" className={linkClass}>
            subtitled simulcast schedule
          </Link>
          . Dub dates can change, and some dubs are region-limited.
        </p>
        <ul className="mb-10 space-y-1.5 text-sm text-ani-muted">
          {week.slots.map((slot) => (
            <li key={slot.title}>
              <span className="text-ani-text">{slot.title}:</span>{" "}
              {slot.sources.map((source, i) => (
                <span key={source.url}>
                  {i > 0 ? " · " : null}
                  <a href={source.url} rel="noopener" className="underline decoration-ani-line underline-offset-2">
                    {source.label}
                  </a>
                </span>
              ))}
              , checked {slot.checked}
            </li>
          ))}
        </ul>

        <SeoGuideNote>
          Looking for something else? Browse{" "}
          <Link href="/tools">more anime tools</Link>, find{" "}
          <Link href="/guides/dubbed-anime-on-crunchyroll">dubbed anime on Crunchyroll</Link>, or
          plan a weekly group night with our guide on how to{" "}
          <Link href="/guides/how-to-watch-seasonal-anime-together">watch seasonal anime together</Link>.
        </SeoGuideNote>

        <h2 id="related" className={headingClass}>
          Related
        </h2>
        <SeoGuideRelated
          className="mb-8"
          links={[
            { href: "/tools/crunchyroll-schedule", label: "Crunchyroll release schedule" },
            { href: "/sub-vs-dub", label: "Sub vs dub for watch parties" },
            { href: "/guides/english-dubbed-anime", label: "English dubbed anime to watch together" },
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
