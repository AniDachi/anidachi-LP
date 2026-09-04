export const CRUNCHYROLL_CONTROL_SOURCE = "anidachi-crunchyroll-control";
export const CRUNCHYROLL_CONTROL_RESULT_SOURCE =
	"anidachi-crunchyroll-control-result";

export type CrunchyrollControlAction =
	| "play"
	| "pause"
	| "seek"
	| "snapshot"
	| "navigate"
	| "seriesPoster"
	| "historyIdentity"
	| "historyCatalog"
	| "cancelHistory";

export type CrunchyrollHistoryMetadata = {
  identity: NonNullable<WatchProgressEvent["crunchyrollIdentity"]>;
  episodeNumber: number | null;
  context: WatchCatalogLocaleContext;
};

export interface CrunchyrollVideoSnapshot {
	buffered: Array<[number, number]>;
	currentTime: number;
	duration: number | null;
	ended: boolean;
	muted: boolean;
	networkState: number;
	paused: boolean;
	playbackRate: number;
	readyState: number;
	seeking: boolean;
	volume: number;
}

export interface CrunchyrollTimelineSnapshot {
	ariaValueMax?: string | null;
	ariaValueMin?: string | null;
	ariaValueNow?: string | null;
	max: string;
	min: string;
	value: string;
}

export interface CrunchyrollControlRequest {
	action: CrunchyrollControlAction;
	id: string;
	source: typeof CRUNCHYROLL_CONTROL_SOURCE;
	contentId?: string;
	locale?: string;
	seriesId?: string;
	time?: number;
	url?: string;
  context?: WatchCatalogLocaleContext;
}

export interface CrunchyrollControlResult {
	action: CrunchyrollControlAction;
	error?: string;
	id: string;
	ok: boolean;
	source: typeof CRUNCHYROLL_CONTROL_RESULT_SOURCE;
	currentUrl?: string;
	method?: string;
	posterUrl?: string | null;
	timedOut?: boolean;
	timeline?: CrunchyrollTimelineSnapshot | null;
	video?: CrunchyrollVideoSnapshot;
  metadata?: CrunchyrollHistoryMetadata;
  catalog?: WatchCatalogSnapshotInput;
}

export function isCrunchyrollControlRequest(value: unknown): value is CrunchyrollControlRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as CrunchyrollControlRequest;
  if (request.source !== CRUNCHYROLL_CONTROL_SOURCE || typeof request.id !== "string" || !request.id || request.id.length > 128) return false;
  const fields = ["action", "id", "source"];
  const guid = (id: unknown) => typeof id === "string" && /^[A-Za-z0-9_-]{1,190}$/.test(id);
  switch (request.action) {
    case "historyIdentity":
      return exact(value, [...fields, "contentId", "locale"]) && guid(request.contentId) &&
        typeof request.locale === "string" && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(request.locale) && request.locale.length <= 35;
    case "historyCatalog":
      return exact(value, [...fields, "seriesId", "context"]) && guid(request.seriesId) && WatchCatalogLocaleContextSchema.safeParse(request.context).success;
    case "cancelHistory": case "play": case "pause": case "snapshot": return exact(value, fields);
    case "seek": return exact(value, [...fields, "time"]) && typeof request.time === "number" && Number.isFinite(request.time) && request.time >= 0;
    case "navigate": return exact(value, [...fields, "url"]) && typeof request.url === "string" && request.url.length <= 2048;
    case "seriesPoster": return exact(value, [...fields, "contentId", "seriesId", "locale"]) &&
      (request.contentId === undefined || guid(request.contentId)) && (request.seriesId === undefined || guid(request.seriesId));
    default: return false;
  }
}

export function isCrunchyrollMetadataResult(value: CrunchyrollControlResult): boolean {
  if (!exact(value, ["action", "id", "source", "ok", "metadata", "catalog", "error", "timedOut"])) return false;
  if (!value.ok) return typeof value.error === "string" && /^[A-Z_]{1,64}$/.test(value.error);
  if (value.action === "historyCatalog") return value.metadata === undefined && WatchCatalogSnapshotInputSchema.safeParse(value.catalog).success;
  const metadata = value.metadata;
  return value.catalog === undefined && Boolean(metadata) && exact(metadata!, ["identity", "episodeNumber", "context"]) &&
    CrunchyrollHistoryIdentitySchema.safeParse(metadata?.identity).success && WatchCatalogLocaleContextSchema.safeParse(metadata?.context).success &&
    (metadata?.episodeNumber === null || typeof metadata?.episodeNumber === "number" && Number.isFinite(metadata.episodeNumber) && metadata.episodeNumber >= 0);
}

function exact(value: object, fields: string[]): boolean {
  return Object.keys(value).every((key) => fields.includes(key));
}

export function getCrunchyrollTimelineValueForTime(
	targetTime: number,
	duration: number | null,
	min: number,
	max: number,
): number {
	if (!Number.isFinite(targetTime)) {
		return min;
	}

	if (!Number.isFinite(min)) {
		min = 0;
	}

	if (!Number.isFinite(max) || max <= min) {
		return targetTime;
	}

	if (
		duration !== null &&
		Number.isFinite(duration) &&
		duration > 0 &&
		max <= 100
	) {
		return min + (Math.max(0, targetTime) / duration) * (max - min);
	}

	return targetTime;
}
import { CrunchyrollHistoryIdentitySchema, WatchCatalogLocaleContextSchema, WatchCatalogSnapshotInputSchema,
  type WatchCatalogLocaleContext, type WatchCatalogSnapshotInput, type WatchProgressEvent } from "@anidachi/protocol";
