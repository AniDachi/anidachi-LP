import { SeoGuideRelated } from "@/components/seo-guide-blocks";
import { CopyRanges } from "@/components/tools/copy-ranges";
import { StatStrip } from "@/components/tools/stat-strip";
import {
  arcLength,
  episodesOfKind,
  formatRange,
  rangeLength,
  skipRanges,
  watchRanges,
  type FillerSeries,
} from "@/lib/tools/filler-arcs";
import { watchHours } from "@/lib/tools/one-piece-count";

const headingClass = "mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";

export function FillerSeriesBody({
  series,
  skipHeading,
  watchHeading,
  watchIntro,
  related,
}: {
  series: FillerSeries;
  skipHeading: string;
  watchHeading: string;
  watchIntro: string;
  related: { href: string; label: string }[];
}) {
  const filler = episodesOfKind(series.arcs, "filler");
  const toWatch = series.totalEpisodes - filler;
  const hoursSaved = watchHours(filler, series.minutesPerEpisode);
  const watch = watchRanges(series);
  const skipText = `${series.title} filler to skip: ${skipRanges(series).map(formatRange).join(", ")}`;
  const watchText = `${series.title} without filler, watch: ${watch.map(formatRange).join(", ")}`;

  return (
    <>
      <StatStrip
        stats={[
          { label: "Episodes in total", value: series.totalEpisodes.toLocaleString() },
          { label: "Filler to skip", value: filler.toLocaleString() },
          { label: "Episodes without filler", value: toWatch.toLocaleString() },
          { label: "Hours saved", value: `~${hoursSaved}` },
        ]}
      />

      <h2 id="skip" className={headingClass}>
        {skipHeading}
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">{series.scope}</p>
      <div className="not-prose mb-4">
        <CopyRanges text={skipText} label="Copy skip list" />
      </div>
      <ol className="not-prose mb-4 divide-y divide-ani-line overflow-hidden rounded-[16px] border border-ani-line">
        {series.arcs.map((arc) => (
          <li
            key={`${arc.name}-${arc.start}`}
            className="grid grid-cols-[4.75rem_1fr] gap-x-3 px-4 py-3 sm:grid-cols-[7rem_1fr_auto] sm:px-5"
          >
            <span className="pt-px font-mono text-sm tabular-nums text-ani-text">
              {formatRange(arc)}
            </span>
            <span className="min-w-0">
              <span className="font-medium text-ani-text">{arc.name}</span>
              {arc.kind === "mixed" ? (
                <span className="ml-2 rounded-full border border-ani-control-border px-2 py-0.5 text-xs text-ani-muted">
                  Mixed, keep
                </span>
              ) : null}
              {arc.note ? (
                <span className="mt-0.5 block text-sm leading-relaxed text-ani-muted">
                  {arc.note}
                </span>
              ) : null}
            </span>
            <span className="col-start-2 text-xs tabular-nums text-ani-muted sm:col-start-3 sm:pt-0.5 sm:text-sm">
              {arcLength(arc)} {arcLength(arc) === 1 ? "ep" : "eps"}
            </span>
          </li>
        ))}
      </ol>

      <h2 id="watch" className={headingClass}>
        {watchHeading}
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">{watchIntro}</p>
      <div className="not-prose mb-4">
        <CopyRanges text={watchText} label="Copy watch list" />
      </div>
      <ol className="not-prose mb-10 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {watch.map((range) => (
          <li
            key={range.start}
            className="flex items-baseline justify-between gap-2 rounded-[12px] border border-ani-line bg-ani-panel px-3 py-2.5"
          >
            <span className="font-mono text-sm tabular-nums text-ani-text">
              {formatRange(range)}
            </span>
            <span className="text-xs tabular-nums text-ani-muted">
              {rangeLength(range)} {rangeLength(range) === 1 ? "ep" : "eps"}
            </span>
          </li>
        ))}
      </ol>

      <h2 id="related" className={headingClass}>
        Related
      </h2>
      <SeoGuideRelated links={related} className="mb-8" />
    </>
  );
}
