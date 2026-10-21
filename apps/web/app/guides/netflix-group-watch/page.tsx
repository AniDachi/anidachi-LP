import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { PRICING_PLUS_SHORT, PRICING_PRO_SHORT } from "@/lib/pricing-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const PAGE_TITLE = "Netflix Group Watch: Rooms for 3 to 15 People";
const PAGE_DESCRIPTION =
  "Run a Netflix group watch for 3 to 15 people: room sizes by plan, who controls playback, push-to-talk etiquette, and start times that work across time zones.";

export const metadata: Metadata = {
  title: "Netflix Group Watch: Rooms for 3 to 15 People",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/guides/netflix-group-watch" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/guides/netflix-group-watch",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How many people can watch Netflix together on AniDachi?",
    answer:
      "Up to 6 people including the host when the host has Plus, or up to 15 when the host has Pro. Friends join free. Teleparty says its parties can hold 1,000 or more people if you need a much bigger group.",
  },
  {
    question: "Can a group share one Netflix account for a watch party?",
    answer:
      "Only within one household. Netflix's Help Center says an account may not be shared outside the household, and each plan limits how many screens play at once. In a group watch, friends in different homes each use their own Netflix.",
  },
  {
    question: "Who controls the movie in a Netflix group watch?",
    answer:
      "In AniDachi, the host controls play, pause and seeking for everyone. The host also decides who has microphone and camera access. Guests chat, react and talk when given a seat.",
  },
  {
    question: "How many people can be on camera at once?",
    answer:
      "Up to four cameras at the same time in any AniDachi room. Microphones go further: up to 6 with a Plus host and up to 8 with a Pro host.",
  },
  {
    question: "What if someone in the group misses a session?",
    answer:
      "AniDachi rooms are live. Someone who misses a night should watch that episode on their own Netflix before the next session. Async catch-up is planned but not available today.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "size", label: "Room size by plan", level: 2 },
  { id: "roles", label: "Roles and host controls", level: 2 },
  { id: "push-to-talk", label: "Push-to-talk etiquette", level: 2 },
  { id: "time-zones", label: "Different time zones", level: 2 },
  { id: "series", label: "Running a series", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function NetflixGroupWatchPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        { name: "Netflix group watch", url: "/guides/netflix-group-watch" },
      ]}
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      url="/guides/netflix-group-watch"
      datePublished="2026-10-08"
      dateModified="2026-10-20"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Netflix Group Watch for 3 to 15 People</SeoGuideTitle>
      <SeoGuideAnswer id="answer">
        <p>
          <strong>
            A Netflix group watch is three or more people on the same title at the
            same moment, each on their own Netflix. With AniDachi, a Plus host fits
            up to 6 people and a Pro host up to 15, including the host.
          </strong>{" "}
          The host controls playback and hands out microphone and camera seats;
          friends join free. It is the group version of a{" "}
          <Link href="/netflix-watch-party">Netflix watch party</Link>.
        </p>
      </SeoGuideAnswer>

      <h2 id="size" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Room size by plan
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        The host&apos;s plan sets the room limits. Guests never need to pay for
        AniDachi; they only need their own Netflix and a Free AniDachi account.
      </p>
      <ResponsiveCompareTable
        columns={[
          { id: "plus", label: `Plus host (${PRICING_PLUS_SHORT})` },
          { id: "pro", label: `Pro host (${PRICING_PRO_SHORT})`, highlight: true },
        ]}
        rows={[
          { feature: "People in the room, including host", values: { plus: "Up to 6", pro: "Up to 15" } },
          { feature: "Cameras on at once", values: { plus: "Up to 4", pro: "Up to 4" } },
          { feature: "Microphones on at once", values: { plus: "Up to 6", pro: "Up to 8" } },
          { feature: "Guests pay for AniDachi", values: { plus: "no", pro: "no" } },
          { feature: "Good fit", values: { plus: "Small friend group, family", pro: "Club, class, server event" } },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        Both plans have a 3-day trial for eligible accounts, which is enough to test
        a first group night. More than 15 people? Split into two rooms with two
        hosts, or use a tool built for very large parties; Teleparty says its
        parties hold 1,000 or more. The trade-offs are in{" "}
        <Link href="/guides/watch-netflix-together" className="text-brand-orange hover:underline">
          watch Netflix together
        </Link>
        .
      </p>

      <h2 id="roles" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Roles and host controls
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        AniDachi rooms have one host and everyone else is a guest. That split
        matters more with eight people than with two.
      </p>
      <SeoGuideBulletList
        items={[
          {
            title: "Playback",
            body: "Only the host's play, pause and seek reach the room. Guests who need a break ask in chat or by voice, and the host pauses for everyone.",
          },
          {
            title: "Invites",
            body: "The host copies the room link or invites saved friends and groups with the person-plus button next to End room.",
          },
          {
            title: "Media seats",
            body: "In People, the host switches microphone and camera access on or off for each guest. Guests without a seat can still listen, chat and react.",
          },
          {
            title: "Ending",
            body: "The host closes the night with End room. Guests see Leave instead, so someone heading to bed early can drop out on their own.",
          },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        Choose a host with a steady connection and a computer that will not go to
        sleep. If the group meets often, rotate who picks the title, not who hosts,
        so one Plus or Pro plan covers everyone.{" "}
        <InstallLink href="/extension" className="text-brand-orange hover:underline">
          Install AniDachi in desktop Chrome
        </InstallLink>{" "}
        to set up the first room.
      </p>

      <h2 id="push-to-talk" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Push-to-talk etiquette
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        A yellow microphone in AniDachi means push-to-talk: hold V to speak.
        Clicking it turns it green, which leaves it open. Settings, Room lets each
        person choose how their microphone starts. With a group, these habits keep
        the dialogue audible.
      </p>
      <SeoGuideBulletList
        items={[
          { title: "Hold V by default", body: "Open microphones pick up keyboards, fans and the movie's own sound." },
          { title: "One open mic at most", body: "If someone wants to stay open, make it the host, and ask them to wear headphones." },
          { title: "Talk over action, not dialogue", body: "Save comments for chases, montages and credits. Plot-heavy scenes go to chat." },
          { title: "Agree on a pause word", body: "Pick one word, like \"pause\", so the host knows a request from a joke." },
          { title: "Reactions for quick takes", body: "Turn on Quick reactions in Settings and send an emoji with the number keys instead of speaking." },
        ]}
      />

      <h2 id="time-zones" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Different time zones
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Write the start time in every zone in the invite, not just yours. Inside the
        US the gaps are fixed, so this conversion always holds:
      </p>
      <ResponsiveCompareTable
        columns={[
          { id: "early", label: "Early start" },
          { id: "late", label: "Late start" },
        ]}
        rows={[
          { feature: "Eastern (ET)", values: { early: "7:00 pm", late: "9:00 pm" } },
          { feature: "Central (CT)", values: { early: "6:00 pm", late: "8:00 pm" } },
          { feature: "Mountain (MT)", values: { early: "5:00 pm", late: "7:00 pm" } },
          { feature: "Pacific (PT)", values: { early: "4:00 pm", late: "6:00 pm" } },
        ]}
      />
      <SeoGuideNote>
        <strong>Groups across the Atlantic:</strong> London is usually 5 hours ahead
        of New York and Central Europe 6, but for a few weeks in March and around
        late October the US and Europe change clocks on different dates and the gap
        shrinks by an hour. A weekend 2:00 pm ET start usually lands at 7:00 pm in
        London. Arizona does not use daylight time, so check it separately.
      </SeoGuideNote>

      <h2 id="series" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Running a series with a group
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        One film is easy. A series is where groups fall apart, because someone
        always misses a week. Set an episode budget per session (two or three
        episodes of a drama, more of a sitcom), and agree on a spoiler rule: anyone
        who watches ahead keeps it out of the room chat. AniDachi rooms are live
        only today, so a friend who misses a night catches up on their own Netflix
        before the next one. If the group is planning a single film rather than a
        series, use{" "}
        <Link href="/guides/netflix-movie-night" className="text-brand-orange hover:underline">
          Netflix movie night
        </Link>{" "}
        instead. The setup clicks for every guest are in{" "}
        <Link
          href="/guides/how-to-watch-netflix-with-friends"
          className="text-brand-orange hover:underline"
        >
          how to watch Netflix with friends
        </Link>
        .
      </p>

      <SeoGuideRelated
        links={[
          { href: "/netflix-watch-party", label: "Netflix watch party hub" },
          {
            href: "/guides/how-to-watch-netflix-with-friends",
            label: "How to watch Netflix with friends, step by step",
          },
          { href: "/guides/netflix-movie-night", label: "Plan a Netflix movie night" },
          { href: "/pricing", label: "Plus and Pro room sizes and prices" },
        ]}
      />
      <p className="mt-6 text-sm leading-relaxed text-ani-muted">
        Sources, checked October 20, 2026:{" "}
        <a
          href="https://help.netflix.com/en/node/123277"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-orange hover:underline"
        >
          Netflix Help: sharing your account
        </a>
        ,{" "}
        <a
          href="https://www.teleparty.com/support"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-orange hover:underline"
        >
          Teleparty support FAQ
        </a>
        .
      </p>
    </SeoPageLayout>
  );
}
