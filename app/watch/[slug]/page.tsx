import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { animeList, type AnimeEntry } from "@/lib/anime-data";
import { getMalIdForSlug } from "@/lib/anime-mal-ids";
import {
  fetchJikanForWatchPage,
  formatEpisodesForUi,
  formatMembersLine,
  formatScoreLine,
  jikanGenresText,
  jikanStatusLine,
  posterUrlFromJikan,
  resolveRelatedFromJikan,
} from "@/lib/jikan-for-watch-page";
import { HowToJsonLd } from "@/components/json-ld";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import {
  buildWatchHowToSteps,
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
    malId != null ? await fetchJikanForWatchPage(malId) : null;
  const posterUrl = posterUrlFromJikan(jikanBundle?.jikanAnime ?? null);

  const metaDescription = buildWatchPageMetaDescription(anime);

  return {
    title: `Watch ${anime.title} with Friends — Create a Watchroom`,
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
      label: `Why ${anime.title} works in a group`,
      level: 2,
    },
    { id: "pacing", label: "Pacing for your crew", level: 2 },
    { id: "discussion-tips", label: "Discussion tips", level: 2 },
    { id: "spoilers", label: "Spoiler boundaries", level: 2 },
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
  const jikanBundle = malId != null ? await fetchJikanForWatchPage(malId) : null;
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
  const posterUrl = posterUrlFromJikan(jikan);

  const metaDescription = buildWatchPageMetaDescription(anime);
  const howToSteps = buildWatchHowToSteps(anime);
  const resourceItemList = watchPageResourceItemList();

  const faq = [
    {
      question: `Does ${anime.title} have a watch party feature on Crunchyroll?`,
      answer: `Crunchyroll does not offer a first-party, built-in "watch with friends" room like some other services. You can still watch with friends by using a third-party tool: install AniDachi, play ${anime.title} in your own Crunchyroll tab, and join the same AniDachi watchroom for synced playback and group chat (live or async).`,
    },
    {
      question: `Can I watch ${anime.title} with friends asynchronously?`,
      answer: `Yes. AniDachi watchrooms for ${anime.title} work when everyone is online at the same time and when you are on different schedules. Mark episodes, leave reactions, and catch up on others' messages without a shared calendar block.`,
    },
    {
      question: `Do all my friends need Crunchyroll to watch ${anime.title} together?`,
      answer: `Yes—each person who watches needs their own active Crunchyroll subscription to stream the video. AniDachi adds the room, chat, and progress sync; it is not a replacement for Crunchyroll's catalog.`,
    },
    {
      question: `Is AniDachi free for ${anime.title} watch parties?`,
      answer: `AniDachi is a paid Chrome extension during early access—pricing and checkout live on the AniDachi homepage. You still need individual Crunchyroll access for ${anime.title}; AniDachi provides the watchroom, sync, and chat layer on top of each person's stream.`,
    },
    {
      question: `Can we host a ${anime.title} night if we live in different countries?`,
      answer: `You can use the same watchroom flow as long as each person can stream ${anime.title} legally in their region. Rights and episode availability may differ by territory. If one friend is geo-blocked for a specific arc, pause the group or pick a different title until everyone can access the same episode legally—then resume with clear episode labels in chat.`,
    },
    {
      question: `What if our schedules never align for ${anime.title}?`,
      answer: `Lean on asynchronous watching: post reactions behind episode markers, mute notifications until you finish the installment, and skim friends' notes before starting the next episode. Reserve rare live sessions for finales or fights everyone wants to hype together.`,
    },
    {
      question: `How do we avoid spoilers when someone falls behind on ${anime.title}?`,
      answer: `Rename threads or room notes with the latest safe episode number, pin "no spoilers past Ep X" at the top, and encourage screenshot reactions instead of plot summaries until stragglers catch up.`,
    },
  ];

  const genreBits = (jikan?.genres?.length
    ? jikanGenresText(jikan, anime.genres)
    : anime.genres.join(", ")
  )
    .split(", ")
    .slice(0, 2)
    .join(" and ")
    .toLowerCase();

  return (
    <>
      <HowToJsonLd
        name={`How to watch ${anime.title} with friends on Crunchyroll`}
        description={`Use AniDachi watchrooms to sync ${anime.title}, chat with your group, and catch up asynchronously without losing episode context.`}
        steps={howToSteps}
      />
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
      dateModified="2026-05-08"
      faq={faq}
      headings={buildToc(relatedAnime.length > 0, anime)}
      itemList={resourceItemList}
      aboveFoldCta
    >
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        Watch {anime.title} with Friends — AniDachi Watchrooms
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          {(() => {
            const s = anime.synopsis.trim();
            const first = s.split(/(?<=[.!?])\s+/)[0] ?? s;
            return (
              <>
                {first}
                {/[!?.]$/.test(first) ? "" : "."} Watching {anime.title} in an
                AniDachi watchroom lets your group react on the big twists and
                cliffhangers together—live or on your own schedule.
              </>
            );
          })()}
        </strong>
      </p>

      <div
        id="series-overview"
        className="bg-gray-50 rounded-lg p-6 mb-8 scroll-mt-24"
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
              />
              <figcaption className="text-gray-500 text-xs mt-2 text-center md:text-left">
                Poster via MyAnimeList / Jikan
              </figcaption>
            </figure>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              What is {anime.title}?
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {anime.japaneseTitle && (
                <div>
                  <span className="text-gray-500">Japanese title</span>
                  <p className="font-medium text-gray-900">{anime.japaneseTitle}</p>
                </div>
              )}
              <div>
                <span className="text-gray-500">Episodes</span>
                <p className="font-medium text-gray-900">{episodesDisplay}</p>
              </div>
              {statusLine && (
                <div>
                  <span className="text-gray-500">Airing status</span>
                  <p className="font-medium text-gray-900">{statusLine}</p>
                </div>
              )}
              {scoreLine && (
                <div>
                  <span className="text-gray-500">Score</span>
                  <p className="font-medium text-gray-900">{scoreLine}</p>
                </div>
              )}
              {membersLine && (
                <div>
                  <span className="text-gray-500">Popularity</span>
                  <p className="font-medium text-gray-900">{membersLine}</p>
                </div>
              )}
              <div>
                <span className="text-gray-500">Genres</span>
                <p className="font-medium text-gray-900">
                  {genresDisplay}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Platform</span>
                <p className="font-medium text-gray-900">Crunchyroll</p>
              </div>
            </div>
            <p className="text-gray-600 text-xs mt-3">
              Episode count, status, scores, and poster are from MyAnimeList (via
              the Jikan API) and refresh about once a day. If the service is slow,
              the site falls back to our written summary.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4 text-base">{anime.synopsis}</p>
          </div>
        </div>
      </div>

      <h2
        id="setup"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        How to Watch {anime.title} Together
      </h2>
      <ol className="list-decimal pl-6 space-y-2 text-gray-700 mb-4">
        {howToSteps.map((step, i) => (
          <li key={i}>
            <span className="font-medium text-gray-900">{step.name}. </span>
            {step.text}
          </li>
        ))}
      </ol>
      <p className="text-gray-700 leading-relaxed border-l-4 border-purple-200 pl-4 py-2 mb-8">
        Hosting {anime.title} this week?{" "}
        <Link href="/#pricing" className="text-purple-600 font-medium hover:underline">
          Check AniDachi pricing
        </Link>{" "}
        on the homepage, install the extension, then create your watchroom from the
        episode your group agreed on—everyone still streams with their own Crunchyroll
        login.
      </p>

      <h2
        id="watch-formats"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Live, async, and hybrid watch nights for {anime.title}
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        <strong>Live premiere energy.</strong> Pick a recurring window (Sunday
        evenings, post-work Tuesdays) and count down in voice chat before you
        hit play. Best when everyone shares at least one overlapping hour—great
        for seasonal drops or finale episodes you want to experience unmuted.
      </p>
      <p className="text-gray-700 leading-relaxed mb-4">
        <strong>Async with guardrails.</strong> When someone travels or pulls a
        late shift, each viewer finishes {anime.title} on their own Crunchyroll
        tab while reactions stack under the same episode index. Late arrivals read
        backward chronologically so punchlines land in order.
      </p>
      <p className="text-gray-700 leading-relaxed mb-8">
        <strong>Hybrid Discord workflow.</strong> Keep Discord or SMS for voice,
        but let each person render {anime.title} locally so bitrate stays crisp.
        Use AniDachi for the shared timeline—otherwise one streamer&apos;s upload
        becomes the bottleneck for everyone else.
      </p>

      <h2
        id="why-async"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Why {anime.title} works in a group watchroom
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        With {episodesDisplay} to work through, {anime.title} rewards a
        watchroom that respects real life. The {genreBits} mix means
        cliffhangers and emotional swings show up often enough that async chat
        stays lively—no one has to sit through a four-hour call to stay in sync.
      </p>
      {extraWhyWatchParagraphs(anime).map((para, i) => (
        <p key={i} className="text-gray-700 leading-relaxed mb-4">
          {para}
        </p>
      ))}

      <h2
        id="pacing"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Pacing {anime.title} with a busy friend group
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        {pacingLeadParagraph(anime, episodesDisplay)}
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-8">
        <li>
          Pick a default cadence—one episode on weeknights, two on Fridays—and
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

      <h2
        id="discussion-tips"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        {anime.title} discussion tips
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
        <li>Agree on sub vs. dub for the room so reactions line up with audio.</li>
        <li>
          Use &quot;no spoilers past episode N&quot; in the room title when
          someone is behind.
        </li>
        <li>
          Drop short reaction notes right after the cold open and before the
          credits—those are the beats people replay.
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
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Spoiler boundaries that keep {anime.title} nights fun
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-8">
        <li>
          Split threads into &quot;caught up through Ep X&quot; vs. &quot;free
          chat&quot; once everyone crosses the same cliffhanger.
        </li>
        <li>
          Ask people to reference episode numbers when posting screenshots or GIFs
          so accidental feeds stay safe.
        </li>
        <li>
          If someone binges ahead, they summarize feelings—not plot beats—until the
          slowest viewer catches up.
        </li>
        <li>
          During filler or recap installments, agree whether the room skips
          together or splinters temporarily so momentum stays high.
        </li>
      </ul>

      <h2
        id="crunchyroll-note"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Accounts, dub/sub choices, and regional catalog
      </h2>
      <p className="text-gray-700 leading-relaxed mb-8">
        Each viewer streams {anime.title} through their own Crunchyroll session.
        Dub and subtitle tracks can vary by region and license window—double-check
        that everyone sees the same audio option before you hype a shared line
        reading. If an episode is unavailable in someone&apos;s territory, pause the
        shared watch plan until you either align on a legal alternative or wait for
        wider availability; AniDachi cannot bypass geo restrictions or subscription
        rules.
      </p>

      <h2
        id="more-guides"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Pillars, glossary, and guides
      </h2>
      <p className="text-gray-600 text-sm mb-4">
        Same ordered list is emitted as{" "}
        <strong className="text-gray-700">ItemList</strong> structured data for
        crawlers—start at the pillars, then skim glossary terms if your crew is new
        to watchrooms or async pacing.
      </p>
      <ul className="space-y-2 text-purple-600 mb-8">
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
            className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
          >
            Related anime
          </h2>
          <p className="text-sm text-gray-600 mb-3">{relatedSourceLabel}</p>
          <ul className="space-y-2 text-purple-600 mb-8">
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
