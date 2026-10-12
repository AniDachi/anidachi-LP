import type { Metadata } from "next";
import Link from "next/link";
import { SeoGuideAnswer, SeoGuideRelated, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ReleaseSchedule } from "@/components/tools/release-schedule";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { CRUNCHYROLL_WEEK, ONE_PIECE_STATUS } from "@/lib/tools/crunchyroll-schedule";
import { slotAnchor, slotInstant } from "@/lib/tools/schedule-time";
import { getSeoSiteOrigin } from "@/lib/site-url";

const url = "/tools/crunchyroll-schedule";
const headingClass = "mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";
const week = CRUNCHYROLL_WEEK;
const showCount = week.slots.length;
const weekLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
}).formatRange(
  new Date(`${week.weekStart}T00:00:00Z`),
  new Date(new Date(`${week.weekStart}T00:00:00Z`).getTime() + 6 * 86_400_000),
);

export const metadata: Metadata = {
  title: `Crunchyroll Release Schedule — ${weekLabel}`,
  description:
    `Crunchyroll release schedule for ${weekLabel}, converted to your timezone. Manually checked ${week.checked}; release times may change.`,
  alternates: { canonical: url },
  openGraph: {
    title: "Crunchyroll Release Schedule",
    description: `${showCount} scheduled simulcasts for ${weekLabel}, in your timezone.`,
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
};

const faq = [
  {
    question: "What time do new Crunchyroll episodes unlock in my timezone?",
    answer:
      "Each show has its own slot, usually an hour or so after it airs in Japan. The schedule above converts every slot to the timezone your device reports.",
  },
  {
    question: "When does the new One Piece episode come out?",
    answer: ONE_PIECE_STATUS,
  },
  {
    question: "Does everyone need their own Crunchyroll login?",
    answer:
      "Yes. Each person watches on their own Crunchyroll account in desktop Chrome. AniDachi keeps the room in sync. It does not re-stream the video.",
  },
  {
    question: "Can a group watch the new episode together?",
    answer:
      "Yes. One person hosts with Plus or Pro, including a trial. Friends join free. Everyone opens the same episode once it unlocks.",
  },
];

const headings: TocHeading[] = [
  { id: "schedule", label: weekLabel, level: 2 },
  { id: "one-piece", label: "One Piece release schedule", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function CrunchyrollSchedulePage() {
  const itemList = [...week.slots]
    .sort((a, b) => slotInstant(week, a).getTime() - slotInstant(week, b).getTime())
    .map((slot, i) => ({
      name: slot.title,
      url: `${url}#${slotAnchor(slot)}`,
      position: i + 1,
    }));

  return (
    <>
      <ToolWebAppJsonLd
        name="Crunchyroll release schedule"
        description={`Crunchyroll simulcasts for ${weekLabel}, converted to your timezone.`}
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Crunchyroll watch party", url: "/watch-crunchyroll-together" },
          { name: "Crunchyroll release schedule", url },
        ]}
        title="Crunchyroll release schedule"
        description={`Crunchyroll simulcasts for ${weekLabel}, converted to your timezone.`}
        url={url}
        datePublished="2026-10-12"
        dateModified="2026-10-12"
        faq={faq}
        headings={headings}
        itemList={itemList}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>Crunchyroll release schedule</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>
              {showCount} subtitled simulcasts scheduled for {weekLabel}.
            </strong>{" "}
            Times are in your timezone. Checked {week.checked}.
          </p>
        </SeoGuideAnswer>

        <h2 id="schedule" className={headingClass}>
          Crunchyroll simulcast schedule: {weekLabel}
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          This is a manually maintained schedule, not a live feed. Subtitled releases only, sorted by planned unlock time. Shows can slip a week, so check the
          episode in the app before the group starts.
        </p>
        <div className="mb-10">
          <ReleaseSchedule week={week} />
        </div>

        <h2 id="one-piece" className={headingClass}>
          One Piece release schedule
        </h2>
        <p className="mb-8 leading-relaxed text-ani-muted">
          {ONE_PIECE_STATUS} Use the break to catch up: see{" "}
          <Link
            href="/tools/one-piece-how-many-episodes"
            className="font-medium text-ani-text underline decoration-ani-line underline-offset-4"
          >
            how many episodes One Piece has
          </Link>{" "}
          and the{" "}
          <Link
            href="/tools/one-piece-filler-list"
            className="font-medium text-ani-text underline decoration-ani-line underline-offset-4"
          >
            filler to skip
          </Link>
          .
        </p>

        <h2 id="related" className={headingClass}>
          Related
        </h2>
        <SeoGuideRelated
          className="mb-8"
          links={[
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
            {
              href: "/guides/how-to-watch-seasonal-anime-together",
              label: "How to watch seasonal anime together",
            },
            {
              href: "/watch/the-apothecary-diaries-with-friends",
              label: "How to watch The Apothecary Diaries with friends",
            },
            {
              href: "/watch/black-clover-with-friends",
              label: "How to watch Black Clover with friends",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
