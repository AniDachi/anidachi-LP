import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
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
import { getSeoSiteOrigin } from "@/lib/site-url";

const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const PAGE_TITLE = "Netflix Party Is Now Teleparty: 2026 Options";
const PAGE_DESCRIPTION =
  "Netflix Party, the Chrome extension, was renamed Teleparty in October 2020. What it does now, 2026 Netflix party options compared, and how to start one today.";

export const metadata: Metadata = {
  title: "Netflix Party Is Now Teleparty: 2026 Options",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/netflix-party" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/netflix-party",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/opengraph-image.png"],
  },
};

/** Third-party facts on this page, checked 20 Oct 2026. */
const SOURCES = [
  {
    href: "https://chromewebstore.google.com/detail/netflix-party-is-now-tele/oocalimimngaihdkbihfgmpkcpnmlaoa",
    label: "Teleparty Chrome Web Store listing",
  },
  { href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
  {
    href: "https://www.makeuseof.com/netflix-party-not-working-troubleshooting/",
    label: "MakeUseOf on the October 2020 rename",
  },
  { href: "https://syncup.tv/faq", label: "SyncUp FAQ" },
  { href: "https://kosmi.io/", label: "Kosmi home page" },
  { href: "https://kosmi.io/watchparty/", label: "Kosmi watch party page" },
  { href: "https://rave.io/", label: "Rave home page" },
];

const faq = [
  {
    question: "What happened to Netflix Party?",
    answer:
      "It was renamed Teleparty. The extension's Chrome Web Store listing says version 2.0.0 of Netflix Party added three more streaming services and renamed the product Teleparty. MakeUseOf dates the change to October 2020. The same listing is still live today.",
  },
  {
    question: "Is Netflix Party still available?",
    answer:
      "Yes, under the name Teleparty. Its Chrome Web Store listing is titled \"Netflix Party is now Teleparty\" and showed version 5.8.5, updated October 8, 2026, when we checked on October 20, 2026.",
  },
  {
    question: "Is Netflix Party free?",
    answer:
      "Teleparty's free tier hosts Netflix parties with synced playback and text chat. Teleparty Premium costs $6.59 a month or $47.88 a year and adds voice and video chat and more streaming services, according to its support FAQ.",
  },
  {
    question: "Was Netflix Party made by Netflix?",
    answer:
      "No. Netflix Party was a third-party browser extension, and Teleparty is still run by its own company. Netflix itself has no watch party feature in its Help Center as of October 20, 2026.",
  },
  {
    question: "Do both people need Netflix for Netflix Party?",
    answer:
      "Yes. Teleparty's FAQ says every participant needs access to an account on the streaming service used in the party. AniDachi works the same way: each person plays the title on their own Netflix.",
  },
  {
    question: "Is there a Netflix Party extension with video chat for free?",
    answer:
      "Teleparty limits voice and video chat to Premium. In AniDachi, voice and video are part of every room and friends join free, but the host needs Plus or Pro, including a 3-day trial for eligible accounts.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "history", label: "From Netflix Party to Teleparty", level: 2 },
  { id: "teleparty-today", label: "What Teleparty does now", level: 2 },
  { id: "options", label: "Netflix party options in 2026", level: 2 },
  { id: "start", label: "Start a Netflix party with AniDachi", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function NetflixPartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        { name: "Netflix Party", url: "/netflix-party" },
      ]}
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      url="/netflix-party"
      datePublished="2026-10-08"
      dateModified="2026-10-20"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
      conversionTemplate="pillar"
    >
      <SeoGuideTitle>Netflix Party Is Now Teleparty</SeoGuideTitle>
      <SeoGuideAnswer id="answer">
        <p>
          <strong>
            Netflix Party was a Chrome extension for watching Netflix in sync with
            friends. It was renamed Teleparty in October 2020, when it added other
            streaming services, and it still works on Netflix today.
          </strong>{" "}
          In 2026 you can also host a{" "}
          <Link href="/netflix-watch-party">Netflix watch party</Link> with
          AniDachi, which includes voice and video in every room.
        </p>
      </SeoGuideAnswer>

      <h2 id="history" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        From Netflix Party to Teleparty
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Netflix Party was never a Netflix product. It was an independent browser
        extension that put a chat sidebar next to the Netflix player and kept
        everyone&apos;s play and pause in step. It became the default answer to
        &quot;how do we watch Netflix together&quot; long before Netflix had any
        reason to build that itself, and it still hasn&apos;t.
      </p>
      <SeoGuideBulletList
        items={[
          {
            title: "The rename",
            body: "Teleparty's Chrome Web Store listing says that version 2.0.0 of Netflix Party added support for three streaming services, and that as part of that update the extension was renamed Teleparty. MakeUseOf places the change in October 2020.",
          },
          {
            title: "Why the name went",
            body: "Once the extension worked on more than Netflix, a name tied to one service no longer described it.",
          },
          {
            title: "The same listing today",
            body: "The Chrome listing is still titled \"Netflix Party is now Teleparty\", so a search for the old name lands on the current extension.",
          },
          {
            title: "Look-alike names",
            body: "The Chrome Web Store also shows other extensions with similar names from different developers, such as \"Netflix Party Pro is now Netflix Party Plus\". If you want the original, check that the listing links to teleparty.com.",
          },
        ]}
      />

      <h2 id="teleparty-today" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What Teleparty does now
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        These details come from Teleparty&apos;s own support FAQ and Chrome Web
        Store listing, checked October 20, 2026. The listing showed version 5.8.5,
        updated October 8, 2026, and 10,000,000 users.
      </p>
      <SeoGuideBulletList
        items={[
          {
            title: "Netflix on the free tier",
            body: "Free users can start parties on Netflix and other free services with synced playback and text chat.",
          },
          {
            title: "Premium",
            body: "$6.59 a month, or $3.99 a month billed yearly ($47.88). Premium adds voice and video chat, custom reactions and extra streaming services such as Crunchyroll and Paramount+. Guests can join a Premium host's party on the free version.",
          },
          {
            title: "Devices",
            body: "Browser extensions for Chrome, Edge, Safari and Opera, plus apps for Android and iOS. Not available on Firefox, smart TVs or consoles.",
          },
          {
            title: "Party size",
            body: "Teleparty says up to 1,000 or more people can join one party.",
          },
          {
            title: "Accounts",
            body: "Every participant needs access to the streaming service and needs Teleparty installed. Teleparty says the host should be on their main profile with the video playing before clicking the TP button.",
          },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        For a full look at the price tiers, read{" "}
        <Link href="/guides/is-teleparty-free" className="text-brand-orange hover:underline">
          is Teleparty free
        </Link>
        . For the Netflix-specific setup, see{" "}
        <Link href="/guides/teleparty-netflix" className="text-brand-orange hover:underline">
          Teleparty on Netflix
        </Link>
        .
      </p>

      <h2 id="options" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Netflix party options in 2026
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Teleparty is no longer the only way. This table lists what each tool says
        about Netflix on its own site, checked October 20, 2026. &quot;Not
        stated&quot; means we did not find it there; it does not mean the feature is
        missing.
      </p>
      <ResponsiveCompareTable
        columns={[
          { id: "teleparty", label: "Teleparty" },
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "syncup", label: "SyncUp" },
          { id: "kosmi", label: "Kosmi" },
          { id: "rave", label: "Rave" },
        ]}
        rows={[
          {
            feature: "How Netflix plays",
            values: {
              teleparty: "Each person's own Netflix, synced",
              anidachi: "Each person's own Netflix, synced",
              syncup: "Each person's own Netflix via its extension",
              kosmi: "Shared virtual browser in the room",
              rave: "Lists Netflix; method not stated",
            },
          },
          {
            feature: "Cost to host",
            values: {
              teleparty: "Free; Premium $6.59/mo",
              anidachi: "Plus or Pro (3-day trial); friends join free",
              syncup: "Free up to 5 people; Plus $3.99/mo",
              kosmi: "Free",
              rave: "Not stated",
            },
          },
          {
            feature: "Voice or video",
            values: {
              teleparty: "Premium only",
              anidachi: "Voice and video in every room",
              syncup: "Voice (1 hour/day free); video not stated",
              kosmi: "Voice and video chat, free",
              rave: "Not stated",
            },
          },
          {
            feature: "Devices",
            values: {
              teleparty: "4 browsers, Android, iOS",
              anidachi: "Desktop Chrome only",
              syncup: "Browsers and mobile apps",
              kosmi: "Web browser and mobile app",
              rave: "Mac, Windows, Android; site says Apple removed it from the App Store",
            },
          },
        ]}
      />
      <SeoGuideNote>
        <strong>How to read this:</strong> tools that sync each person&apos;s own
        Netflix keep full picture quality but need everyone to have Netflix. A
        shared browser puts the video inside the room instead; how well that works
        with Netflix&apos;s copy protection is something to test before a big night.
        Deeper comparisons:{" "}
        <Link href="/compare/anidachi-vs-teleparty">AniDachi vs Teleparty</Link>,{" "}
        <Link href="/compare/anidachi-vs-syncup">AniDachi vs SyncUp</Link>,{" "}
        <Link href="/compare/anidachi-vs-kosmi">AniDachi vs Kosmi</Link> and{" "}
        <Link href="/compare/anidachi-vs-rave">AniDachi vs Rave</Link>.
      </SeoGuideNote>
      <p className="mb-6 leading-relaxed text-ani-muted">
        When does AniDachi make sense over the old Netflix Party? When your group
        wants to see and hear each other during the film without everyone buying a
        voice add-on, and when the same friends also watch anime on Crunchyroll or
        long videos on YouTube. When does it not? If anyone is on a phone, uses
        Safari, or wants Disney+ or Hulu, stick with Teleparty or one of the others.
      </p>

      <h2 id="start" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        How to start a Netflix party with AniDachi
      </h2>
      <SeoGuideSteps
        steps={[
          {
            name: "Add AniDachi to Chrome",
            text: (
              <>
                <InstallLink href="/extension">Get AniDachi from the install page</InstallLink>{" "}
                on a desktop computer, choose Add to Chrome on the official listing,
                and sign in.
              </>
            ),
          },
          {
            name: "Play the movie or episode on Netflix",
            text: "Use your own Netflix account and start the title so the address bar shows netflix.com/watch/.",
          },
          {
            name: "Create a room",
            text: "Click the AniDachi capsule on the player and choose Create room. The host needs Plus or Pro; eligible accounts can start a 3-day trial.",
          },
          {
            name: "Send the link",
            text: "Friends install AniDachi, sign in on a Free account, and open the link. Each plays the title on their own Netflix while AniDachi keeps everyone at the same second.",
          },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        Rooms hold up to 6 people with a Plus host or 15 with Pro, including the
        host. The full walkthrough, what works today and a troubleshooting
        checklist are on the{" "}
        <Link href="/netflix-watch-party" className="text-brand-orange hover:underline">
          Netflix watch party
        </Link>{" "}
        hub.
      </p>

      <h2 id="related" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Related
      </h2>
      <SeoGuideRelated
        links={[
          { href: "/netflix-watch-party", label: "Netflix watch party hub" },
          { href: "/guides/watch-netflix-together", label: "Watch Netflix together: 4 ways compared" },
          { href: "/guides/netflix-party-extension", label: "Netflix Party extension" },
          { href: "/guides/does-netflix-have-a-watch-party", label: "Does Netflix have a watch party?" },
          { href: "/compare/anidachi-vs-teleparty", label: "AniDachi vs Teleparty" },
        ]}
      />
      <p className="mt-6 text-sm leading-relaxed text-ani-muted">
        Sources, checked October 20, 2026:{" "}
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
        . AniDachi is not affiliated with Netflix, Teleparty, SyncUp, Kosmi or Rave.
      </p>
    </SeoPageLayout>
  );
}
