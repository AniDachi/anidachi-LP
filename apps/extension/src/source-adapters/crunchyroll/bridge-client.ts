import {
	CRUNCHYROLL_CONTROL_RESULT_SOURCE,
	CRUNCHYROLL_CONTROL_SOURCE,
	type CrunchyrollControlAction,
	type CrunchyrollControlResult,
  isCrunchyrollMetadataResult,
  type CrunchyrollControlRequest,
} from "./bridge-contract";
import type { CrunchyrollHistoryMetadata } from "./bridge-contract";
import { type WatchCatalogLocaleContext, type WatchCatalogSnapshotInput } from "@anidachi/protocol";
import { crunchyrollDisplayEpisodeNumber, normalizeCrunchyrollCatalog } from "./catalog";
import { resolveCrunchyrollCurrentObjectIdentity } from "./progress";

type HistoryJsonLoader = (path: string, signal: AbortSignal) => Promise<unknown>;

function historyRows(value: unknown, maximum: number): Record<string, unknown>[] {
  if (!value || typeof value !== "object" || !("data" in value) || !Array.isArray(value.data)) throw new Error("HISTORY_RESPONSE");
  if (value.data.length > maximum || "total" in value && typeof value.total === "number" && value.total > maximum) throw new Error("HISTORY_LIMIT");
  return value.data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row));
}

function cmsPath(path: string, context: WatchCatalogLocaleContext): string {
  const params = new URLSearchParams({ locale: context.requestedLocale });
  if (context.audioLocale) params.set("preferred_audio_language", context.audioLocale);
  return `/content/v2/cms/${path}?${params}`;
}

function safeGuid(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,190}$/.test(value);
}

function checkHistoryAbort(signal: AbortSignal): void {
  if (signal.aborted) throw new Error("HISTORY_ABORTED");
}

export async function resolveCrunchyrollHistoryMetadata(
  watchId: string, captured: WatchCatalogLocaleContext, load: HistoryJsonLoader, signal: AbortSignal,
): Promise<CrunchyrollHistoryMetadata | null> {
  const context = structuredClone(captured);
  if (!safeGuid(watchId)) return null;
  checkHistoryAbort(signal);
  const objectResponse = await load(cmsPath(`objects/${watchId}`, context), signal);
  checkHistoryAbort(signal);
  const object = historyRows(objectResponse, 1).find((row) => row.id === watchId);
  const metadata = object?.episode_metadata as Record<string, unknown> | undefined;
  const seriesId = metadata?.series_id;
  const seasonId = metadata?.season_id;
  if (!safeGuid(seriesId) || !safeGuid(seasonId)) return null;
  const seasonsResponse = await load(cmsPath(`series/${seriesId}/seasons`, context), signal);
  checkHistoryAbort(signal);
  historyRows(seasonsResponse, 100);
  const episodesResponse = await load(cmsPath(`seasons/${seasonId}/episodes`, context), signal);
  checkHistoryAbort(signal);
  const rows = historyRows(episodesResponse, 2000);
  const resolved = resolveCrunchyrollCurrentObjectIdentity({ watchId, objectResponse, seasonsResponse, episodesResponse });
  if (!resolved) return null;
  const { titleKey: _title, seasonKey: _season, episodeKey: _episode, ...identity } = resolved;
  const row = rows.find((row) => row.identifier === identity.providerEpisodeIdentifier);
  return { identity, episodeNumber: row ? crunchyrollDisplayEpisodeNumber(row) : null, context };
}

export async function collectCrunchyrollHistoryCatalog(
  seriesId: string, captured: WatchCatalogLocaleContext, load: HistoryJsonLoader, signal: AbortSignal,
): Promise<WatchCatalogSnapshotInput> {
  const context = structuredClone(captured);
  if (!safeGuid(seriesId)) throw new Error("HISTORY_IDENTITY");
  checkHistoryAbort(signal);
  const seriesResponse = await load(cmsPath(`objects/${seriesId}`, context), signal);
  checkHistoryAbort(signal);
  const series = historyRows(seriesResponse, 1).find((row) => row.id === seriesId);
  if (!series || typeof series.title !== "string" || !series.title.trim() || series.title.length > 300) throw new Error("HISTORY_IDENTITY");
  const seasonsResponse = await load(cmsPath(`series/${seriesId}/seasons`, context), signal);
  checkHistoryAbort(signal);
  const seasons = historyRows(seasonsResponse, 100);
  const episodeResponses: Record<string, unknown> = {};
  const encoder = new TextEncoder();
  let bytes = encoder.encode(JSON.stringify(seasonsResponse)).byteLength;
  for (const season of seasons) {
    checkHistoryAbort(signal);
    if (!safeGuid(season.id)) throw new Error("HISTORY_IDENTITY");
    if (Object.hasOwn(episodeResponses, season.id)) continue;
    const response = await load(cmsPath(`seasons/${season.id}/episodes`, context), signal);
    checkHistoryAbort(signal);
    historyRows(response, 2000);
    bytes += encoder.encode(JSON.stringify(response)).byteLength;
    if (bytes > 8 * 1024 * 1024) throw new Error("HISTORY_LIMIT");
    episodeResponses[season.id] = response;
  }
  return normalizeCrunchyrollCatalog({
    seriesId, title: series.title, ...context, contextUnchanged: true,
    seasonsResponse, episodeResponses,
  }).snapshot;
}

export function runCrunchyrollMainCommand(
	action: CrunchyrollControlAction,
	payload: Omit<CrunchyrollControlRequest, "action" | "id" | "source"> = {},
	timeoutMs = action === "seek"
		? 1000
		: action === "navigate"
			? 5200
			: action === "seriesPoster"
				? 3500
				: action === "historyIdentity" ? 30_000 : action === "historyCatalog" ? 120_000 : 450,
  signal?: AbortSignal,
): Promise<CrunchyrollControlResult> {
	const id = createMessageId();

	return new Promise((resolve) => {
		let completed = false;
		let timeout = 0;
		const cleanup = () => {
			window.clearTimeout(timeout);
			window.removeEventListener("message", onMessage);
      signal?.removeEventListener("abort", onAbort);
		};
		const complete = (result: CrunchyrollControlResult) => {
			if (completed) {
				return;
			}

			completed = true;
			cleanup();
			resolve(result);
		};
		const onMessage = (event: MessageEvent) => {
			if (
				(event.source && event.source !== window) ||
				!isCrunchyrollControlResult(event.data, id, action)
			) {
				return;
			}

			complete(event.data);
		};
    const cancel = () => {
      if (action === "historyIdentity" || action === "historyCatalog") window.postMessage({ action: "cancelHistory", id, source: CRUNCHYROLL_CONTROL_SOURCE }, "*");
    };
    const onAbort = () => {
      cancel();
      complete({ action, id, source: CRUNCHYROLL_CONTROL_RESULT_SOURCE, ok: false, error: "MAIN_BRIDGE_ABORTED" });
    };
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener("abort", onAbort, { once: true });

		window.addEventListener("message", onMessage);
		timeout = window.setTimeout(() => {
      cancel();
			complete({
				action,
				error: "MAIN_BRIDGE_TIMEOUT",
				id,
				ok: false,
				source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
				timedOut: true,
			});
		}, timeoutMs);

		window.postMessage(
			{
				action,
				id,
				source: CRUNCHYROLL_CONTROL_SOURCE,
				...payload,
			},
			"*",
		);
	});
}

function isCrunchyrollControlResult(
	value: unknown,
	id: string,
  action: CrunchyrollControlAction,
): value is CrunchyrollControlResult {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<CrunchyrollControlResult>;
	return (
		candidate.source === CRUNCHYROLL_CONTROL_RESULT_SOURCE &&
		candidate.id === id && candidate.action === action && typeof candidate.ok === "boolean" &&
    (action !== "historyIdentity" && action !== "historyCatalog" || isCrunchyrollMetadataResult(candidate as CrunchyrollControlResult))
	);
}

function createMessageId(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
