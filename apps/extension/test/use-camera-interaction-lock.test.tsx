import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CAMERA_INTERACTION_APPROACH_TIMEOUT_MS,
	CAMERA_INTERACTION_RELEASE_DELAY_MS,
	useCameraInteractionLock,
} from "../src/use-camera-interaction-lock";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("camera interaction lock", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it("locks passively inside the camera travel area and releases only after a settled exit", async () => {
		const view = await renderHarness();

		await movePointer(850, 430);
		expect(readLocked(view.container)).toBe(true);

		await movePointer(500, 250);
		await advance(CAMERA_INTERACTION_RELEASE_DELAY_MS - 1);
		expect(readLocked(view.container)).toBe(true);

		await movePointer(850, 430);
		await advance(CAMERA_INTERACTION_RELEASE_DELAY_MS);
		expect(readLocked(view.container)).toBe(true);

		await movePointer(500, 250);
		await advance(CAMERA_INTERACTION_RELEASE_DELAY_MS);
		expect(readLocked(view.container)).toBe(false);

		await unmount(view.root);
	});

	it("releases when the pointer remains in the travel path but has left the actual camera", async () => {
		const view = await renderHarness();

		await movePointer(850, 430);
		expect(readLocked(view.container)).toBe(true);

		await movePointer(850, 500);
		await advance(CAMERA_INTERACTION_RELEASE_DELAY_MS);
		expect(readLocked(view.container)).toBe(false);

		await movePointer(850, 500);
		expect(readLocked(view.container)).toBe(false);

		await movePointer(500, 250);
		await movePointer(850, 500);
		expect(readLocked(view.container)).toBe(true);

		await unmount(view.root);
	});

	it("allows enough bridge time to reach the camera after adaptive movement", async () => {
		const view = await renderHarness();

		await movePointer(850, 500);
		expect(readLocked(view.container)).toBe(true);

		await advance(CAMERA_INTERACTION_APPROACH_TIMEOUT_MS - 1);
		expect(readLocked(view.container)).toBe(true);

		await movePointer(850, 430);
		await advance(CAMERA_INTERACTION_APPROACH_TIMEOUT_MS);
		expect(readLocked(view.container)).toBe(true);

		await unmount(view.root);
	});

	it("does not treat empty reserved camera slots as active camera controls", async () => {
		const view = await renderHarness();

		await movePointer(1050, 400);
		expect(readLocked(view.container)).toBe(true);

		await advance(CAMERA_INTERACTION_APPROACH_TIMEOUT_MS);
		expect(readLocked(view.container)).toBe(false);

		await unmount(view.root);
	});

	it("does not lock for touch movement or when no camera is visible", async () => {
		const view = await renderHarness();

		await movePointer(850, 430, "touch");
		expect(readLocked(view.container)).toBe(false);

		await view.rerender(false);
		await movePointer(850, 430);
		expect(readLocked(view.container)).toBe(false);

		await unmount(view.root);
	});

	it("keeps the last controls-visible inset while the user interacts", async () => {
		const view = await renderHarness();

		await view.rerender(true, true, 88);
		await movePointer(850, 430);
		expect(readBottomInset(view.container)).toBe(88);

		await view.rerender(true, false, 0);
		expect(readLocked(view.container)).toBe(true);
		expect(readBottomInset(view.container)).toBe(88);

		await movePointer(500, 250);
		await advance(CAMERA_INTERACTION_RELEASE_DELAY_MS);
		expect(readLocked(view.container)).toBe(false);
		expect(readBottomInset(view.container)).toBeNull();

		await unmount(view.root);
	});

	it("observes pointer movement without preventing player events", async () => {
		const listener = vi.fn();
		window.addEventListener("pointermove", listener);
		const view = await renderHarness();

		await movePointer(850, 430);

		expect(listener).toHaveBeenCalledOnce();
		expect(readLocked(view.container)).toBe(true);

		window.removeEventListener("pointermove", listener);
		await unmount(view.root);
	});
});

function Harness({
	bottomInsetPx = 0,
	controlsVisible = false,
	enabled = true,
}: {
	bottomInsetPx?: number;
	controlsVisible?: boolean;
	enabled?: boolean;
}) {
	const overlayRef = useRef<HTMLDivElement>(null);
	const cameraRef = useRef<HTMLDivElement>(null);
	const interaction = useCameraInteractionLock({
		cameraRef,
		enabled,
		interactionRect: { height: 180, width: 400, x: 780, y: 330 },
		overlayRef,
		playerGeometry: {
			controlsVisible,
			safeInsets: {
				bottomPx: bottomInsetPx,
				leftPx: 0,
				rightPx: 0,
				topPx: 0,
			},
		},
	});

	return (
		<div
			data-bottom-inset={
				interaction.pinnedPlayerSafeInsets?.bottomPx.toString() ?? ""
			}
			data-locked={interaction.locked ? "true" : "false"}
			ref={(element) => {
				overlayRef.current = element;
				if (element) {
					element.getBoundingClientRect = () => rect(20, 30, 1000, 600);
				}
			}}
		>
			<div
				ref={(element) => {
					cameraRef.current = element;
					if (element) {
						element.getBoundingClientRect = () => rect(800, 360, 400, 80);
					}
				}}
			>
				<span
					ref={(element) => {
						if (element) {
							element.getBoundingClientRect = () => rect(800, 360, 120, 80);
						}
					}}
				/>
			</div>
		</div>
	);
}

async function renderHarness(): Promise<{
	container: HTMLDivElement;
	rerender(
		enabled: boolean,
		controlsVisible?: boolean,
		bottomInsetPx?: number,
	): Promise<void>;
	root: Root;
}> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	await act(async () => root.render(<Harness />));
	return {
		container,
		root,
		async rerender(enabled, controlsVisible = false, bottomInsetPx = 0) {
			await act(async () =>
				root.render(
					<Harness
						bottomInsetPx={bottomInsetPx}
						controlsVisible={controlsVisible}
						enabled={enabled}
					/>,
				),
			);
		},
	};
}

async function movePointer(
	clientX: number,
	clientY: number,
	pointerType = "mouse",
): Promise<void> {
	await act(async () => {
		window.dispatchEvent(
			new PointerEvent("pointermove", { clientX, clientY, pointerType }),
		);
	});
}

async function advance(milliseconds: number): Promise<void> {
	await act(async () => vi.advanceTimersByTime(milliseconds));
}

async function unmount(root: Root): Promise<void> {
	await act(async () => root.unmount());
}

function readLocked(container: HTMLElement): boolean {
	return container.firstElementChild?.getAttribute("data-locked") === "true";
}

function readBottomInset(container: HTMLElement): number | null {
	const value = container.firstElementChild?.getAttribute("data-bottom-inset");
	return value ? Number(value) : null;
}

function rect(
	left: number,
	top: number,
	width: number,
	height: number,
): DOMRect {
	return {
		bottom: top + height,
		height,
		left,
		right: left + width,
		top,
		width,
		x: left,
		y: top,
		toJSON: () => ({}),
	} as DOMRect;
}
