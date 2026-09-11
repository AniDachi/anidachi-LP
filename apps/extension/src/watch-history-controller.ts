import type {
	RoomHistoryAuthority,
	WatchHistoryPreferences,
	WatchProgressEvent,
} from "@anidachi/protocol";
import {
	canCaptureWatchHistory,
	historyServerTime,
	type WatchHistoryLease,
} from "./watch-history-access";
import {
	HISTORY_OBSERVATION_SUSPENDED,
	type HistoryObservation,
	type HistoryObservationResult,
} from "./source-adapters/core/history-policy";
import type { WatchHistoryCaptureResult } from "./watch-history-client";
import type { WatchHistoryObservationDisplayMode } from "./watch-history-storage";
import type { WatchHistoryLocalEvent } from "./watch-history-outbox";

export const WATCH_HISTORY_HEARTBEAT_MS = 60_000;

type HistoryEventKind = WatchProgressEvent["kind"];

export type WatchHistoryControllerDependencies = {
	onPersisted?: (
		event: WatchHistoryLocalEvent,
		owner: string,
		options: { refreshCatalog: boolean },
	) => Promise<void> | void;
	isOwnerCurrent?: (owner: string) => boolean;
	getProvider?: () => "crunchyroll" | "youtube";
	getObservation: (
		preferences: WatchHistoryPreferences | null,
	) => HistoryObservationResult;
	getRoomActive: () => boolean;
	loadCachedPreferences?: () => Promise<{
		ownerUserId: string;
		accountGeneration: number;
		accessLease?: WatchHistoryLease | null;
		preferences: WatchHistoryPreferences;
		capturePaused?: boolean;
	} | null>;
	loadPreferences: () => Promise<{
		ownerUserId: string;
		accountGeneration: number;
		accessLease?: WatchHistoryLease | null;
		preferences: WatchHistoryPreferences;
		capturePaused?: boolean;
	} | null>;
	recoverCapture?: () => Promise<{
		ownerUserId: string;
		accountGeneration: number;
		accessLease?: WatchHistoryLease | null;
		preferences: WatchHistoryPreferences;
		capturePaused: boolean;
	} | null>;
	observeLocally: (
		event: WatchProgressEvent,
		expectedOwnerUserId: string,
		meaningfulSolo: boolean,
		displayMode: WatchHistoryObservationDisplayMode | null,
		queueForSync: boolean,
		flushNow: boolean,
	) =>
		| Promise<WatchHistoryCaptureResult | void>
		| WatchHistoryCaptureResult
		| void;
	onObservation?: (observation: HistoryObservation | null) => void;
	onRoomHistoryAuthorityState?: (state: "solo" | "waiting" | "ready") => void;
	now?: () => number;
	createEventId?: () => string;
	createSessionKey?: () => string;
	isPlaying: () => boolean;
	isSeeking: () => boolean;
};

export type WatchHistoryController = {
	notePlaybackInteraction(): Promise<void>;
	start(): Promise<void>;
	observe(kind: HistoryEventKind): Promise<void>;
	noteSeeking(): Promise<void>;
	noteResumeSeeking(): Promise<void>;
	applyLocalPreferences(input: {
		ownerUserId: string;
		accountGeneration: number;
		accessLease?: WatchHistoryLease | null;
		preferences: WatchHistoryPreferences;
		capturePaused: boolean;
	}): Promise<void>;
	setRoomActive(active: boolean): Promise<void>;
	setRoomHistoryAuthority(
		authority: RoomHistoryAuthority | null,
	): Promise<void>;
	refreshAuthority(): Promise<void>;
	recover(): Promise<void>;
	dispose(): Promise<void>;
};

export function createWatchHistoryController(
	dependencies: WatchHistoryControllerDependencies,
): WatchHistoryController {
	const now = dependencies.now ?? Date.now;
	const eventId = dependencies.createEventId ?? (() => crypto.randomUUID());
	const sessionKey =
		dependencies.createSessionKey ?? (() => crypto.randomUUID());
	let authority: Awaited<
		ReturnType<WatchHistoryControllerDependencies["loadPreferences"]>
	> = null;
	let retained: HistoryObservation | null = null;
	let key: string | null = null;
	let sequence = 0;
	let previousTime: number | null = null;
	let meaningful = false;
	let resumeAwaitingPlayback = false;
	let heartbeatAt: number | null = null;
	let interaction = dependencies.isPlaying();
	let disposed = false;
	let revision = 0;
	let roomActive = dependencies.getRoomActive();
	let tail = Promise.resolve();
	let operations = 0;
	let refreshFlight: Promise<void> | null = null;
	let nextRefreshAt = 0;
	const serial = (operation: () => Promise<void>) => {
		operations++;
		const result = tail.then(operation).finally(() => {
			operations--;
		});
		tail = result.catch(() => undefined);
		return result;
	};
	const allowed = () =>
		!disposed &&
		!!authority &&
		!authority.capturePaused &&
		dependencies.isOwnerCurrent?.(authority.ownerUserId) !== false &&
		(dependencies.getProvider?.() !== "youtube" ||
			authority.preferences.youtubeHistoryEnabled) &&
		canCaptureWatchHistory(
			authority.accessLease,
			authority.ownerUserId,
			now(),
			dependencies.getProvider?.(),
		);
	function reset() {
		retained = null;
		key = null;
		sequence = 0;
		previousTime = null;
		meaningful = false;
		resumeAwaitingPlayback = false;
		heartbeatAt = null;
		dependencies.onObservation?.(null);
	}
	function apply(next: NonNullable<typeof authority>) {
		if (disposed || dependencies.isOwnerCurrent?.(next.ownerUserId) === false)
			return;
		const old = authority;
		authority = next;
		const accountChanged = old && (
			old.ownerUserId !== next.ownerUserId ||
			old.accountGeneration !== next.accountGeneration ||
			old.accessLease?.access.accessEpoch !== next.accessLease?.access.accessEpoch
		);
		const youtubeChanged = old && (
			old.accessLease?.access.youtubeConsentEpoch !== next.accessLease?.access.youtubeConsentEpoch ||
			old.preferences.youtubeHistoryEnabled !== next.preferences.youtubeHistoryEnabled
		);
		// A refresh request may leave its old lease usable while it awaits a
		// response. Invalidate samples at semantic application too, including
		// those queued after that request started but before its authority arrived.
		if (old && (accountChanged || youtubeChanged || old.capturePaused !== next.capturePaused))
			++revision;
		if (
			old &&
			(accountChanged || (retained?.provider === "youtube" && youtubeChanged) || !allowed())
		)
			reset();
	}
	function refreshAuthority(): Promise<void> {
		if (refreshFlight) return refreshFlight;
		const token = ++revision;
		if (retained?.provider === "youtube" && authority)
			authority = { ...authority, accessLease: null };
		nextRefreshAt = now() + 10_000;
		const flight = (async () => {
			const loaded = await dependencies.loadPreferences().catch(() => null);
			if (!disposed && token === revision && loaded) apply(loaded);
		})();
		refreshFlight = flight;
		void flight.finally(() => {
			if (refreshFlight === flight) refreshFlight = null;
		});
		return flight;
	}
	async function start() {
		const token = ++revision;
		const cached = dependencies.loadCachedPreferences
			? await dependencies.loadCachedPreferences().catch(() => null)
			: null;
		if (disposed || token !== revision) return;
		if (cached) apply(cached);
		if (!allowed()) await refreshAuthority();
		else void refreshAuthority();
		await queueCapture("heartbeat");
	}
	async function persist(
		observation: HistoryObservation,
		kind: HistoryEventKind,
		displayMode: WatchHistoryObservationDisplayMode | null,
		queue: boolean,
		flush: boolean,
	) {
		if (
			!allowed() ||
			!authority?.accessLease ||
			!canCaptureWatchHistory(
				authority.accessLease,
				authority.ownerUserId,
				now(),
				observation.provider,
			)
		)
			return false;
		const captured = authority;
		const token = revision;
		key ??= sessionKey();
		// Allocated at capture creation, before any asynchronous dispatch. This same
		// session is serialized through persistence; delayed callbacks keep their number.
		const event: WatchHistoryLocalEvent = {
			...toEvent(
				observation,
				kind,
				captured.accountGeneration,
				eventId(),
				key,
				historyServerTime(captured.accessLease!, now()),
			),
			captureProof: structuredClone(captured.accessLease!),
			clientSequence: ++sequence,
		};
		const result = await dependencies.observeLocally(
			event,
			captured.ownerUserId,
			meaningful,
			displayMode,
			queue,
			flush,
		);
		if (
			disposed ||
			dependencies.isOwnerCurrent?.(captured.ownerUserId) === false ||
			authority !== captured ||
			token !== revision ||
			!allowed()
		)
			return false;
		if (isFailedCapture(result)) {
			if (result.status === "storage-full")
				authority = { ...captured, capturePaused: true };
			return false;
		}
		if (queue && dependencies.onPersisted) {
			const refreshCatalog =
				interaction && kind !== "source_change" && kind !== "pagehide";
			if (refreshCatalog) interaction = false;
			void Promise.resolve(
				dependencies.onPersisted(event, captured.ownerUserId, {
					refreshCatalog,
				}),
			).catch(() => undefined);
		}
		return true;
	}
	function queueCapture(kind: HistoryEventKind) {
		const token = revision;
		const sample = allowed()
			? dependencies.getObservation(authority!.preferences)
			: HISTORY_OBSERVATION_SUSPENDED;
		// Bind provider eligibility and the content clock to event arrival, before
		// a background acknowledgement can delay this operation past an ad or seek.
		const observation = sample && sample !== HISTORY_OBSERVATION_SUSPENDED
			? structuredClone(sample)
			: sample;
		const playing = dependencies.isPlaying() && !dependencies.isSeeking();
		return serial(() => capture(kind, observation, playing, token));
	}
	function sourceIsCurrent(observation: HistoryObservation | null) {
		const current = dependencies.getObservation(authority!.preferences);
		return current !== HISTORY_OBSERVATION_SUSPENDED &&
			(current && observation
				? observationIdentity(current) === observationIdentity(observation)
				: current === observation);
	}
	async function capture(
		kind: HistoryEventKind,
		observation: HistoryObservationResult,
		playing: boolean,
		token: number,
	) {
		if (disposed) return;
		if (!allowed()) {
			reset();
			if (!disposed && now() >= nextRefreshAt) void refreshAuthority();
			return;
		}
		// The sample conveys no authority: changed account/lease/consent revisions
		// invalidate queued work, and current source identity must still match.
		if (token !== revision || observation === HISTORY_OBSERVATION_SUSPENDED) return;
		if (!sourceIsCurrent(observation) || !allowed()) return;
		if (
			retained &&
			(!observation ||
				observationIdentity(retained) !== observationIdentity(observation))
		) {
			await persist(retained, "source_change", null, meaningful, meaningful);
			if (token !== revision || !allowed() || !sourceIsCurrent(observation)) return;
			reset();
		}
		if (!observation || !allowed()) return;
		retained = observation;
		dependencies.onObservation?.(observation);
		if (
			playing &&
			previousTime !== null &&
			observation.currentTime > previousTime
		) {
			meaningful = true;
			resumeAwaitingPlayback = false;
		}
		if (kind === "ended" && !resumeAwaitingPlayback) meaningful = true;
		previousTime = playing ? observation.currentTime : null;
		const queue = meaningful && (kind !== "heartbeat" || playing);
		const flush =
			queue &&
			(kind !== "heartbeat" ||
				heartbeatAt === null ||
				now() - heartbeatAt >= WATCH_HISTORY_HEARTBEAT_MS);
		if (
			(await persist(
				observation,
				kind,
				isActivePresentationKind(kind) ? "mine" : null,
				queue,
				flush,
			)) &&
			kind === "heartbeat" &&
			flush
		)
			heartbeatAt = now();
	}
	return {
		start,
		refreshAuthority,
		observe: queueCapture,
		notePlaybackInteraction: async () => {
			interaction = true;
		},
		noteSeeking: async () => {
			previousTime = null;
		},
		noteResumeSeeking: async () => {
			previousTime = null;
			meaningful = false;
			resumeAwaitingPlayback = true;
		},
		applyLocalPreferences: async (input) => {
			++revision;
			const before = retained;
			const previous = authority;
			apply(input);
			const youtubeChanged =
				before?.provider === "youtube" &&
				(previous?.preferences.youtubeHistoryEnabled !==
					input.preferences.youtubeHistoryEnabled ||
					previous?.accessLease?.access.youtubeConsentEpoch !==
						input.accessLease?.access.youtubeConsentEpoch);
			if (!operations && allowed() && (!before || !retained || youtubeChanged))
				await queueCapture("heartbeat");
		},
		setRoomActive: async (active) => {
			const leaving = roomActive && !active;
			roomActive = active;
			dependencies.onRoomHistoryAuthorityState?.(active ? "ready" : "solo");
			if (leaving) await queueCapture("room_leave");
		},
		// Technical room source authority belongs to the live room path, never capture.
		setRoomHistoryAuthority: async () => undefined,
		recover: async () => {
			await refreshAuthority();
			if (authority?.capturePaused && dependencies.recoverCapture) {
				const recovered = await dependencies.recoverCapture();
				if (recovered) apply(recovered);
			}
		},
		dispose: async () => {
			if (disposed) return tail;
			const captured = authority;
			let cleanup = retained;
			if (allowed()) {
				const latest = dependencies.getObservation(authority!.preferences);
				if (
					latest !== HISTORY_OBSERVATION_SUSPENDED &&
					latest &&
					retained &&
					observationIdentity(latest) === observationIdentity(retained)
				)
					cleanup = latest;
			}
			const event =
				allowed() && captured?.accessLease && cleanup && key && meaningful
					? {
							...toEvent(
								cleanup,
								"source_change",
								captured.accountGeneration,
								eventId(),
								key,
								historyServerTime(captured.accessLease, now()),
							),
							captureProof: structuredClone(captured.accessLease),
							clientSequence: ++sequence,
						}
					: null;
			disposed = true;
			++revision;
			// No display callback after teardown: a new route may already own the panel.
			await tail;
			if (
				event &&
				captured &&
				dependencies.isOwnerCurrent?.(captured.ownerUserId) !== false &&
				canCaptureWatchHistory(
					event.captureProof,
					captured.ownerUserId,
					now(),
					event.provider,
				)
			) {
				await dependencies.observeLocally(
					event,
					captured.ownerUserId,
					true,
					null,
					true,
					true,
				);
			}
		},
	};
}

function isActivePresentationKind(kind: HistoryEventKind): boolean {
	return (
		kind !== "source_change" &&
		kind !== "pagehide" &&
		kind !== "room_leave" &&
		kind !== "room_end" &&
		kind !== "ended"
	);
}

function isFailedCapture(
	result: WatchHistoryCaptureResult | void,
): result is Extract<WatchHistoryCaptureResult, { ok: false }> {
	return result !== undefined && !result.ok;
}

function observationIdentity(observation: HistoryObservation): string {
	return [
		observation.provider,
		observation.titleKey,
		observation.episodeKey,
		observation.sourceUrl,
	].join("\u0000");
}

function toEvent(
	observation: HistoryObservation,
	kind: HistoryEventKind,
	accountGeneration: number,
	clientEventId: string,
	clientSessionKey: string,
	observedAt: number,
): WatchHistoryLocalEvent {
	return {
		schemaVersion: 3,
		clientEventId,
		clientSessionKey,
		accountGeneration,
		provider: observation.provider,
		titleKey: observation.titleKey,
		itemKind: observation.itemKind,
		title: observation.title,
		artworkUrl: observation.artworkUrl,
		episodeKey: observation.episodeKey,
		episodeTitle: observation.episodeTitle,
		seasonKey: observation.seasonKey,
		seasonTitle: observation.seasonTitle,
		seasonNumber: observation.seasonNumber,
		episodeNumber: observation.episodeNumber,
		sourceUrl: observation.sourceUrl,
		currentTime: observation.currentTime,
		duration: observation.duration,
		progress: observation.progress,
		observedAt: new Date(observedAt).toISOString(),
		kind,
		...(observation.identityPending
			? { identityPending: observation.identityPending }
			: {}),
		...(observation.crunchyrollIdentity
			? { crunchyrollIdentity: observation.crunchyrollIdentity }
			: {}),
		...(observation.provider === "youtube"
			? {
					youtubeVideoId:
						observation.youtubeVideoId ??
						new URL(observation.sourceUrl).searchParams.get("v") ??
						undefined,
				}
			: {}),
	};
}
