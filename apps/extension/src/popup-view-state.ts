import type { PopupTab } from "./popup-app";
import type { PopupHistoryConditions } from "./popup-watch-filters";

const KEY = "anidachi.popupView.v1";
type HistoryView = {
  generation: number;
  branches: Record<string, boolean>;
  seasons: Record<string, string>;
  titleQuery?: string;
  titlePages?: number;
};
type PopupView = {
  owner: string;
  tab: PopupTab;
  scroll: Partial<Record<PopupTab, number>>;
  history?: HistoryView;
  search: string;
  conditions: PopupHistoryConditions;
};
const tabs = new Set<PopupTab>(["resources", "friends", "inbox"]);
function record<T>(value: unknown, valid: (value: unknown) => value is T): Record<string, T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, entry]) => key.length <= 512 && valid(entry)).slice(-128));
}
const string = (value: unknown): value is string => typeof value === "string" && value.length <= 512;
const boolean = (value: unknown): value is boolean => typeof value === "boolean";
const position = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000;

// Local presentation preferences only: no history records, artwork, progress, auth or
// access proofs. Keep just the most recent account and bound every map.
export function readPopupView(owner: string): PopupView {
  const empty: PopupView = { owner, tab: "resources", scroll: {}, search: "", conditions: { period: "all-time", fromDate: "", throughDate: "" } };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || raw.owner !== owner) return empty;
    const scroll = record(raw.scroll, position);
    const history = raw.history;
    return {
      owner,
      search: typeof raw.search === "string" ? raw.search.slice(0, 200) : "",
      conditions: ["all-time", "today", "last-7-days", "this-month", "custom"].includes(raw.conditions?.period) ? {
        period: raw.conditions.period,
        fromDate: typeof raw.conditions.fromDate === "string" ? raw.conditions.fromDate.slice(0, 10) : "",
        throughDate: typeof raw.conditions.throughDate === "string" ? raw.conditions.throughDate.slice(0, 10) : "",
      } : empty.conditions,
      tab: tabs.has(raw.tab) ? raw.tab : "resources",
      scroll: Object.fromEntries(Object.entries(scroll).filter(([key]) => tabs.has(key as PopupTab))),
      ...(Number.isSafeInteger(history?.generation) && history.generation >= 1 ? { history: {
        generation: history.generation,
        branches: record(history.branches, boolean),
        seasons: record(history.seasons, string),
        ...(typeof history.titleQuery === "string" && history.titleQuery.length <= 1024 && Number.isSafeInteger(history.titlePages) ? {
          titleQuery: history.titleQuery, titlePages: Math.max(1, Math.min(20, history.titlePages)),
        } : {}),
      } } : {}),
    };
  } catch { return empty; }
}
export function writePopupNavigation(owner: string, tab: PopupTab, scrollTop?: number) {
  const view = readPopupView(owner);
  save({ ...view, tab, scroll: position(scrollTop) ? { ...view.scroll, [tab]: scrollTop } : view.scroll });
}
export function readPopupHistoryView(owner: string, generation?: number): HistoryView {
  const history = readPopupView(owner).history;
  return history && history.generation === generation ? history : { generation: generation ?? 0, branches: {}, seasons: {} };
}
export function writePopupQuery(owner: string, search: string, conditions: PopupHistoryConditions) {
  save({ ...readPopupView(owner), search, conditions });
}
export function writePopupTitlePages(owner: string, generation: number | undefined, query: string, pages: number) {
  if (!generation || !Number.isSafeInteger(pages) || query.length > 1024) return;
  save({ ...readPopupView(owner), history: { ...readPopupHistoryView(owner, generation), titleQuery: query, titlePages: Math.max(1, Math.min(20, pages)) } });
}
export function writePopupHistoryChoice(owner: string, generation: number | undefined, kind: "branches" | "seasons", key: string, value: boolean | string) {
  if (!generation || key.length > 512) return;
  const view = readPopupView(owner);
  const history = readPopupHistoryView(owner, generation);
  const choices = { ...history[kind], [key]: value };
  save({ ...view, history: { ...history, [kind]: kind === "branches" ? record(choices, boolean) : record(choices, string) } });
}
export function forgetPopupView() {
  try { localStorage.removeItem(KEY); } catch { /* Storage is optional for presentation. */ }
}
function save(view: PopupView) {
  try { localStorage.setItem(KEY, JSON.stringify(view)); } catch { /* Keep this popup usable if storage is unavailable. */ }
}
