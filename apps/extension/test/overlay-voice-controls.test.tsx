import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE } from "../src/overlay-interaction-boundary";
import {
	PanelMicrophoneControl,
	VoiceSettingsPanel,
} from "../src/overlay-voice-controls";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("PanelMicrophoneControl", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("publishes only while a primary pointer is held in Push to talk mode", async () => {
		const onPushToTalkChange = vi.fn();
		const view = await renderPanel({
			onPushToTalkChange,
		});
		const button = getButton(view.container, "Hold to talk");

		await pointer(button, "pointerdown", {
			button: 0,
			isPrimary: true,
			pointerId: 7,
		});
		expect(onPushToTalkChange).toHaveBeenLastCalledWith(true);

		await pointer(button, "pointerup", {
			button: 0,
			isPrimary: true,
			pointerId: 7,
		});
		expect(onPushToTalkChange.mock.calls).toEqual([[true], [false]]);

		await unmount(view.root);
	});

	it("ignores non-primary pointers and auxiliary buttons", async () => {
		const onPushToTalkChange = vi.fn();
		const view = await renderPanel({
			onPushToTalkChange,
		});
		const button = getButton(view.container, "Hold to talk");

		await pointer(button, "pointerdown", {
			button: 0,
			isPrimary: false,
			pointerId: 7,
		});
		await pointer(button, "pointerdown", {
			button: 1,
			isPrimary: true,
			pointerId: 8,
		});

		expect(onPushToTalkChange).not.toHaveBeenCalled();
		await unmount(view.root);
	});

	it.each([
		"pointercancel",
		"lostpointercapture",
	] as const)("stops Push to talk on %s without a duplicate release", async (eventName) => {
		const onPushToTalkChange = vi.fn();
		const view = await renderPanel({
			onPushToTalkChange,
		});
		const button = getButton(view.container, "Hold to talk");

		await pointer(button, "pointerdown", {
			button: 0,
			isPrimary: true,
			pointerId: 11,
		});
		await pointer(button, eventName, {
			button: 0,
			isPrimary: true,
			pointerId: 11,
		});
		await pointer(button, "lostpointercapture", {
			button: 0,
			isPrimary: true,
			pointerId: 11,
		});

		expect(onPushToTalkChange.mock.calls).toEqual([[true], [false]]);
		await unmount(view.root);
	});

	it.each([
		" ",
		"Enter",
	])("supports focused %s key hold without treating the generated click as a toggle", async (key) => {
		const onOpenMicChange = vi.fn();
		const onPushToTalkChange = vi.fn();
		const view = await renderPanel({
			onOpenMicChange,
			onPushToTalkChange,
		});
		const button = getButton(view.container, "Hold to talk");
		button.focus();

		await keyboard(button, "keydown", { key });
		await keyboard(button, "keydown", { key, repeat: true });
		await keyboard(button, "keyup", { key });
		await click(button);

		expect(onPushToTalkChange.mock.calls).toEqual([[true], [false]]);
		expect(onOpenMicChange).not.toHaveBeenCalled();
		await unmount(view.root);
	});

	it("uses switch semantics and click toggling in Open mic mode", async () => {
		const onOpenMicChange = vi.fn();
		const view = await renderPanel({
			mode: "open-mic",
			onOpenMicChange,
		});
		let button = getButton(view.container, "Turn microphone on");

		expect(button.getAttribute("role")).toBe("switch");
		expect(button.getAttribute("aria-checked")).toBe("false");
		await click(button);
		expect(onOpenMicChange).toHaveBeenLastCalledWith(true);

		await view.rerender(
			<PanelMicrophoneControl
				{...panelProps({
					microphoneEnabled: true,
					mode: "open-mic",
					onOpenMicChange,
				})}
			/>,
		);
		button = getButton(view.container, "Turn microphone off");
		expect(button.getAttribute("aria-checked")).toBe("true");
		await click(button);
		expect(onOpenMicChange).toHaveBeenLastCalledWith(false);

		await unmount(view.root);
	});

	it("distinguishes enabled but quiet Open mic from active speech", async () => {
		const view = await renderPanel({
			microphoneEnabled: true,
			mode: "open-mic",
			speaking: false,
		});
		let button = getButton(view.container, "Turn microphone off");

		expect(button.classList.contains("enabled")).toBe(true);
		expect(button.classList.contains("speaking")).toBe(false);

		await view.rerender(
			<PanelMicrophoneControl
				{...panelProps({
					microphoneEnabled: true,
					mode: "open-mic",
					speaking: true,
				})}
			/>,
		);
		button = getButton(view.container, "Turn microphone off");
		expect(button.classList.contains("enabled")).toBe(true);
		expect(button.classList.contains("speaking")).toBe(true);

		await unmount(view.root);
	});

	it("remains visible but unavailable without a media seat", async () => {
		const onOpenMicChange = vi.fn();
		const onPushToTalkChange = vi.fn();
		const view = await renderPanel({
			available: false,
			disabledReason: "Join a media seat to use voice.",
			onOpenMicChange,
			onPushToTalkChange,
		});
		const button = getButton(view.container, "Microphone unavailable");

		expect(button.disabled).toBe(true);
		expect(button.title).toBe("Join a media seat to use voice.");
		expect(button.classList.contains("unavailable")).toBe(true);
		expect(button.getAttribute(OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE)).toBe("true");
		await pointer(button, "pointerdown", { button: 0, pointerId: 3 });
		await click(button);
		expect(onPushToTalkChange).not.toHaveBeenCalled();
		expect(onOpenMicChange).not.toHaveBeenCalled();

		await unmount(view.root);
	});
});

describe("VoiceSettingsPanel", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("changes the preferred mode without exposing a capture action", async () => {
		const onModeChange = vi.fn();
		const view = await render(
			<VoiceSettingsPanel {...voicePanelProps()} onModeChange={onModeChange} />,
		);

		const pushToTalk = getButton(view.container, "Push to talk");
		const openMic = getButton(view.container, "Open mic");
		expect(
			pushToTalk.closest('[role="radiogroup"]')?.getAttribute("aria-label"),
		).toBe("Microphone mode");
		expect(pushToTalk.getAttribute("role")).toBe("radio");
		expect(pushToTalk.getAttribute("aria-checked")).toBe("true");
		expect(openMic.getAttribute("aria-checked")).toBe("false");

		await click(openMic);
		expect(onModeChange).toHaveBeenCalledWith("open-mic");
		expect(onModeChange).toHaveBeenCalledTimes(1);

		await unmount(view.root);
	});

	it("shows concise microphone state without conflating quiet enabled voice and speech", async () => {
		const view = await render(
			<VoiceSettingsPanel
				{...voicePanelProps()}
				microphoneEnabled
				mode="open-mic"
			/>,
		);
		expect(readStatus(view.container)).toBe("Microphone on");

		await view.rerender(
			<VoiceSettingsPanel
				{...voicePanelProps()}
				microphoneEnabled
				mode="open-mic"
				speaking
			/>,
		);
		expect(readStatus(view.container)).toBe("Speaking");
		expect(
			view.container.querySelector(".voice-settings-status")?.classList,
		).toContain("speaking");

		await unmount(view.root);
	});

	it("explains both push-to-talk inputs while the microphone is idle", async () => {
		const view = await render(<VoiceSettingsPanel {...voicePanelProps()} />);

		expect(readStatus(view.container)).toBe("Hold V or hold the mic");

		await unmount(view.root);
	});

	it("renders media-seat guidance while keeping mode selection available", async () => {
		const onModeChange = vi.fn();
		const view = await render(
			<VoiceSettingsPanel
				{...voicePanelProps()}
				hasMediaSeat={false}
				mediaSeatGuidance="Waiting for the host to approve live media."
				onModeChange={onModeChange}
			/>,
		);

		expect(readStatus(view.container)).toBe("Media seat required");
		expect(view.container.textContent).toContain(
			"Waiting for the host to approve live media.",
		);
		const openMic = getButton(view.container, "Open mic");
		expect(openMic.disabled).toBe(false);
		await click(openMic);
		expect(onModeChange).toHaveBeenCalledWith("open-mic");

		await unmount(view.root);
	});

	it("renders Dictate as an action slot without owning its behavior", async () => {
		const onDictate = vi.fn();
		const view = await render(
			<VoiceSettingsPanel
				{...voicePanelProps()}
				dictateAction={
					<button onClick={onDictate} type="button">
						Dictate reactions
					</button>
				}
			/>,
		);

		const panel = view.container.querySelector(".voice-settings-panel");
		expect(panel?.getAttribute(OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE)).toBe("true");
		await click(getButton(view.container, "Dictate reactions"));
		expect(onDictate).toHaveBeenCalledTimes(1);

		await unmount(view.root);
	});
});

function panelProps(
	overrides: Partial<React.ComponentProps<typeof PanelMicrophoneControl>> = {},
): React.ComponentProps<typeof PanelMicrophoneControl> {
	return {
		available: true,
		disabledReason: "",
		microphoneEnabled: false,
		mode: "push-to-talk",
		onOpenMicChange: vi.fn(),
		onPushToTalkChange: vi.fn(),
		speaking: false,
		...overrides,
	};
}

function voicePanelProps(): React.ComponentProps<typeof VoiceSettingsPanel> {
	return {
		dictateAction: null,
		hasMediaSeat: true,
		mediaSeatGuidance: "",
		microphoneEnabled: false,
		microphoneStatus: "off",
		mode: "push-to-talk",
		onModeChange: vi.fn(),
		speaking: false,
	};
}

async function renderPanel(
	overrides: Partial<React.ComponentProps<typeof PanelMicrophoneControl>> = {},
): Promise<RenderedView> {
	return render(<PanelMicrophoneControl {...panelProps(overrides)} />);
}

interface RenderedView {
	container: HTMLDivElement;
	rerender: (node: ReactNode) => Promise<void>;
	root: Root;
}

async function render(node: ReactNode): Promise<RenderedView> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	await act(async () => {
		root.render(node);
	});
	return {
		container,
		rerender: async (nextNode) => {
			await act(async () => {
				root.render(nextNode);
			});
		},
		root,
	};
}

async function click(button: HTMLButtonElement): Promise<void> {
	await act(async () => {
		button.click();
	});
}

async function pointer(
	button: HTMLButtonElement,
	type: string,
	init: PointerEventInit,
): Promise<void> {
	await act(async () => {
		button.dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				cancelable: true,
				...init,
			}),
		);
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

function readStatus(container: HTMLElement): string | null {
	return (
		container.querySelector(".voice-settings-status-value")?.textContent ?? null
	);
}

async function unmount(root: Root): Promise<void> {
	await act(async () => {
		root.unmount();
	});
}
