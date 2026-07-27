import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE } from "../src/overlay-interaction-boundary";
import {
	ParticipantAudioContourControl,
	ParticipantAudioInlineControl,
} from "../src/participant-audio-controls";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("participant audio controls", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("maps the inline slider to one remote participant preference", async () => {
		const onChange = vi.fn();
		const view = await render(
			<ParticipantAudioInlineControl
				displayName="Remote User"
				onChange={onChange}
				preference={{ muted: true, volume: 0.4 }}
			/>,
		);

		const slider = view.container.querySelector<HTMLInputElement>(
			'input[type="range"]',
		);
		expect(slider?.value).toBe("0");
		expect(slider?.getAttribute("aria-label")).toBe("Remote User volume");
		expect(
			view.container
				.querySelector(".participant-audio-inline-control")
				?.getAttribute(OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE),
		).toBe("true");

		await setRangeValue(slider, "55");
		expect(onChange).toHaveBeenLastCalledWith({
			muted: false,
			volume: 0.55,
		});

		await unmount(view.root);
	});

	it("mutes and restores the last audible inline volume", async () => {
		const onChange = vi.fn();
		const view = await render(
			<ParticipantAudioInlineControl
				displayName="Remote User"
				onChange={onChange}
				preference={{ muted: false, volume: 0.4 }}
			/>,
		);

		await click(getButton(view.container, "Mute Remote User"));
		expect(onChange).toHaveBeenLastCalledWith({
			muted: true,
			volume: 0.4,
		});

		await unmount(view.root);

		const restored = await render(
			<ParticipantAudioInlineControl
				displayName="Remote User"
				onChange={onChange}
				preference={{ muted: true, volume: 0.4 }}
			/>,
		);
		await click(getButton(restored.container, "Unmute Remote User"));
		expect(onChange).toHaveBeenLastCalledWith({
			muted: false,
			volume: 0.4,
		});
		await unmount(restored.root);
	});

	it("exposes the video contour as an accessible keyboard slider", async () => {
		const onChange = vi.fn();
		const view = await render(
			<ParticipantAudioContourControl
				displayName="Remote User"
				onChange={onChange}
				preference={{ muted: false, volume: 0.5 }}
			/>,
		);

		const slider = view.container.querySelector<HTMLElement>('[role="slider"]');
		expect(slider?.getAttribute("aria-valuemin")).toBe("0");
		expect(slider?.getAttribute("aria-valuemax")).toBe("100");
		expect(slider?.getAttribute("aria-valuenow")).toBe("50");
		expect(slider?.getAttribute("aria-label")).toBe("Remote User volume");

		await keyDown(slider, "ArrowRight");
		expect(onChange).toHaveBeenLastCalledWith({
			muted: false,
			volume: 0.55,
		});

		await keyDown(slider, "Home");
		expect(onChange).toHaveBeenLastCalledWith({
			muted: true,
			volume: 0.5,
		});

		await unmount(view.root);
	});

	it("starts and always ends a captured contour adjustment", async () => {
		const onAdjustmentStart = vi.fn();
		const onAdjustmentEnd = vi.fn();
		const onChange = vi.fn();
		const view = await render(
			<ParticipantAudioContourControl
				displayName="Remote User"
				onAdjustmentEnd={onAdjustmentEnd}
				onAdjustmentStart={onAdjustmentStart}
				onChange={onChange}
				preference={{ muted: false, volume: 0.5 }}
			/>,
		);
		const slider = view.container.querySelector<HTMLElement>('[role="slider"]');
		if (!slider) {
			throw new Error("Contour slider missing");
		}
		vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({
			bottom: 100,
			height: 100,
			left: 0,
			right: 100,
			top: 0,
			width: 100,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		});
		Object.defineProperty(slider, "setPointerCapture", {
			configurable: true,
			value: vi.fn(),
		});
		Object.defineProperty(slider, "releasePointerCapture", {
			configurable: true,
			value: vi.fn(),
		});

		await pointer(slider, "pointerdown", {
			clientX: 50,
			clientY: 2,
			isPrimary: true,
			pointerId: 7,
		});
		expect(onAdjustmentStart).toHaveBeenCalledOnce();
		expect(onChange).toHaveBeenCalled();

		await pointer(slider, "pointercancel", { pointerId: 7 });
		expect(onAdjustmentEnd).toHaveBeenCalledOnce();

		await unmount(view.root);
	});

	it("ends an inline adjustment if the control unmounts during pointer capture", async () => {
		const onAdjustmentStart = vi.fn();
		const onAdjustmentEnd = vi.fn();
		const view = await render(
			<ParticipantAudioInlineControl
				displayName="Remote User"
				onAdjustmentEnd={onAdjustmentEnd}
				onAdjustmentStart={onAdjustmentStart}
				onChange={vi.fn()}
				preference={{ muted: false, volume: 0.5 }}
			/>,
		);
		const slider = view.container.querySelector<HTMLInputElement>(
			'input[type="range"]',
		);
		if (!slider) {
			throw new Error("Inline slider missing");
		}
		Object.defineProperty(slider, "setPointerCapture", {
			configurable: true,
			value: vi.fn(),
		});

		await pointer(slider, "pointerdown", {
			button: 0,
			isPrimary: true,
			pointerId: 9,
		});
		expect(onAdjustmentStart).toHaveBeenCalledOnce();

		await unmount(view.root);
		expect(onAdjustmentEnd).toHaveBeenCalledOnce();
	});
});

async function render(element: ReactNode) {
	const container = document.createElement("div");
	document.body.append(container);
	const root: Root = createRoot(container);
	await act(async () => root.render(element));
	return { container, root };
}

async function unmount(root: Root) {
	await act(async () => root.unmount());
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
	const button = [
		...container.querySelectorAll<HTMLButtonElement>("button"),
	].find((item) => item.getAttribute("aria-label") === label);
	if (!button) {
		throw new Error(`Button not found: ${label}`);
	}
	return button;
}

async function click(button: HTMLButtonElement) {
	await act(async () => {
		button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	});
}

async function setRangeValue(input: HTMLInputElement | null, value: string) {
	if (!input) {
		throw new Error("Range input missing");
	}
	await act(async () => {
		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		valueSetter?.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	});
}

async function keyDown(element: HTMLElement | null, key: string) {
	if (!element) {
		throw new Error("Keyboard target missing");
	}
	await act(async () => {
		element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
	});
}

async function pointer(
	element: HTMLElement,
	type: string,
	init: PointerEventInit,
) {
	await act(async () => {
		element.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
	});
}
