import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { COMPARE_ENTRIES } from "@/lib/section-index";
import {
  WATCH_PARTY_APPS_CHECKED_ON,
  watchPartyApps,
  watchPartySources,
  type WatchPartyAppId,
} from "@/lib/watch-party-apps";
import { getSeoSiteOrigin } from "@/lib/site-url";

/**
 * "Best watch party apps" pillar (ANI-44 step 3 / ANI-78, owner-approved 23 Nov 2026).
 * Keyword Planner, 23 Nov 2026 (worldwide / US per month): "watch party apps" 3,600 / 1,300,
 * "watch party websites" 1,600 / 590, "apps to watch movies together" 880 / 170,
 * "best watch party apps" 260 / 110. /guides/best-watch-party-apps-for-anime 308s here.
 * Competitor facts come from each company's own site, checked 23 Nov 2026 (Teleparty 19-23 Nov,
 * Discord 22 Nov). Re-check on each review date.
 */
const PAGE_PATH = "/compare";
const PAGE_TITLE = "Best Watch Party Apps & Websites (2026): 10 Compared";
const PAGE_DESCRIPTION =
  "10 watch party apps and websites compared: which work on phones, Netflix and Crunchyroll, which are free, and which have video chat. Checked Nov 2026.";
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const RANKED: WatchPartyAppId[] = [
  "anidachi",
  "teleparty",
  "kosmi",
  "syncup",
  "watch2gether",
  "rave",
  "discord",
  "hyperbeam",
  "metastream",
  "syncplay",
];
const apps = watchPartyApps(RANKED);
const SOURCES = watchPartySources(RANKED);
/** Where each app's name links: our page about it, or its section on this page. */
const appLink = (href: string, id: string) => (href.startsWith("/compare#") ? `#${id}` : href);

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Teleparty, Kosmi, SyncUp, Watch2Gether, Rave, Discord, Hyperbeam and more, compared for phones, Netflix, price and video chat.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "10 ways to watch together online, compared from each company's own pages.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is the best watch party app?",
    answer:
      "It depends on where your friends watch. On computers with Netflix, Disney+, Hulu or Prime Video and text chat, Teleparty's free tier covers most groups. For voice and video calls on the player, plus Crunchyroll, AniDachi. With friends on phones, Kosmi or SyncUp. For YouTube with no install or account, Watch2Gether.",
  },
  {
    question: "What is the best free watch party app?",
    answer:
      "Kosmi is free and includes voice and video chat. Watch2Gether is free with no account. Teleparty is free on Netflix, YouTube, Disney+, Hulu, HBO Max and Prime Video with text chat. SyncUp is free for rooms of up to 5 with an hour of voice chat a day. On AniDachi, friends join free and a Free host gets 20 minutes a day.",
  },
  {
    question: "Which watch party apps work on phones?",
    answer:
      "Kosmi and SyncUp work in phone browsers and have apps, Discord has phone apps, and Rave has an Android app. Rave's site says Apple removed it from the App Store (checked 23 Nov 2026). Teleparty's mobile apps cover fewer services than its extension. AniDachi is desktop Chrome only.",
  },
  {
    question: "Which watch party apps work with Netflix?",
    answer:
      "AniDachi, Teleparty, SyncUp (with its extension) and Rave say they support Netflix, and Kosmi says its shared browser opens any streaming service. Everyone needs their own Netflix access. Screen sharing Netflix on Discord usually shows a black screen.",
  },
  {
    question: "Is there a watch party website with no download?",
    answer:
      "Yes. Watch2Gether and Kosmi rooms open from a link in the browser, and SyncUp needs no account for YouTube and other web videos. Netflix and other paid services usually need an extension or app, because each viewer plays the video on their own account.",
  },
  {
    question: "Does Netflix or Disney+ have its own watch party?",
    answer:
      "Not anymore. Netflix has no built-in watch party, Disney+ removed GroupWatch in 2023 and Prime Video removed Watch Party in 2024, so groups use a third-party app instead.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "compared", label: "All 10 compared", level: 2 },
  { id: "apps", label: "The apps", level: 2 },
  { id: "by-service", label: "By service and device", level: 2 },
  { id: "built-in", label: "Built-in watch parties", level: 2 },
  { id: "head-to-head", label: "Head-to-head pages", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const cell = "border-b border-ani-line px-3 py-2 align-top";
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function CompareIndexPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: PAGE_PATH },
      ]}
      title="Best watch party apps and websites"
      description={PAGE_DESCRIPTION}
      url={PAGE_PATH}
      datePublished="2026-10-19"
      dateModified="2026-11-23"
      faq={faq}
      headings={tocHeadings}
      itemList={apps.map((app, index) => ({
        name: app.name,
        url: app.href.startsWith("/compare#") ? app.href : `${PAGE_PATH}#${app.id}`,
        position: index + 1,
      }))}
      articleImage={articleImage}
      aboveFoldCta
      aboveFoldStyle="hero"
    >
      <SeoGuideTitle>Best Watch Party Apps and Websites (2026)</SeoGuideTitle>

      <h2 id="answer" className="scroll-mt-24">
        Short answer
      </h2>
      <SeoGuideAnswer>
        <p>
          <strong>
            Pick by where your friends watch. On computers with Netflix,
            Disney+, Hulu or Prime Video and text chat, Teleparty&apos;s free
            tier is enough. For voice and video calls on the player, and for
            Crunchyroll, use AniDachi. With friends on phones, use Kosmi or
            SyncUp. For YouTube with no install or account, use Watch2Gether.
          </strong>{" "}
          With every app here, each viewer still needs their own access to the
          streaming service. We make AniDachi, so we list where each of the
          others is the better pick, and every competitor detail comes from
          that company&apos;s own site, checked on 23 Nov 2026.
        </p>
      </SeoGuideAnswer>

      <h2 id="compared" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        10 watch party apps compared
      </h2>
      <div className="mb-8 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm text-ani-muted">
          <thead>
            <tr className="text-ani-text">
              <th scope="col" className={cell}>App</th>
              <th scope="col" className={cell}>How it runs</th>
              <th scope="col" className={cell}>Phones</th>
              <th scope="col" className={cell}>Netflix</th>
              <th scope="col" className={cell}>Calls</th>
              <th scope="col" className={cell}>Price</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id}>
                <th scope="row" className={`${cell} font-semibold text-ani-text`}>
                  <a href={`#${app.id}`} className="hover:underline">
                    {app.name}
                  </a>
                </th>
                <td className={cell}>{app.runs}</td>
                <td className={cell}>{cap(app.phones)}</td>
                <td className={cell}>{cap(app.netflix)}</td>
                <td className={cell}>{app.calls}</td>
                <td className={cell}>{app.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="apps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        The apps, and who each one suits
      </h2>
      <SeoGuideOptions
        options={apps.map((app, index) => ({
          title: `${index + 1}. ${app.name}: ${app.tagline}`,
          highlight: app.id === "anidachi",
          body: (
            <>
              <span id={app.id} className="scroll-mt-24" />
              {app.summary}{" "}
              {app.id === "anidachi" ? (
                <Link href="/pricing">AniDachi pricing</Link>
              ) : app.href.startsWith("/compare#") ? null : (
                <>
                  More: <Link href={appLink(app.href, app.id)}>{app.hrefLabel}</Link>
                </>
              )}
              {app.id === "anidachi" || !app.href.startsWith("/compare#") ? "." : null}
            </>
          ),
        }))}
      />
      <p className="mb-8 leading-relaxed text-ani-muted">
        Not ranked: Scener&apos;s and TwoSeven&apos;s sites didn&apos;t load any
        content when we checked on 23 Nov 2026, and kast.gg now says Kast is
        joining the Amaze family, with no watch party product described.
      </p>

      <h2 id="by-service" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Best watch party app by service and device
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Netflix",
            body: (
              <>
                Teleparty is free with text chat; AniDachi adds free calls on the
                player; Kosmi and SyncUp also cover phones. Setup:{" "}
                <Link href="/netflix-watch-party">Netflix watch party</Link>.
              </>
            ),
          },
          {
            title: "Crunchyroll and anime",
            body: (
              <>
                Teleparty lists Crunchyroll as Premium. AniDachi, Rave and
                SyncUp&apos;s extension list it, and on AniDachi friends join free.
                Setup:{" "}
                <Link href="/watch-crunchyroll-together">Crunchyroll watch party</Link>{" "}
                and{" "}
                <Link href="/watch-anime-together">watch anime together</Link>.
              </>
            ),
          },
          {
            title: "YouTube",
            body: (
              <>
                Watch2Gether or SyncUp for quick rooms with no account; Discord
                Watch Together inside a call; AniDachi for full watch pages on
                everyone&apos;s own account. Setup:{" "}
                <Link href="/watch-youtube-together">YouTube watch party</Link>.
              </>
            ),
          },
          {
            title: "Disney+, Hulu, HBO Max and Prime Video",
            body: (
              <>
                Teleparty covers all four on its free tier, and SyncUp&apos;s
                extension lists them too. AniDachi doesn&apos;t support them yet.
                Prime Video options:{" "}
                <Link href="/prime-video-watch-party">Prime Video watch party</Link>.
              </>
            ),
          },
          {
            title: "Phones",
            body: "Kosmi, SyncUp and Discord work on phones; Rave on Android. Teleparty's apps cover fewer services than its extension.",
          },
          {
            title: "Movie night with a long-distance partner",
            body: (
              <>
                Any app with calls works; see{" "}
                <Link href="/virtual-movie-night">virtual movie night</Link> and{" "}
                <Link href="/guides/watch-movies-together-online">
                  how to watch movies together online
                </Link>
                .
              </>
            ),
          },
        ]}
      />

      <h2 id="built-in" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What happened to the built-in watch parties?
      </h2>
      <p className="mb-8 leading-relaxed text-ani-muted">
        Netflix has no built-in watch party (
        <Link href="/guides/does-netflix-have-a-watch-party">
          does Netflix have a watch party
        </Link>
        ), Disney+ removed GroupWatch in 2023, and Prime Video removed Watch
        Party in 2024. YouTube&apos;s options are covered in{" "}
        <Link href="/watch-youtube-together#no-native">
          does YouTube have a watch party
        </Link>
        . That&apos;s why every option above is a separate app.
      </p>

      <h2 id="head-to-head" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Head-to-head pages
      </h2>
      <SeoGuideRelated
        links={[
          { href: "/guides/best-teleparty-alternatives-for-anime", label: "Best Teleparty alternatives" },
          { href: "/guides/watch2gether-alternatives-for-anime", label: "Watch2Gether alternatives" },
          { href: "/guides/rave-alternatives-for-youtube", label: "Rave alternatives" },
          { href: "/guides/kast-alternatives-for-youtube", label: "Kast alternatives" },
          ...COMPARE_ENTRIES.map((entry) => ({ href: entry.href, label: entry.label })),
        ]}
      />

      <h2 id="sources" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Sources
      </h2>
      <p className="mb-8 leading-relaxed text-ani-muted">
        Competitor details come from each company&apos;s own pages, checked on{" "}
        {WATCH_PARTY_APPS_CHECKED_ON} unless a date is shown:{" "}
        {SOURCES.map((source, index) => (
          <span key={source.href}>
            {index > 0 ? ", " : null}
            <a href={source.href} target="_blank" rel="noopener noreferrer">
              {source.label}
            </a>
          </span>
        ))}
        . Prices change, so check the screen where you pay. We re-check these
        pages on 21 Dec 2026. AniDachi is not affiliated with any of them.
      </p>
    </SeoPageLayout>
  );
}
