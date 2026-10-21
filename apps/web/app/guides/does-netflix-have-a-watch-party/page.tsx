import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getSeoSiteOrigin } from "@/lib/site-url";

const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const PAGE_TITLE = "Does Netflix Have a Watch Party? (2026)";
const PAGE_DESCRIPTION =
  "No. As of October 20, 2026, Netflix has no built-in watch party or group watch. What people use instead to watch Netflix together, and what each one needs.";

export const metadata: Metadata = {
  title: "Does Netflix Have a Watch Party? (2026)",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/guides/does-netflix-have-a-watch-party" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/guides/does-netflix-have-a-watch-party",
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
    question: "Does Netflix have a watch party feature in 2026?",
    answer:
      "No. When we checked on October 20, 2026, Netflix's Help Center described no watch party, group watch or synced viewing feature. Watching together takes a third-party extension, an app, or a screen share.",
  },
  {
    question: "Does Netflix have group watch?",
    answer:
      "Not as a built-in feature. A Netflix group watch is something you set up with a tool such as AniDachi or Teleparty, where each person plays the title on their own account and the tool keeps everyone in sync.",
  },
  {
    question: "Are Netflix party games a watch party?",
    answer:
      "No. Netflix's Help Center lists party games such as Codenames: Party and LEGO Party!. They are games, and they do not sync a movie or episode across several accounts.",
  },
  {
    question: "Is Teleparty made by Netflix?",
    answer:
      "No. Teleparty, formerly Netflix Party, is a third-party extension from its own company. Netflix does not make or run it.",
  },
  {
    question: "Can I watch Netflix with someone in another house?",
    answer:
      "Yes, if they have their own Netflix access. Netflix's Help Center says an account may not be shared outside the household; people elsewhere need their own account or an extra member slot on certain plans. Then a sync tool lines up both players.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "checked", label: "What we checked", level: 2 },
  { id: "instead", label: "What to use instead", level: 2 },
  { id: "accounts", label: "The account rule", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DoesNetflixHaveAWatchPartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        {
          name: "Does Netflix have a watch party?",
          url: "/guides/does-netflix-have-a-watch-party",
        },
      ]}
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      url="/guides/does-netflix-have-a-watch-party"
      datePublished="2026-10-08"
      dateModified="2026-10-20"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Does Netflix Have a Watch Party?</SeoGuideTitle>
      <SeoGuideAnswer id="answer">
        <p>
          <strong>
            No. As of October 20, 2026, Netflix has no built-in watch party, group
            watch or &quot;watch together&quot; button. You can each play the same
            title on your own account, but Netflix will not keep the players in
            sync.
          </strong>{" "}
          To watch together, people add a sync extension such as AniDachi or
          Teleparty, or share a screen on a call.
        </p>
      </SeoGuideAnswer>

      <h2 id="checked" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What we checked
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        On October 20, 2026 we searched Netflix&apos;s Help Center for &quot;watch
        party&quot;, &quot;watch together&quot; and &quot;group watch&quot;. None of
        the results described a feature that syncs one title across several
        accounts. The &quot;watch party&quot; search returns support pages for
        Netflix party games, such as Codenames: Party and LEGO Party!, which are
        games rather than synced viewing. The other searches return playback
        errors, My List and the &quot;Are you still watching?&quot; prompt.
        Netflix&apos;s help pages also cover profiles, household sharing and
        watching while travelling, none of which sync playback between people. We
        will update the date at the top when we check again; if Netflix ships its
        own feature, this answer changes.
      </p>

      <h2 id="instead" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What to use instead
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "sync", label: "Keeps sync" },
          { id: "needs", label: "Each person needs Netflix" },
          { id: "voice", label: "Voice or video" },
        ]}
        rows={[
          {
            feature: "AniDachi (desktop Chrome)",
            values: { sync: "yes", needs: "yes", voice: "Included" },
          },
          {
            feature: "Teleparty (browsers, phone apps)",
            values: { sync: "yes", needs: "yes", voice: "Premium only" },
          },
          {
            feature: "Discord or Zoom screen share",
            values: { sync: "One shared stream", needs: "Only the sharer", voice: "yes" },
          },
          {
            feature: "Countdown on a call",
            values: { sync: "no", needs: "yes", voice: "Your call app" },
          },
        ]}
      />
      <SeoGuideBulletList
        items={[
          {
            title: "AniDachi",
            body: "Syncs Netflix movies and episodes in desktop Chrome, with chat, reactions, voice and video. The host needs Plus or Pro, including a 3-day trial; friends join free.",
          },
          {
            title: "Teleparty",
            body: (
              <>
                The extension that used to be called{" "}
                <Link href="/netflix-party">Netflix Party</Link>. Free sync and text
                chat on Netflix; voice and video need Premium.
              </>
            ),
          },
          {
            title: "Screen share",
            body: "Netflix video often shows black to viewers because of copy protection, and quality depends on the sharer's upload.",
          },
          {
            title: "Countdown",
            body: "Free and works on a TV, but you drift after the first pause or buffer.",
          },
        ]}
      />
      <p className="mb-6 leading-relaxed text-ani-muted">
        For pros and cons of each in more depth, read{" "}
        <Link href="/guides/watch-netflix-together" className="text-brand-orange hover:underline">
          watch Netflix together
        </Link>
        . To set one up now, the{" "}
        <Link href="/netflix-watch-party" className="text-brand-orange hover:underline">
          Netflix watch party
        </Link>{" "}
        hub has the four steps, or{" "}
        <InstallLink href="/extension" className="text-brand-orange hover:underline">
          add AniDachi to Chrome
        </InstallLink>{" "}
        and start a room from any Netflix movie or episode.
      </p>

      <h2 id="accounts" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        The account rule that applies to every option
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Because Netflix has no shared session, every sync tool asks each person to
        play the title on Netflix themselves. Netflix&apos;s Help Center says an
        account may not be shared outside your household, so friends in other homes
        need their own access. Titles can also differ by country, so check that the
        film or show appears for everyone before the night.
      </p>

      <SeoGuideRelated
        links={[
          { href: "/netflix-watch-party", label: "Netflix watch party hub" },
          { href: "/netflix-party", label: "Netflix Party is now Teleparty" },
          {
            href: "/guides/how-to-screen-share-netflix-on-discord",
            label: "How to stream Netflix on Discord",
          },
        ]}
      />
      <p className="mt-6 text-sm leading-relaxed text-ani-muted">
        Sources, checked October 20, 2026:{" "}
        <a
          href="https://help.netflix.com/en"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-orange hover:underline"
        >
          Netflix Help Center
        </a>
        ,{" "}
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
        . AniDachi is not affiliated with Netflix or Teleparty.
      </p>
    </SeoPageLayout>
  );
}
