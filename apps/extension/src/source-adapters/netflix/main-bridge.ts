import {
	NETFLIX_RESULT,
	NETFLIX_VIDEO_GENERATION,
	NetflixRequestSchema,
	NetflixResultSchema,
	NetflixSnapshotSchema,
	netflixWatchId,
	type NetflixResult,
	type NetflixSnapshot,
} from "./contract";
import {
	netflixContext,
	netflixId,
	readNetflixCatalog,
	readNetflixMetadata,
	record,
} from "./metadata";

// Only this module touches Netflix's undocumented page API. No extension APIs.
type Player = {
	getMovieId(): unknown;
	getCurrentTime(): unknown;
	getDuration(): unknown;
	isPaused(): unknown;
	isReady(): unknown;
	getElement(): unknown;
	getAdManager(): unknown;
	play(): unknown;
	pause(): unknown;
	seek(timeMs: number): unknown;
};
type Api = {
	videoPlayer: {
		getAllPlayerSessionIds(): unknown;
		getVideoPlayerBySessionId(id: string): Player;
	};
	getVideoMetadataByVideoId(id: string | number): unknown;
};
type Binding = {
	player: Player;
	video: HTMLVideoElement;
	movieId: string;
	generation: string;
};
export function startNetflixBridge(): () => void {
	let stopped = false;
	let binding: Binding | null = null;
	const pending = new Map<string, () => void>();
	const invalidate = () => {
		if (
			binding &&
			binding.video.getAttribute(NETFLIX_VIDEO_GENERATION) ===
				binding.generation
		)
			binding.video.removeAttribute(NETFLIX_VIDEO_GENERATION);
		binding = null;
	};
	function inspect(): {
		snapshot: NetflixSnapshot;
		raw: unknown;
		binding: Binding;
	} | null {
		try {
			if (stopped) return null;
			const movieId = netflixWatchId(location.href);
			if (!movieId) {
				invalidate();
				return null;
			}
			const netflix = record(Reflect.get(window, "netflix"));
			const appContext = record(netflix?.appContext),
				state = record(appContext?.state),
				playerApp = record(state?.playerApp);
			const api =
				typeof playerApp?.getAPI === "function"
					? (playerApp.getAPI() as Api)
					: null;
			if (!api?.videoPlayer) {
				invalidate();
				return null;
			}
			const sessions = api.videoPlayer.getAllPlayerSessionIds();
			if (!Array.isArray(sessions) || sessions.length > 16) {
				invalidate();
				return null;
			}
			const candidates: { player: Player; video: HTMLVideoElement }[] = [];
			for (const session of sessions) {
				if (typeof session !== "string" || session.length > 200) continue;
				const player = api.videoPlayer.getVideoPlayerBySessionId(session);
				if (netflixId(player.getMovieId()) !== movieId) continue;
				const element = player.getElement();
				if (!(element instanceof HTMLElement)) continue;
				const videos =
					element instanceof HTMLVideoElement
						? [element]
						: [...element.querySelectorAll("video")];
				const video = videos.filter(
					(v) => v.isConnected && !!v.closest('[data-uia="watch-video"]'),
				);
				if (video.length === 1) candidates.push({ player, video: video[0] });
			}
			if (candidates.length !== 1) {
				invalidate();
				return null;
			}
			const { player, video } = candidates[0];
			if (
				!binding ||
				binding.player !== player ||
				binding.video !== video ||
				binding.movieId !== movieId
			) {
				invalidate();
				binding = { player, video, movieId, generation: crypto.randomUUID() };
				video.setAttribute(NETFLIX_VIDEO_GENERATION, binding.generation);
			}
			const ad = record(player.getAdManager());
			const presenting =
				typeof ad?.adPresenting === "boolean"
					? ad.adPresenting
					: record(ad?.adPresenting)?._value;
			if (
				presenting !== false ||
				player.isReady() !== true ||
				video.readyState < 2
			) {
				invalidate();
				return null;
			}
			const raw = record(
				record(
					api.getVideoMetadataByVideoId(player.getMovieId() as string | number),
				)?._metadataObject,
			)?.video;
			const models = record(record(netflix?.reactContext)?.models),
				geo = record(record(models?.geo)?.data);
			const context = netflixContext(
				record(geo?.requestCountry)?.id,
				record(geo?.locale)?.id,
			);
			const metadata = readNetflixMetadata(raw, movieId, context);
			const time = player.getCurrentTime(),
				duration = player.getDuration(),
				paused = player.isPaused();
			if (
				!metadata ||
				typeof time !== "number" ||
				typeof duration !== "number" ||
				typeof paused !== "boolean"
			) {
				invalidate();
				return null;
			}
			const snapshot = NetflixSnapshotSchema.safeParse({
				generation: binding.generation,
				movieId,
				currentTime: time / 1000,
				duration: duration / 1000,
				playing: !paused,
				metadata,
			});
			if (!snapshot.success) {
				invalidate();
				return null;
			}
			return { snapshot: snapshot.data, raw, binding };
		} catch {
			invalidate();
			return null;
		}
	}
	const post = (result: NetflixResult) => {
		if (!stopped && NetflixResultSchema.safeParse(result).success)
			window.postMessage(result, location.origin);
	};
	const onMessage = (event: MessageEvent) => {
		if (stopped || event.source !== window || event.origin !== location.origin)
			return;
		const parsed = NetflixRequestSchema.safeParse(event.data);
		if (!parsed.success) return;
		if (parsed.data.action === "cancel") {
			pending.get(parsed.data.id)?.();
			return;
		}
		if (pending.has(parsed.data.id) || pending.size >= 8) return;
		const request = parsed.data;
		let timer: ReturnType<typeof setInterval> | undefined;
		const finish = (result: Omit<NetflixResult, "source" | "id">) => {
			if (!pending.has(request.id)) return;
			if (timer !== undefined) clearInterval(timer);
			pending.delete(request.id);
			post({ source: NETFLIX_RESULT, id: request.id, ...result });
		};
		pending.set(request.id, () => finish({ ok: false }));
		const current = inspect();
		if (
			!current ||
			current.snapshot.movieId !== request.movieId ||
			(request.action !== "snapshot" &&
				current.snapshot.generation !== request.generation)
		) {
			finish({ ok: false, snapshot: null });
			return;
		}
		if (request.action === "snapshot") {
			finish({ ok: true, snapshot: current.snapshot });
			return;
		}
		if (request.action === "catalog") {
			const catalog = readNetflixCatalog(
				current.raw,
				request.movieId,
				current.snapshot.metadata.context,
			);
			finish(
				catalog
					? { ok: true, catalog, snapshot: current.snapshot }
					: { ok: false },
			);
			return;
		}
		try {
			// Identity is checked immediately before the one synchronous command.
			const result =
				request.action === "play"
					? current.binding.player.play()
					: request.action === "pause"
						? current.binding.player.pause()
						: current.binding.player.seek(
								Math.min(request.time!, current.snapshot.duration) * 1000,
							);
			// Consume provider rejections, but completion is always observed independently.
			if (result && typeof (result as PromiseLike<unknown>).then === "function")
				Promise.resolve(result).catch(() => finish({ ok: false }));
			const started = Date.now();
			timer = setInterval(() => {
				const next = inspect();
				if (!next || next.binding !== current.binding) {
					finish({ ok: false });
					return;
				}
				const completed =
					request.action === "seek"
						? Math.abs(
								next.snapshot.currentTime -
									Math.min(request.time!, next.snapshot.duration),
							) <= 1.25
						: next.snapshot.playing === (request.action === "play");
				if (completed) finish({ ok: true, snapshot: next.snapshot });
				else if (Date.now() - started >= 2500) finish({ ok: false });
			}, 80);
		} catch {
			finish({ ok: false });
		}
	};
	window.addEventListener("message", onMessage);
	const dispose = () => {
		if (stopped) return;
		stopped = true;
		window.removeEventListener("message", onMessage);
		window.removeEventListener("pagehide", dispose);
		for (const cancel of [...pending.values()]) cancel();
		invalidate();
	};
	window.addEventListener("pagehide", dispose);
	return dispose;
}
