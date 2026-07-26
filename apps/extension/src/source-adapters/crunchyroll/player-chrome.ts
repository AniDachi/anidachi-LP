import {
	arePlayerOverlayGeometriesEqual,
	normalizePlayerOverlayGeometry,
	type PlayerOverlayGeometry,
	type PlayerOverlayGeometryListener,
} from "../core/overlay-geometry";

export interface CrunchyrollPlayerChromeState {
	controlsVisible: boolean;
	camStackBottomPx: number;
	containerHeightPx: number;
	containerWidthPx: number;
	miniPanelRightPx: number;
	miniPanelTopPx: number;
	topBubbleRightPx: number;
	topBubbleTopPx: number;
}

export const DEFAULT_CAM_STACK_BOTTOM_PX = 54;
export const DEFAULT_TOP_BUBBLE_TOP_PX = 10;
export const DEFAULT_TOP_BUBBLE_RIGHT_PX = 10;
export const DEFAULT_MINI_PANEL_TOP_PX = 48;
export const DEFAULT_MINI_PANEL_RIGHT_PX = 10;
export const DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE: CrunchyrollPlayerChromeState =
	{
		controlsVisible: false,
		camStackBottomPx: DEFAULT_CAM_STACK_BOTTOM_PX,
		containerHeightPx: 0,
		containerWidthPx: 0,
		miniPanelRightPx: DEFAULT_MINI_PANEL_RIGHT_PX,
		miniPanelTopPx: DEFAULT_MINI_PANEL_TOP_PX,
		topBubbleRightPx: DEFAULT_TOP_BUBBLE_RIGHT_PX,
		topBubbleTopPx: DEFAULT_TOP_BUBBLE_TOP_PX,
	};

const CRUNCHYROLL_CONTROL_SELECTORS = [
	"[data-testid='player-controls-root']",
	"[data-testid='timeline-controls-container']",
	"[data-testid='settings-button']",
	"[data-testid='fullscreen-button']",
	"[data-testid='playback-speed-button']",
	"[data-testid='audio-subtitle-button']",
	"[data-testid='play-pause-button']",
	"[data-testid='timestamp']",
	"[data-testid*='player' i]",
	"[data-testid*='control' i]",
	"[data-testid*='settings' i]",
	"[data-testid*='fullscreen' i]",
	"button",
	"[role='button']",
	"[role='slider']",
	"input[type='range']",
];

const CRUNCHYROLL_CONTROL_SELECTOR = CRUNCHYROLL_CONTROL_SELECTORS.join(", ");

export function getCrunchyrollPlayerChromeState(
	container: HTMLElement,
): CrunchyrollPlayerChromeState {
	const containerRect = container.getBoundingClientRect();
	if (!isUsableRect(containerRect)) {
		return DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE;
	}

	const controlRects = getCrunchyrollControlRects(
		container,
		containerRect,
		true,
	);
	const layoutControlRects = getCrunchyrollControlRects(
		container,
		containerRect,
		false,
	);
	const timelineRect = getVisibleElementRect(
		container.querySelector<HTMLElement>(
			"[data-testid='timeline-controls-container']",
		),
		container,
		containerRect,
		true,
	);
	const controlsVisible = Boolean(timelineRect) || controlRects.length > 0;
	const topControlRects = getCrunchyrollTopControlRects(
		layoutControlRects.length ? layoutControlRects : controlRects,
		containerRect,
	);
	const topPosition = getCrunchyrollTopBubblePosition(
		containerRect,
		topControlRects,
		topControlRects.length > 0,
	);

	return {
		controlsVisible,
		camStackBottomPx: controlsVisible
			? getCrunchyrollCamStackBottom(containerRect, timelineRect, controlRects)
			: DEFAULT_CAM_STACK_BOTTOM_PX,
		containerHeightPx: Math.round(containerRect.height),
		containerWidthPx: Math.round(containerRect.width),
		...topPosition,
	};
}

export function getCrunchyrollPlayerOverlayGeometry(
	container: HTMLElement,
): PlayerOverlayGeometry {
	const state = getCrunchyrollPlayerChromeState(container);

	return normalizePlayerOverlayGeometry({
		controlsVisible: state.controlsVisible,
		viewport: {
			widthPx: state.containerWidthPx,
			heightPx: state.containerHeightPx,
		},
		safeInsets: {
			topPx: 0,
			rightPx: 0,
			bottomPx: state.controlsVisible ? state.camStackBottomPx : 0,
			leftPx: 0,
		},
		launcher: {
			topPx: state.topBubbleTopPx,
			rightPx: state.topBubbleRightPx,
		},
		panel: {
			topPx: state.miniPanelTopPx,
			rightPx: state.miniPanelRightPx,
		},
	});
}

export function subscribeCrunchyrollPlayerOverlayGeometry(
	container: HTMLElement,
	listener: PlayerOverlayGeometryListener,
): () => void {
	let disposed = false;
	let animationFrame: number | null = null;
	let currentGeometry = getCrunchyrollPlayerOverlayGeometry(container);
	const observedChromeRoots = new Set<Element>();
	const resizeObserver = new ResizeObserver(scheduleMeasurement);
	const mutationObserver = new MutationObserver(() => {
		refreshObservedChromeRoots();
		scheduleMeasurement();
	});

	function refreshObservedChromeRoots(): void {
		const nextChromeRoots = new Set<Element>([
			container,
			...getCrunchyrollChromeRoots(container),
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
			const nextGeometry = getCrunchyrollPlayerOverlayGeometry(container);
			if (arePlayerOverlayGeometriesEqual(currentGeometry, nextGeometry)) {
				return;
			}

			currentGeometry = nextGeometry;
			listener(nextGeometry);
		});
	}

	refreshObservedChromeRoots();
	mutationObserver.observe(container, {
		attributes: true,
		attributeFilter: ["class", "style", "aria-hidden", "hidden", "data-testid"],
		childList: true,
		subtree: true,
	});
	container.addEventListener("pointermove", scheduleMeasurement);
	container.addEventListener("pointerleave", scheduleMeasurement);
	container.addEventListener("transitionend", scheduleMeasurement);
	document.addEventListener("fullscreenchange", scheduleMeasurement);

	return () => {
		if (disposed) {
			return;
		}

		disposed = true;
		if (animationFrame !== null) {
			window.cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}
		mutationObserver.disconnect();
		resizeObserver.disconnect();
		container.removeEventListener("pointermove", scheduleMeasurement);
		container.removeEventListener("pointerleave", scheduleMeasurement);
		container.removeEventListener("transitionend", scheduleMeasurement);
		document.removeEventListener("fullscreenchange", scheduleMeasurement);
	};
}

export function areCrunchyrollPlayerChromeStatesEqual(
	left: CrunchyrollPlayerChromeState,
	right: CrunchyrollPlayerChromeState,
): boolean {
	return (
		left.controlsVisible === right.controlsVisible &&
		left.camStackBottomPx === right.camStackBottomPx &&
		left.containerHeightPx === right.containerHeightPx &&
		left.containerWidthPx === right.containerWidthPx &&
		left.miniPanelRightPx === right.miniPanelRightPx &&
		left.miniPanelTopPx === right.miniPanelTopPx &&
		left.topBubbleRightPx === right.topBubbleRightPx &&
		left.topBubbleTopPx === right.topBubbleTopPx
	);
}

function getCrunchyrollControlRects(
	container: HTMLElement,
	containerRect: DOMRect,
	respectOpacity: boolean,
): DOMRect[] {
	const controls = Array.from(
		container.querySelectorAll<HTMLElement>(
			CRUNCHYROLL_CONTROL_SELECTOR,
		),
	);

	return controls
		.map((element) =>
			getVisibleElementRect(element, container, containerRect, respectOpacity),
		)
		.filter((rect): rect is DOMRect => Boolean(rect))
		.filter((rect) => !isLikelyWholePlayerControlRoot(rect, containerRect));
}

function getCrunchyrollChromeRoots(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>(CRUNCHYROLL_CONTROL_SELECTOR),
	);
}

function getCrunchyrollTopControlRects(
	controlRects: DOMRect[],
	containerRect: DOMRect,
): DOMRect[] {
	const topZoneBottom =
		containerRect.top + Math.min(150, Math.max(96, containerRect.height * 0.2));
	const rightZoneStart =
		containerRect.right -
		Math.min(360, Math.max(180, containerRect.width * 0.4));

	return controlRects.filter(
		(rect) =>
			rect.top < topZoneBottom &&
			rect.bottom > containerRect.top &&
			rect.right > rightZoneStart &&
			rect.width >= 18 &&
			rect.width <= 104 &&
			rect.height >= 18 &&
			rect.height <= 104,
	);
}

function getCrunchyrollTopBubblePosition(
	containerRect: DOMRect,
	topControlRects: DOMRect[],
	controlsVisible: boolean,
): Pick<
	CrunchyrollPlayerChromeState,
	"miniPanelRightPx" | "miniPanelTopPx" | "topBubbleRightPx" | "topBubbleTopPx"
> {
	if (!controlsVisible || topControlRects.length === 0) {
		return {
			miniPanelRightPx: DEFAULT_MINI_PANEL_RIGHT_PX,
			miniPanelTopPx: DEFAULT_MINI_PANEL_TOP_PX,
			topBubbleRightPx: DEFAULT_TOP_BUBBLE_RIGHT_PX,
			topBubbleTopPx: DEFAULT_TOP_BUBBLE_TOP_PX,
		};
	}

	const margin = 10;
	const bubbleHeight = 30;
	const firstControl = [...topControlRects].sort((a, b) => a.top - b.top)[0];
	const firstCenterY = rectCenterY(firstControl);
	const rowRects = topControlRects.filter(
		(rect) => Math.abs(rectCenterY(rect) - firstCenterY) <= 34,
	);
	const rowTop = Math.min(...rowRects.map((rect) => rect.top));
	const rowBottom = Math.max(...rowRects.map((rect) => rect.bottom));
	const topBubbleTopPx = Math.round(
		clampNumber(
			rowTop - containerRect.top + (rowBottom - rowTop - bubbleHeight) / 2,
			margin,
			Math.max(margin, containerRect.height - bubbleHeight - margin),
		),
	);
	const topBubbleRightPx = margin;

	return {
		miniPanelRightPx: margin,
		miniPanelTopPx: Math.round(
			clampNumber(
				topBubbleTopPx + bubbleHeight + 8,
				DEFAULT_MINI_PANEL_TOP_PX,
				Math.max(DEFAULT_MINI_PANEL_TOP_PX, containerRect.height - 80),
			),
		),
		topBubbleRightPx,
		topBubbleTopPx,
	};
}

function getCrunchyrollCamStackBottom(
	containerRect: DOMRect,
	timelineRect: DOMRect | null,
	controlRects: DOMRect[],
): number {
	const lowerZoneTop =
		containerRect.bottom -
		Math.min(260, Math.max(120, containerRect.height * 0.28));
	const lowerControlRects = [timelineRect, ...controlRects].filter(
		(rect): rect is DOMRect => {
			if (!rect) {
				return false;
			}

			return (
				rect.top >= lowerZoneTop &&
				rect.bottom <= containerRect.bottom + 4 &&
				rect.width >= 18 &&
				rect.height >= 6
			);
		},
	);

	if (lowerControlRects.length === 0) {
		return 126;
	}

	const firstControlTop = Math.min(
		...lowerControlRects.map((rect) => rect.top),
	);
	const bottomPx = containerRect.bottom - firstControlTop + 18;
	return Math.round(
		clampNumber(bottomPx, 96, Math.min(220, containerRect.height - 72)),
	);
}

function getVisibleElementRect(
	element: HTMLElement | null,
	boundary: HTMLElement,
	boundaryRect: DOMRect,
	respectOpacity: boolean,
): DOMRect | null {
	if (
		!element ||
		!isElementVisuallyAvailable(element, boundary, respectOpacity)
	) {
		return null;
	}

	const rect = element.getBoundingClientRect();
	if (!isUsableRect(rect) || !rectIntersects(rect, boundaryRect)) {
		return null;
	}

	return rect;
}

function isElementVisuallyAvailable(
	element: HTMLElement,
	boundary: HTMLElement,
	respectOpacity: boolean,
): boolean {
	let current: HTMLElement | null = element;
	let opacity = 1;

	while (current) {
		const style = getComputedStyle(current);
		if (
			style.display === "none" ||
			style.visibility === "hidden" ||
			style.visibility === "collapse"
		) {
			return false;
		}

		const nextOpacity = Number.parseFloat(style.opacity || "1");
		if (Number.isFinite(nextOpacity)) {
			opacity *= nextOpacity;
		}

		if (current === boundary || (respectOpacity && opacity <= 0.04)) {
			break;
		}

		current = current.parentElement;
	}

	return !respectOpacity || opacity > 0.04;
}

function isUsableRect(rect: DOMRect): boolean {
	return (
		Number.isFinite(rect.width) &&
		Number.isFinite(rect.height) &&
		rect.width > 1 &&
		rect.height > 1
	);
}

function rectIntersects(rect: DOMRect, boundary: DOMRect): boolean {
	return (
		rect.right > boundary.left &&
		rect.left < boundary.right &&
		rect.bottom > boundary.top &&
		rect.top < boundary.bottom
	);
}

function isLikelyWholePlayerControlRoot(
	rect: DOMRect,
	boundary: DOMRect,
): boolean {
	return (
		rect.width >= boundary.width * 0.84 &&
		rect.height >= boundary.height * 0.62 &&
		rect.top <= boundary.top + 24
	);
}

function rectCenterY(rect: DOMRect): number {
	return rect.top + rect.height / 2;
}

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) {
		return min;
	}

	return Math.max(min, Math.min(max, value));
}
