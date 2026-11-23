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
import { HowToJsonLd } from "@/components/json-ld";
import { InstallLink } from "@/components/install-link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/guides/is-teleparty-safe";
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const PAGE_TITLE = "Is Teleparty Safe? Permissions, Privacy and Data";
const PAGE_DESCRIPTION =
  "Teleparty is a legitimate extension with about 10 million users. What it can access in your browser and what data it collects, checked Nov 2026.";

/**
 * Teleparty facts on this page were read on 19 Nov 2026 (privacy policy, support FAQ,
 * permissions via chrome-stats.com for version 5.8.9). The Chrome Web Store data
 * disclosure was read on 16 Nov 2026. Re-check on each review date.
 */
const SOURCES = [
  { href: "https://www.teleparty.com/privacy", label: "Teleparty privacy policy (effective June 30, 2026)" },
  { href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
  {
    href: "https://chromewebstore.google.com/detail/netflix-party-is-now-tele/oocalimimngaihdkbihfgmpkcpnmlaoa",
    label: "Teleparty Chrome Web Store listing",
  },
  {
    href: "https://chrome-stats.com/d/oocalimimngaihdkbihfgmpkcpnmlaoa",
    label: "Chrome-Stats record for Teleparty (permissions for version 5.8.9)",
  },
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

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "What the Teleparty extension can access, what data it collects, whether it stores passwords or chat, and how to install it safely.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "Teleparty's permissions, data collection and privacy policy, read from its own pages.",
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
    question: "Is Teleparty legit?",
    answer:
      "Yes. Teleparty is the extension that used to be called Netflix Party, and its Chrome Web Store listing dates from April 2020. Its privacy policy names WP Interactive Media, Inc. as the company behind it and gives team@teleparty.com for data requests.",
  },
  {
    question: "Can Teleparty see my Netflix password?",
    answer:
      "No. You sign in to Netflix on Netflix's own site, and Teleparty's support FAQ says it does not store your streaming service account details or password. Teleparty's own sign-in, which you need for Premium, uses a Google account.",
  },
  {
    question: "What data does Teleparty collect?",
    answer:
      "Its privacy policy (effective June 30, 2026) says installing the extension assigns you a unique ID. It also collects usage statistics, your IP address and cookie data, uses Google Analytics, and uses your location for internal analytics. The Chrome Web Store disclosure lists personal communications, location and user activity.",
  },
  {
    question: "Does Teleparty sell your data?",
    answer:
      "Its privacy policy says it does not sell your personal information, and its Chrome Web Store disclosure says data isn't sold outside approved uses. The policy does allow it to share data with service providers such as Google Analytics and Stripe, and to transfer data if the company is sold.",
  },
  {
    question: "Does Teleparty save chat messages?",
    answer:
      "Not at the moment. The privacy policy says Teleparty does not currently store your messages or chat history during watch parties. 'Currently' means that could change, so check the policy again if it matters to you.",
  },
  {
    question: "Is Teleparty a virus?",
    answer:
      "No. The official Teleparty listing on the Chrome Web Store is a normal browser extension. The risk is fake copies, so install it only from the official Chrome Web Store listing with about 10 million users, never from a download site.",
  },
  {
    question: "Is it safe to pay for Teleparty Premium?",
    answer:
      "Payments on Teleparty's website go through Stripe, a large payment company. Teleparty's privacy policy says Stripe receives your payment details, IP address and device information to process the charge and check for fraud. Premium costs $6.59 a month or $47.88 a year on Teleparty's website.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "who-makes-it", label: "Who makes Teleparty", level: 2 },
  { id: "permissions", label: "What it can access", level: 2 },
  { id: "data", label: "What data it collects", level: 2 },
  { id: "passwords", label: "Passwords and accounts", level: 2 },
  { id: "install-safely", label: "Install it safely", level: 2 },
  { id: "your-data", label: "Asking for your data", level: 2 },
  { id: "anidachi", label: "How AniDachi compares", level: 2 },
  { id: "sources", label: "Sources and review dates", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function IsTelepartySafePage() {
  return (
    <>
      <HowToJsonLd
        name="How to install Teleparty safely"
        description="Install Teleparty from the official Chrome Web Store listing, check its access request, and keep your streaming password and payment details on the right sites."
        steps={installSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/guides" },
          { name: "Is Teleparty safe?", url: PAGE_PATH },
        ]}
        title="Is Teleparty safe?"
        description={PAGE_DESCRIPTION}
        url={PAGE_PATH}
        datePublished="2026-11-19"
        dateModified="2026-11-19"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
        aboveFoldStyle="hero"
      >
        <SeoGuideTitle>Is Teleparty Safe? Permissions, Privacy and Your Data</SeoGuideTitle>
        <h2 id="answer" className="scroll-mt-24">
          Short answer
        </h2>
        <SeoGuideAnswer>
          <p>
            <strong>
              Yes. Teleparty is a legitimate extension with about 10 million
              Chrome users, and its current version asks for only four basic
              permissions, with no request to read every website you visit. It
              says it doesn&apos;t store your streaming password or sell your
              personal information.
            </strong>{" "}
            It does give you a unique ID and collect usage data, your IP
            address and your location for analytics. We read its privacy
            policy, support page and permissions on 19 Nov 2026.
          </p>
        </SeoGuideAnswer>

        <h2 id="who-makes-it" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Who makes Teleparty
        </h2>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Teleparty used to be called Netflix Party, and its Chrome Web Store
          listing dates from April 2020. Its privacy policy names{" "}
          <strong>WP Interactive Media, Inc.</strong> as the company behind
          teleparty.com and netflixparty.com. Chrome-Stats shows about 10
          million users and a 3.97 rating from about 17,500 ratings. Version
          5.8.9 came out on 13 Nov 2026, so it is still maintained. Its support
          page says Teleparty is safe and used by over 10 million people.
        </p>

        <h2 id="permissions" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          What Teleparty can access in your browser
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          A Chrome extension can only do what its permissions allow. Chrome warns
          before install only about permissions that reach your data on
          websites. Teleparty version 5.8.9 asks for four:
        </p>
        <SeoGuideBulletList
          items={[
            {
              title: "activeTab",
              body: "Temporary access to the tab you're on, but only after you click the extension's button there.",
            },
            {
              title: "scripting",
              body: "Lets it run its own code in a page it already has access to.",
            },
            {
              title: "storage",
              body: "Saves its own settings inside Chrome.",
            },
            {
              title: "alarms",
              body: "Runs tasks on a timer.",
            },
          ]}
        />
        <p className="mb-8 leading-relaxed text-ani-muted">
          Chrome-Stats lists no optional permissions and no host permissions
          for this version, and none of the four gives access to your browsing
          history, downloads or passwords saved in Chrome. That is a short list
          for a watch-party extension. The permission history on Chrome-Stats
          shows the list has not changed since version 5.0.0 in May 2024.
        </p>

        <h2 id="data" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          What data Teleparty collects
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Teleparty&apos;s privacy policy (effective June 30, 2026) and its
          Chrome Web Store disclosure describe what the company collects and
          keeps:
        </p>
        <SeoGuideBulletList
          items={[
            {
              title: "A unique ID",
              body: "Installing the extension assigns you an identifier that Teleparty stores on its servers. It uses it to let you into parties and for usage statistics.",
            },
            {
              title: "Usage data, IP address and cookies",
              body: "The policy lists preferences, usage statistics, server logs, your IP address and cookies. It uses Google Analytics and links to Google's opt-out.",
            },
            {
              title: "Location",
              body: "Teleparty uses your unique ID and location for internal purposes such as analytics, and may share them with its service providers.",
            },
            {
              title: "Chat",
              body: "The policy says Teleparty does not currently store your messages or chat history during watch parties.",
            },
            {
              title: "Selling data",
              body: "The policy says it does not sell your personal information. The store disclosure, read on 16 Nov 2026, lists personal communications, location and user activity, and says data isn't sold outside approved uses.",
            },
            {
              title: "Do Not Track",
              body: "The policy says Teleparty does not respond to a browser's Do Not Track signal.",
            },
          ]}
        />
        <p className="mb-8 leading-relaxed text-ani-muted">
          For users in the EEA, the policy says data is transferred to the
          United States and may be processed elsewhere. The service is not
          meant for children under 13, and the policy says Teleparty deletes
          data about a child under 13 if it learns of it.
        </p>

        <h2 id="passwords" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Passwords, streaming accounts and payments
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Teleparty&apos;s support FAQ says it does not store your streaming
          service account details or password. You sign in to Netflix, Disney+
          or Crunchyroll on their own sites.
        </p>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Teleparty&apos;s own sign-in, which you need to upgrade to Premium,
          uses a Google account. Payments on Teleparty&apos;s website go through Stripe. The privacy policy says
          Stripe receives your payment details, IP address and device
          information, and uses them to check for fraud. Prices are on{" "}
          <Link href="/guides/is-teleparty-free">is Teleparty free</Link>.
        </p>

        <h2 id="install-safely" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How to install Teleparty safely
        </h2>
        <SeoGuideSteps steps={installSteps} />
        <SeoGuideNote>
          Our read: nothing in Teleparty&apos;s permissions or privacy policy is
          unusual for a watch-party extension. The bigger risk is a fake copy,
          so install it from the official listing and read Chrome&apos;s access
          request before you click Add.
        </SeoGuideNote>

        <h2 id="your-data" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How to ask Teleparty about your data
        </h2>
        <p className="mb-8 leading-relaxed text-ani-muted">
          The privacy policy gives people in the EU, EEA and UK the right to
          see, correct, delete or move their data, and to object to how it is
          used. California residents get the right to know, delete and correct
          data and to opt out of its sale or sharing. Requests go to{" "}
          <strong>team@teleparty.com</strong>. To stop Teleparty collecting
          anything new, remove the extension from Chrome&apos;s extensions page.
        </p>

        <h2 id="anidachi" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How AniDachi compares
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          We make AniDachi, another watch-party extension, so here is the same
          check on ours. AniDachi asks for more permissions than Teleparty,
          because it signs you in, sends room invites and copies invite links.
          Its access to websites is limited to the sites it works on.
        </p>
        <ResponsiveCompareTable
          columns={[
            { id: "teleparty", label: "Teleparty 5.8.9" },
            { id: "anidachi", label: "AniDachi" },
          ]}
          rows={[
            {
              feature: "Can read every website you visit",
              values: { teleparty: "no", anidachi: "no" },
            },
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
            {
              feature: "Stores your streaming password",
              values: { teleparty: "no", anidachi: "no" },
            },
          ]}
        />
        <p className="mb-8 leading-relaxed text-ani-muted">
          What AniDachi&apos;s extra permissions are for: identity opens the
          sign-in window, cookies checks whether you&apos;re signed in on anidachi.app,
          notifications shows room invites from friends, and clipboardWrite
          copies an invite link. The full list and how we handle data are on
          our <Link href="/security">security page</Link> and in our{" "}
          <Link href="/privacy">privacy policy</Link>. If you watch Crunchyroll,
          YouTube or Netflix in desktop Chrome and want voice chat in the room,{" "}
          <InstallLink href="/extension">try AniDachi; friends join free</InstallLink>
          . The full feature comparison is in{" "}
          <Link href="/guides/best-teleparty-alternatives-for-anime">Best Teleparty alternatives</Link>.
        </p>

        <h2 id="sources" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Sources and review dates
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Every Teleparty detail on this page comes from Teleparty&apos;s own
          pages, its Chrome Web Store listing, or Chrome-Stats for the
          permission list. We read the privacy policy, support FAQ and
          permissions on 19 Nov 2026, and the store&apos;s data disclosure on 16
          Nov 2026:{" "}
          {SOURCES.map((source, index) => (
            <span key={source.href}>
              {index > 0 ? ", " : null}
              <a href={source.href} target="_blank" rel="noopener noreferrer">
                {source.label}
              </a>
            </span>
          ))}
          . We haven&apos;t audited Teleparty&apos;s code; this page reports
          what its policy, support page and Chrome-Stats say.
        </p>
        <p className="mb-8 leading-relaxed text-ani-muted">
          We re-check these sources on 19 Dec 2026, 18 Jan 2027 and 17 Feb 2027,
          and update the date on this page when something changes. AniDachi is
          not affiliated with Teleparty.
        </p>

        <SeoGuideRelated
          links={[
            { href: "/guides/is-teleparty-free", label: "Is Teleparty free?" },
            { href: "/guides/best-teleparty-alternatives-for-anime", label: "Best Teleparty alternatives" },
            { href: "/netflix-watch-party", label: "Netflix watch party" },
            { href: "/security", label: "AniDachi security and permissions" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
