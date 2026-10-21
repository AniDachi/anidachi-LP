import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { HowToJsonLd } from "@/components/json-ld";
import { SeoGuideAnswer, SeoGuideNote, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { CRUNCHYROLL_DUB_WEEK, dubLagSummary, dubNote } from "@/lib/tools/crunchyroll-dub-schedule";
import { CRUNCHYROLL_WEEK } from "@/lib/tools/crunchyroll-schedule";
import { ZONE_PRESETS, slotLocalLabel, weekRangeLabel } from "@/lib/tools/schedule-time";
import { getSeoSiteOrigin } from "@/lib/site-url";

const url = "/guides/how-to-watch-seasonal-anime-together";
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${getSeoSiteOrigin()}${BRAND_OG_PATH}`;
const headingClass = "mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";
const linkClass = "font-medium text-ani-text underline decoration-ani-line underline-offset-4";

const week = CRUNCHYROLL_WEEK;
const weekLabel = weekRangeLabel(week);
const dubWeekCurrent = CRUNCHYROLL_DUB_WEEK.weekStart === week.weekStart;
const dubs = dubLagSummary(CRUNCHYROLL_DUB_WEEK);

/**
 * Shows from this season's Crunchyroll lineup that suit groups. Only titles present in the
 * weekly schedule data render, so the table never lists a show that is not airing.
 */
const PICKS: { title: string; why: string }[] = [
  { title: "The Apothecary Diaries Season 3", why: "Mystery-of-the-week episodes that are easy to discuss" },
  { title: "Black Clover Season 2", why: "Big shonen fights for loud reaction nights" },
  { title: "Dragon Ball Super: Beerus", why: "Familiar cast, low barrier for casual fans" },
  { title: "Link Click Season 3", why: "Twisty time-travel plot that rewards theories" },
  { title: "Aoashi Season 2", why: "Sports anime with match-night energy" },
  { title: "Overgeared", why: "Game-world isekai with easy-to-follow stakes" },
  { title: "Magic Knight Rayearth (2026)", why: "New take on a classic, good for mixed-age groups" },
  { title: "Case Closed (Detective Conan)", why: "Long runner; guess the culprit before the reveal" },
];
const picks = PICKS.flatMap((pick) => {
  const slot = week.slots.find((s) => s.title === pick.title);
  if (!slot) return [];
  const dub = dubWeekCurrent
    ? CRUNCHYROLL_DUB_WEEK.slots.find((d) => d.subTitle === pick.title || d.title === pick.title)
    : undefined;
  return [{ ...pick, slot, dub }];
});
const example = picks[0];

export const metadata: Metadata = {
  title: "How to Watch Seasonal Anime Together Every Week",
  description:
    "Watch seasonal anime with friends each week: pick a time across time zones, set spoiler and catch-up rules, choose sub or dub, and see this season's picks.",
  alternates: { canonical: url },
  openGraph: {
    title: "How to Watch Seasonal Anime Together",
    description:
      "A weekly ritual for friend groups following a simulcast season: meeting time, spoiler rules, sub or dub, and catch-up rules.",
    url,
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Watch Seasonal Anime Together",
    description: "A weekly simulcast ritual for friend groups on Crunchyroll.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is seasonal anime?",
    answer:
      "Seasonal anime are new series that premiere in quarterly batches: winter (January), spring (April), summer (July) and fall (October). Most simulcast on Crunchyroll within hours of the Japanese broadcast, one episode a week for 12 to 24 weeks.",
  },
  {
    question: "How do friend groups watch seasonal anime together?",
    answer:
      "Pick one or two shows, agree on a weekly meeting time a few hours after the episode unlocks, and watch in a synced room so everyone sees the same moment. Members who miss a night watch on their own before the next one.",
  },
  {
    question: "Can we watch seasonal anime if we're in different time zones?",
    answer:
      "Yes. Convert the unlock time for everyone, pick the slot where the latest local time is still reasonable, and rotate it monthly if one person always gets the bad hour. Spoiler-free chat until everyone has watched keeps it fair.",
  },
  {
    question: "How many seasonal anime should a group commit to?",
    answer:
      "One main show and one optional backup suits most friend groups. With three or more shows at once, someone usually falls behind by mid-season and spoilers become a problem.",
  },
  {
    question: "What anime is airing on Crunchyroll this season?",
    answer: `This week's Crunchyroll release schedule lists ${week.slots.length} simulcast episodes for ${weekLabel}, including ${picks
      .slice(0, 3)
      .map((p) => p.title)
      .join(", ")}. The schedule shows each unlock time in your time zone.`,
  },
  {
    question: "Should our group watch seasonal anime subbed or dubbed?",
    answer:
      "Sub if the group wants each episode the day it unlocks. Dub if people want to talk while watching, ideally a same-day dub so the group stays current. Decide before episode 1 and keep it for the season.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "this-season", label: "This season on Crunchyroll", level: 2 },
  { id: "howto", label: "The weekly ritual", level: 2 },
  { id: "time", label: "Pick a day and time", level: 2 },
  { id: "sub-or-dub", label: "Sub or dub", level: 2 },
  { id: "spoiler-rules", label: "Spoiler rules", level: 2 },
  { id: "catch-up", label: "Catch-up rules", level: 2 },
  { id: "mid-season", label: "Mid-season check", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
];

const howToSteps = [
  {
    name: "Pick your lineup in week one",
    text: "When a season starts (January, April, July or October), agree on one main show and one backup. Check that every member can stream them on Crunchyroll in their region.",
  },
  {
    name: "Set one weekly meeting time",
    text: "Convert each show's unlock time for every member and book a recurring slot a few hours after it. Put the time and the room link in a calendar invite.",
  },
  {
    name: "Settle sub or dub",
    text: "Decide before episode 1. A same-day dub keeps the group current; a dub that trails by two episodes means meeting on an older episode.",
  },
  {
    name: "Watch in a synced room",
    text: "The host installs AniDachi in desktop Chrome, opens the episode on Crunchyroll and creates a room with Plus or Pro, including a trial. Friends join free with their own Crunchyroll accounts.",
  },
  {
    name: "Post the spoiler line",
    text: "After each session, post the newest episode everyone has seen in your group chat. Nobody discusses past that line until the next meeting.",
  },
  {
    name: "Check in at mid-season",
    text: "Around episode 6, ask whether the group still wants the show. Drop it or swap in the backup rather than forcing it.",
  },
];

export default function HowToWatchSeasonalAnimeTogetherPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch seasonal anime together"
        description="A weekly ritual for a friend group following a simulcast season on Crunchyroll: lineup, meeting time, sub or dub, synced room, spoiler line and mid-season check."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Anime Together", url: "/watch-anime-together" },
          { name: "How to watch seasonal anime together", url },
        ]}
        title="How to watch seasonal anime together"
        description="A weekly simulcast ritual for friend groups on Crunchyroll."
        url={url}
        datePublished="2026-06-08"
        dateModified="2026-10-20"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
      >
        <SeoGuideTitle>How to watch seasonal anime together</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>
              Pick one or two shows from the new season, meet at the same time every week a few hours
              after the episode unlocks, and watch in a synced room so everyone reacts to the same
              scene.
            </strong>{" "}
            Agree on sub or dub before episode 1, keep spoilers behind a shared line, and give anyone
            who misses a week until the next meeting to catch up.
          </p>
        </SeoGuideAnswer>

        <p className="mb-4 leading-relaxed text-ani-muted">
          Seasonal anime suits a group better than bingeing a finished series. One episode a week is
          easy to fit around work and school, the wait between episodes gives you time to argue about
          theories, and a fixed night turns into a habit. The hard parts are practical: people live in
          different time zones, not everyone likes subtitles, and somebody always misses a week. This
          guide is the routine we suggest for a group following a Crunchyroll season, with the
          decisions to make once and the rules that keep it going for twelve weeks.
        </p>

        <h2 id="this-season" className={headingClass}>
          This season on Crunchyroll
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Crunchyroll&apos;s{" "}
          <Link href="/tools/crunchyroll-schedule" className={linkClass}>
            release schedule for this week
          </Link>{" "}
          lists {week.slots.length} simulcast episodes for {weekLabel}. These are the shows from that
          list we would start a group with. Unlock times are US Eastern; the schedule converts every
          slot to your own zone.
        </p>
        {picks.length > 0 ? (
          <div className="not-prose mb-4 overflow-x-auto rounded-[16px] border border-ani-line">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Crunchyroll simulcasts for groups, {weekLabel}</caption>
              <thead className="bg-ani-panel text-left text-xs text-ani-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Show
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Unlocks (ET)
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    English dub
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Why it works for groups
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ani-line">
                {picks.map((pick) => (
                  <tr key={pick.title}>
                    <th scope="row" className="px-4 py-2.5 text-left align-top font-medium text-ani-text">
                      {pick.slot.watchSlug ? (
                        <Link href={`/watch/${pick.slot.watchSlug}-with-friends`} className={linkClass}>
                          {pick.title}
                        </Link>
                      ) : (
                        pick.title
                      )}
                      {pick.slot.episode ? (
                        <span className="ml-1.5 font-normal text-ani-muted">{pick.slot.episode}</span>
                      ) : null}
                    </th>
                    <td className="whitespace-nowrap px-4 py-2.5 align-top tabular-nums text-ani-muted">
                      {slotLocalLabel(week, pick.slot, "America/New_York")}
                    </td>
                    <td className="px-4 py-2.5 align-top text-ani-muted">
                      {pick.dub ? (dubNote(pick.dub) ?? "Weekly") : "Not this week"}
                    </td>
                    <td className="px-4 py-2.5 align-top text-ani-muted">{pick.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="mb-10 text-sm leading-relaxed text-ani-muted">
          Schedule checked {week.checked}. &quot;Not this week&quot; means no English dub episode is
          scheduled on Crunchyroll this week; see the{" "}
          <Link href="/tools/crunchyroll-dub-schedule" className={linkClass}>
            Crunchyroll dub schedule
          </Link>{" "}
          for every dub time.
        </p>

        <h2 id="howto" className={headingClass}>
          The weekly ritual
        </h2>
        <ol className="mb-6 list-decimal space-y-3 pl-6 text-ani-muted">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <span className="font-medium text-ani-text">{step.name}.</span> {step.text}
            </li>
          ))}
        </ol>
        <p className="mb-10 leading-relaxed text-ani-muted">
          Ready for week one?{" "}
          <InstallLink href="/extension" className={linkClass}>
            Add AniDachi to desktop Chrome
          </InstallLink>{" "}
          before the premiere so the host isn&apos;t installing anything while everyone waits. Play,
          pause and seek stay in sync for the whole room, with chat and voice built in. More detail on
          the room itself is in our{" "}
          <Link href="/watch-crunchyroll-together" className={linkClass}>
            Crunchyroll watch party
          </Link>{" "}
          guide.
        </p>

        <h2 id="time" className={headingClass}>
          Pick a day and time that works across time zones
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Every simulcast has a fixed weekly slot tied to its broadcast in Japan, so start from the
          unlock time, not from a night that feels convenient. Meet two to six hours after the episode
          unlocks: late enough that nobody is waiting on a slow release, early enough that nobody has
          seen clips online yet.
        </p>
        {example ? (
          <>
            <p className="mb-4 leading-relaxed text-ani-muted">
              For example, {example.title} unlocks at these local times this week:
            </p>
            <div className="not-prose mb-4 overflow-hidden rounded-[16px] border border-ani-line">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  {example.title} unlock time in six time zones
                </caption>
                <tbody className="divide-y divide-ani-line">
                  {ZONE_PRESETS.map((zone) => (
                    <tr key={zone.id}>
                      <th scope="row" className="w-24 px-4 py-2 text-left font-medium text-ani-text">
                        {zone.label}
                      </th>
                      <td className="px-4 py-2 tabular-nums text-ani-muted">
                        {slotLocalLabel(week, example.slot, zone.timeZone)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        <p className="mb-4 leading-relaxed text-ani-muted">
          A group split between the US and Europe usually lands on a weekend afternoon in the
          Americas, which is evening in Europe. A group with members in India or Japan has less room:
          pick the slot where the latest local time is still before midnight for most people, and
          rotate it monthly so the same person isn&apos;t always up at 2 a.m.
        </p>
        <p className="mb-10 leading-relaxed text-ani-muted">
          Watch for clock changes. Simulcast slots stay put in Japan time, so when Europe (late
          October) and the US (early November) leave daylight saving, every unlock moves an hour
          earlier on local clocks. Resend the calendar invite that week. Our guide to{" "}
          <Link href="/guides/how-to-watch-anime-with-friends-in-different-time-zones" className={linkClass}>
            watching anime across time zones
          </Link>{" "}
          has more scheduling tactics.
        </p>

        <h2 id="sub-or-dub" className={headingClass}>
          Decide sub or dub once
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Subtitles arrive first: every show on the simulcast calendar is subbed on the day it
          unlocks. English dubs follow two patterns. Same-day dubs stream at the same minute as the
          sub, so a dub group stays current.
          {dubWeekCurrent
            ? ` This week ${dubs.sameDay} of ${dubs.total} English dubs on Crunchyroll are same-day; most of the rest trail the sub by about ${dubs.typicalGap ?? 2} episodes.`
            : " Most other dubs trail the sub by a couple of episodes."}
        </p>
        <p className="mb-10 leading-relaxed text-ani-muted">
          A trailing dub is fine if the group agrees to stay on it, but it makes spoilers harder to
          dodge because the internet is talking about episodes you haven&apos;t reached. If even one
          person relies on the dub, choose a show with a same-day dub or accept the lag. Everyone in
          the room should open the same version of the episode, so the group picks one. Our{" "}
          <Link href="/sub-vs-dub" className={linkClass}>
            sub vs dub guide
          </Link>{" "}
          covers the trade-offs.
        </p>

        <h2 id="spoiler-rules" className={headingClass}>
          Spoiler rules for weekly drops
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Clips and reactions hit social media within minutes of an episode unlocking, and some
          members will read ahead in the manga. Three rules cover most groups:
        </p>
        <ul className="mb-10 list-disc space-y-2 pl-6 text-ani-muted">
          <li>
            <strong className="text-ani-text">One spoiler line.</strong> After each session, post the
            newest episode everyone has seen in the group chat. Nothing past it gets discussed in the
            main chat.
          </li>
          <li>
            <strong className="text-ani-text">A separate channel for early watchers and manga
            readers.</strong> Label it clearly so people opt in.
          </li>
          <li>
            <strong className="text-ani-text">Feelings, not plot.</strong> &quot;That ending
            destroyed me&quot; is fine before everyone has watched; &quot;the villain is his
            dad&quot; is not.
          </li>
        </ul>

        <h2 id="catch-up" className={headingClass}>
          Catch-up rules for missed weeks
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Somebody will miss a night. Decide up front what happens so the group neither waits forever
          nor leaves people behind:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6 text-ani-muted">
          <li>
            The group always watches the newest episode on its night. It doesn&apos;t pause the
            season for one person.
          </li>
          <li>
            Anyone who misses a week watches that episode on their own before the next session, then
            joins as normal.
          </li>
          <li>
            If two or more people miss the same week, push the session a day or two rather than
            splitting the group.
          </li>
          <li>
            Start each session with a two-minute recap from someone who watched, so returning members
            remember where things stand.
          </li>
        </ul>
        <p className="mb-10 leading-relaxed text-ani-muted">
          Live sync is for the shared night; catch-up happens solo. For more on mixing the two, see{" "}
          <Link href="/guides/asynchronous-vs-live-watch-party" className={linkClass}>
            async vs live watch parties
          </Link>
          .
        </p>

        <h2 id="mid-season" className={headingClass}>
          The mid-season check
        </h2>
        <p className="mb-10 leading-relaxed text-ani-muted">
          Around episode 6, ask the group one question: still excited? If the answer is a shrug, drop
          the show or promote the backup. Seasonal anime is supposed to be fun, and a show that the
          group is forcing itself through will kill attendance faster than a missed week. Split-cour
          shows often pause after 12 or 13 episodes and come back a season or more later, so treat the break
          as a natural point to pick something new. For long runners such as Case Closed, set a fixed
          run (say, the next eight weeks) instead of an open-ended commitment.
        </p>

        <SeoGuideNote>
          Running a bigger group? Our guide to{" "}
          <Link href="/guides/how-to-run-an-online-anime-club">running an online anime club</Link>{" "}
          covers roles, voting on the lineup and keeping attendance up across a season.
        </SeoGuideNote>

        <h2 id="related" className={headingClass}>
          Related guides
        </h2>
        <ul className="mb-8 space-y-2">
          <li>
            <Link href="/tools/crunchyroll-schedule" className={linkClass}>
              Crunchyroll release schedule this week
            </Link>
          </li>
          <li>
            <Link href="/tools/crunchyroll-dub-schedule" className={linkClass}>
              Crunchyroll dub schedule
            </Link>
          </li>
          <li>
            <Link href="/glossary/anime-simulcast" className={linkClass}>
              What is an anime simulcast?
            </Link>
          </li>
          <li>
            <Link href="/watch-crunchyroll-together" className={linkClass}>
              Watch Crunchyroll together
            </Link>
          </li>
          <li>
            <Link href="/guides/best-anime-to-watch-with-friends" className={linkClass}>
              Best anime to watch with friends
            </Link>
          </li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
