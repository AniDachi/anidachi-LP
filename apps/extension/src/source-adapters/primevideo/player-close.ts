import {
	PRIME_NAVIGATING,
	PRIME_PLAYER,
	PRIME_PLAYER_STATE,
	PRIME_PLAYER_ENDED,
	PRIME_BINDING_CHANGED,
	readPrimeBinding,
} from "./contract";

/** ISOLATED world: a page-authored state/event alone can never request departure. */
export function subscribePrimePlayerClose(
	container: HTMLElement,
	video: HTMLVideoElement,
	listener: (event: Event) => void,
): () => void {
	let pending: { event: Event; contentId: string | null; natural?: boolean } | null = null;
	let observedOpen = container.getAttribute(PRIME_PLAYER_STATE) === "open";
	let timer: ReturnType<typeof setTimeout> | undefined;
	const cancel = () => {
		pending = null;
		clearTimeout(timer);
	};
	const check = () => {
		if (container.getAttribute(PRIME_PLAYER_STATE) === "open") observedOpen = true;
		if (!pending) return;
		const id = readPrimeBinding(video)?.contentId;
		if (
			!container.isConnected ||
			(id && pending.contentId && id !== pending.contentId)
		) {
			cancel();
			return;
		}
		if (container.getAttribute(PRIME_PLAYER_STATE) !== "closed") return;
		if (pending.natural && container.getAttribute(PRIME_PLAYER_ENDED) !== "true") return;
		const { event } = pending;
		cancel();
		observedOpen = false;
		listener(event);
	};
	const unloaded = (event: Event) => {
		// Native media unload plus SDK end+Close: neither page markup nor a
		// synthetic event alone may retire a room. Ads and source swaps unload too.
		if (!event.isTrusted || event.target !== video || !observedOpen || pending) return;
		pending = { event, contentId: readPrimeBinding(video)?.contentId ?? null, natural: true };
		timer = setTimeout(cancel, 1000);
		check();
	};
	const gesture = (event: Event) => {
		if (!event.isTrusted) return;
		cancel();
		const target = event.target;
		if (
			!(target instanceof Element) ||
			!container.contains(target) ||
			target.closest("anidachi-overlay-root") ||
			!video.isConnected ||
			video.getAttribute(PRIME_PLAYER) !== "true" ||
			container.getAttribute(PRIME_PLAYER_STATE) !== "open"
		)
			return;
		const button = target.closest("button#atvwebplayersdk-close-player-button");
		const closeClick =
			event.type === "click" &&
			button instanceof HTMLButtonElement &&
			!button.disabled;
		const escape =
			event instanceof KeyboardEvent &&
			event.key === "Escape" &&
			!event.repeat &&
			!event.altKey &&
			!event.ctrlKey &&
			!event.metaKey &&
			!document.fullscreenElement;
		if (!closeClick && !escape) return;
		pending = { event, contentId: readPrimeBinding(video)?.contentId ?? null };
		// SDK's existing 250ms observation confirms closure. No additional polling.
		timer = setTimeout(cancel, 1000);
	};
	const observer = new MutationObserver(check);
	observer.observe(container, {
		attributes: true,
		attributeFilter: [PRIME_PLAYER_STATE, PRIME_PLAYER_ENDED],
	});
	video.addEventListener("emptied", unloaded);
	document.addEventListener(PRIME_BINDING_CHANGED, check);
	document.addEventListener("click", gesture, true);
	document.addEventListener("keydown", gesture, true);
	document.addEventListener(PRIME_NAVIGATING, cancel);
	window.addEventListener("pagehide", cancel);
	return () => {
		cancel();
		observer.disconnect();
		video.removeEventListener("emptied", unloaded);
		document.removeEventListener(PRIME_BINDING_CHANGED, check);
		document.removeEventListener("click", gesture, true);
		document.removeEventListener("keydown", gesture, true);
		document.removeEventListener(PRIME_NAVIGATING, cancel);
		window.removeEventListener("pagehide", cancel);
	};
}
