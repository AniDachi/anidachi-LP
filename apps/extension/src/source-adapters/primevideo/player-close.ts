import {
	PRIME_NAVIGATING,
	PRIME_PLAYER,
	PRIME_PLAYER_STATE,
	readPrimeBinding,
} from "./contract";

/** ISOLATED world: a page-authored state/event alone can never request departure. */
export function subscribePrimePlayerClose(
	container: HTMLElement,
	video: HTMLVideoElement,
	listener: (event: Event) => void,
): () => void {
	let pending: { event: Event; contentId: string | null } | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const cancel = () => {
		pending = null;
		clearTimeout(timer);
	};
	const check = () => {
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
		const { event } = pending;
		cancel();
		listener(event);
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
		attributeFilter: [PRIME_PLAYER_STATE],
	});
	document.addEventListener("click", gesture, true);
	document.addEventListener("keydown", gesture, true);
	document.addEventListener(PRIME_NAVIGATING, cancel);
	window.addEventListener("pagehide", cancel);
	return () => {
		cancel();
		observer.disconnect();
		document.removeEventListener("click", gesture, true);
		document.removeEventListener("keydown", gesture, true);
		document.removeEventListener(PRIME_NAVIGATING, cancel);
		window.removeEventListener("pagehide", cancel);
	};
}
