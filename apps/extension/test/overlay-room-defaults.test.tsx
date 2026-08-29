import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE } from "../src/overlay-interaction-boundary";
import { RoomDefaultsSettingsPanel } from "../src/overlay-room-defaults";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("RoomDefaultsSettingsPanel", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("presents concise room defaults with two accessible media controls", async () => {
		const onChange = vi.fn();
		const view = await render(
			<RoomDefaultsSettingsPanel
				error={null}
				onChange={onChange}
				preferences={{
					version: 1,
					microphoneOnJoin: "last-used",
					cameraOnJoin: "off",
				}}
				ready
				saving={false}
			/>,
		);

		const panel = view.container.querySelector(".room-defaults-settings-panel");
		expect(panel?.getAttribute(OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE)).toBe("true");
		expect(
			view.container.querySelector(".room-defaults-title")?.textContent,
		).toBe("Room defaults");
		expect(
			view.container.querySelector(".room-defaults-description")?.textContent,
		).toBe("Choose your starting setup for every room.");
		expect(
			getGroup(view.container, "Microphone").querySelectorAll("button"),
		).toHaveLength(3);
		expect(
			getGroup(view.container, "Camera").querySelectorAll("button"),
		).toHaveLength(3);
		expect(view.container.querySelector(".room-defaults-note")).toBeNull();
		expect(view.container.textContent).not.toContain("Apply");

		await click(getButton(getGroup(view.container, "Camera"), "On"));
		expect(onChange).toHaveBeenCalledWith({ cameraOnJoin: "on" });
		await unmount(view.root);
	});

	it("supports keyboard navigation within each setting", async () => {
		const onChange = vi.fn();
		const view = await render(
			<RoomDefaultsSettingsPanel
				error={null}
				onChange={onChange}
				preferences={{
					version: 1,
					microphoneOnJoin: "last-used",
					cameraOnJoin: "off",
				}}
				ready
				saving={false}
			/>,
		);
		const lastUsed = getButton(
			getGroup(view.container, "Microphone"),
			"Last used",
		);
		lastUsed.focus();
		await keyboard(lastUsed, "ArrowRight");
		expect(onChange).toHaveBeenCalledWith({ microphoneOnJoin: "push-to-talk" });
		expect(document.activeElement?.textContent).toBe("Push to talk");
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
	await act(async () => root.render(node));
	return { container, root };
}

async function click(button: HTMLButtonElement): Promise<void> {
	await act(async () => button.click());
}

async function keyboard(button: HTMLButtonElement, key: string): Promise<void> {
	await act(async () => {
		button.dispatchEvent(
			new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }),
		);
	});
}

function getGroup(container: HTMLElement, name: string): HTMLElement {
	const group = [
		...container.querySelectorAll<HTMLElement>('[role="radiogroup"]'),
	].find((candidate) => candidate.getAttribute("aria-label") === name);
	if (!group) throw new Error(`Group not found: ${name}`);
	return group;
}

function getButton(container: HTMLElement, name: string): HTMLButtonElement {
	const button = [...container.querySelectorAll("button")].find(
		(candidate) => candidate.textContent?.trim() === name,
	);
	if (!(button instanceof HTMLButtonElement))
		throw new Error(`Button not found: ${name}`);
	return button;
}

async function unmount(root: Root): Promise<void> {
	await act(async () => root.unmount());
}
