"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { groupByLocalDay, slotAnchor, type ScheduleWeek } from "@/lib/tools/schedule-time";

/** First paint uses US Eastern so the HTML already has times; the browser then swaps in its own zone. */
const SERVER_ZONE = "America/New_York";

function zoneName(timeZone: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

export function ReleaseSchedule({ week }: { week: ScheduleWeek }) {
  const [timeZone, setTimeZone] = useState(SERVER_ZONE);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || SERVER_ZONE);
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const days = useMemo(() => groupByLocalDay(week, timeZone), [week, timeZone]);
  const next =
    now === null
      ? null
      : (days.flatMap((day) => day.rows).find((row) => row.at.getTime() > now) ?? null);

  return (
    <div className="not-prose">
      <p className="mb-4 text-sm text-ani-muted">
        Times shown in <strong className="font-medium text-ani-text">{zoneName(timeZone)}</strong>
        {timeZone === SERVER_ZONE && now === null ? " until your browser loads its own zone" : ""}.
      </p>

      {next ? (
        <p className="mb-6 rounded-[16px] border border-ani-line bg-ani-panel px-4 py-3 text-sm text-ani-muted sm:px-5">
          Next scheduled: <strong className="font-medium text-ani-text">{next.slot.title}</strong>
          {next.slot.episode ? ` ${next.slot.episode}` : ""}, {next.time}{" "}
          {new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(next.at)}.
        </p>
      ) : null}

      <div className="space-y-6">
        {days.map((day) => (
          <section key={day.key} aria-label={day.label}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.06em] text-ani-muted">
              {day.label}
            </h3>
            <ol className="divide-y divide-ani-line overflow-hidden rounded-[16px] border border-ani-line">
              {day.rows.map((row) => {
                const past = now !== null && row.at.getTime() <= now;
                const isNext = next !== null && row === next;
                return (
                  <li
                    key={`${row.slot.title}-${row.slot.utcDay}`}
                    id={slotAnchor(row.slot)}
                    className={`grid scroll-mt-24 grid-cols-[5.25rem_1fr] gap-x-3 px-4 py-3 sm:px-5 ${
                      isNext ? "bg-ani-hover" : ""
                    }`}
                  >
                    <time
                      dateTime={row.at.toISOString()}
                      className={`pt-px font-mono text-sm tabular-nums ${
                        past ? "text-ani-muted" : "text-ani-text"
                      }`}
                    >
                      {row.time}
                    </time>
                    <span className="min-w-0">
                      {row.slot.watchSlug ? (
                        <Link
                          href={`/watch/${row.slot.watchSlug}-with-friends`}
                          className="font-medium text-ani-text underline decoration-ani-line underline-offset-4 hover:decoration-ani-text"
                        >
                          {row.slot.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-ani-text">{row.slot.title}</span>
                      )}
                      {row.slot.episode ? (
                        <span className="ml-2 text-sm text-ani-muted">{row.slot.episode}</span>
                      ) : null}
                      {past ? <span className="ml-2 text-xs text-ani-muted">Scheduled time passed</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
