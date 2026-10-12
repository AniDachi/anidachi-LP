export type ScheduleSlot = {
  title: string;
  /** 0 = Monday … 6 = Sunday, in UTC. */
  utcDay: number;
  /** "HH:MM" in UTC. */
  utcTime: string;
  episode?: string;
  /** Existing `/watch/{slug}-with-friends` page, when there is one. */
  watchSlug?: string;
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
