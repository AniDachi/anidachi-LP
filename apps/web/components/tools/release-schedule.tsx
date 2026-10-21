"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_ZONE,
  ZONE_PRESETS,
  groupByLocalDay,
  presetForZone,
  slotAnchor,
  type ScheduleWeek,
} from "@/lib/tools/schedule-time";

/** Remembers the visitor's pick across weekly visits. Shared by every schedule tool. */
const STORAGE_KEY = "anidachi.schedule.zone";

function zoneName(timeZone: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

function readStoredZone(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeZone(timeZone: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, timeZone);
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
}

function isValidZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Weekly schedule with a time-zone switch. The server renders US Eastern so the HTML
 * already has times; the browser then moves to the stored pick, or the visitor's own zone.
 */
export function ReleaseSchedule({ week }: { week: ScheduleWeek }) {
  const [timeZone, setTimeZone] = useState(DEFAULT_ZONE);
  const [localZone, setLocalZone] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_ZONE;
    const devicePreset = presetForZone(device, week);
    // A device zone that matches a preset (Toronto = ET) is shown as that preset.
    setLocalZone(devicePreset ? null : device);
    const stored = readStoredZone();
    if (stored && isValidZone(stored)) setTimeZone(stored);
    else setTimeZone(devicePreset?.timeZone ?? device);
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [week]);

  const days = useMemo(() => groupByLocalDay(week, timeZone), [week, timeZone]);
  const next =
    now === null
      ? null
      : (days.flatMap((day) => day.rows).find((row) => row.at.getTime() > now) ?? null);

  const choose = (zone: string) => {
    setTimeZone(zone);
    storeZone(zone);
  };
  const options = [
    ...ZONE_PRESETS.map((preset) => ({ label: preset.label, timeZone: preset.timeZone })),
    ...(localZone ? [{ label: "My time", timeZone: localZone }] : []),
  ];

  return (
    <div className="not-prose">
      <div
        role="group"
        aria-label="Time zone"
        className="mb-3 flex flex-wrap gap-1.5"
      >
        {options.map((option) => {
          const active = option.timeZone === timeZone;
          return (
            <button
              key={option.timeZone}
              type="button"
              aria-pressed={active}
              onClick={() => choose(option.timeZone)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                active
                  ? "border-ani-control-border bg-ani-selected-quiet text-ani-text"
                  : "border-ani-line text-ani-muted hover:border-ani-control-border hover:bg-ani-hover hover:text-ani-text"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mb-4 text-sm text-ani-muted">
        Times shown in <strong className="font-medium text-ani-text">{zoneName(timeZone)}</strong>
        {now === null ? " until your browser loads your own zone" : ""}.
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
                      {row.slot.note ? (
                        <span className="ml-2 text-xs text-ani-muted">· {row.slot.note}</span>
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
