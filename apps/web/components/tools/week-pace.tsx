"use client";

import { useEffect, useState } from "react";
import { watchHours, weeksAtPace } from "@/lib/tools/one-piece-count";

const PACES = [1, 2, 3, 5, 7, 14] as const;

export function WeekPace({
  episodes,
  fillerEpisodes,
  minutesPerEpisode,
}: {
  episodes: number;
  fillerEpisodes: number;
  minutesPerEpisode: number;
}) {
  const [perWeek, setPerWeek] = useState<number>(2);
  const [skipFiller, setSkipFiller] = useState(false);
  const [finishLabel, setFinishLabel] = useState<string | null>(null);

  const toWatch = skipFiller ? episodes - fillerEpisodes : episodes;
  const weeks = weeksAtPace(toWatch, perWeek);
  const hours = watchHours(toWatch, minutesPerEpisode);
  const years = weeks / 52;

  useEffect(() => {
    const finish = new Date();
    finish.setDate(finish.getDate() + weeks * 7);
    setFinishLabel(finish.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
  }, [weeks]);

  return (
    <div className="not-prose overflow-hidden rounded-[20px] border border-ani-line bg-ani-panel">
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <p id="pace-label" className="text-sm font-medium text-ani-text">
          Episodes per week
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="pace-label">
          {PACES.map((pace) => (
            <button
              key={pace}
              type="button"
              role="radio"
              aria-checked={perWeek === pace}
              onClick={() => setPerWeek(pace)}
              className={`min-h-11 min-w-12 rounded-full px-4 text-sm font-medium tabular-nums transition-colors duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus ${
                perWeek === pace
                  ? "bg-ani-primary text-ani-on-primary"
                  : "border border-ani-control-border text-ani-text hover:bg-ani-hover"
              }`}
            >
              {pace}
            </button>
          ))}
        </div>
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ani-text">
          <input
            type="checkbox"
            checked={skipFiller}
            onChange={(event) => setSkipFiller(event.target.checked)}
            className="h-5 w-5 accent-[var(--ani-progress)]"
          />
          Skip the {fillerEpisodes} filler episodes
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 border-t border-ani-line" aria-live="polite">
        <div className="px-4 py-4 sm:px-6">
          <p className="text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ani-text">
            {weeks.toLocaleString()}
            <span className="ml-1 text-base font-medium text-ani-muted">weeks</span>
          </p>
          <p className="mt-1 text-xs text-ani-muted">
            {years >= 1 ? `About ${years.toFixed(1)} years` : "Under a year"}
          </p>
        </div>
        <div className="border-l border-ani-line px-4 py-4 sm:px-6">
          <p className="text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ani-text">
            ~{hours.toLocaleString()}
            <span className="ml-1 text-base font-medium text-ani-muted">hours</span>
          </p>
          <p className="mt-1 text-xs text-ani-muted">
            {finishLabel ? `Done around ${finishLabel}` : `${toWatch.toLocaleString()} episodes`}
          </p>
        </div>
      </div>
    </div>
  );
}
