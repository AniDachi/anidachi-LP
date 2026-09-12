import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PixelRect } from "./overlay-layout-engine";
import type { PlayerOverlayInsets } from "./source-adapters/core/overlay-geometry";

export const CAMERA_INTERACTION_RELEASE_DELAY_MS = 360;
export const CAMERA_INTERACTION_APPROACH_TIMEOUT_MS = 720;

const OVERLAY_RECT_MAX_AGE_MS = 250;
const CAMERA_INTERACTION_GEOMETRY_SETTLE_MS = 240;
const CAMERA_INTERACTION_ACTIVE_PADDING_PX = 22;

interface CameraInteractionPlayerGeometry {
	controlsVisible: boolean;
	safeInsets: PlayerOverlayInsets;
}

interface UseCameraInteractionLockOptions {
	cameraRef: RefObject<HTMLElement | null>;
	enabled: boolean;
	interactionRect: PixelRect;
	overlayRef: RefObject<HTMLElement | null>;
	playerGeometry: CameraInteractionPlayerGeometry;
}

interface CameraInteractionLockState {
	locked: boolean;
	pinnedPlayerSafeInsets: PlayerOverlayInsets | null;
}

/**
 * Keeps camera controls stationary while the pointer crosses the camera's
 * adaptive travel path. Observation is passive: only the visible camera
 * controls remain interactive, so native player controls stay clickable.
 */
export function useCameraInteractionLock({
	cameraRef,
	enabled,
	interactionRect,
	overlayRef,
	playerGeometry,
}: UseCameraInteractionLockOptions): CameraInteractionLockState {
	const [locked, setLockedState] = useState(false);
	const [pinnedPlayerSafeInsets, setPinnedPlayerSafeInsets] =
		useState<PlayerOverlayInsets | null>(null);
	const enabledRef = useRef(enabled);
	const interactionRectRef = useRef(interactionRect);
	const playerGeometryRef = useRef(playerGeometry);
	const lockedRef = useRef(false);
	const cameraEngagedRef = useRef(false);
	const interactionArmedRef = useRef(true);
	const pointerInsideCameraRef = useRef(false);
	const pointerInsideCorridorRef = useRef(false);
	const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
	const overlayRectRef = useRef<DOMRect | null>(null);
	const overlayRectMeasuredAtRef = useRef(0);
	const releaseTimerRef = useRef<number | null>(null);
	const geometrySettleTimerRef = useRef<number | null>(null);

	enabledRef.current = enabled;
	interactionRectRef.current = interactionRect;
	playerGeometryRef.current = playerGeometry;

	const clearReleaseTimer = useCallback(() => {
		if (releaseTimerRef.current === null) {
			return;
		}
		window.clearTimeout(releaseTimerRef.current);
		releaseTimerRef.current = null;
	}, []);

	const clearGeometrySettleTimer = useCallback(() => {
		if (geometrySettleTimerRef.current === null) {
			return;
		}
		window.clearTimeout(geometrySettleTimerRef.current);
		geometrySettleTimerRef.current = null;
	}, []);

	const updatePinnedInsets = useCallback((next: PlayerOverlayInsets) => {
		setPinnedPlayerSafeInsets((current) =>
			current && equalInsets(current, next) ? current : { ...next },
		);
	}, []);

	const setLocked = useCallback(
		(nextLocked: boolean) => {
			if (lockedRef.current === nextLocked) {
				return;
			}
			lockedRef.current = nextLocked;
			setLockedState(nextLocked);
			if (nextLocked) {
				updatePinnedInsets(playerGeometryRef.current.safeInsets);
			} else {
				setPinnedPlayerSafeInsets(null);
			}
		},
		[updatePinnedInsets],
	);

	const unlock = useCallback(
		(disarmWhileInsideCorridor: boolean) => {
			clearReleaseTimer();
			cameraEngagedRef.current = false;
			pointerInsideCameraRef.current = false;
			if (disarmWhileInsideCorridor && pointerInsideCorridorRef.current) {
				interactionArmedRef.current = false;
			}
			setLocked(false);
		},
		[clearReleaseTimer, setLocked],
	);

	const release = useCallback(() => {
		clearReleaseTimer();
		pointerInsideCameraRef.current = false;
		pointerInsideCorridorRef.current = false;
		interactionArmedRef.current = true;
		unlock(false);
	}, [clearReleaseTimer, unlock]);

	const scheduleRelease = useCallback(
		(delayMs: number) => {
			if (!lockedRef.current || releaseTimerRef.current !== null) {
				return;
			}
			releaseTimerRef.current = window.setTimeout(() => {
				releaseTimerRef.current = null;
				if (!pointerInsideCameraRef.current) {
					unlock(true);
				}
			}, delayMs);
		},
		[unlock],
	);

	const updateOverlayRect = useCallback(() => {
		const overlay = overlayRef.current;
		if (!overlay) {
			overlayRectRef.current = null;
			return null;
		}

		const nextRect = overlay.getBoundingClientRect();
		overlayRectRef.current = nextRect;
		overlayRectMeasuredAtRef.current = Date.now();
		return nextRect;
	}, [overlayRef]);

	const invalidateOverlayRect = useCallback(() => {
		overlayRectRef.current = null;
		overlayRectMeasuredAtRef.current = 0;
	}, []);

	const evaluatePointer = useCallback(
		(clientX: number, clientY: number) => {
			lastPointerRef.current = { x: clientX, y: clientY };
			if (!enabledRef.current) {
				release();
				return;
			}

			const overlayRectIsStale =
				overlayRectRef.current === null ||
				Date.now() - overlayRectMeasuredAtRef.current >=
					OVERLAY_RECT_MAX_AGE_MS;
			const overlayRect = overlayRectIsStale
				? updateOverlayRect()
				: overlayRectRef.current;
			if (!overlayRect) {
				return;
			}

			const insideCorridor = pointInsideLocalRect(
				clientX - overlayRect.left,
				clientY - overlayRect.top,
				interactionRectRef.current,
			);
			const insideCamera = pointInsideVisibleCameraControls(
				clientX,
				clientY,
				cameraRef.current,
			);

			pointerInsideCorridorRef.current = insideCorridor;
			pointerInsideCameraRef.current = insideCamera;
			if (!insideCorridor) {
				interactionArmedRef.current = true;
			}
			if (insideCamera) {
				clearReleaseTimer();
				cameraEngagedRef.current = true;
				interactionArmedRef.current = true;
				setLocked(true);
				return;
			}
			if (lockedRef.current) {
				scheduleRelease(
					cameraEngagedRef.current
						? CAMERA_INTERACTION_RELEASE_DELAY_MS
						: CAMERA_INTERACTION_APPROACH_TIMEOUT_MS,
				);
				return;
			}
			if (insideCorridor && interactionArmedRef.current) {
				cameraEngagedRef.current = false;
				setLocked(true);
				scheduleRelease(CAMERA_INTERACTION_APPROACH_TIMEOUT_MS);
			}
		},
		[
			cameraRef,
			clearReleaseTimer,
			release,
			scheduleRelease,
			setLocked,
			updateOverlayRect,
		],
	);

	const handlePointerExit = useCallback(() => {
		lastPointerRef.current = null;
		pointerInsideCameraRef.current = false;
		pointerInsideCorridorRef.current = false;
		interactionArmedRef.current = true;
		scheduleRelease(CAMERA_INTERACTION_RELEASE_DELAY_MS);
	}, [scheduleRelease]);

	useEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			if (event.pointerType === "touch") {
				return;
			}
			evaluatePointer(event.clientX, event.clientY);
		};
		const handlePointerOut = (event: PointerEvent) => {
			if (
				event.relatedTarget === null &&
				!pointInsideViewport(event.clientX, event.clientY)
			) {
				handlePointerExit();
			}
		};

		window.addEventListener("pointermove", handlePointerMove, {
			capture: true,
			passive: true,
		});
		window.addEventListener("pointerout", handlePointerOut, {
			capture: true,
			passive: true,
		});
		window.addEventListener("blur", handlePointerExit);
		return () => {
			window.removeEventListener("pointermove", handlePointerMove, true);
			window.removeEventListener("pointerout", handlePointerOut, true);
			window.removeEventListener("blur", handlePointerExit);
		};
	}, [evaluatePointer, handlePointerExit]);

	useEffect(() => {
		updateOverlayRect();
		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(invalidateOverlayRect);
		if (overlayRef.current) {
			resizeObserver?.observe(overlayRef.current);
		}

		window.addEventListener("resize", invalidateOverlayRect);
		window.addEventListener("scroll", invalidateOverlayRect, true);
		document.addEventListener("fullscreenchange", invalidateOverlayRect);
		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener("resize", invalidateOverlayRect);
			window.removeEventListener("scroll", invalidateOverlayRect, true);
			document.removeEventListener("fullscreenchange", invalidateOverlayRect);
		};
	}, [invalidateOverlayRect, overlayRef, updateOverlayRect]);

	useEffect(() => {
		if (!enabled) {
			release();
			return;
		}
		if (lockedRef.current && playerGeometry.controlsVisible) {
			updatePinnedInsets(playerGeometry.safeInsets);
		}
		const pointer = lastPointerRef.current;
		if (pointer) {
			evaluatePointer(pointer.x, pointer.y);
		}
		clearGeometrySettleTimer();
		geometrySettleTimerRef.current = window.setTimeout(() => {
			geometrySettleTimerRef.current = null;
			const settledPointer = lastPointerRef.current;
			if (settledPointer) {
				evaluatePointer(settledPointer.x, settledPointer.y);
			}
		}, CAMERA_INTERACTION_GEOMETRY_SETTLE_MS);
	}, [
		clearGeometrySettleTimer,
		enabled,
		evaluatePointer,
		interactionRect.height,
		interactionRect.width,
		interactionRect.x,
		interactionRect.y,
		playerGeometry.controlsVisible,
		playerGeometry.safeInsets.bottomPx,
		playerGeometry.safeInsets.leftPx,
		playerGeometry.safeInsets.rightPx,
		playerGeometry.safeInsets.topPx,
		release,
		updatePinnedInsets,
	]);

	useEffect(
		() => () => {
			clearReleaseTimer();
			clearGeometrySettleTimer();
		},
		[clearGeometrySettleTimer, clearReleaseTimer],
	);

	return { locked, pinnedPlayerSafeInsets };
}

function pointInsideExpandedClientRect(
	clientX: number,
	clientY: number,
	rect: DOMRect,
	paddingPx: number,
): boolean {
	return (
		clientX >= rect.left - paddingPx &&
		clientX <= rect.right + paddingPx &&
		clientY >= rect.top - paddingPx &&
		clientY <= rect.bottom + paddingPx
	);
}

function pointInsideVisibleCameraControls(
	clientX: number,
	clientY: number,
	cameraContainer: HTMLElement | null,
): boolean {
	if (!cameraContainer) {
		return false;
	}
	return Array.from(cameraContainer.children).some((camera) =>
		pointInsideExpandedClientRect(
			clientX,
			clientY,
			camera.getBoundingClientRect(),
			CAMERA_INTERACTION_ACTIVE_PADDING_PX,
		),
	);
}

function pointInsideLocalRect(x: number, y: number, rect: PixelRect): boolean {
	return (
		rect.width > 0 &&
		rect.height > 0 &&
		x >= rect.x &&
		x <= rect.x + rect.width &&
		y >= rect.y &&
		y <= rect.y + rect.height
	);
}

function pointInsideViewport(clientX: number, clientY: number): boolean {
	return (
		clientX >= 0 &&
		clientX <= window.innerWidth &&
		clientY >= 0 &&
		clientY <= window.innerHeight
	);
}

function equalInsets(
	left: PlayerOverlayInsets,
	right: PlayerOverlayInsets,
): boolean {
	return (
		left.bottomPx === right.bottomPx &&
		left.leftPx === right.leftPx &&
		left.rightPx === right.rightPx &&
		left.topPx === right.topPx
	);
}
