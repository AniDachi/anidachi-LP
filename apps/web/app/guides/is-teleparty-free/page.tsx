import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { InstallLink } from "@/components/install-link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import {
  PRICING_PLUS_SHORT,
  PRICING_PRO_SHORT,
  PRICING_ROOM_SIZE_RANGE,
} from "@/lib/pricing-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/guides/is-teleparty-free";
const PAGE_TITLE = "Is Teleparty Free and Safe? Premium Price & Privacy";
const PAGE_DESCRIPTION =
  "Teleparty is free on Netflix, YouTube and Disney+; Crunchyroll and video chat need Premium. Is it safe? Prices, permissions and data, checked Nov 2026.";
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

/**
 * Competitor facts below were checked on 20 Oct 2026; the support FAQ, privacy policy,
 * Premium page and extension version (5.8.9, permissions via Chrome-Stats) were re-checked
 * on 19 Nov 2026, and the Chrome Web Store data disclosure was read on 16 Nov 2026. The
 * safety section came from /guides/is-teleparty-safe, merged here on 23 Nov 2026 (ANI-77).
 * Re-check on each review date.
 */
const SOURCES = [
  { href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
  { href: "https://www.teleparty.com/premium", label: "Teleparty Premium page" },
  { href: "https://www.teleparty.com/privacy", label: "Teleparty privacy policy (effective June 30, 2026)" },
  {
    href: "https://chromewebstore.google.com/detail/netflix-party-is-now-tele/oocalimimngaihdkbihfgmpkcpnmlaoa",
    label: "Teleparty Chrome Web Store listing",
  },
  {
    href: "https://chrome-stats.com/d/oocalimimngaihdkbihfgmpkcpnmlaoa",
    label: "Chrome-Stats record for Teleparty (version 5.8.9 and permissions)",
  },
  { href: "https://apps.apple.com/us/app/id1620026075", label: "Teleparty iPhone and iPad App Store listing" },
  { href: "https://apps.apple.com/us/app/id6471985961", label: "Teleparty Mac App Store listing" },
];

const installSteps = [
  {
    name: "Install it from the official store listing",
    text: "Use the official Teleparty listing on the Chrome Web Store (linked in the sources on this page), which has about 10 million users. Skip download sites that offer the extension file directly.",
  },
  {
    name: "Read Chrome's access prompt",
    text: "When you click Add to Chrome, Chrome shows any access the extension wants. If the prompt asks to read and change your data on all websites, stop and check that you have the right listing.",
  },
  {
    name: "Sign in to your streaming service on its own site",
    text: "Log in to Netflix, Disney+ or Crunchyroll on that service's website as usual. Teleparty says it doesn't store your streaming password, so don't type it anywhere else.",
  },
  {
    name: "Pay only through Teleparty itself",
    text: "If you buy Premium, pay through Teleparty's own upgrade page after signing in with Google, or through its official App Store app. Don't pay a third-party site that promises a cheaper Teleparty Premium.",
  },
];

const telepartySteps = [
  {
    name: "Install the extension",
    text: "Add Teleparty to Chrome, Edge, Safari or Opera on a computer. Teleparty's support page says it is not available for Firefox. A red TP button appears in the toolbar once it is installed.",
  },
  {
    name: "Start the video",
    text: "Sign in to a supported streaming service on your main profile and start playing a show or movie. On Netflix, the address should look like netflix.com/watch/ followed by a number.",
  },
  {
    name: "Click TP to start the party",
    text: "Click the red TP button to turn the video into a Teleparty and open the chat sidebar. Crunchyroll, Paramount+ and other premium services need a host with Teleparty Premium.",
  },
  {
    name: "Share the link",
    text: "Use the share icon at the top of the chat to copy the party link. Friends open it, then click their own TP button to join. Each of them needs the extension (or the app) and their own access to the service.",
  },
];

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "What Teleparty's free version covers, what Premium costs, and whether the extension is safe: its permissions, data and privacy policy.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "Teleparty's free tier, Premium prices and safety, from its own pages.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Is Teleparty safe?",
    answer:
      "Yes, by the usual tests. It is a real extension from WP Interactive Media with about 10 million Chrome users, and version 5.8.9 asks for only four basic permissions (activeTab, storage, scripting and alarms), with no request to read every website. It does collect usage data, your IP address and a unique ID, according to its privacy policy.",
  },
  {
    question: "Is Teleparty free?",
    answer:
      "Yes, for the free services. Teleparty's support FAQ says the free version lets you start parties on services such as Netflix, Disney+, Hulu, Amazon, YouTube and HBO Max, with video sync and text chat. Crunchyroll, Paramount+, ESPN+ and voice or video chat need Teleparty Premium.",
  },
  {
    question: "Does Teleparty Premium have a free trial?",
    answer:
      "Only on the annual plan. Teleparty's support FAQ (checked 19 Nov 2026) says the annual plan comes with a 7-day free trial and the monthly plan has none. You can cancel any time and keep Premium until the end of the billing period, but Teleparty doesn't refund unused time.",
  },
  {
    question: "How much is Teleparty Premium?",
    answer:
      "On 19 Nov 2026 Teleparty's support FAQ listed $6.59 a month, or $47.88 a year ($3.99 a month billed annually), with a 7-day free trial on the annual plan only. Its iPhone App Store listing showed $6.95 a month or $49.95 a year on 20 Oct 2026, so check the price where you subscribe.",
  },
  {
    question: "Does Teleparty work with Crunchyroll for free?",
    answer:
      "No. Teleparty lists Crunchyroll as a premium service, so the host needs Teleparty Premium. Friends can join that party with the free version, but each still needs their own Crunchyroll access.",
  },
  {
    question: "Does Teleparty have ads?",
    answer:
      "Teleparty's Mac App Store description lists 'no ads' among Premium features, which suggests the free version can show ads. Its support FAQ does not describe where ads appear, so we can't say more than that.",
  },
  {
    question: "Does everyone need Teleparty Premium?",
    answer:
      "No. Only the host of a premium-service party needs Premium. Teleparty's FAQ says guests join premium parties with the free version, and anyone can receive voice and video from Premium users, but only Premium users can turn on their own camera and microphone.",
  },
  {
    question: "Is Teleparty on iPhone and Android?",
    answer:
      "Yes. Teleparty's support page links iOS and Android apps. It also says the mobile apps support fewer services than the browser extension, naming Netflix, Disney+, Hulu and HBO Max.",
  },
  {
    question: "Is Teleparty legit?",
    answer:
      "Yes. Teleparty is the extension that used to be called Netflix Party, and its Chrome Web Store listing dates from April 2020. Its privacy policy names WP Interactive Media, Inc. as the company behind it and gives team@teleparty.com for data requests.",
  },
  {
    question: "Can Teleparty see my Netflix password?",
    answer:
      "No. You sign in to Netflix on Netflix's own site, and Teleparty's support FAQ says it does not store your streaming service account details or password. Teleparty's own sign-in, which you need for Premium, uses a Google account, and website payments go through Stripe.",
  },
  {
    question: "What data does Teleparty collect, and does it sell it?",
    answer:
      "Its privacy policy (effective June 30, 2026) says installing the extension assigns you a unique ID, and that it collects usage statistics, your IP address and cookie data, uses Google Analytics and uses your location for internal analytics. It says it does not sell your personal information and does not currently store chat messages.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "free-vs-premium", label: "Free vs Premium", level: 2 },
  { id: "price", label: "Premium price and trial", level: 2 },
  { id: "ads", label: "Ads", level: 2 },
  { id: "platforms", label: "Supported services and devices", level: 2 },
  { id: "safe", label: "Is Teleparty safe?", level: 2 },
  { id: "how-to-use", label: "How to use Teleparty", level: 2 },
  { id: "verdict", label: "Teleparty or AniDachi?", level: 2 },
  { id: "sources", label: "Sources and review dates", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function IsTelepartyFreePage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Guides", url: "/guides" },
        { name: "Is Teleparty free and safe?", url: PAGE_PATH },
      ]}
      title="Is Teleparty free and safe?"
      description={PAGE_DESCRIPTION}
      url={PAGE_PATH}
      datePublished="2026-10-20"
      dateModified="2026-11-23"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
      aboveFoldStyle="hero"
    >
      <SeoGuideTitle>Is Teleparty Free and Safe? Premium Price, Privacy and Setup</SeoGuideTitle>
      <h2 id="answer" className="scroll-mt-24">
        Short answer
      </h2>
      <SeoGuideAnswer>
        <p>
          <strong>
            Yes, partly. Teleparty is free for parties on Netflix, YouTube,
            Disney+, Hulu, HBO Max and Prime Video, with synced playback and
            text chat. Crunchyroll, Paramount+, ESPN+ and other premium
            services, plus voice and video chat, need Teleparty Premium:
            $6.59 a month or $47.88 a year on its website when we checked on
            19 Nov 2026.
          </strong>{" "}
          Guests can join a Premium host&apos;s party for free.
        </p>
        <p>
          <strong>
            And yes, it is safe to install. Teleparty is a legitimate extension
            with about 10 million Chrome users, and its current version asks for
            only four basic permissions, with no request to read every website
            you visit.
          </strong>{" "}
          It says it doesn&apos;t store your streaming password or sell your
          personal information, but it does give you a unique ID and collect
          usage data, your IP address and your location for analytics. The
          7-day free trial is on the annual plan only.
        </p>
      </SeoGuideAnswer>

      <h2 id="free-vs-premium" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Teleparty free vs Premium
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Teleparty (formerly Netflix Party) splits its services into two
        groups. The free version covers the big general-purpose streamers.
        Premium unlocks a second list of &quot;premium services&quot; and the
        call features. Its Chrome Web Store listing describes this as 9
        services for free and 23 extra streaming services for Premium.
        Planning a{" "}
        <Link href="/netflix-watch-party">Netflix watch party</Link>? That
        page compares Teleparty with the other ways to watch Netflix together.
      </p>
      <ResponsiveCompareTable
        columns={[
          { id: "free", label: "Teleparty free" },
          { id: "premium", label: "Teleparty Premium" },
        ]}
        rows={[
          {
            feature: "Host parties on Netflix, YouTube, Disney+, Hulu, HBO Max, Prime Video",
            values: { free: "yes", premium: "yes" },
          },
          {
            feature: "Host parties on Crunchyroll, Paramount+, ESPN+ and other premium services",
            values: { free: "no", premium: "yes" },
          },
          {
            feature: "Join a premium-service party someone else hosts",
            values: { free: "yes", premium: "yes" },
          },
          { feature: "Synced playback and text chat", values: { free: "yes", premium: "yes" } },
          {
            feature: "Turn on your own camera and microphone",
            values: { free: "no", premium: "yes" },
          },
          {
            feature: "See and hear Premium users' video and voice",
            values: { free: "yes", premium: "yes" },
          },
          {
            feature: "Custom reactions, chat badges and profiles",
            values: { free: "no", premium: "yes" },
          },
          {
            feature: "Price",
            values: { free: "$0", premium: "$6.59/mo or $47.88/yr (website)" },
          },
        ]}
      />
      <p className="mb-8 leading-relaxed text-ani-muted">
        The detail most anime fans miss: Crunchyroll is on the premium list.
        If your group watches anime, somebody has to pay for Teleparty Premium
        to host. Teleparty&apos;s FAQ says guests can then join that party on
        the free version. This is also why &quot;Teleparty Crunchyroll&quot;
        searches so often end in confusion; we cover the details in{" "}
        <Link href="/watch-crunchyroll-together">
          does Teleparty work with Crunchyroll
        </Link>
        .
      </p>

      <h2 id="price" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Teleparty Premium price and trial
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Teleparty&apos;s support FAQ lists Premium at <strong>$6.59 a month</strong>{" "}
        on the monthly plan, or <strong>$3.99 a month billed annually ($47.88)</strong>{" "}
        on the annual plan. The 7-day free trial applies to the annual plan
        only; the monthly plan has no trial. You can cancel any time, keep
        Premium until the end of the billing period, and Teleparty says it
        does not refund unused time.
      </p>
      <p className="mb-8 leading-relaxed text-ani-muted">
        Prices are not identical everywhere. The iPhone and iPad App Store
        listing showed $6.95 a month or $49.95 a year on the same day. Teleparty
        also needs a Google account to sign in and upgrade, according to its
        FAQ. Check the price on the screen where you pay rather than relying on
        any third-party page, including this one.
      </p>

      <h2 id="ads" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Does Teleparty have ads?
      </h2>
      <p className="mb-8 leading-relaxed text-ani-muted">
        Teleparty&apos;s Mac App Store description lists &quot;no ads&quot;
        among the things Premium includes, which implies free users can see
        some advertising. Its support FAQ doesn&apos;t say where. Separately,
        ads from the streaming service itself are not Teleparty&apos;s: if your
        Netflix, Hulu or Disney+ plan has ads, you&apos;ll still see them in a
        party, and Teleparty&apos;s Chrome Web Store release notes mention fixes
        for keeping ad-based plans in sync.
      </p>

      <h2 id="platforms" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Supported services, browsers and phones
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Free services",
            body: "Netflix, YouTube, Disney+, Hulu, HBO Max and Amazon Prime Video are the ones Teleparty names on its homepage and FAQ.",
          },
          {
            title: "Premium services",
            body: "Crunchyroll, Paramount+, ESPN+, Peacock, Apple TV, Viki, Mubi, Shudder and more appear on its Premium page.",
          },
          {
            title: "Browsers",
            body: "Chrome, Edge, Safari and Opera on a computer. Teleparty says it is not available for Firefox, smart TVs or game consoles.",
          },
          {
            title: "Phones and tablets",
            body: "Apps for iOS and Android. The support FAQ says the mobile apps support fewer services than the extension (Netflix, Disney+, Hulu and HBO Max), and the Android app supports Premium services with a subscription.",
          },
          {
            title: "Group size",
            body: "Teleparty says up to 1,000 people can join one party.",
          },
          {
            title: "Accounts",
            body: "Everyone in the party needs their own access to the streaming service being watched.",
          },
        ]}
      />

      <h2 id="safe" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Is Teleparty safe?
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        The free and Premium versions are the same extension, so the safety
        answer doesn&apos;t depend on whether you pay. Teleparty used to be
        called Netflix Party, and its Chrome Web Store listing dates from April
        2020. Its privacy policy names <strong>WP Interactive Media, Inc.</strong>{" "}
        as the company behind it. Chrome-Stats shows about 10 million users and
        a 3.97 rating from about 17,500 ratings, and version 5.8.9 came out on
        13 Nov 2026, so it is still maintained.
      </p>

      <h3 id="permissions" className="mt-6 scroll-mt-24 text-xl font-semibold text-ani-text">
        What it can access in your browser
      </h3>
      <p className="mb-4 leading-relaxed text-ani-muted">
        A Chrome extension can only do what its permissions allow. Version 5.8.9
        asks for four:
      </p>
      <SeoGuideBulletList
        items={[
          {
            title: "activeTab",
            body: "Temporary access to the tab you're on, but only after you click the extension's button there.",
          },
          { title: "scripting", body: "Lets it run its own code in a page it already has access to." },
          { title: "storage", body: "Saves its own settings inside Chrome." },
          { title: "alarms", body: "Runs tasks on a timer." },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        Chrome-Stats lists no optional permissions and no host permissions for
        this version, and none of the four gives access to your browsing
        history, downloads or passwords saved in Chrome. The list has not
        changed since version 5.0.0 in May 2024.
      </p>

      <h3 id="data" className="mt-6 scroll-mt-24 text-xl font-semibold text-ani-text">
        What data it collects
      </h3>
      <SeoGuideBulletList
        items={[
          {
            title: "A unique ID",
            body: "Installing the extension assigns you an identifier that Teleparty stores on its servers, used to let you into parties and for usage statistics.",
          },
          {
            title: "Usage data, IP address, cookies and location",
            body: "The privacy policy (effective June 30, 2026) lists preferences, usage statistics, server logs, your IP address and cookies, uses Google Analytics, and uses your location for internal analytics.",
          },
          {
            title: "Chat",
            body: "The policy says Teleparty does not currently store your messages or chat history during watch parties.",
          },
          {
            title: "Selling data",
            body: "The policy says it does not sell your personal information. The Chrome Web Store disclosure, read on 16 Nov 2026, lists personal communications, location and user activity, and says data isn't sold outside approved uses.",
          },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        People in the EU, EEA and UK can ask to see, correct, delete or move
        their data, and California residents can ask to know, delete and correct
        it. Requests go to <strong>team@teleparty.com</strong>. To stop it
        collecting anything new, remove the extension from Chrome&apos;s
        extensions page.
      </p>

      <h3 id="passwords" className="mt-6 scroll-mt-24 text-xl font-semibold text-ani-text">
        Passwords and payments
      </h3>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Teleparty&apos;s support FAQ says it does not store your streaming
        service account details or password: you sign in to Netflix, Disney+ or
        Crunchyroll on their own sites. Teleparty&apos;s own sign-in, needed for
        Premium, uses a Google account, and payments on its website go through
        Stripe, which receives your payment details, IP address and device
        information to process the charge and check for fraud.
      </p>

      <h3 id="install-safely" className="mt-6 scroll-mt-24 text-xl font-semibold text-ani-text">
        How to install Teleparty safely
      </h3>
      <SeoGuideSteps steps={installSteps} />
      <SeoGuideNote>
        Our read: nothing in Teleparty&apos;s permissions or privacy policy is
        unusual for a watch-party extension. The bigger risk is a fake copy, so
        install it from the official listing and read Chrome&apos;s access
        request before you click Add.
      </SeoGuideNote>

      <h3 id="anidachi-permissions" className="mt-6 scroll-mt-24 text-xl font-semibold text-ani-text">
        The same check on AniDachi
      </h3>
      <p className="mb-4 leading-relaxed text-ani-muted">
        We make AniDachi, another watch-party extension. It asks for more
        permissions than Teleparty, because it signs you in, sends room invites
        and copies invite links, but its access to websites is limited to the
        sites it works on.
      </p>
      <ResponsiveCompareTable
        columns={[
          { id: "teleparty", label: "Teleparty 5.8.9" },
          { id: "anidachi", label: "AniDachi" },
        ]}
        rows={[
          { feature: "Can read every website you visit", values: { teleparty: "no", anidachi: "no" } },
          {
            feature: "Sites it can run on",
            values: {
              teleparty: "No site access requested beyond the active tab (per Chrome-Stats)",
              anidachi: "YouTube, Netflix, Crunchyroll and anidachi.app (and connects to AniDachi's servers)",
            },
          },
          {
            feature: "Other permissions",
            values: {
              teleparty: "activeTab, scripting, storage, alarms",
              anidachi: "storage, alarms, identity, cookies, notifications, clipboardWrite",
            },
          },
          { feature: "Stores your streaming password", values: { teleparty: "no", anidachi: "no" } },
        ]}
      />
      <p className="mb-8 leading-relaxed text-ani-muted">
        Identity opens AniDachi&apos;s sign-in window, cookies checks whether
        you&apos;re signed in on anidachi.app, notifications shows room invites,
        and clipboardWrite copies an invite link. The full list is on our{" "}
        <Link href="/security">security page</Link> and in our{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2 id="how-to-use" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        How to use Teleparty in 4 steps
      </h2>
      <SeoGuideSteps steps={telepartySteps} />
      <p className="mb-8 leading-relaxed text-ani-muted">
        If the TP button stays grey, Teleparty&apos;s FAQ suggests checking that
        you are signed in, on your main profile, with a video actually playing,
        and reinstalling the extension if it still won&apos;t start. Crunchyroll
        problems have their own fixes in{" "}
        <Link href="/watch-crunchyroll-together">
          Teleparty not working on Crunchyroll
        </Link>
        .
      </p>

      <h2 id="verdict" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        When Teleparty is the better pick, and when AniDachi is
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        We make AniDachi, so weigh this accordingly. Teleparty is the better
        choice in several common cases:
      </p>
      <SeoGuideBulletList
        items={[
          {
            body: (
              <>
                Your group watches Disney+, Hulu, HBO Max, Prime Video or
                Paramount+. AniDachi does not support those. For Prime Video,
                what works today is in{" "}
                <Link href="/prime-video-watch-party" className="text-brand-orange hover:underline">
                  Prime Video watch party
                </Link>
                .
              </>
            ),
          },
          { body: "Someone joins from a phone or tablet. AniDachi has no mobile app." },
          { body: "Someone uses Edge, Safari or Opera. AniDachi runs in desktop Chrome only." },
          { body: "You want free hosting on Netflix or YouTube with text chat, and don't need calls." },
          { body: "Your party is bigger than 15 people." },
        ]}
      />
      <p className="mb-4 leading-relaxed text-ani-muted">
        AniDachi fits a narrower job: Crunchyroll, YouTube and Netflix nights in
        desktop Chrome where you want to talk. Rooms include voice and video
        calls with push-to-talk, on-player chat and reactions. One host creates the room on Free (30 host minutes per UTC day for up to 4 people),
        Plus ({PRICING_PLUS_SHORT}), or Pro ({PRICING_PRO_SHORT}). Rooms hold {PRICING_ROOM_SIZE_RANGE}.
        Everyone still uses their own streaming account.
      </p>
      <p className="mb-8 leading-relaxed text-ani-muted">
        For Crunchyroll, YouTube and Netflix with voice,{" "}
        <InstallLink href="/extension">try AniDachi; friends join free</InstallLink>
        . Other options, side by side, are in{" "}
        <Link href="/guides/best-teleparty-alternatives-for-anime">
          the best Teleparty alternatives
        </Link>
        .
      </p>

      <h2 id="sources" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Sources and review dates
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Every Teleparty detail on this page comes from Teleparty&apos;s own pages,
        store listings and Chrome-Stats. The support FAQ (prices, free trial, free and
        premium services, password), the privacy policy and the Premium
        page&apos;s service list were re-checked on 19 Nov 2026 and still
        match, and the Chrome Web Store data disclosure was read on 16 Nov 2026.
        We haven&apos;t audited Teleparty&apos;s code; the safety section reports
        what its policy, support page and Chrome-Stats say. The extension&apos;s version and permission list (via
        Chrome-Stats) were updated the same day: version 5.8.9 lists no
        optional access to all websites, so we removed that line. The App Store
        listings were last checked on 20 Oct 2026:{" "}
        {SOURCES.map((source, index) => (
          <span key={source.href}>
            {index > 0 ? ", " : null}
            <a href={source.href} target="_blank" rel="noopener noreferrer">
              {source.label}
            </a>
          </span>
        ))}
        . Teleparty&apos;s pages don&apos;t always agree with each other (for
        example, App Store and website prices differ), so where they differ we
        say which page a number came from.
      </p>
      <p className="mb-8 leading-relaxed text-ani-muted">
        We re-check these sources on 19 Dec 2026, 18 Jan 2027 and 17 Feb 2027, and
        update the date at the bottom of this page when something changes. AniDachi is not affiliated with Teleparty.
      </p>

      <SeoGuideRelated
        links={[
          { href: "/guides/best-teleparty-alternatives-for-anime", label: "Best Teleparty alternatives" },
          { href: "/watch-crunchyroll-together",
            label: "Crunchyroll watch party" },
          {
            href: "/guides/teleparty-not-working-youtube",
            label: "Teleparty not working on YouTube?",
          },
          { href: "/netflix-watch-party", label: "Netflix watch party" },
          { href: "/pricing", label: "AniDachi pricing" },
        ]}
      />
    </SeoPageLayout>
  );
}
