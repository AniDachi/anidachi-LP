import type { Metadata } from "next";
import Link from "next/link";
import { HubCtaBand } from "@/components/hub-cta-band";
import { HubFeatureGrid, HubLandingLayout } from "@/components/hub-landing-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoGuideNote, SeoGuideRelated } from "@/components/seo-guide-blocks";
import type { TocHeading } from "@/components/table-of-contents";
import { PRICING_FREE20_SUMMARY } from "@/lib/pricing-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

/**
 * Prime Video hub, published before launch (ANI-52 step 1, owner-approved 2026-11-11). It uses the
 * platform hub template, but Prime Video is NOT a supported AniDachi platform yet:
 * - the hero button is the generic install label and "Works today on" lists only supported platforms;
 * - the steps are how to watch Prime Video together today, without AniDachi, and there is no
 *   HowTo JSON-LD;
 * - Prime Video stays out of lib/product-facts.ts SUPPORTED_PLATFORMS.
 * Launch day (ANI-43 checklist): "Start a Prime Video Watch Party" button, the AniDachi install
 * steps with HowTo JSON-LD, Prime Video first in heroWorksOn, and update the status table.
 */
const PAGE_PATH = "/prime-video-watch-party";
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const PAGE_TITLE = "Prime Video Watch Party (Amazon Watch Party)";
const PAGE_DESCRIPTION =
  "Amazon removed Watch Party from Prime Video in 2024. What still works to watch Prime Video together online, the account rules, and AniDachi's Prime Video plans.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "Prime Video's Watch Party is gone. What still works to watch together.",
    images: ["/opengraph-image.png"],
  },
};

/** Facts on this page, checked 11 Nov 2026 (removal sources from the ANI-50 fact-check, 10 Nov). */
const SOURCES = [
  {
    href: "https://www.howtogeek.com/prime-video-watch-party-shutdown/",
    label: "How-To Geek: Watch Party removed from Prime Video",
  },
  {
    href: "https://www.neowin.net/news/amazon-prime-quietly-got-rid-of-a-covid-19-era-feature-watch-party/",
    label: "Neowin: Amazon quietly got rid of Watch Party",
  },
  {
    href: "https://www.techtimes.com/articles/306472/20240708/amazon-discontinued-prime-video-watch-party-feature-users-noticed.htm",
    label: "Tech Times: Amazon discontinued its Prime Video Watch Party feature",
  },
  { href: "https://www.primevideo.com/help?nodeId=G202095500", label: "Prime Video Usage Rules" },
  { href: "https://www.primevideo.com/help?nodeId=G202095490", label: "Prime Video Terms of Use" },
  { href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
];

/** Works today without AniDachi. Replace with the AniDachi install steps (and HowTo JSON-LD) on launch day. */
const todaySteps = [
  {
    name: "Open the same title on your own account",
    text: "Each person signs in to their own Prime Video and opens the same movie or episode. Say the episode number out loud, and check that everyone can find the title in their country.",
  },
  {
    name: "Keep the players together",
    text: "Use a browser extension that lists Prime Video support, such as Teleparty, so play, pause and seek stay in sync. Without one, count down and press play at the same moment.",
  },
  {
    name: "Talk on a call",
    text: "Use a phone, Discord or Zoom call for voice. Don't share your screen: Prime Video's DRM usually turns a screen share black.",
  },
];

const faq = [
  {
    question: "What happened to Prime Video Watch Party?",
    answer:
      "Amazon removed it in spring 2024 without a public announcement; reports put the end date at 2 April 2024. It let Prime members watch the same title with a shared chat. Prime Video has had no built-in way to watch together since.",
  },
  {
    question: "How can I watch Prime Video with friends online now?",
    answer:
      "Use a browser extension that lists Prime Video support, such as Teleparty, which syncs everyone's player and adds a text chat on its free tier. Without an extension, start the title at the same moment on everyone's own account and talk on a call, but it drifts after every pause.",
  },
  {
    question: "Does AniDachi work with Prime Video?",
    answer:
      "Not yet. Prime Video support is coming in an update. Today AniDachi syncs Crunchyroll, Netflix and YouTube in desktop Chrome, and Chrome updates the extension automatically when Prime Video is added.",
  },
  {
    question: "Does everyone need Prime Video for a watch party?",
    answer:
      "Yes. Sync tools play the title on each person's own player, so every viewer needs access to Prime Video and the same title in their country. Teleparty's FAQ says the same about its parties.",
  },
  {
    question: "Can a group share one Amazon account for a watch party?",
    answer:
      "Not for one title. Prime Video's Usage Rules allow up to three streams at once on one Amazon account, but the same video on no more than two devices at a time. A third friend needs their own access.",
  },
  {
    question: "Can you stream Prime Video on Discord?",
    answer:
      "Usually not with a picture. Prime Video protects its video with DRM, so a Discord Go Live share often shows friends a black screen. Keep Discord for voice and have each person play the title on their own account.",
  },
  {
    question: "Does Amazon Prime have a watch party for anime?",
    answer:
      "Not anymore. Some anime streams on Prime Video, depending on your region, but the built-in Watch Party feature is gone. Most popular anime and current simulcasts are on Crunchyroll, where AniDachi already syncs watch parties.",
  },
  {
    question: "What anime is on Prime Video vs Crunchyroll?",
    answer:
      "Prime Video carries some anime in some regions, such as Vinland Saga Season 2, Made in Abyss and The Rising of the Shield Hero, plus a few originals. Availability changes by country. Crunchyroll has the larger anime catalog, including Demon Slayer, Jujutsu Kaisen, Attack on Titan, One Piece and most current simulcasts.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "how-to-watch", label: "How to watch Prime Video together", level: 2 },
  { id: "what-happened", label: "What happened to Amazon Watch Party", level: 2 },
  { id: "then-vs-now", label: "Amazon Watch Party then vs now", level: 2 },
  { id: "options", label: "Your options today", level: 2 },
  { id: "everyone-needs-prime", label: "Does everyone need Prime Video?", level: 2 },
  { id: "anidachi", label: "AniDachi and Prime Video", level: 2 },
  { id: "anime", label: "Anime on Prime Video vs Crunchyroll", level: 2 },
  { id: "discord", label: "Prime Video on Discord", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function PrimeVideoWatchPartyPage() {
  return (
    <HubLandingLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Prime Video Watch Party", url: PAGE_PATH },
      ]}
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      url={PAGE_PATH}
      datePublished="2026-11-11"
      dateModified="2026-11-14"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      itemList={[
        {
          name: "Stream Prime Video on Discord",
          url: "/guides/how-to-stream-prime-video-on-discord",
          position: 1,
        },
        { name: "Netflix watch party", url: "/netflix-watch-party", position: 2 },
        { name: "Virtual movie night", url: "/virtual-movie-night", position: 3 },
      ]}
      h1="Prime Video Watch Party"
      heroLead="Prime Video removed its watch party in 2024. AniDachi's Prime Video support is coming in an update."
      heroWorksOn={["Netflix", "Crunchyroll", "YouTube"]}
      heroWorksOnLabel="Works today on"
      heroFinePrint="20 free minutes a day. Friends join free."
      answer={
        <>
          <strong>
            Prime Video no longer has a watch party. Amazon removed Watch Party
            in spring 2024, and there is no built-in way to watch Prime Video
            together today. Groups use a browser extension that syncs each
            person&apos;s own player, or start the title at the same time and
            talk on a call.
          </strong>{" "}
          AniDachi&apos;s Prime Video support is coming in an update; today it
          syncs Netflix, Crunchyroll and YouTube.
        </>
      }
      steps={{
        id: "how-to-watch",
        heading: "How to Watch Prime Video Together Today",
        intro:
          "Until AniDachi adds Prime Video, this is the setup that works: everyone plays the title on their own account, and you talk on a call.",
        items: todaySteps,
      }}
    >
      <h2 id="what-happened" className="scroll-mt-24">
        What happened to Amazon Watch Party
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Prime Video&apos;s Watch Party let Prime members start a title together
        and talk in a shared chat. Amazon dropped it in spring 2024 without an
        announcement. Reports put the end date at 2 April 2024, and its help
        pages were taken down. It hasn&apos;t come back.
      </p>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Prime Video wasn&apos;t alone: Disney+ removed GroupWatch the year
        before. So &quot;Amazon watch party&quot; now means a third-party tool.
      </p>

      <h2 id="then-vs-now" className="scroll-mt-24">
        Amazon Watch Party then vs now
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "amazon", label: "Amazon Watch Party" },
          { id: "anidachi", label: "AniDachi", highlight: true },
        ]}
        rows={[
          { feature: "Available today", values: { amazon: "No (removed in 2024)", anidachi: "yes" } },
          {
            feature: "Platforms",
            values: { amazon: "Prime Video only, before removal", anidachi: "Netflix, Crunchyroll, YouTube" },
          },
          { feature: "Synced playback", values: { amazon: "Before removal", anidachi: "yes" } },
          { feature: "Chat", values: { amazon: "Before removal", anidachi: "yes" } },
          { feature: "Voice and video calls", values: { amazon: "no", anidachi: "yes" } },
          { feature: "Prime Video", values: { amazon: "Before removal", anidachi: "Coming in an update" } },
          { feature: "Cost", values: { amazon: "Was included with Prime", anidachi: "20 free minutes a day; Plus and Pro" } },
        ]}
      />

      <h2 id="options" className="scroll-mt-24">
        Your options today
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Three setups work for watching Prime Video with friends online. They
        differ in how well playback stays together after someone pauses.
      </p>
      <HubFeatureGrid
        columns={3}
        items={[
          {
            title: "A sync extension",
            body: "Each person plays the title on their own account, and the extension keeps the players together. Teleparty lists Prime Video on its free version, with video sync and text chat; its voice and video chat need Teleparty Premium.",
          },
          {
            title: "A countdown",
            body: "Everyone opens the same title and presses play on three. It costs nothing and works on TVs and phones, but playback drifts apart and every pause needs another countdown.",
          },
          {
            title: "A screen share",
            body: "One person shares their screen on a call. On Prime Video this usually shows a black screen, because the video is DRM-protected.",
          },
        ]}
      />

      <h2 id="everyone-needs-prime" className="scroll-mt-24">
        Does everyone need Prime Video?
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        Yes, for any setup that plays the video on each person&apos;s screen.
        Sync tools line up separate players, and nobody&apos;s video is sent to
        the others. Teleparty&apos;s FAQ says each participant needs access to an
        account for the service being used, and the same will apply to AniDachi.
      </p>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Can a group share one Amazon account? Only up to a point. Prime
        Video&apos;s Usage Rules allow up to three streams at the same time on one
        Amazon account, but the same video on no more than two devices at a
        time. So two people can watch one film on one account; a third needs
        their own. Titles also differ by country, so check that everyone can open
        the title before the night.
      </p>

      <h2 id="anidachi" className="scroll-mt-24">
        AniDachi and Prime Video
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        AniDachi is a Chrome extension that keeps everyone&apos;s player on the
        same moment, with chat, reactions, and voice and video calls in the
        room. Prime Video support is coming in an update. Until it ships, this
        is what works:
      </p>
      <ResponsiveCompareTable
        columns={[{ id: "status", label: "AniDachi today", highlight: true }]}
        rows={[
          { feature: "Prime Video", values: { status: "Coming in an update" } },
          { feature: "Netflix, Crunchyroll and YouTube", values: { status: "yes" } },
          { feature: "Desktop Chrome", values: { status: "yes" } },
          { feature: "Voice and video calls in the room", values: { status: "yes" } },
          { feature: "Phones, tablets and TV apps", values: { status: "no" } },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        If your group also watches Netflix, Crunchyroll or YouTube, you can
        install AniDachi now and use it for those. Chrome updates extensions
        automatically, so Prime Video support arrives in the same install.{" "}
        {PRICING_FREE20_SUMMARY} Friends join free.
      </p>
      <SeoGuideNote>
        We&apos;ll list Prime Video as supported only once it works in the
        Chrome Web Store version. For films on Netflix, start a{" "}
        <Link href="/netflix-watch-party">Netflix watch party</Link> instead.
      </SeoGuideNote>

      <h2 id="anime" className="scroll-mt-24">
        Anime on Prime Video vs Crunchyroll
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Prime Video carries some anime, depending on your country: Vinland Saga
        Season 2, Made in Abyss, The Rising of the Shield Hero and a few
        originals such as Ninja Kamui. Crunchyroll has the larger catalog,
        including{" "}
        <Link href="/watch/demon-slayer-with-friends">Demon Slayer</Link>,{" "}
        <Link href="/watch/jujutsu-kaisen-with-friends">Jujutsu Kaisen</Link>,{" "}
        <Link href="/watch/one-piece-with-friends">One Piece</Link> and most
        current simulcasts, and AniDachi syncs it today in a{" "}
        <Link href="/watch-crunchyroll-together">Crunchyroll watch party</Link>.
      </p>

      <HubCtaBand
        pagePath={PAGE_PATH}
        heading="Get AniDachi before Prime Video lands"
        body="Use it today for Netflix, Crunchyroll and YouTube. Prime Video support arrives in the same install. 20 free minutes a day, and friends join free."
      />

      <h2 id="discord" className="scroll-mt-24">
        Prime Video on Discord
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Sharing Prime Video in a Discord call often shows friends a black screen
        with the audio still playing. The DRM that protects the video causes it,
        and Prime Video&apos;s terms forbid working around it. Why it happens and
        what to do instead is in{" "}
        <Link href="/guides/how-to-stream-prime-video-on-discord">
          how to stream Prime Video on Discord
        </Link>
        .
      </p>

      <h2 id="more" className="scroll-mt-24">
        More Prime Video guides
      </h2>
      <SeoGuideRelated
        links={[
          {
            href: "/guides/how-to-stream-prime-video-on-discord",
            label: "How to stream Prime Video on Discord",
          },
          { href: "/compare/anidachi-vs-teleparty", label: "AniDachi vs Teleparty" },
          { href: "/netflix-watch-party", label: "Netflix watch party" },
          { href: "/virtual-movie-night", label: "Virtual movie night" },
          { href: "/guides/is-teleparty-free", label: "Is Teleparty free?" },
        ]}
      />
      <p className="mt-6 text-sm leading-relaxed text-ani-muted">
        Sources, checked 11 November 2026:{" "}
        {SOURCES.map((source, index) => (
          <span key={source.href}>
            {index > 0 ? ", " : null}
            <a href={source.href} target="_blank" rel="noopener noreferrer">
              {source.label}
            </a>
          </span>
        ))}
        . AniDachi is not affiliated with Amazon, Prime Video or Teleparty.
      </p>
    </HubLandingLayout>
  );
}
