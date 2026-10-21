export type ScheduleSlot = {
  title: string;
  /** 0 = Monday … 6 = Sunday, in UTC. */
  utcDay: number;
  /** "HH:MM" in UTC. */
  utcTime: string;
  episode?: string;
  /** Existing `/watch/{slug}-with-friends` page, when there is one. */
  watchSlug?: string;
  /** Short muted note after the episode, e.g. "Same day as sub". */
  note?: string;
};

export type ScheduleWeek = {
  /** Monday of the week, "YYYY-MM-DD". */
  weekStart: string;
  checked: string;
  slots: ScheduleSlot[];
};

/** Absolute release instant for a slot in its week. */
export function slotInstant(week: ScheduleWeek, slot: ScheduleSlot): Date {
  const [hours, minutes] = slot.utcTime.split(":").map(Number);
  const start = new Date(`${week.weekStart}T00:00:00Z`);
  return new Date(start.getTime() + ((slot.utcDay * 24 + hours) * 60 + minutes) * 60_000);
}

/** Calendar key (YYYY-MM-DD) for an instant in a timezone. */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type DayGroup = {
  key: string;
  label: string;
  rows: { slot: ScheduleSlot; at: Date; time: string }[];
};

/** Slots grouped by local day and sorted by time, as the visitor sees them. */
export function groupByLocalDay(week: ScheduleWeek, timeZone: string): DayGroup[] {
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  const groups = new Map<string, DayGroup>();
  const rows = week.slots
    .map((slot) => ({ slot, at: slotInstant(week, slot) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.slot.title.localeCompare(b.slot.title));
  for (const { slot, at } of rows) {
    const key = dayKey(at, timeZone);
    const group = groups.get(key) ?? { key, label: dayLabel.format(at), rows: [] };
    group.rows.push({ slot, at, time: timeLabel.format(at) });
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Stable row anchor, e.g. "show-black-clover-season-2". */
export function slotAnchor(slot: ScheduleSlot): string {
  return `show-${slot.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export type ZonePreset = {
  id: string;
  /** Button label, e.g. "ET". */
  label: string;
  timeZone: string;
};

/** Time-zone switch options. ET first: it is the server-rendered default. */
export const ZONE_PRESETS: ZonePreset[] = [
  { id: "et", label: "ET", timeZone: "America/New_York" },
  { id: "pt", label: "PT", timeZone: "America/Los_Angeles" },
  { id: "uk", label: "UK", timeZone: "Europe/London" },
  { id: "cet", label: "CET", timeZone: "Europe/Paris" },
  { id: "ist", label: "IST", timeZone: "Asia/Kolkata" },
  { id: "jst", label: "JST", timeZone: "Asia/Tokyo" },
];

export const DEFAULT_ZONE = ZONE_PRESETS[0].timeZone;

/** UTC offset of a zone at an instant, in minutes (New York in October: -240). */
export function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

/**
 * The preset that shows the same clock times as `timeZone` for every slot in the week,
 * so a visitor in Toronto lands on ET and one in Madrid on CET. Undefined when none match.
 */
export function presetForZone(timeZone: string, week: ScheduleWeek): ZonePreset | undefined {
  const exact = ZONE_PRESETS.find((preset) => preset.timeZone === timeZone);
  if (exact) return exact;
  const instants = week.slots.map((slot) => slotInstant(week, slot));
  if (instants.length === 0) instants.push(new Date(`${week.weekStart}T00:00:00Z`));
  return ZONE_PRESETS.find((preset) =>
    instants.every((at) => zoneOffsetMinutes(preset.timeZone, at) === zoneOffsetMinutes(timeZone, at)),
  );
}

/** Week range label, e.g. "Oct 19 – 25, 2026" (or without the year when `year` is false). */
export function weekRangeLabel(week: Pick<ScheduleWeek, "weekStart">, year = true): string {
  const start = new Date(`${week.weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" as const } : {}),
  }).formatRange(start, end);
}

/** Local weekday and time of a slot, e.g. "Fri 11:00 AM", for static tables. */
export function slotLocalLabel(week: ScheduleWeek, slot: ScheduleSlot, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(slotInstant(week, slot));
}
