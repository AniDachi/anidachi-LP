import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	InterfacePreferencesPatch,
	InterfacePreferencesV1,
} from "../src/interface-preferences";
import { OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE } from "../src/overlay-interaction-boundary";
import { InterfaceSettingsPanel } from "../src/overlay-interface-settings";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const DEFAULT_PREFERENCES: InterfacePreferencesV1 = {
	version: 1,
	mainControlVisibility: "auto-hide",
	participantPillVisibility: "smart",
};

describe("InterfaceSettingsPanel", () => {
	beforeEach(() => {
		mockReducedMotion(false);
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("renders only the approved interface visibility choices", async () => {
		const onChange = vi.fn();
		const view = await renderPanel({ onChange });

		expect(getRadioGroup(view.container, "Main control")).not.toBeNull();
		expect(getRadioGroup(view.container, "Participant pills")).not.toBeNull();
		expect(
			getButton(view.container, "Auto hide").getAttribute("aria-checked"),
		).toBe("true");
		expect(
			getButton(view.container, "Always visible", 0).getAttribute(
				"aria-checked",
			),
		).toBe("false");
		expect(
			getButton(view.container, "Smart").getAttribute("aria-checked"),
		).toBe("true");
		expect(
			getButton(view.container, "Always visible", 1).getAttribute(
				"aria-checked",
			),
		).toBe("false");
		expect(view.container.textContent).not.toMatch(/Preset|Apply|Revert/);
		expect(
			view.container
				.querySelector(".interface-settings-panel")
				?.getAttribute(OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE),
		).toBe("true");

		await unmount(view.root);
	});

	it("reports only the changed preference field", async () => {
		const onChange = vi.fn();
		const view = await renderPanel({ onChange });

		await click(getButton(view.container, "Always visible", 0));
		expect(onChange).toHaveBeenLastCalledWith({
			mainControlVisibility: "always-visible",
		});

		await click(getButton(view.container, "Always visible", 1));
		expect(onChange).toHaveBeenLastCalledWith({
			participantPillVisibility: "always-visible",
		});

		await unmount(view.root);
	});

	it("supports arrow navigation and moves focus within each radio group", async () => {
		const onChange = vi.fn();
		const view = await renderPanel({ onChange });
		const autoHide = getButton(view.container, "Auto hide");
		const alwaysVisible = getButton(view.container, "Always visible", 0);

		autoHide.focus();
		await keyboard(autoHide, { key: "ArrowRight" });

		expect(onChange).toHaveBeenCalledWith({
			mainControlVisibility: "always-visible",
		});
		expect(document.activeElement).toBe(alwaysVisible);

		await keyboard(alwaysVisible, { key: "ArrowLeft" });
		expect(onChange).toHaveBeenLastCalledWith({
			mainControlVisibility: "auto-hide",
		});
		expect(document.activeElement).toBe(autoHide);

		await unmount(view.root);
	});

	it("updates the preview from the same resolved preference state", async () => {
		const view = await renderPanel();
		const preview = getPreview(view.container);
		const mainControl = getRadioGroup(view.container, "Main control");
		const participantPills = getRadioGroup(view.container, "Participant pills");

		expect(preview.getAttribute("data-main-visible")).toBe("false");
		expect(preview.getAttribute("data-pill-visibility")).toBe("hidden");
		expect(mainControl?.getAttribute("data-state")).toBe("first");
		expect(participantPills?.getAttribute("data-state")).toBe("first");

		await view.rerender({
			...DEFAULT_PREFERENCES,
			mainControlVisibility: "always-visible",
			participantPillVisibility: "always-visible",
		});

		expect(preview.getAttribute("data-main-visible")).toBe("true");
		expect(preview.getAttribute("data-pill-visibility")).toBe("compact");
		expect(mainControl?.getAttribute("data-state")).toBe("second");
		expect(participantPills?.getAttribute("data-state")).toBe("second");

		await unmount(view.root);
	});

	it("demonstrates the real visibility sequence without playback controls", async () => {
		vi.useFakeTimers();
		const view = await renderPanel();
		const preview = getPreview(view.container);

		expect(
			view.container.querySelector(".interface-settings-replay"),
		).toBeNull();
		expect(
			view.container.querySelector(".interface-settings-preview-state"),
		).toBeNull();
		expect(
			view.container.querySelector(".interface-settings-player-progress"),
		).toBeNull();
		expect(preview.getAttribute("data-preview-moment")).toBe("idle");
		expect(preview.getAttribute("data-cursor-target")).toBe("rest");
		expect(preview.getAttribute("data-cursor-visible")).toBe("false");

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("idle");
		expect(preview.getAttribute("data-main-glow")).toBe("false");
		expect(preview.getAttribute("data-main-visible")).toBe("false");
		expect(preview.getAttribute("data-cursor-target")).toBe("main-edge");
		expect(preview.getAttribute("data-cursor-visible")).toBe("true");

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("proximity");
		expect(preview.getAttribute("data-main-glow")).toBe("true");
		expect(preview.getAttribute("data-cursor-target")).toBe("main-edge");

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("main-visible");
		expect(preview.getAttribute("data-main-visible")).toBe("true");
		expect(preview.getAttribute("data-cursor-target")).toBe("main-edge");

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("main-visible");
		expect(preview.getAttribute("data-cursor-target")).toBe("main-edge");
		expect(preview.getAttribute("data-main-visible")).toBe("true");
		expect(preview.getAttribute("data-cursor-visible")).toBe("false");

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("idle");
		expect(preview.getAttribute("data-main-visible")).toBe("false");

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("speaking");
		expect(preview.getAttribute("data-cursor-visible")).toBe("false");
		expect(getParticipantPresentations(preview)).toEqual([
			"compact",
			"hidden",
			"hidden",
		]);

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("idle");

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("idle");
		expect(preview.getAttribute("data-cursor-target")).toBe("rail-edge");
		expect(preview.getAttribute("data-cursor-visible")).toBe("true");
		expect(getParticipantPresentations(preview)).toEqual([
			"hidden",
			"hidden",
			"hidden",
		]);

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("interaction");
		expect(preview.getAttribute("data-cursor-target")).toBe("rail-edge");
		expect(getParticipantPresentations(preview)).toEqual([
			"expanded",
			"expanded",
			"expanded",
		]);

		await unmount(view.root);
	});

	it("skips irrelevant cursor travel and targets one persistent participant", async () => {
		vi.useFakeTimers();
		const view = await renderPanel({
			preferences: {
				...DEFAULT_PREFERENCES,
				mainControlVisibility: "always-visible",
				participantPillVisibility: "always-visible",
			},
		});
		const preview = getPreview(view.container);

		expect(preview.getAttribute("data-preview-moment")).toBe("idle");
		expect(preview.getAttribute("data-main-visible")).toBe("true");

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("speaking");
		expect(preview.getAttribute("data-cursor-visible")).toBe("false");

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("idle");

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("idle");
		expect(preview.getAttribute("data-cursor-target")).toBe("participant-pill");
		expect(preview.getAttribute("data-cursor-visible")).toBe("true");
		expect(getParticipantPresentations(preview)).toEqual([
			"compact",
			"compact",
			"compact",
		]);

		await advancePreviewFrame();
		expect(preview.getAttribute("data-preview-moment")).toBe("interaction");
		expect(preview.getAttribute("data-cursor-target")).toBe("participant-pill");
		expect(getParticipantPresentations(preview)).toEqual([
			"expanded",
			"compact",
			"compact",
		]);

		await unmount(view.root);
	});

	it("renders the resolved final state without travel when reduced motion is requested", async () => {
		vi.useFakeTimers();
		mockReducedMotion(true);
		const view = await renderPanel({
			preferences: {
				...DEFAULT_PREFERENCES,
				mainControlVisibility: "always-visible",
				participantPillVisibility: "always-visible",
			},
		});
		const preview = getPreview(view.container);

		expect(preview.getAttribute("data-reduced-motion")).toBe("true");
		expect(preview.getAttribute("data-preview-moment")).toBe("interaction");
		expect(preview.getAttribute("data-main-visible")).toBe("true");
		expect(preview.getAttribute("data-pill-visibility")).toBe("expanded");
		await advance(10_000);
		expect(preview.getAttribute("data-preview-moment")).toBe("interaction");

		await unmount(view.root);
	});

	it("disables choices while loading and exposes saving and error status", async () => {
		const view = await renderPanel({
			error: "Couldn't save interface settings.",
			ready: false,
			saving: true,
		});
		const panel = view.container.querySelector(".interface-settings-panel");
		const status = view.container.querySelector('[role="status"]');

		expect(panel?.getAttribute("aria-busy")).toBe("true");
		expect(
			[...view.container.querySelectorAll('[role="radio"]')].every(isDisabled),
		).toBe(true);
		expect(status?.getAttribute("aria-live")).toBe("polite");
		expect(status?.textContent).toBe("Couldn't save interface settings.");

		await unmount(view.root);
	});

	it("keeps preview silhouettes decorative", async () => {
		const view = await renderPanel();

		expect(
			[
				...view.container.querySelectorAll(".interface-settings-silhouette"),
			].every((element) => element.getAttribute("aria-hidden") === "true"),
		).toBe(true);

		await unmount(view.root);
	});

	it("renders recognizable real overlay elements and a demonstration cursor", async () => {
		const view = await renderPanel({
			preferences: {
				...DEFAULT_PREFERENCES,
				mainControlVisibility: "always-visible",
				participantPillVisibility: "always-visible",
			},
		});
		const preview = getPreview(view.container);

		expect(
			preview.querySelector(".interface-settings-demo-cursor"),
		).not.toBeNull();
		const logo = preview.querySelector(".interface-settings-main-logo");
		expect(logo).toBeInstanceOf(HTMLImageElement);
		expect((logo as HTMLImageElement).src).toContain("Anidachi_logo.png");
		expect((logo as HTMLImageElement).width).toBeLessThan(24);
		expect(
			preview.querySelector(".interface-settings-main-count")?.textContent,
		).toBe("3");
		expect(
			[...preview.querySelectorAll(".interface-settings-participant-name")].map(
				(element) => element.textContent,
			),
		).toEqual(["Mika", "Ren", "Niko"]);

		await unmount(view.root);
	});
});

interface PanelOverrides {
	error?: string | null;
	onChange?: (patch: InterfacePreferencesPatch) => void;
	preferences?: InterfacePreferencesV1;
	ready?: boolean;
	saving?: boolean;
}

interface RenderedPanel {
	container: HTMLDivElement;
	rerender(preferences: InterfacePreferencesV1): Promise<void>;
	root: Root;
}

async function renderPanel(
	overrides: PanelOverrides = {},
): Promise<RenderedPanel> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const props = {
		error: overrides.error ?? null,
		onChange: overrides.onChange ?? vi.fn(),
		preferences: overrides.preferences ?? DEFAULT_PREFERENCES,
		ready: overrides.ready ?? true,
		saving: overrides.saving ?? false,
	};

	await act(async () => {
		root.render(<InterfaceSettingsPanel {...props} />);
	});

	return {
		container,
		rerender: async (preferences) => {
			await act(async () => {
				root.render(
					<InterfaceSettingsPanel {...props} preferences={preferences} />,
				);
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

async function keyboard(
	button: HTMLButtonElement,
	init: KeyboardEventInit,
): Promise<void> {
	await act(async () => {
		button.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				...init,
			}),
		);
	});
}

async function advance(milliseconds: number): Promise<void> {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(milliseconds);
	});
}

async function advancePreviewFrame(): Promise<void> {
	await act(async () => {
		await vi.advanceTimersToNextTimerAsync();
	});
}

async function unmount(root: Root): Promise<void> {
	await act(async () => {
		root.unmount();
	});
}

function getRadioGroup(
	container: HTMLElement,
	name: string,
): HTMLElement | null {
	return container.querySelector(`[role="radiogroup"][aria-label="${name}"]`);
}

function getButton(
	container: HTMLElement,
	name: string,
	index = 0,
): HTMLButtonElement {
	const buttons = [...container.querySelectorAll("button")].filter(
		(candidate) =>
			candidate.getAttribute("aria-label") === name ||
			candidate.textContent?.trim() === name,
	);
	const button = buttons[index];
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Button not found: ${name} at index ${index}`);
	}
	return button;
}

function getPreview(container: HTMLElement): HTMLElement {
	const preview = container.querySelector(".interface-settings-preview");
	if (!(preview instanceof HTMLElement)) {
		throw new Error("Interface preview not found.");
	}
	return preview;
}

function getParticipantPresentations(
	preview: HTMLElement,
): Array<string | null> {
	return [
		...preview.querySelectorAll(".interface-settings-participant-pill"),
	].map((element) => element.getAttribute("data-presentation"));
}

function isDisabled(element: Element): boolean {
	return element instanceof HTMLButtonElement && element.disabled;
}

function mockReducedMotion(matches: boolean): void {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn().mockReturnValue({
			addEventListener: vi.fn(),
			matches,
			media: "(prefers-reduced-motion: reduce)",
			removeEventListener: vi.fn(),
		}),
	});
}
