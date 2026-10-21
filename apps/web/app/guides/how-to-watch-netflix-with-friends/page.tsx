import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { HowToJsonLd } from "@/components/json-ld";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { INSTALL_HOWTO_STEP_TEXT } from "@/lib/install-cta";
import { getSeoSiteOrigin } from "@/lib/site-url";

const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const PAGE_TITLE = "How to Watch Netflix with Friends (Step by Step)";
const PAGE_DESCRIPTION =
  "Step-by-step: watch Netflix with friends online in sync. Host and guest steps for desktop Chrome, own accounts, voice and video, plus a troubleshooting box.";

const howToSteps = [
  {
    name: "Agree on the title and start time",
    text: "Send the exact movie, or the season and episode number, plus one start time written in each person's time zone.",
  },
  {
    name: "Everyone installs AniDachi",
    text: `${INSTALL_HOWTO_STEP_TEXT} Each friend signs in; a Free account is enough to join.`,
  },
  {
    name: "Everyone signs in to their own Netflix",
    text: "Each person uses a Netflix account they are allowed to use, in desktop Chrome, and checks the title opens for them.",
  },
  {
    name: "The host creates the room",
    text: "The host starts the title so the address shows netflix.com/watch/, clicks the AniDachi capsule at the top-right of the player and chooses Create room. Hosting needs Plus or Pro, including a trial.",
  },
  {
    name: "The host shares the invite",
    text: "Copy the room link into the group chat, or use the person-plus button next to End room to invite saved friends and groups.",
  },
  {
    name: "Friends join and the host hands out seats",
    text: "Friends open the link and join on their own Netflix. In People, the host turns on microphone and camera access for each guest.",
  },
  {
    name: "Press play",
    text: "The host controls play, pause and seeking. Press Enter to chat, use number keys for quick reactions, and hold V to talk.",
  },
];

export const metadata: Metadata = {
  title: "How to Watch Netflix with Friends (Step by Step)",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/guides/how-to-watch-netflix-with-friends" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/guides/how-to-watch-netflix-with-friends",
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
    question: "How do you watch Netflix with friends online?",
    answer:
      "Pick a title and a start time, have each friend open it on their own Netflix account in desktop Chrome, and use a sync extension so play and pause match. With AniDachi, the host creates a room from the player and friends join free from the invite link.",
  },
  {
    question: "Can friends watch Netflix together on different accounts?",
    answer:
      "Yes, and they should. Sync tools line up separate Netflix accounts. Netflix's Help Center says an account may not be shared outside the household, so friends in other homes need their own access.",
  },
  {
    question: "Can my friends pause the movie?",
    answer:
      "In AniDachi, the host controls play, pause and seeking for the whole room. Friends can ask in chat or by voice, and the host pauses for everyone.",
  },
  {
    question: "Do my friends have to pay for AniDachi?",
    answer:
      "No. Friends join on Free AniDachi accounts. Only the host needs Plus or Pro, and eligible accounts can start with a 3-day trial. Everyone still needs Netflix.",
  },
  {
    question: "How many friends can watch Netflix together on AniDachi?",
    answer:
      "Up to 6 people including the host when the host has Plus, or up to 15 with Pro. Up to four cameras can be on at the same time.",
  },
  {
    question: "Can I watch Netflix with friends on my phone or TV?",
    answer:
      "Not with AniDachi, which needs desktop Chrome. A countdown on a call works on any screen, and Teleparty lists phone apps. The options are compared in watch Netflix together.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "before", label: "Before the night", level: 2 },
  { id: "steps", label: "Steps", level: 2 },
  { id: "friends", label: "What friends do", level: 2 },
  { id: "troubleshooting", label: "Troubleshooting", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToWatchNetflixWithFriendsPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch Netflix with friends"
        description="Host a synced Netflix room in desktop Chrome with AniDachi while each friend uses their own Netflix account."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Netflix watch party", url: "/netflix-watch-party" },
          {
            name: "How to watch Netflix with friends",
            url: "/guides/how-to-watch-netflix-with-friends",
          },
        ]}
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url="/guides/how-to-watch-netflix-with-friends"
        datePublished="2026-10-08"
        dateModified="2026-10-20"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>How to Watch Netflix with Friends</SeoGuideTitle>
        <SeoGuideAnswer id="answer">
          <p>
            <strong>
              To watch Netflix with friends online, everyone opens the same title on
              their own Netflix account in desktop Chrome, and one host with AniDachi
              Plus or Pro creates a room from the player and shares the link.
            </strong>{" "}
            Friends join free, playback stays in sync, and the room has chat,
            reactions, voice and video. The seven steps are below.
          </p>
        </SeoGuideAnswer>

        <h2 id="before" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Before the night: a two-minute checklist
        </h2>
        <SeoGuideBulletList
          items={[
            { title: "A computer each", body: "A laptop or desktop with Google Chrome. Phones and tablets cannot join." },
            { title: "Netflix for everyone", body: "Each friend signs in to an account they can use and confirms the title shows up in their country." },
            { title: "AniDachi installed", body: "Everyone adds the extension and signs in before start time, so nobody installs during the opening scene." },
            { title: "A headset", body: "Headphones stop the movie's sound from feeding back into everyone's microphone." },
          ]}
        />
        <p className="mb-6 leading-relaxed text-ani-muted">
          If nobody has installed it yet,{" "}
          <InstallLink href="/extension" className="text-brand-orange hover:underline">
            send the group the AniDachi install page
          </InstallLink>{" "}
          with the invite to the night.
        </p>

        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Steps
        </h2>
        <SeoGuideSteps steps={howToSteps} />

        <h2 id="friends" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          What friends do on their side
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Friends have less to do than the host. They install AniDachi, sign in on a
          Free account, make sure their own Netflix is signed in in Chrome, then open
          the invite link to join the room, with the title playing on their own
          Netflix tab.
          Once the host gives them a microphone or camera seat, they can talk by
          holding V, or click the microphone to leave it open. Chat opens with
          Enter. Quick reactions are turned on in Settings, then sent with the
          number keys 1 to 0.
        </p>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Want to compare this with Teleparty, a Discord share or a countdown first?
          That side-by-side is on{" "}
          <Link href="/guides/watch-netflix-together" className="text-brand-orange hover:underline">
            watch Netflix together
          </Link>
          . Bigger groups should also read{" "}
          <Link href="/guides/netflix-group-watch" className="text-brand-orange hover:underline">
            Netflix group watch
          </Link>
          .
        </p>

        <p className="mb-6 leading-relaxed text-ani-muted">
          Who should host? Pick the friend with the steadiest connection and a
          laptop that stays plugged in, because the room follows the host&apos;s
          play, pause and seeking. Only that person needs Plus or Pro; a Plus host
          fits up to 6 people including themselves, and a Pro host up to 15. If
          the group meets every week, keep the same host and rotate who picks the
          film instead. That way one plan covers everyone, and the host already
          knows where People, Settings and End room sit on the player.
        </p>

        <h2
          id="troubleshooting"
          className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
        >
          Troubleshooting
        </h2>
        <ResponsiveCompareTable
          columns={[{ id: "fix", label: "Fix" }]}
          rows={[
            {
              feature: "The capsule does not appear on the player",
              values: { fix: "Make sure the address is netflix.com/watch/, not the browse page. Refresh the tab once." },
            },
            {
              feature: "A friend cannot find the title",
              values: { fix: "Catalogs differ by country and by profile. Try another profile or pick a title everyone has." },
            },
            {
              feature: "One person is on a different scene",
              values: { fix: "Check the season and episode number. Trailers and recaps do not sync; skip to the main video." },
            },
            {
              feature: "A friend cannot talk",
              values: { fix: "The host turns on their microphone seat in People. Chrome must also allow the microphone." },
            },
            {
              feature: "Create room is not available",
              values: { fix: "Creating rooms needs Plus or Pro, including a trial. Friends join free." },
            },
            {
              feature: "A friend is on a phone",
              values: { fix: "AniDachi needs desktop Chrome. They can join from a laptop." },
            },
          ]}
        />
        <SeoGuideNote>
          <strong>Netflix plan with ads:</strong> we have not yet confirmed AniDachi
          on Netflix&apos;s ad-supported plan. If a friend uses it, run a short test
          room first. More fixes are in the{" "}
          <Link href="/netflix-watch-party">Netflix watch party</Link> hub&apos;s
          &quot;not working&quot; checklist.
        </SeoGuideNote>

        <SeoGuideRelated
          links={[
            { href: "/netflix-watch-party", label: "Netflix watch party hub" },
            { href: "/guides/watch-netflix-together", label: "Watch Netflix together: 4 ways compared" },
            { href: "/guides/netflix-group-watch", label: "Netflix group watch" },
            { href: "/guides/netflix-movie-night", label: "Plan a Netflix movie night" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
