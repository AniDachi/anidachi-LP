import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE } from "../src/overlay-interaction-boundary";
import { VoiceSettingsPanel } from "../src/overlay-voice-controls";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("VoiceSettingsPanel", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("renders only the two mutually exclusive microphone modes", async () => {
		const onModeChange = vi.fn();
		const view = await render(
			<VoiceSettingsPanel mode="push-to-talk" onModeChange={onModeChange} />,
		);

		const panel = view.container.querySelector(".voice-settings-panel");
		const pushToTalk = getButton(view.container, "Push to talk");
		const openMic = getButton(view.container, "Open mic");

		expect(panel?.getAttribute(OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE)).toBe("true");
		expect(
			pushToTalk.closest('[role="radiogroup"]')?.getAttribute("aria-label"),
		).toBe("Microphone mode");
		expect(
			pushToTalk.closest('[role="radiogroup"]')?.getAttribute("data-state"),
		).toBe("first");
		expect(pushToTalk.getAttribute("role")).toBe("radio");
		expect(pushToTalk.getAttribute("aria-checked")).toBe("true");
		expect(openMic.getAttribute("aria-checked")).toBe("false");
		expect(view.container.querySelector(".voice-settings-status")).toBeNull();
		expect(view.container.textContent).not.toContain("Dictate reactions");

		await click(openMic);
		expect(onModeChange).toHaveBeenCalledWith("open-mic");
		expect(onModeChange).toHaveBeenCalledTimes(1);

		await act(async () => {
			view.root.render(
				<VoiceSettingsPanel mode="open-mic" onModeChange={onModeChange} />,
			);
		});
		expect(
			getButton(view.container, "Open mic")
				.closest('[role="radiogroup"]')
				?.getAttribute("data-state"),
		).toBe("second");

		await unmount(view.root);
	});

	it("supports arrow-key navigation as one keyboard radio group", async () => {
		const onModeChange = vi.fn();
		const view = await render(
			<VoiceSettingsPanel mode="push-to-talk" onModeChange={onModeChange} />,
		);
		const pushToTalk = getButton(view.container, "Push to talk");
		const openMic = getButton(view.container, "Open mic");

		expect(pushToTalk.tabIndex).toBe(0);
		expect(openMic.tabIndex).toBe(-1);
		pushToTalk.focus();
		await keyboard(pushToTalk, "keydown", { key: "ArrowRight" });

		expect(onModeChange).toHaveBeenCalledWith("open-mic");
		expect(document.activeElement).toBe(openMic);

		await unmount(view.root);
	});

	it("renders exception-only feedback without adding another microphone control", async () => {
		const view = await render(
			<VoiceSettingsPanel
				feedback="Microphone access was denied."
				mode="push-to-talk"
				onModeChange={vi.fn()}
			/>,
		);

		expect(view.container.querySelectorAll("button")).toHaveLength(2);
		expect(view.container.textContent).toContain(
			"Microphone access was denied.",
		);

		await unmount(view.root);
	});
});

interface RenderedView {
	container: HTMLDivElement;
	root: Root;
}

async function render(node: ReactNode): Promise<RenderedView> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	await act(async () => {
		root.render(node);
	});
	return { container, root };
}

async function click(button: HTMLButtonElement): Promise<void> {
	await act(async () => {
		button.click();
	});
}

async function keyboard(
	button: HTMLButtonElement,
	type: string,
	init: KeyboardEventInit,
): Promise<void> {
	await act(async () => {
		button.dispatchEvent(
			new KeyboardEvent(type, {
				bubbles: true,
				cancelable: true,
				...init,
			}),
		);
	});
}

function getButton(container: HTMLElement, name: string): HTMLButtonElement {
	const button = [...container.querySelectorAll("button")].find(
		(candidate) =>
			candidate.getAttribute("aria-label") === name ||
			candidate.textContent?.trim() === name,
	);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Button not found: ${name}`);
	}
	return button;
}

async function unmount(root: Root): Promise<void> {
	await act(async () => {
		root.unmount();
	});
}
