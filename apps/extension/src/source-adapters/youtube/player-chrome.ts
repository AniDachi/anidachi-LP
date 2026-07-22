import {
	arePlayerOverlayGeometriesEqual,
	DEFAULT_PLAYER_OVERLAY_GEOMETRY,
	normalizePlayerOverlayGeometry,
	type PlayerOverlayGeometry,
	type PlayerOverlayGeometryListener,
} from "../core/overlay-geometry";

const YOUTUBE_BOTTOM_CHROME_SELECTORS = [
	".ytp-chrome-bottom",
	".ytp-progress-bar-container",
] as const;

const YOUTUBE_TOP_ACTION_SELECTORS = [
	".ytp-watch-later-button",
	".ytp-share-button",
	".ytp-chrome-top-buttons button",
] as const;

const YOUTUBE_TOP_CHROME_SELECTORS = [
	".ytp-chrome-top",
	".ytp-chrome-top-buttons",
	...YOUTUBE_TOP_ACTION_SELECTORS,
] as const;

const YOUTUBE_BOTTOM_FALLBACK_SELECTOR = [
	"button",
	"[role='button']",
	"[role='slider']",
	"[role='progressbar']",
	"input[type='range']",
	"progress",
].join(", ");
const YOUTUBE_TOP_FALLBACK_SELECTOR = "button, [role='button']";

const LAUNCHER_WIDTH_PX = 92;
const LAUNCHER_HEIGHT_PX = 32;
const PLAYER_MARGIN_PX = 10;
const LAUNCHER_GAP_PX = 8;
const VISIBILITY_SETTLE_DELAY_MS = 220;

export function getYouTubePlayerOverlayGeometry(
	container: HTMLElement,
): PlayerOverlayGeometry {
	const containerRect = container.getBoundingClientRect();
	if (!isUsableRect(containerRect)) {
		return DEFAULT_PLAYER_OVERLAY_GEOMETRY;
	}

	const visibleBottomChrome = getBottomChromeRects(
		container,
		containerRect,
		true,
	);
	const layoutBottomChrome = getBottomChromeRects(
		container,
		containerRect,
		false,
	);
	const launcher = getLauncherPosition(container, containerRect);

	return normalizePlayerOverlayGeometry({
		controlsVisible: visibleBottomChrome.length > 0,
		viewport: {
			widthPx: containerRect.width,
			heightPx: containerRect.height,
		},
		safeInsets: {
			topPx: 0,
			rightPx: 0,
			bottomPx: getBottomReservation(containerRect, layoutBottomChrome),
			leftPx: 0,
		},
		launcher,
		panel: {
			topPx: Math.max(48, launcher.topPx + 40),
			rightPx: PLAYER_MARGIN_PX,
		},
	});
}

export function subscribeYouTubePlayerOverlayGeometry(
	container: HTMLElement,
	listener: PlayerOverlayGeometryListener,
): () => void {
	let disposed = false;
	let animationFrame: number | null = null;
	let delayedMeasurement: number | null = null;
	let currentGeometry = getYouTubePlayerOverlayGeometry(container);
	const observedChromeRoots = new Set<Element>();
	const resizeObserver = new ResizeObserver(scheduleMeasurement);
	const mutationObserver = new MutationObserver(() => {
		if (disposed) {
			return;
		}

		refreshObservedChromeRoots();
		scheduleVisibilityMeasurement();
	});

	function refreshObservedChromeRoots(): void {
		const nextChromeRoots = new Set<Element>([
			container,
			...getYouTubeChromeRoots(container),
		]);

		for (const root of observedChromeRoots) {
			if (!nextChromeRoots.has(root)) {
				resizeObserver.unobserve(root);
				observedChromeRoots.delete(root);
			}
		}

		for (const root of nextChromeRoots) {
			if (!observedChromeRoots.has(root)) {
				observedChromeRoots.add(root);
				resizeObserver.observe(root);
			}
		}
	}

	function scheduleMeasurement(): void {
		if (disposed || animationFrame !== null) {
			return;
		}

		animationFrame = window.requestAnimationFrame(() => {
			animationFrame = null;
			const nextGeometry = getYouTubePlayerOverlayGeometry(container);
			if (arePlayerOverlayGeometriesEqual(currentGeometry, nextGeometry)) {
				return;
			}

			currentGeometry = nextGeometry;
			listener(nextGeometry);
		});
	}

	function scheduleVisibilityMeasurement(): void {
		if (disposed) {
			return;
		}

		scheduleMeasurement();
		if (delayedMeasurement !== null) {
			window.clearTimeout(delayedMeasurement);
		}
		delayedMeasurement = window.setTimeout(() => {
			delayedMeasurement = null;
			scheduleMeasurement();
		}, VISIBILITY_SETTLE_DELAY_MS);
	}

	refreshObservedChromeRoots();
	mutationObserver.observe(container, {
		attributes: true,
		attributeFilter: ["class", "style", "aria-hidden", "hidden"],
		childList: true,
		subtree: true,
	});
	container.addEventListener(
		"pointermove",
		scheduleVisibilityMeasurement,
		true,
	);
	container.addEventListener(
		"pointerleave",
		scheduleVisibilityMeasurement,
		true,
	);
	container.addEventListener(
		"transitionend",
		scheduleVisibilityMeasurement,
		true,
	);
	document.addEventListener("fullscreenchange", scheduleVisibilityMeasurement);
	scheduleMeasurement();

	return () => {
		if (disposed) {
			return;
		}

		disposed = true;
		mutationObserver.disconnect();
		resizeObserver.disconnect();
		container.removeEventListener(
			"pointermove",
			scheduleVisibilityMeasurement,
			true,
		);
		container.removeEventListener(
			"pointerleave",
			scheduleVisibilityMeasurement,
			true,
		);
		container.removeEventListener(
			"transitionend",
			scheduleVisibilityMeasurement,
			true,
		);
		document.removeEventListener(
			"fullscreenchange",
			scheduleVisibilityMeasurement,
		);
		if (animationFrame !== null) {
			window.cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}
		if (delayedMeasurement !== null) {
			window.clearTimeout(delayedMeasurement);
			delayedMeasurement = null;
		}
	};
}

function getYouTubeChromeRoots(container: HTMLElement): HTMLElement[] {
	return queryUniqueElements(container, [
		...YOUTUBE_BOTTOM_CHROME_SELECTORS,
		...YOUTUBE_TOP_CHROME_SELECTORS,
	]);
}

function getBottomChromeRects(
	container: HTMLElement,
	containerRect: DOMRect,
	respectOpacity: boolean,
): DOMRect[] {
	const knownElements = queryUniqueElements(
		container,
		YOUTUBE_BOTTOM_CHROME_SELECTORS,
	);
	if (knownElements.length > 0) {
		return getAvailableRects(
			knownElements,
			container,
			containerRect,
			respectOpacity,
		);
	}

	const bottomZoneTop = containerRect.top + containerRect.height * 0.7;
	return getAvailableRects(
		Array.from(
			container.querySelectorAll<HTMLElement>(YOUTUBE_BOTTOM_FALLBACK_SELECTOR),
		),
		container,
		containerRect,
		respectOpacity,
	).filter((rect) => {
		const centerY = rect.top + rect.height / 2;
		const isWholeOverlayRoot =
			rect.width > containerRect.width * 0.96 &&
			rect.height > containerRect.height * 0.45;
		return centerY >= bottomZoneTop && !isWholeOverlayRoot;
	});
}

function getBottomReservation(
	containerRect: DOMRect,
	chromeRects: DOMRect[],
): number {
	if (chromeRects.length === 0) {
		return 0;
	}

	const bottomChromeTop = Math.min(...chromeRects.map((rect) => rect.top));
	const maximum = Math.max(0, Math.min(180, containerRect.height - 72));
	const minimum = Math.min(54, maximum);
	return clampNumber(
		containerRect.bottom - bottomChromeTop + 18,
		minimum,
		maximum,
	);
}

function getLauncherPosition(
	container: HTMLElement,
	containerRect: DOMRect,
): PlayerOverlayGeometry["launcher"] {
	const knownActions = getAvailableRects(
		queryUniqueElements(container, YOUTUBE_TOP_ACTION_SELECTORS),
		container,
		containerRect,
		true,
	);
	const actionRects =
		knownActions.length > 0
			? knownActions
			: getFallbackTopActionRects(container, containerRect);

	if (actionRects.length === 0) {
		return { topPx: PLAYER_MARGIN_PX, rightPx: PLAYER_MARGIN_PX };
	}

	const cluster = getBoundingRect(actionRects);
	const maximumTop = Math.max(
		0,
		containerRect.height - LAUNCHER_HEIGHT_PX - PLAYER_MARGIN_PX,
	);
	const minimumTop = Math.min(PLAYER_MARGIN_PX, maximumTop);
	const roomToClusterLeft = cluster.left - containerRect.left;

	if (
		roomToClusterLeft >=
		PLAYER_MARGIN_PX + LAUNCHER_WIDTH_PX + LAUNCHER_GAP_PX
	) {
		return {
			topPx: clampNumber(
				cluster.top -
					containerRect.top +
					(cluster.height - LAUNCHER_HEIGHT_PX) / 2,
				minimumTop,
				maximumTop,
			),
			rightPx: Math.max(
				0,
				containerRect.right - cluster.left + LAUNCHER_GAP_PX,
			),
		};
	}

	return {
		topPx: clampNumber(
			cluster.bottom - containerRect.top + LAUNCHER_GAP_PX,
			minimumTop,
			maximumTop,
		),
		rightPx: PLAYER_MARGIN_PX,
	};
}

function getFallbackTopActionRects(
	container: HTMLElement,
	containerRect: DOMRect,
): DOMRect[] {
	const topZoneBottom = containerRect.top + containerRect.height * 0.25;
	const rightZoneStart = containerRect.right - containerRect.width * 0.45;

	return getAvailableRects(
		Array.from(
			container.querySelectorAll<HTMLElement>(YOUTUBE_TOP_FALLBACK_SELECTOR),
		),
		container,
		containerRect,
		true,
	).filter((rect) => {
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		return centerY <= topZoneBottom && centerX >= rightZoneStart;
	});
}

function queryUniqueElements(
	container: HTMLElement,
	selectors: readonly string[],
): HTMLElement[] {
	const elements = new Set<HTMLElement>();
	for (const selector of selectors) {
		for (const element of container.querySelectorAll<HTMLElement>(selector)) {
			elements.add(element);
		}
	}

	return Array.from(elements);
}

function getAvailableRects(
	elements: HTMLElement[],
	container: HTMLElement,
	containerRect: DOMRect,
	respectOpacity: boolean,
): DOMRect[] {
	return elements
		.map((element) =>
			getAvailableRect(element, container, containerRect, respectOpacity),
		)
		.filter((rect): rect is DOMRect => rect !== null);
}

function getAvailableRect(
	element: HTMLElement,
	container: HTMLElement,
	containerRect: DOMRect,
	respectOpacity: boolean,
): DOMRect | null {
	if (
		!container.contains(element) ||
		!isVisuallyAvailable(element, container, respectOpacity)
	) {
		return null;
	}

	const rect = element.getBoundingClientRect();
	if (!isUsableRect(rect) || !rectIntersects(rect, containerRect)) {
		return null;
	}

	return rect;
}

function isVisuallyAvailable(
	element: HTMLElement,
	container: HTMLElement,
	respectOpacity: boolean,
): boolean {
	let current: HTMLElement | null = element;
	let cumulativeOpacity = 1;

	while (current) {
		const style = getComputedStyle(current);
		if (
			style.display === "none" ||
			style.visibility === "hidden" ||
			style.visibility === "collapse"
		) {
			return false;
		}

		const opacity = Number.parseFloat(style.opacity || "1");
		if (Number.isFinite(opacity)) {
			cumulativeOpacity *= opacity;
		}

		if (current === container) {
			return !respectOpacity || cumulativeOpacity > 0.04;
		}
		if (respectOpacity && cumulativeOpacity <= 0.04) {
			return false;
		}

		current = current.parentElement;
	}

	return false;
}

function getBoundingRect(rects: DOMRect[]): DOMRect {
	const left = Math.min(...rects.map((rect) => rect.left));
	const top = Math.min(...rects.map((rect) => rect.top));
	const right = Math.max(...rects.map((rect) => rect.right));
	const bottom = Math.max(...rects.map((rect) => rect.bottom));

	return {
		bottom,
		height: bottom - top,
		left,
		right,
		top,
		width: right - left,
	} as DOMRect;
}

function isUsableRect(rect: DOMRect): boolean {
	return (
		Number.isFinite(rect.width) &&
		Number.isFinite(rect.height) &&
		rect.width > 1 &&
		rect.height > 1
	);
}

function rectIntersects(rect: DOMRect, containerRect: DOMRect): boolean {
	return (
		rect.right > containerRect.left &&
		rect.left < containerRect.right &&
		rect.bottom > containerRect.top &&
		rect.top < containerRect.bottom
	);
}

function clampNumber(value: number, minimum: number, maximum: number): number {
	if (!Number.isFinite(value)) {
		return minimum;
	}

	return Math.max(minimum, Math.min(maximum, value));
}
