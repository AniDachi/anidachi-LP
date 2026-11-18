import {
	boundedMessage,
	PRIME_NAVIGATING,
	PRIME_BINDING,
	PRIME_PLAYER,
	PRIME_PLAYER_STATE,
	PRIME_PLAYER_ENDED,
	PRIME_PLAYER_CLOSE_WINDOW_MS,
	PRIME_BINDING_CHANGED,
	PRIME_RESULT,
	PrimeRequestSchema,
	PrimeResultSchema,
	PrimeSnapshotSchema,
	type PrimeSnapshot,
	type PrimeRequest,
} from "./contract";
import { object } from "./metadata";
import { primeRouteMatches } from "./url";
import { callPrime, inspectPrimePlayer, inspectPrimePlayerLifecycle, inspectPrimeSdk, type PrimeSdk } from "./sdk";
import { loadPrimeCatalog, primeCatalogContext } from "./catalog";
import { readPrimeCatalogPage } from "./catalog-page";
type Binding = { sdk: PrimeSdk; generation: string; snapshot: PrimeSnapshot };
/** MAIN-world owner. Catalog I/O is limited to observed same-origin detail metadata. */
export function startPrimeBridge(): () => void {
	let navigating = false;
	let stopped = false,
		binding: Binding | null = null;
	let playerVideo: HTMLVideoElement | null = null;
	let playerRoot: HTMLElement | null = null;
	let endObserver: { root: HTMLElement; context: PrimeSdk["context"]; webPlayer: object; emitter: object; publishClose: () => void; stop: () => void } | null = null;
	const pending = new Map<string, AbortController>();
	const retired = new Set<string>();
	let catalogAttempt: {
		key: string;
		proof: string;
		settled: boolean;
		controller: AbortController;
		promise: ReturnType<typeof loadPrimeCatalog>;
	} | null = null;
	const catalogProof = () =>
		JSON.stringify(readPrimeCatalogPage(document, location.origin));
	const announce = () =>
		document.dispatchEvent(new Event(PRIME_BINDING_CHANGED));
	function setPlayer(video: HTMLVideoElement | null) {
		if (playerVideo === video) return;
		playerVideo?.removeAttribute(PRIME_PLAYER);
		playerVideo = video;
		video?.setAttribute(PRIME_PLAYER, "true");
		announce();
	}
	function invalidate(notify = true) {
		if (!binding) return;
		catalogAttempt?.controller.abort();
		binding.sdk.video.removeAttribute(PRIME_BINDING);
		binding = null;
		if (notify) announce();
	}
	function observePlayerEnd(lifecycle: ReturnType<typeof inspectPrimePlayerLifecycle>) {
		const { root, context } = lifecycle;
		const webPlayer = object(context?.webPlayer);
		const emitter = object(webPlayer.eventEmitter);
		if (endObserver?.root === root && endObserver.context === context && endObserver.webPlayer === webPlayer && endObserver.emitter === emitter) return;
		// The closed SDK can outlive its React root. Sample it once before release.
		if (!context) endObserver?.publishClose();
		endObserver?.stop();
		endObserver = null;
		if (!root || !context || typeof emitter.on !== "function" || typeof emitter.off !== "function") return;
		const on = emitter.on, off = emitter.off;
		const publishClose = () => {
			if (stopped || navigating || endObserver?.context !== context || endObserver.root !== root ||
				context.webPlayer !== webPlayer || webPlayer.eventEmitter !== emitter || webPlayer.isPlayerOpen !== false) return;
			const current = inspectPrimePlayerLifecycle();
			if ((current.root && current.root !== root) || (current.context && current.context !== context)) return;
			if (current.context === context && object(context.timeline).titleEnded === true)
				root.setAttribute(PRIME_PLAYER_ENDED, String(performance.now()));
			// Deliver before Amazon removes the root or reopens it for a different title.
			root.setAttribute(PRIME_PLAYER_STATE, "closed");
			announce();
		};
		const close = () => {
			if (webPlayer.isPlayerOpen === false) publishClose();
			else queueMicrotask(publishClose);
		};
		const stop = () => {
			root.removeAttribute(PRIME_PLAYER_ENDED);
			try { off.call(emitter, "Close", close); } catch { /* Retired SDK. */ }
		};
		try {
			on.call(emitter, "Close", close);
			endObserver = { root, context, webPlayer, emitter, publishClose, stop };
		} catch { stop(); }
	}
	function inspect(): Binding | null {
		if (stopped || navigating) return null;
		const lifecycle = inspectPrimePlayerLifecycle();
		if (playerRoot !== lifecycle.root) playerRoot?.removeAttribute(PRIME_PLAYER_STATE);
		playerRoot = lifecycle.root;
		observePlayerEnd(lifecycle);
		const endedAt = playerRoot?.getAttribute(PRIME_PLAYER_ENDED);
		if (lifecycle.open === true || (endedAt != null && performance.now() - Number(endedAt) > PRIME_PLAYER_CLOSE_WINDOW_MS))
			playerRoot?.removeAttribute(PRIME_PLAYER_ENDED);
		if (lifecycle.open === null) playerRoot?.removeAttribute(PRIME_PLAYER_STATE);
		else {
			const state = lifecycle.open ? "open" : "closed";
			if (playerRoot?.getAttribute(PRIME_PLAYER_STATE) !== state)
				playerRoot?.setAttribute(PRIME_PLAYER_STATE, state);
		}
		const player = inspectPrimePlayer(document, lifecycle);
		setPlayer(player?.video ?? null);
		const sdk = inspectPrimeSdk(document, player);
		if (!sdk) {
			invalidate();
			return null;
		}
		const changed =
			!binding ||
			binding.sdk.context !== sdk.context ||
			binding.sdk.webPlayer !== sdk.webPlayer ||
			binding.sdk.titleApi !== sdk.titleApi ||
			binding.sdk.timelineApi !== sdk.timelineApi ||
			binding.sdk.playerFacade !== sdk.playerFacade ||
			binding.sdk.playback !== sdk.playback ||
			binding.sdk.video !== sdk.video ||
			binding.snapshot.contentId !== sdk.snapshot.contentId ||
			(["content", "buffering"].includes(binding.snapshot.phase)
				? "main"
				: binding.snapshot.phase) !==
				(["content", "buffering"].includes(sdk.snapshot.phase)
					? "main"
					: sdk.snapshot.phase);
		const generation = changed ? crypto.randomUUID() : binding!.generation;
		const parsed = PrimeSnapshotSchema.safeParse({
			...sdk.snapshot,
			generation,
		});
		if (!parsed.success) {
			invalidate();
			return null;
		}
		if (
			binding &&
			primeCatalogContext(binding.snapshot) !== primeCatalogContext(parsed.data)
		)
			catalogAttempt?.controller.abort();
		if (changed) invalidate(false);
		binding = { sdk, generation, snapshot: parsed.data };
		if (
			catalogAttempt &&
			!catalogAttempt.settled &&
			catalogAttempt.proof !== catalogProof()
		)
			catalogAttempt.controller.abort();
		if (changed) {
			sdk.video.setAttribute(
				PRIME_BINDING,
				`${sdk.page.contentId}:${generation}`,
			);
			announce();
		}
		return binding;
	}
	const retire = (id: string) => {
		retired.add(id);
		if (retired.size > 256) retired.delete(retired.values().next().value!);
	};
	function current(request: PrimeRequest, expected?: Binding): Binding | null {
		const value = inspect();
		return value &&
			value.snapshot.contentId === request.contentId &&
			(!request.generation || value.generation === request.generation) &&
			(!expected || value.generation === expected.generation)
			? value
			: null;
	}
	const delay = (signal: AbortSignal) =>
		new Promise<void>((resolve) => {
			const finish = () => {
				clearTimeout(timer);
				signal.removeEventListener("abort", finish);
				resolve();
			};
			const timer = setTimeout(finish, 50);
			signal.addEventListener("abort", finish, { once: true });
		});
	async function run(request: PrimeRequest, abort: AbortController) {
		let result: {
			ok: boolean;
			error?: "autoplay-blocked";
			snapshot?: PrimeSnapshot;
			catalog?: PrimeSdk["page"]["catalog"];
		} = { ok: false };
		try {
			const initial = current(request);
			if (!initial || abort.signal.aborted) return;
			if (request.action === "snapshot")
				result = { ok: true, snapshot: initial.snapshot };
			else if (request.action === "catalog") {
				if (initial.snapshot.phase === "content" && initial.sdk.page.catalog) {
					const context = primeCatalogContext(initial.snapshot);
					const key = `${initial.generation}:${context}`;
					const proof = catalogProof();
					const fresh = () => {
						const value = current(request, initial);
						return (
							!!value &&
							value.snapshot.phase === "content" &&
							primeCatalogContext(value.snapshot) === context &&
							catalogProof() === proof
						);
					};
					if (catalogAttempt?.key !== key) {
						catalogAttempt?.controller.abort();
						const controller = new AbortController();
						const cancel = () => controller.abort();
						abort.signal.addEventListener("abort", cancel, { once: true });
						const attempt = {
							key,
							proof,
							settled: false,
							controller,
							promise: Promise.resolve(null) as ReturnType<
								typeof loadPrimeCatalog
							>,
						};
						catalogAttempt = attempt;
						attempt.promise = loadPrimeCatalog(
							initial.snapshot,
							controller.signal,
							fresh,
						).finally(() => {
							attempt.settled = true;
							abort.signal.removeEventListener("abort", cancel);
						});
					}
					if (catalogAttempt.proof !== proof) return;
					const catalog = await catalogAttempt.promise;
					if (!abort.signal.aborted && fresh())
						result = {
							ok: true,
							snapshot: current(request, initial)!.snapshot,
							catalog: catalog ?? initial.sdk.page.catalog,
						};
				}
			} else {
				const interstitial = request.action === "resume-interstitial";
				const expectedPhase = interstitial ? "interstitial" : "content";
				// Yield once so same-turn cancellation/disposal can fence a queued request.
				await delay(abort.signal);
				const before = current(request, initial);
				if (
					!before ||
					abort.signal.aborted ||
					before.snapshot.phase !== expectedPhase ||
					(request.expiresAt !== undefined && request.expiresAt <= Date.now())
				)
					return;
				if (request.action === "next-episode") {
					const next = before.sdk.page.nextEpisode;
					if (!next || next.compact !== request.targetContentId) return;
					const advertisedId = object(object(before.sdk.context.nextTitle).nextTitleInfo).titleId;
					if (advertisedId != null && (typeof advertisedId !== "string" || !primeRouteMatches(advertisedId, next))) return;
					const buttons = before.sdk.video.closest("#dv-web-player")?.querySelectorAll<HTMLButtonElement>(
						"button#atvwebplayersdk-next-episode-button",
					);
					const button = buttons?.length === 1 ? buttons[0] : null;
					if (!button || button.matches(":disabled") || button.closest('[hidden], [inert], [aria-disabled="true"]'))
						return;
					button.click();
					// Acknowledges only the click. The caller waits for the target binding.
					result = { ok: true, snapshot: before.snapshot };
					return;
				}
				if (
					request.action === "seek" &&
					(!before.sdk.seekAllowed || request.time! > before.snapshot.duration)
				)
					return;
				if (request.action === "pause" && !before.sdk.pauseAllowed) return;
				if (request.action === "rate" && !before.sdk.rateAllowed) return;
				if (!["play", "resume-interstitial", "pause", "seek", "rate"].includes(request.action)) return;
				// Call only after the last synchronous identity, phase and cancellation check.
				const returned =
					request.action === "rate"
						? callPrime(
								object(before.sdk.playback.player),
								"setPlaybackRate",
								request.rate!,
							)
						: request.action === "seek"
							? callPrime(before.sdk.playback, "seek", request.time! * 1000)
							: callPrime(before.sdk.playback, interstitial ? "play" : request.action);
				// SDK completion is not trusted as proof; consume rejection without awaiting an unbounded page promise.
				let autoplayBlocked = false;
				if (
					returned &&
					typeof (returned as PromiseLike<unknown>).then === "function"
				)
					Promise.resolve(returned).catch(error => {
						autoplayBlocked = (interstitial || request.action === "play") && error?.name === "NotAllowedError";
					});
				const until = Date.now() + 2000;
				while (!abort.signal.aborted && Date.now() < until) {
					const after = current(request, before);
					if (!after) break;
					if (autoplayBlocked) { result = {ok:false,error:"autoplay-blocked"}; break; }
					if (after.snapshot.phase === "buffering") {
						await delay(abort.signal);
						continue;
					}
					if (after.snapshot.phase !== expectedPhase) break;
					const confirmed =
						interstitial ? callPrime(after.sdk.playback, "getPlaybackState") === "Playing" : request.action === "rate"
							? Math.abs(after.snapshot.playbackRate - request.rate!) < 0.001
							: request.action === "seek"
								? Math.abs(after.snapshot.currentTime - request.time!) <= 1.25
								: request.action === "play"
									? after.snapshot.playing
									: !after.snapshot.playing;
					if (confirmed) {
						result = { ok: true, snapshot: after.snapshot };
						break;
					}
					await delay(abort.signal);
				}
			}
		} catch (error) {
			if ((request.action === "play" || request.action === "resume-interstitial") &&
				error instanceof Error && error.name === "NotAllowedError") result = {ok:false,error:"autoplay-blocked"};
			/* Undocumented API changes fail closed. */
		} finally {
			if (!stopped && !abort.signal.aborted) {
				const parsed = PrimeResultSchema.safeParse({
					source: PRIME_RESULT,
					id: request.id,
					...result,
				});
				if (parsed.success) window.postMessage(parsed.data, location.origin);
			}
			if (pending.get(request.id) === abort) pending.delete(request.id);
			retire(request.id);
		}
	}
	const navigate = () => {
		navigating = true;
		endObserver?.stop();
		endObserver = null;
		playerRoot?.removeAttribute(PRIME_PLAYER_STATE);
		setPlayer(null);
		catalogAttempt?.controller.abort();
		for (const abort of pending.values()) abort.abort();
		pending.clear();
		invalidate();
	};
	const listener = (event: MessageEvent) => {
		if (
			stopped ||
			event.source !== window ||
			event.origin !== location.origin ||
			!boundedMessage(event.data, 32)
		)
			return;
		const parsed = PrimeRequestSchema.safeParse(event.data);
		if (!parsed.success) return;
		const request = parsed.data;
		if (request.action === "cancel") {
			pending.get(request.id)?.abort();
			pending.delete(request.id);
			retire(request.id);
			return;
		}
		if (pending.has(request.id) || retired.has(request.id) || pending.size >= 8)
			return;
		const abort = new AbortController();
		pending.set(request.id, abort);
		void run(request, abort);
	};
	// Media signals cover native Next Episode with the same URL and video. The bounded
	// SDK poll also catches a paused title/context swap without a DOM mutation.
	const refresh = () => {
		inspect();
	};
	const events = [
		"timeupdate",
		"play",
		"pause",
		"loadedmetadata",
		"emptied",
		"loadstart",
	];
	for (const name of events) document.addEventListener(name, refresh, true);
	document.addEventListener(PRIME_NAVIGATING, navigate);
	window.addEventListener("message", listener);
	window.addEventListener("pagehide", stop);
	const timer = setInterval(refresh, 250);
	inspect();
	function stop() {
		if (stopped) return;
		stopped = true;
		endObserver?.stop();
		endObserver = null;
		playerRoot?.removeAttribute(PRIME_PLAYER_STATE);
		setPlayer(null);
		catalogAttempt?.controller.abort();
		clearInterval(timer);
		document.removeEventListener(PRIME_NAVIGATING, navigate);
		window.removeEventListener("message", listener);
		window.removeEventListener("pagehide", stop);
		for (const name of events)
			document.removeEventListener(name, refresh, true);
		for (const abort of pending.values()) abort.abort();
		pending.clear();
		retired.clear();
		invalidate();
	}
	return stop;
}
