import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { animeList, isMovieEntry, type AnimeEntry } from "@/lib/anime-data";
import { getMalIdForSlug } from "@/lib/anime-mal-ids";
import {
  fetchJikanForWatchPage,
  formatEpisodesForUi,
  formatMembersLine,
  formatScoreLine,
  jikanGenresText,
  jikanStatusLine,
  resolvePosterUrl,
  resolveRelatedFromJikan,
} from "@/lib/jikan-for-watch-page";
import { HowToJsonLd, TvSeriesJsonLd, MovieJsonLd } from "@/components/json-ld";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import {
  buildWatchHowToSteps,
  buildWatchPageFaq,
  buildWatchPageMetaDescription,
  extraWhyWatchParagraphs,
  genreDiscussionTips,
  pacingLeadParagraph,
  watchPageResourceItemList,
} from "@/lib/watch-page-rich-content";

interface Props {
  params: Promise<{ slug: string }>;
}

function getAnimeBySlug(rawSlug: string): AnimeEntry | undefined {
  const slug = rawSlug.replace(/-with-friends$/, "");
  return animeList.find((a) => a.slug === slug);
}

function getPageLastModified(): string {
  try {
    const mtime = fs.statSync(
      path.join(process.cwd(), "app/watch/[slug]/page.tsx")
    ).mtime;
    return mtime.toISOString().split("T")[0];
  } catch {
    return "2026-05-18";
  }
}

function buildTitleTag(anime: AnimeEntry, episodesDisplay: string): string {
  if (isMovieEntry(anime)) {
    return `Watch ${anime.title} with Friends — Group Movie Night`;
  }
  const isLong =
    /\+|1100|1000|\b720\b|\b700\b|seasons|multiple seasons|counting/i.test(
      `${episodesDisplay} ${anime.episodes}`
    ) ||
    /one-piece|naruto|hunter-x-hunter|fairy-tail|gintama|inuyasha|bleach/i.test(
      anime.slug
    );
  if (isLong) {
    return `Watch ${anime.title} with Friends — Group Marathon, No Spoilers`;
  }
  return `Watch ${anime.title} with Friends — AniDachi Watchroom`;
}

export async function generateStaticParams() {
  return animeList.map((anime) => ({
    slug: `${anime.slug}-with-friends`,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const anime = getAnimeBySlug(rawSlug);
  if (!anime) return {};

  const malId = getMalIdForSlug(anime.slug);
  const jikanBundle =
    malId != null ? await fetchJikanForWatchPage(malId, anime.slug) : null;
  const posterUrl = resolvePosterUrl(
    anime.slug,
    jikanBundle?.jikanAnime ?? null
  );
  const episodesDisplay = formatEpisodesForUi(
    jikanBundle?.jikanAnime ?? null,
    anime.episodes
  );

  const metaDescription = buildWatchPageMetaDescription(anime);
  const titleTag = buildTitleTag(anime, episodesDisplay);

  return {
    title: titleTag,
    description: metaDescription,
    alternates: { canonical: `/watch/${rawSlug}` },
    openGraph: {
      title: `Watch ${anime.title} with Friends | AniDachi`,
      description: metaDescription,
      url: `/watch/${rawSlug}`,
      ...(posterUrl
        ? {
            images: [
              {
                url: posterUrl,
                alt: `${anime.title} anime poster — watch together with friends`,
              },
            ],
          }
        : {}),
    },
    ...(posterUrl
      ? {
          twitter: {
            card: "summary_large_image",
            title: `Watch ${anime.title} with Friends | AniDachi`,
            description: metaDescription,
            images: [posterUrl],
          },
        }
      : {
          twitter: {
            card: "summary_large_image",
            title: `Watch ${anime.title} with Friends | AniDachi`,
            description: metaDescription,
          },
        }),
  };
}

function buildToc(
  hasRelated: boolean,
  anime: AnimeEntry
): TocHeading[] {
  const base: TocHeading[] = [
    { id: "series-overview", label: `What is ${anime.title}?`, level: 2 },
    { id: "setup", label: "Step-by-step setup", level: 2 },
    {
      id: "watch-formats",
      label: "Live, async, and hybrid watch nights",
      level: 2,
    },
    {
      id: "why-async",
      label: `Is ${anime.title} good to watch with a group?`,
      level: 2,
    },
    { id: "pacing", label: "Pacing for your crew", level: 2 },
    { id: "discussion-tips", label: "Discussion tips", level: 2 },
    { id: "spoilers", label: "How to avoid spoilers", level: 2 },
    {
      id: "crunchyroll-note",
      label: "Accounts and regional catalog",
      level: 2,
    },
    {
      id: "more-guides",
      label: "Pillars, glossary, and guides",
      level: 2,
    },
  ];
  if (hasRelated) {
    base.push({ id: "related-anime", label: "Related anime", level: 2 });
  }
  base.push({ id: "faq", label: "FAQ", level: 2 });
  return base;
}

export default async function AnimeWithFriendsPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const anime = getAnimeBySlug(rawSlug);
  if (!anime) notFound();

  const malId = getMalIdForSlug(anime.slug);
  const jikanBundle =
    malId != null ? await fetchJikanForWatchPage(malId, anime.slug) : null;
  const jikan = jikanBundle?.jikanAnime ?? null;
  const fromJikan = resolveRelatedFromJikan(jikanBundle?.recs, anime.slug);
  const relatedAnime =
    fromJikan.length > 0
      ? fromJikan
      : (anime.related
          .map((s) => animeList.find((a) => a.slug === s))
          .filter(Boolean) as AnimeEntry[]);

  const relatedSourceLabel =
    fromJikan.length > 0
      ? "Picked from MyAnimeList recommendations (matched to our guides)."
      : "Curated for fans of the same kind of show.";

  const episodesDisplay = formatEpisodesForUi(jikan, anime.episodes);
  const scoreLine = formatScoreLine(jikan);
  const membersLine = formatMembersLine(jikan);
  const statusLine = jikanStatusLine(jikan);
  const genresDisplay = jikanGenresText(jikan, anime.genres);
  const posterUrl = resolvePosterUrl(anime.slug, jikan);

  const metaDescription = buildWatchPageMetaDescription(anime);
  const howToSteps = buildWatchHowToSteps(anime);
  const resourceItemList = watchPageResourceItemList(anime.genres);
  const faq = buildWatchPageFaq(anime, episodesDisplay);
  const dateModified = getPageLastModified();
  const isMovie = isMovieEntry(anime);

  const genreBits = (jikan?.genres?.length
    ? jikanGenresText(jikan, anime.genres)
    : anime.genres.join(", ")
  )
    .split(", ")
    .slice(0, 2)
    .join(" and ")
    .toLowerCase();

  // Derive genres list for TVSeries/Movie schema — prefer Jikan genres
  const schemaGenres =
    jikan?.genres?.length
      ? jikan.genres.map((g) => g.name).filter(Boolean)
      : anime.genres;

  return (
    <>
      <HowToJsonLd
        name={`How to watch ${anime.title} with friends on Crunchyroll`}
        description={`Use AniDachi watchrooms to sync ${anime.title}, chat with your group, and catch up asynchronously without losing episode context.`}
        steps={howToSteps}
      />
      {isMovie ? (
        <MovieJsonLd
          name={anime.title}
          alternateName={anime.japaneseTitle}
          description={anime.synopsis}
          genres={schemaGenres}
          image={posterUrl}
          ratingValue={jikan?.score}
          ratingCount={jikan?.members}
          url={`/watch/${rawSlug}`}
          sameAs={malId != null ? `https://myanimelist.net/anime/${malId}` : null}
          inLanguage="ja"
        />
      ) : (
        <TvSeriesJsonLd
          name={anime.title}
          alternateName={anime.japaneseTitle}
          description={anime.synopsis}
          genres={schemaGenres}
          numberOfEpisodes={jikan?.episodes}
          image={posterUrl}
          ratingValue={jikan?.score}
          ratingCount={jikan?.members}
          url={`/watch/${rawSlug}`}
          sameAs={malId != null ? `https://myanimelist.net/anime/${malId}` : null}
          inLanguage="ja"
        />
      )}
      <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Anime Together", url: "/watch-anime-together" },
        { name: anime.title, url: `/watch/${rawSlug}` },
      ]}
      title={`Watch ${anime.title} with Friends — AniDachi Watchrooms`}
      description={metaDescription}
      url={`/watch/${rawSlug}`}
      articleImage={posterUrl ?? undefined}
      datePublished="2026-04-23"
      dateModified={dateModified}
      faq={faq}
      headings={buildToc(relatedAnime.length > 0, anime)}
      itemList={resourceItemList}
      aboveFoldCta
    >
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
        Watch {anime.title} with Friends
      </h1>

      <p className="text-xs text-foreground/40 mb-6">
        Last updated: {new Date(dateModified).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>

      <p className="text-xl text-foreground/80 leading-relaxed mb-8">
        <strong>
          {isMovie
            ? `Yes — you can watch ${anime.title} with friends as a group movie night using AniDachi's watchroom on Crunchyroll. Set up a shared watch party in under 2 minutes: no screen-share, no spoiler risk, everyone streams in sync. Works for 2–10 people across different time zones, all on their own Crunchyroll account.`
            : (() => {
                const isLong =
                  /\+|1100|1000|\b720\b|\b700\b|seasons|multiple seasons|counting/i.test(
                    `${episodesDisplay} ${anime.episodes}`
                  ) ||
                  /one-piece|naruto|boruto|hunter-x-hunter|fairy-tail|gintama|inuyasha|bleach/i.test(
                    anime.slug
                  );
                return isLong
                  ? `Yes — you can watch ${anime.title} with friends using AniDachi's watchroom on Crunchyroll. AniDachi's async mode lets members catch up at their own pace without spoilers, so your watch party doesn't stall when someone falls behind across ${episodesDisplay}. Works for 2–10 people on different schedules, all on Crunchyroll.`
                  : `Yes — you can watch ${anime.title} with friends using AniDachi's watchroom on Crunchyroll. Sync playback in real time or use async catch-up so your watch party keeps moving even when schedules differ. Works for 2–10 people across different time zones, all on Crunchyroll.`;
              })()}
        </strong>
      </p>

      <div
        id="series-overview"
        className="bg-brand-surface rounded-lg p-6 mb-8 scroll-mt-24"
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {posterUrl ? (
            <figure className="mx-auto shrink-0 md:mx-0 w-[min(220px,55vw)]">
              <Image
                src={posterUrl}
                alt={`${anime.title} anime poster — watch together with friends on Crunchyroll`}
                width={220}
                height={330}
                className="w-full rounded-lg shadow-md object-cover aspect-[2/3]"
                sizes="(max-width: 768px) 55vw, 220px"
                decoding="async"
                priority
              />
              <figcaption className="text-foreground/50 text-xs mt-2 text-center md:text-left">
                Poster via MyAnimeList / Jikan
              </figcaption>
            </figure>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-4" id="series-overview-heading">
              What is {anime.title}?
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {anime.japaneseTitle && (
                <div>
                  <span className="text-foreground/50">Japanese title</span>
                  <p className="font-medium text-foreground">{anime.japaneseTitle}</p>
                </div>
              )}
              <div>
                <span className="text-foreground/50">{isMovie ? "Format" : "Episodes"}</span>
                <p className="font-medium text-foreground">{episodesDisplay}</p>
              </div>
              {statusLine && (
                <div>
                  <span className="text-foreground/50">Airing status</span>
                  <p className="font-medium text-foreground">{statusLine}</p>
                </div>
              )}
              {scoreLine && (
                <div>
                  <span className="text-foreground/50">Score</span>
                  <p className="font-medium text-foreground">{scoreLine}</p>
                </div>
              )}
              {membersLine && (
                <div>
                  <span className="text-foreground/50">Popularity</span>
                  <p className="font-medium text-foreground">{membersLine}</p>
                </div>
              )}
              <div>
                <span className="text-foreground/50">Genres</span>
                <p className="font-medium text-foreground">
                  {genresDisplay}
                </p>
              </div>
              <div>
                <span className="text-foreground/50">Platform</span>
                <p className="font-medium text-foreground">Crunchyroll</p>
              </div>
            </div>
            <p className="text-foreground/70 text-xs mt-3">
              Episode count, status, scores, and poster are from MyAnimeList (via
              the Jikan API) and refresh about once a day. If the service is slow,
              the site falls back to our written summary.
            </p>
            <p className="text-foreground/80 leading-relaxed mt-4 text-base">{anime.synopsis}</p>
          </div>
        </div>
      </div>

      <h2
        id="setup"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        How to Watch {anime.title} Together — Step by Step
      </h2>
      <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-4">
        {howToSteps.map((step, i) => (
          <li key={i}>
            <span className="font-medium text-foreground">{step.name}. </span>
            {step.text}
          </li>
        ))}
      </ol>
      <p className="text-foreground/80 leading-relaxed border-l-4 border-brand-orange/30 pl-4 py-2 mb-8">
        Hosting {anime.title} this week?{" "}
        <Link href="/#pricing" className="text-brand-orange font-medium hover:underline">
          Check AniDachi pricing
        </Link>{" "}
        on the homepage, install the extension, then create your watchroom from the
        episode your group agreed on — everyone still streams with their own Crunchyroll
        login.
      </p>

      <h2
        id="watch-formats"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Live, Async, and Hybrid Watch Nights for {anime.title}
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        <strong>Live premiere energy.</strong> Pick a recurring window (Sunday
        evenings, post-work Tuesdays) and count down in voice chat before you
        hit play. Best when everyone shares at least one overlapping hour — great
        for seasonal drops or finale episodes you want to experience unmuted.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-4">
        <strong>Async with guardrails.</strong> When someone travels or pulls a
        late shift, each viewer finishes {anime.title} on their own Crunchyroll
        tab while reactions stack under the same episode index. Late arrivals read
        backward chronologically so punchlines land in order.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        <strong>Hybrid Discord workflow.</strong> Keep Discord or SMS for voice,
        but let each person render {anime.title} locally so bitrate stays crisp.
        Use AniDachi for the shared timeline — otherwise one streamer&apos;s upload
        becomes the bottleneck for everyone else.
      </p>

      <h2
        id="why-async"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Is {anime.title} Good to Watch With a Group?
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        {isMovie
          ? `${anime.title} is an excellent group watch — a self-contained story that fits a single evening and gives everyone the same shared experience to talk about right after the credits. The ${genreBits} tone makes it easy to react together to key moments without needing to coordinate across multiple sessions.`
          : `With ${episodesDisplay} to work through, ${anime.title} rewards a watchroom that respects real life. The ${genreBits} mix means cliffhangers and emotional swings show up often enough that async chat stays lively — no one has to sit through a four-hour call to stay in sync.`}
      </p>
      {extraWhyWatchParagraphs(anime).map((para, i) => (
        <p key={i} className="text-foreground/80 leading-relaxed mb-4">
          {para}
        </p>
      ))}

      <h2
        id="pacing"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Pacing {anime.title} with a Busy Friend Group
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        {pacingLeadParagraph(anime, episodesDisplay)}
      </p>
      {!isMovie && (
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            Pick a default cadence — one episode on weeknights, two on Fridays — and
            pin it above your invite links so newcomers know what &quot;on
            schedule&quot; means.
          </li>
          <li>
            For ongoing simulcasts, align on whether you watch day-of or weekend-only
            so nobody accidentally reads finale chatter early.
          </li>
          <li>
            When life happens, leave voice notes or short text reactions instead of
            skipping entire arcs; the watchroom preserves where each person stopped.
          </li>
        </ul>
      )}

      <h2
        id="discussion-tips"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        {anime.title} Discussion Tips
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-4">
        <li>Agree on sub vs. dub for the room so reactions line up with audio.</li>
        <li>
          Use &quot;no spoilers past episode N&quot; in the room title when
          someone is behind.
        </li>
        <li>
          Drop short reaction notes right after the cold open and before the
          credits — those are the beats people replay.
        </li>
        <li>
          Save big lore debates for after the eyecatch to avoid late joins getting
          spoiled.
        </li>
        {genreDiscussionTips(anime.genres).map((tip, i) => (
          <li key={i}>{tip}</li>
        ))}
      </ul>

      <h2
        id="spoilers"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        How Do You Avoid Spoilers Watching {anime.title} With Friends?
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>
          Split threads into &quot;caught up through Ep X&quot; vs. &quot;free
          chat&quot; once everyone crosses the same cliffhanger.
        </li>
        <li>
          Ask people to reference episode numbers when posting screenshots or GIFs
          so accidental feeds stay safe.
        </li>
        <li>
          If someone binges ahead, they summarize feelings — not plot beats — until the
          slowest viewer catches up.
        </li>
        {!isMovie && (
          <li>
            During filler or recap installments, agree whether the room skips
            together or splinters temporarily so momentum stays high.
          </li>
        )}
      </ul>

      <h2
        id="crunchyroll-note"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Accounts, Dub/Sub Choices, and Regional Catalog
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Each viewer streams {anime.title} through their own Crunchyroll session.
        Dub and subtitle tracks can vary by region and license window — double-check
        that everyone sees the same audio option before you hype a shared line
        reading. If an episode is unavailable in someone&apos;s territory, pause the
        shared watch plan until you either align on a legal alternative or wait for
        wider availability; AniDachi cannot bypass geo restrictions or subscription
        rules.
      </p>

      <h2
        id="more-guides"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Pillars, Glossary, and Guides
      </h2>
      <p className="text-foreground/70 text-sm mb-4">
        Same ordered list is emitted as{" "}
        <strong className="text-foreground/80">ItemList</strong> structured data for
        crawlers — start at the pillars, then skim glossary terms if your crew is new
        to watchrooms or async pacing.
      </p>
      <ul className="space-y-2 text-brand-orange mb-8">
        {resourceItemList.map((item) => (
          <li key={item.url}>
            <Link href={item.url} className="hover:underline">
              {item.name}
            </Link>
          </li>
        ))}
      </ul>

      {relatedAnime.length > 0 && (
        <>
          <h2
            id="related-anime"
            className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
          >
            Related Anime to Watch With Friends
          </h2>
          <p className="text-sm text-foreground/70 mb-3">{relatedSourceLabel}</p>
          <ul className="space-y-2 text-brand-orange mb-8">
            {relatedAnime.map((related) => (
              <li key={related.slug}>
                <Link
                  href={`/watch/${related.slug}-with-friends`}
                  className="hover:underline"
                >
                  Watch {related.title} with friends
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </SeoPageLayout>
    </>
  );
}
