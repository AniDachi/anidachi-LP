import {
	boundedMessage,
	PRIME_NAVIGATING,
	PRIME_BINDING,
	PRIME_PLAYER,
	PRIME_PLAYER_STATE,
	PRIME_BINDING_CHANGED,
	PRIME_RESULT,
	PrimeRequestSchema,
	PrimeResultSchema,
	PrimeSnapshotSchema,
	type PrimeSnapshot,
	type PrimeRequest,
} from "./contract";
import { object } from "./metadata";
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
	function inspect(): Binding | null {
		if (stopped || navigating) return null;
		const lifecycle = inspectPrimePlayerLifecycle();
		if (playerRoot !== lifecycle.root) playerRoot?.removeAttribute(PRIME_PLAYER_STATE);
		playerRoot = lifecycle.root;
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
				// Yield once so same-turn cancellation/disposal can fence a queued request.
				await delay(abort.signal);
				const before = current(request, initial);
				if (
					!before ||
					abort.signal.aborted ||
					before.snapshot.phase !== "content" ||
					(request.expiresAt !== undefined && request.expiresAt <= Date.now())
				)
					return;
				if (
					request.action === "seek" &&
					(!before.sdk.seekAllowed || request.time! > before.snapshot.duration)
				)
					return;
				if (request.action === "pause" && !before.sdk.pauseAllowed) return;
				if (request.action === "rate" && !before.sdk.rateAllowed) return;
				if (!["play", "pause", "seek", "rate"].includes(request.action)) return;
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
							: callPrime(before.sdk.playback, request.action);
				// SDK completion is not trusted as proof; consume rejection without awaiting an unbounded page promise.
				if (
					returned &&
					typeof (returned as PromiseLike<unknown>).then === "function"
				)
					Promise.resolve(returned).catch(() => undefined);
				const until = Date.now() + 2000;
				while (!abort.signal.aborted && Date.now() < until) {
					const after = current(request, before);
					if (!after) break;
					if (after.snapshot.phase === "buffering") {
						await delay(abort.signal);
						continue;
					}
					if (after.snapshot.phase !== "content") break;
					const confirmed =
						request.action === "rate"
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
		} catch {
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
