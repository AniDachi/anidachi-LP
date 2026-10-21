import type { Metadata } from "next";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import { InstallLink } from "@/components/install-link";
import { ResponsiveDataTable } from "@/components/responsive-data-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getSeoSiteOrigin } from "@/lib/site-url";

const SITE_URL = getSeoSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;
const PAGE_PATH = "/guides/crunchyroll-watch-party-not-working";

const SOURCES = [
  { href: "https://www.crunchyroll.com/premium", label: "Crunchyroll plans page" },
  { href: "https://www.crunchyroll.com/tos", label: "Crunchyroll Terms of Service" },
];

export const metadata: Metadata = {
  title: "Crunchyroll Watch Party Not Working? 12 Fixes",
  description:
    "Crunchyroll watch party not syncing or a friend can't join? The real AniDachi messages, what each one means, and the fix: region, plan, browser, room limits.",
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: "Crunchyroll Watch Party Not Working? 12 Fixes",
    description:
      "Each message the AniDachi extension shows on Crunchyroll, what causes it, and how to fix it before the episode starts.",
    url: PAGE_PATH,
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crunchyroll Watch Party Not Working?",
    description: "Sync, join, region and browser fixes for Crunchyroll watch parties.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Why is my Crunchyroll watch party not working?",
    answer:
      "Most failures come from four places: a guest on a phone or a browser other than desktop Chrome, a guest whose Crunchyroll account cannot play that episode in their region, a host without Plus, Pro or a trial, or a stale extension that needs an update. The message in the AniDachi panel tells you which one it is.",
  },
  {
    question: "Why won't my Crunchyroll watch party sync?",
    answer:
      "If AniDachi shows a seconds-out-of-sync counter, press Catch up. If it says Playback needs your permission, press Resume sync; Chrome blocked autoplay in that tab. If the host's player is buffering, the room pauses and shows Buffering · room paused until it recovers.",
  },
  {
    question: "Why can't my friend join the Crunchyroll watch party?",
    answer:
      "Check the message they see. This watch room is full means the host's plan limit is reached (6 people on Plus, 15 on Pro, host included). A request to update AniDachi means their extension is out of date. A room that is no longer available has ended, so the host needs to send a new link.",
  },
  {
    question: "Does a Crunchyroll watch party work on mobile?",
    answer:
      "No. AniDachi runs as an extension in desktop Chrome 121 or newer, or Chromium Microsoft Edge. If a friend opens the invite on a phone, the room page asks them to open it on a computer. The Crunchyroll mobile app cannot load extensions.",
  },
  {
    question: "Can a guest pause a Crunchyroll watch party?",
    answer:
      "Not in AniDachi. The host controls play, pause, seek and episode changes for the room. If a guest pauses or skips, their player is put back on the host's position. Ask the host to pause, or use chat.",
  },
  {
    question: "Why does my friend's Crunchyroll tab go back to the host's episode?",
    answer:
      "That is the room keeping everyone on the same source. When a guest opens a different episode while in the room, AniDachi navigates their tab back to the episode the host is playing. Leave the room first if you want to watch something else.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "messages", label: "What each message means", level: 2 },
  { id: "before-you-start", label: "Check before you start", level: 2 },
  { id: "sync", label: "Playback drifts or stops", level: 2 },
  { id: "join", label: "A friend can't join", level: 2 },
  { id: "access", label: "Region and plan problems", level: 2 },
  { id: "still-broken", label: "Still broken?", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Use desktop Chrome",
    text: "Everyone opens the invite on a computer in Chrome 121 or newer, or Chromium Edge. Phones and the Crunchyroll app cannot run the extension.",
  },
  {
    name: "Play the episode on your own account",
    text: "Each person signs in to their own Crunchyroll account and confirms the episode actually plays for them before joining.",
  },
  {
    name: "Sign in to AniDachi",
    text: "Click the AniDachi capsule at the top-right of the Crunchyroll player and sign in. Guests can use a Free account.",
  },
  {
    name: "Join the host's room",
    text: "Open the invite link. While you are in the room, AniDachi moves your tab to the episode the host is playing.",
  },
  {
    name: "Fix drift from the panel",
    text: "If the panel shows seconds out of sync, press Catch up. If it asks for permission, press Resume sync.",
  },
];

const messageRows = [
  {
    message: "Seconds out of sync, with a Catch up button",
    meaning: "Your player fell behind or ran ahead of the host.",
    fix: "Press Catch up. It jumps you to the host's position.",
  },
  {
    message: "Playback needs your permission",
    meaning: "Chrome blocked the tab from starting video on its own.",
    fix: "Press Resume sync once. Chrome then lets the room start playback.",
  },
  {
    message: "Buffering · room paused",
    meaning: "The host's player is loading, so the room holds everyone.",
    fix: "Wait a few seconds. If it repeats, the host should close other heavy tabs or downloads.",
  },
  {
    message: "This watch room is full",
    meaning: "The host's plan limit is reached: 6 people on Plus, 15 on Pro, host included.",
    fix: "Someone leaves, or the host moves to Pro for larger groups.",
  },
  {
    message: "This room needs a host with Plus or Pro",
    meaning: "The person who created the room no longer has hosting access.",
    fix: "The host renews Plus or Pro, or another friend with access hosts.",
  },
  {
    message: "Update AniDachi to join this room",
    meaning: "Your extension is older than the room needs.",
    fix: "Update the extension (Chrome usually does this on restart), then refresh the Crunchyroll tab.",
  },
  {
    message: "This room was opened in another tab or device",
    meaning: "Your account is in the same room somewhere else. One session per account.",
    fix: "Close the other tab or computer, then rejoin here.",
  },
  {
    message: "You already have an active watch room",
    meaning: "You are hosting another room, possibly on another site.",
    fix: "End the old room from its capsule before creating a new one.",
  },
  {
    message: "The player did not reach the room source in time",
    meaning: "Your tab could not open the host's episode. Usually region or plan access.",
    fix: "Open the episode yourself on Crunchyroll. If it will not play, pick an episode everyone can open.",
  },
  {
    message: "Watch room ended / no longer available",
    meaning: "The host closed the room or the link is old.",
    fix: "Ask the host for a fresh invite link.",
  },
];

export default function CrunchyrollWatchPartyNotWorkingPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-crunchyroll"],
    excludeHref: PAGE_PATH,
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="Fix a Crunchyroll watch party that is not working"
        description="Check browser, Crunchyroll access and AniDachi sign-in, then use Catch up or Resume sync when playback drifts."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
          {
            name: "Crunchyroll watch party not working",
            url: PAGE_PATH,
          },
        ]}
        title="Crunchyroll watch party not working? 12 fixes"
        description="The messages AniDachi shows on Crunchyroll, what causes each one, and the fix."
        url={PAGE_PATH}
        datePublished="2026-06-08"
        dateModified="2026-10-20"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <SeoGuideTitle>Crunchyroll Watch Party Not Working? 12 Fixes</SeoGuideTitle>

        <h2 id="answer" className="scroll-mt-24">
          Short answer
        </h2>
        <SeoGuideAnswer>
          <strong>
            When a Crunchyroll watch party breaks, read the message in the
            AniDachi panel first. Drift has a Catch up button. A blocked tab
            needs Resume sync. A friend who can&apos;t join is usually on a
            phone, outdated, over the room limit, or can&apos;t play that
            episode in their region on their own Crunchyroll account.
          </strong>
        </SeoGuideAnswer>

        <p className="text-foreground/80 leading-relaxed mb-6">
          This page covers AniDachi watchrooms on Crunchyroll. The messages
          below are the ones the extension actually shows, so you can match
          what is on screen to a cause. If you use a different extension, the
          access checks in the{" "}
          <a href="#access" className="text-brand-orange hover:underline">
            region and plan section
          </a>{" "}
          still apply, and{" "}
          <Link
            href="/guides/teleparty-not-working-crunchyroll"
            className="text-brand-orange hover:underline"
          >
            Teleparty not working on Crunchyroll
          </Link>{" "}
          covers that tool. For the full setup from scratch, start at the{" "}
          <Link href="/watch-crunchyroll-together" className="text-brand-orange hover:underline">
            Crunchyroll watch party guide
          </Link>
          .
        </p>

        <h2
          id="messages"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          What each message means
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Open the AniDachi capsule at the top-right of the player to see the
          room panel. Status messages appear there, and most of the fixes on
          this page start from one of these lines.
        </p>
        <ResponsiveDataTable
          titleKey="message"
          columns={[
            { key: "message", label: "Message you see" },
            { key: "meaning", label: "What it means" },
            { key: "fix", label: "Fix" },
          ]}
          rows={messageRows}
        />

        <h2
          id="before-you-start"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Check before you start
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Most failed nights are decided before anyone presses play. Run these
          checks with the group ten minutes early:
        </p>
        <SeoGuideSteps steps={howToSteps} />
        <p className="text-foreground/80 leading-relaxed mb-8">
          Missing the extension, or not sure the install worked?{" "}
          <InstallLink href="/extension" className="text-brand-orange hover:underline">
            Add AniDachi to Chrome from the install page
          </InstallLink>
          , pin it from the puzzle-piece menu, and refresh any Crunchyroll tab
          that was already open. Friends join free; only the host needs Plus or
          Pro, including a trial.
        </p>

        <h3 className="text-xl font-semibold text-foreground mt-8 mb-3">
          No AniDachi capsule on the Crunchyroll page
        </h3>
        <p className="text-foreground/80 leading-relaxed mb-8">
          The capsule sits on the video player, so it only appears once
          Crunchyroll has loaded a player with a video in it. Some direct
          episode links open a details view first, with the artwork and
          description but no running video. That is a waiting state, not an
          error: press play on Crunchyroll and the capsule appears when the
          video starts. If it still does not show, refresh the tab. After an
          extension install or update, tabs opened earlier need that refresh.
          The extension only runs on crunchyroll.com, YouTube and Netflix
          pages, so a Crunchyroll video opened through another site will not
          work.
        </p>

        <h2
          id="sync"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Playback drifts or stops
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "1. Out of sync",
              body: "The panel shows how many seconds you are off, with a Catch up button. Press it rather than scrubbing by hand; manual seeking from a guest is undone anyway.",
            },
            {
              title: "2. Video won't start for one person",
              body: "Chrome sometimes blocks a background tab from playing video. AniDachi then shows Playback needs your permission. One click on Resume sync fixes it for the rest of the session.",
            },
            {
              title: "3. Room keeps pausing",
              body: "When the host's player buffers, the room pauses everyone and shows Buffering · room paused. A slow connection on the host's side causes this, not the guests'. The host can close large downloads or other video tabs.",
            },
            {
              title: "4. Guest can't pause or skip",
              body: "This is how the room works. The host controls play, pause, seek and the episode. A guest who pauses is returned to the host's position. Use chat to ask for a break.",
            },
            {
              title: "5. Tab jumps back to another episode",
              body: "If a guest opens a different episode while in the room, AniDachi sends their tab back to the host's episode. When the host moves to the next episode, guests follow.",
            },
          ]}
        />
        <SeoGuideNote>
          Running another watch-party extension on the same tab is a useful
          thing to rule out. Two tools trying to control one player can fight
          over pause and seek. Turn the other one off for a test episode.
        </SeoGuideNote>

        <h2
          id="join"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          A friend can&apos;t join
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "6. They opened the link on a phone",
              body: "The room page tells mobile visitors to continue on desktop Chrome and offers to copy or share the link to their computer. There is no AniDachi mobile app.",
            },
            {
              title: "7. Wrong browser",
              body: "Safari, Firefox and phone browsers cannot load the extension. Desktop Chrome 121 or newer and Chromium Edge can.",
            },
            {
              title: "8. Room is full",
              body: "Plus rooms hold 6 people and Pro rooms 15, host included. The limit comes from the host's plan, not the guest's.",
            },
            {
              title: "9. Extension out of date",
              body: "A guest with an old version is asked to update before joining. Chrome Web Store installs update automatically, usually after a browser restart.",
            },
            {
              title: "10. Same account in two places",
              body: "One AniDachi account can be in a room from one tab at a time. Joining from a second tab or computer ends the first session with a message saying so.",
            },
          ]}
        />

        <h2
          id="access"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Region and plan problems
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          AniDachi never streams video to anyone. Each person&apos;s Crunchyroll
          player loads the episode from Crunchyroll, under their own account,
          and AniDachi only lines the players up. So if Crunchyroll will not
          play an episode for one friend, the room cannot fix that.
        </p>
        <SeoGuideBulletList
          items={[
            {
              title: "11. Episode not available in a friend's region",
              body: "Crunchyroll's terms say content and features vary by territory and that it uses location checks to enforce this. A friend abroad may get a different catalog. AniDachi then reports that the player did not reach the room source. Pick a show that plays in every member's country.",
            },
            {
              title: "12. Account can't play the episode",
              body: "Every plan on Crunchyroll's plans page is paid, with a free trial for new and eligible subscribers. A friend without an active plan, or whose trial ended, will not get the video. Check by opening the episode on their own account before the session.",
            },
          ]}
        />
        <p className="text-foreground/80 leading-relaxed mb-4">
          Two things that look like access problems but are not. First, ads:
          Crunchyroll lists its current plans as ad-free, with a note that
          trailers and promotional messages may still appear. AniDachi&apos;s
          automatic ad pause is built for YouTube ads, so if a promo plays for
          one person on Crunchyroll, they press Catch up when it ends. Second,
          VPNs: Crunchyroll&apos;s terms say to use the service only where it
          is officially offered, so changing region to reach a show is not a
          fix we recommend.
        </p>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Sharing one login so a friend can watch is also not a workaround. It
          runs into Crunchyroll&apos;s household rules and stream limits; see{" "}
          <Link
            href="/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing"
            className="text-brand-orange hover:underline"
          >
            Crunchyroll account sharing rules
          </Link>{" "}
          and{" "}
          <Link
            href="/guides/does-everyone-need-crunchyroll-premium-for-watch-party"
            className="text-brand-orange hover:underline"
          >
            whether everyone needs Crunchyroll Premium
          </Link>
          .
        </p>

        <h2
          id="still-broken"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Still broken?
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Narrow it down with a two-person test. The host creates a room on a
          short episode both of you can play, and one friend joins. If that
          works, add people one at a time; the person who breaks it has a
          browser, region or account problem from the lists above. If even the
          two-person test fails, both of you refresh the Crunchyroll tab and
          the host creates a new room.
        </p>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Trying to use Discord screen share instead? Crunchyroll often shows a
          black screen there because the video is protected. The reasons are
          in{" "}
          <Link
            href="/guides/can-you-screen-share-crunchyroll-on-discord"
            className="text-brand-orange hover:underline"
          >
            can you screen share Crunchyroll on Discord
          </Link>
          . For voice drift during a session, see{" "}
          <Link
            href="/guides/how-to-fix-watch-party-audio-delay"
            className="text-brand-orange hover:underline"
          >
            how to fix watch party audio delay
          </Link>
          . To report a bug, use the{" "}
          <Link href="/contact" className="text-brand-orange hover:underline">
            contact page
          </Link>{" "}
          with the exact message you saw.
        </p>

        <h2
          id="sources"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Sources
        </h2>
        <p className="text-foreground/80 mb-8">
          AniDachi messages are taken from the current extension. Crunchyroll
          plan and terms details checked 20 Oct 2026:{" "}
          {SOURCES.map((source, index) => (
            <span key={source.href}>
              {index > 0 ? ", " : null}
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-orange hover:underline"
              >
                {source.label}
              </a>
            </span>
          ))}
          . Plans and benefits vary by region. AniDachi is not affiliated
          with Crunchyroll.
        </p>

        <h2 id="related" className="scroll-mt-24">
          Related guides
        </h2>
        <SeoGuideRelated
          links={[
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party guide" },
            {
              href: "/guides/how-to-sync-crunchyroll-with-friends",
              label: "How to sync Crunchyroll with friends",
            },
            {
              href: "/guides/crunchyroll-watch-party-chrome-extension",
              label: "Crunchyroll watch party extension: install and use",
            },
            {
              href: "/guides/teleparty-not-working-crunchyroll",
              label: "Teleparty not working on Crunchyroll",
            },
            ...relatedGuideLinks
              .filter(
                (g) =>
                  ![
                    "/watch-crunchyroll-together",
                    "/guides/how-to-sync-crunchyroll-with-friends",
                    "/guides/crunchyroll-watch-party-chrome-extension",
                    "/guides/teleparty-not-working-crunchyroll",
                  ].includes(g.href),
              )
              .map((g) => ({ href: g.href, label: g.label })),
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
