/** Keep provider chrome hidden through focus/hover caused by removing the composer.
 * Release on the next player interaction without swallowing or replaying that event.
 */
export function installComposerQuietRelease(
	player: HTMLElement,
	overlay: HTMLElement,
	release: () => void,
	isOverlayShortcut: (event: KeyboardEvent) => boolean = () => false,
): () => void {
	const root = overlay.getRootNode() as Document | ShadowRoot;
	const boundary = "host" in root ? root.host : overlay;
	const belongsToOverlay = (event: Event) =>
		event
			.composedPath()
			.some((target) => target === boundary || target === overlay);
	let released = false;
	const releaseOnce = () => {
		if (released) return;
		released = true;
		cleanup();
		release();
	};
	const onPointer = (event: Event) => {
		if (!belongsToOverlay(event)) releaseOnce();
	};
	const onKey = (event: KeyboardEvent) => {
		if (
			event.isComposing ||
			event.keyCode === 229 ||
			belongsToOverlay(event) ||
			isOverlayShortcut(event)
		)
			return;
		// Enter/Alt+C reopen the composer; modifier presses alone do not control video.
		if (
			event.key === "Enter" ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			["Alt", "Control", "Meta", "Shift"].includes(event.key)
		)
			return;
		const target = event.target;
		if (
			target !== window.document.body &&
			target !== window.document.documentElement &&
			target !== window &&
			(!(target instanceof Node) || !player.contains(target))
		)
			return;
		releaseOnce();
	};
	const cleanup = () => {
		player.removeEventListener("pointermove", onPointer, true);
		player.removeEventListener("pointerdown", onPointer, true);
		window.removeEventListener("keydown", onKey, true);
	};
	player.addEventListener("pointermove", onPointer, true);
	player.addEventListener("pointerdown", onPointer, true);
	window.addEventListener("keydown", onKey, true);
	return cleanup;
}
