import {
	arePlayerOverlayGeometriesEqual,
	DEFAULT_PLAYER_OVERLAY_GEOMETRY,
	normalizePlayerOverlayGeometry,
	type PlayerOverlayGeometry,
	type PlayerOverlayGeometryListener,
} from "../core/overlay-geometry";

// These are the native controls observed inside Netflix's watch-video root.
// Do not measure the full-size player surface, subtitles or AniDachi itself.
const TOP_SELECTOR = '[data-uia="control-nav-back"], [data-uia="control-flag"]';
const BOTTOM_SELECTOR = '[data-uia="controls-standard"]';
const CHROME_SELECTOR = `${TOP_SELECTOR}, ${BOTTOM_SELECTOR}`;
const MARGIN = 10;
const GAP = 8;
const LAUNCHER_WIDTH = 92;
const LAUNCHER_HEIGHT = 32;

export function getNetflixPlayerOverlayGeometry(
	container: HTMLElement,
): PlayerOverlayGeometry {
	const boundary = container.getBoundingClientRect();
	if (!usableRect(boundary)) return DEFAULT_PLAYER_OVERLAY_GEOMETRY;
	const top = visibleRects(container, boundary, TOP_SELECTOR);
	const bottom = visibleRects(container, boundary, BOTTOM_SELECTOR);
	const topInset = top.length
		? Math.max(...top.map((rect) => rect.bottom)) - boundary.top + GAP
		: 0;
	const bottomInset = bottom.length
		? boundary.bottom - Math.min(...bottom.map((rect) => rect.top)) + 18
		: 0;
	const topRight = top.filter(
		(rect) => rect.left + rect.width / 2 > boundary.left + boundary.width / 2,
	);
	let launcher = { topPx: MARGIN, rightPx: MARGIN };
	if (topRight.length) {
		const left = Math.min(...topRight.map((rect) => rect.left));
		const rowTop = Math.min(...topRight.map((rect) => rect.top));
		const rowBottom = Math.max(...topRight.map((rect) => rect.bottom));
		const availableLeft = Math.max(
			boundary.left + MARGIN,
			...top
				.filter((rect) => !topRight.includes(rect))
				.map((rect) => rect.right + GAP),
		);
		launcher =
			left - GAP - availableLeft >= LAUNCHER_WIDTH
				? {
						topPx: Math.max(
							MARGIN,
							rowTop -
								boundary.top +
								(rowBottom - rowTop - LAUNCHER_HEIGHT) / 2,
						),
						rightPx: boundary.right - left + GAP,
					}
				: { topPx: rowBottom - boundary.top + GAP, rightPx: MARGIN };
	}
	return normalizePlayerOverlayGeometry({
		controlsVisible: top.length > 0 || bottom.length > 0,
		viewport: { widthPx: boundary.width, heightPx: boundary.height },
		safeInsets: {
			topPx: topInset,
			rightPx: 0,
			bottomPx: bottomInset,
			leftPx: 0,
		},
		launcher,
		panel: {
			topPx: Math.max(48, launcher.topPx + 38, topInset),
			rightPx: MARGIN,
		},
	});
}

export function subscribeNetflixPlayerOverlayGeometry(
	container: HTMLElement,
	listener: PlayerOverlayGeometryListener,
): () => void {
	let disposed = false;
	let frame: number | null = null;
	let geometry = getNetflixPlayerOverlayGeometry(container);
	let roots = new Set<Element>();
	const resize = new ResizeObserver(schedule);
	const mutations = new MutationObserver((records) => {
		if (disposed) return;
		// Timeline progress and subtitle text change continuously. Only control
		// mounting/removal and visibility ancestors can change this geometry.
		const relevant = records.some((record) =>
			record.type === "childList"
				? [...record.addedNodes, ...record.removedNodes].some(
						(node) =>
							hasChrome(node) ||
							[...roots].some((root) => node === root || node.contains(root)),
					)
				: record.type === "attributes" &&
					record.target instanceof Element &&
					(record.target === container ||
						record.target.matches('[data-uia="player"]') ||
						record.target.matches(CHROME_SELECTOR) ||
						[...roots].some(
							(root) => record.target === root || record.target.contains(root),
						)),
		);
		if (!relevant) return;
		refreshRoots();
		schedule();
	});

	function refreshRoots() {
		const next = new Set<Element>(container.querySelectorAll(CHROME_SELECTOR));
		for (const root of roots) if (!next.has(root)) resize.unobserve(root);
		for (const root of next) if (!roots.has(root)) resize.observe(root);
		roots = next;
	}
	function schedule() {
		if (disposed || frame !== null) return;
		frame = window.requestAnimationFrame(() => {
			frame = null;
			if (disposed) return;
			const next = getNetflixPlayerOverlayGeometry(container);
			if (arePlayerOverlayGeometriesEqual(geometry, next)) return;
			geometry = next;
			listener(next);
		});
	}

	refreshRoots();
	resize.observe(container);
	mutations.observe(container, {
		attributes: true,
		attributeFilter: [
			"class",
			"style",
			"hidden",
			"aria-hidden",
			"data-uia",
			"data-anidachi-composer-open",
		],
		childList: true,
		subtree: true,
	});
	const events = [
		"pointermove",
		"pointerleave",
		"focusin",
		"transitionend",
		"transitioncancel",
		"animationend",
	] as const;
	for (const event of events) container.addEventListener(event, schedule, true);
	document.addEventListener("fullscreenchange", schedule);
	schedule();
	return () => {
		if (disposed) return;
		disposed = true;
		mutations.disconnect();
		resize.disconnect();
		if (frame !== null) window.cancelAnimationFrame(frame);
		for (const event of events)
			container.removeEventListener(event, schedule, true);
		document.removeEventListener("fullscreenchange", schedule);
	};
}

function hasChrome(node: Node): boolean {
	return (
		node instanceof Element &&
		(node.matches(CHROME_SELECTOR) ||
			node.querySelector(CHROME_SELECTOR) !== null)
	);
}

function visibleRects(
	container: HTMLElement,
	boundary: DOMRect,
	selector: string,
): DOMRect[] {
	const rects: DOMRect[] = [];
	for (const element of container.querySelectorAll<HTMLElement>(selector)) {
		let current: HTMLElement | null = element;
		let opacity = 1;
		let visible = true;
		while (current) {
			const style = getComputedStyle(current);
			opacity *= Number.parseFloat(style.opacity || "1");
			if (
				current.hidden ||
				current.getAttribute("aria-hidden") === "true" ||
				style.display === "none" ||
				style.visibility === "hidden" ||
				style.visibility === "collapse" ||
				opacity <= 0.04
			) {
				visible = false;
				break;
			}
			if (current === container) break;
			current = current.parentElement;
		}
		if (!visible) continue;
		const rect = element.getBoundingClientRect();
		if (
			usableRect(rect) &&
			rect.right > boundary.left &&
			rect.left < boundary.right &&
			rect.bottom > boundary.top &&
			rect.top < boundary.bottom
		)
			rects.push(rect);
	}
	return rects;
}

function usableRect(rect: DOMRect): boolean {
	return (
		[rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) &&
		rect.width > 1 &&
		rect.height > 1
	);
}
