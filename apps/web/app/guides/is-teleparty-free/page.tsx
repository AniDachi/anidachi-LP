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
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

/** Competitor facts below were checked on these pages on 20 Oct 2026. Re-check on each review date. */
const SOURCES = [
  { href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
  { href: "https://www.teleparty.com/premium", label: "Teleparty Premium page" },
  { href: "https://www.teleparty.com/privacy", label: "Teleparty privacy policy (effective June 30, 2026)" },
  {
    href: "https://chromewebstore.google.com/detail/netflix-party-is-now-tele/oocalimimngaihdkbihfgmpkcpnmlaoa",
    label: "Teleparty Chrome Web Store listing (version 5.8.5)",
  },
  { href: "https://apps.apple.com/us/app/id1620026075", label: "Teleparty iPhone and iPad App Store listing" },
  { href: "https://apps.apple.com/us/app/id6471985961", label: "Teleparty Mac App Store listing" },
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
  title: "Is Teleparty Free? Premium, Safety and Setup",
  description:
    "Teleparty is free on Netflix, YouTube, Disney+ and more; Crunchyroll and video chat need Premium. Prices, permissions, privacy and setup, checked Oct 2026.",
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: "Is Teleparty Free? Premium, Safety and Setup",
    description:
      "What Teleparty's free version covers, what Premium costs, what the extension can access, and how to start a party.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Is Teleparty Free? Premium, Safety and Setup",
    description: "Teleparty's free tier, Premium prices, safety and setup, from its own pages.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Is Teleparty free?",
    answer:
      "Yes, for the free services. Teleparty's support FAQ says the free version lets you start parties on services such as Netflix, Disney+, Hulu, Amazon, YouTube and HBO Max, with video sync and text chat. Crunchyroll, Paramount+, ESPN+ and voice or video chat need Teleparty Premium.",
  },
  {
    question: "How much is Teleparty Premium?",
    answer:
      "On 20 Oct 2026 Teleparty's support FAQ listed $6.59 a month, or $47.88 a year ($3.99 a month billed annually), with a 7-day free trial on the annual plan only. Its iPhone App Store listing showed $6.95 a month or $49.95 a year, so check the price where you subscribe.",
  },
  {
    question: "Is Teleparty safe?",
    answer:
      "It is a long-running extension from WP Interactive Media with about 10 million Chrome users. Teleparty says it does not store your streaming password, and its privacy policy says it does not sell personal information. It does collect a unique ID, usage data and IP address, and uses Google Analytics.",
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
    question: "How do you use Teleparty?",
    answer:
      "Install the extension, sign in to a supported streaming service, start a video, click the red TP button to create the party, and share the link. Friends open the link and click their own TP button to join.",
  },
  {
    question: "Is Teleparty on iPhone and Android?",
    answer:
      "Yes. Teleparty's support page links iOS and Android apps. It also says the mobile apps support fewer services than the browser extension, naming Netflix, Disney+, Hulu and HBO Max.",
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
        { name: "Is Teleparty free?", url: PAGE_PATH },
      ]}
      title="Is Teleparty free?"
      description="Teleparty's free tier, Premium prices, safety and setup, checked against Teleparty's own pages."
      url={PAGE_PATH}
      datePublished="2026-10-20"
      dateModified="2026-10-20"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Is Teleparty Free? Premium, Safety and How to Use It</SeoGuideTitle>
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
            20 Oct 2026.
          </strong>{" "}
          Guests can join a Premium host&apos;s party for free.
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
        <Link href="/guides/does-teleparty-work-with-crunchyroll">
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
        &quot;Safe&quot; usually means three things: is it a real extension,
        what can it access in your browser, and what does the company do with
        your data. Here is what Teleparty&apos;s own pages and its Chrome Web
        Store listing say.
      </p>
      <SeoGuideBulletList
        items={[
          {
            title: "Who makes it",
            body: "WP Interactive Media, Inc. The Chrome Web Store listing shows about 10 million users, a 4.0 rating from about 17,500 ratings, and says the publisher has a good record with no history of violations.",
          },
          {
            title: "Browser permissions",
            body: "The current Chrome version (5.8.5) requests activeTab, storage, scripting and alarms. It can also ask for optional access to all websites, which you approve or decline in Chrome. In plain terms: it can run on the tab you use it on and save its own settings.",
          },
          {
            title: "Your streaming password",
            body: "Teleparty's FAQ says it does not store your streaming service account details or password. You sign in to Netflix or Crunchyroll on their own sites.",
          },
          {
            title: "Data it collects",
            body: "Its privacy policy (effective June 30, 2026) says installing the extension assigns a unique identifier, and it collects usage statistics, IP address and cookie data, and uses Google Analytics. The Chrome Web Store disclosure lists personal communications, location and user activity.",
          },
          {
            title: "Chat",
            body: "The privacy policy says Teleparty does not currently store messages or chat history from watch parties.",
          },
          {
            title: "Selling data",
            body: "The privacy policy says Teleparty does not sell personal information, and the Chrome Web Store disclosure says data is not sold outside approved use cases. Payments go through Stripe, which also receives your IP address and device details for fraud checks.",
          },
        ]}
      />
      <SeoGuideNote>
        Our read: Teleparty is a mainstream, long-running extension and nothing
        in its permissions or policy is unusual for a watch-party tool. As with
        any extension, install it only from the official store listing, and
        read the access request before you approve it.
      </SeoGuideNote>

      <h2 id="how-to-use" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        How to use Teleparty in 4 steps
      </h2>
      <SeoGuideSteps steps={telepartySteps} />
      <p className="mb-8 leading-relaxed text-ani-muted">
        If the TP button stays grey, Teleparty&apos;s FAQ suggests checking that
        you are signed in, on your main profile, with a video actually playing,
        and reinstalling the extension if it still won&apos;t start. Crunchyroll
        problems have their own fixes in{" "}
        <Link href="/guides/teleparty-not-working-crunchyroll">
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
          { body: "Your group watches Disney+, Hulu, HBO Max, Prime Video or Paramount+. AniDachi does not support those." },
          { body: "Someone joins from a phone or tablet. AniDachi has no mobile app." },
          { body: "Someone uses Edge, Safari or Opera. AniDachi runs in desktop Chrome only." },
          { body: "You want free hosting on Netflix or YouTube with text chat, and don't need calls." },
          { body: "Your party is bigger than 15 people." },
        ]}
      />
      <p className="mb-4 leading-relaxed text-ani-muted">
        AniDachi fits a narrower job: Crunchyroll, YouTube and Netflix nights in
        desktop Chrome where you want to talk. Rooms include voice and video
        calls with push-to-talk, on-player chat and reactions. One host with
        Plus ({PRICING_PLUS_SHORT}), Pro ({PRICING_PRO_SHORT}) or an eligible 3-day
        trial creates the room. Rooms hold {PRICING_ROOM_SIZE_RANGE}.
        Everyone still uses their own streaming account.
      </p>
      <p className="mb-8 leading-relaxed text-ani-muted">
        For Crunchyroll, YouTube and Netflix with voice,{" "}
        <InstallLink href="/extension">try AniDachi; friends join free</InstallLink>
        . The full side-by-side is in{" "}
        <Link href="/compare/anidachi-vs-teleparty">AniDachi vs Teleparty</Link>,
        and other options are in{" "}
        <Link href="/guides/best-teleparty-alternatives-for-anime">
          the best Teleparty alternatives for anime
        </Link>
        .
      </p>

      <h2 id="sources" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Sources and review dates
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Every Teleparty detail on this page was checked on 20 Oct 2026 against
        Teleparty&apos;s own pages and store listings:{" "}
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
        We re-check prices, services and the privacy policy on 19 Nov 2026, 19
        Dec 2026 and 18 Jan 2027, and update the date at the bottom of this page
        when something changes. AniDachi is not affiliated with Teleparty.
      </p>

      <SeoGuideRelated
        links={[
          { href: "/compare/anidachi-vs-teleparty", label: "AniDachi vs Teleparty" },
          { href: "/guides/teleparty-netflix", label: "Teleparty on Netflix" },
          {
            href: "/guides/does-teleparty-work-with-crunchyroll",
            label: "Does Teleparty work with Crunchyroll?",
          },
          {
            href: "/guides/does-teleparty-work-with-youtube",
            label: "Does Teleparty work with YouTube?",
          },
          { href: "/netflix-party", label: "Netflix Party, now Teleparty" },
          { href: "/pricing", label: "AniDachi pricing" },
        ]}
      />
    </SeoPageLayout>
  );
}
