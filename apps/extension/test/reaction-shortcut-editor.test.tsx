import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReactionShortcutEditor } from "../src/reaction-shortcut-editor";
import { DEFAULT_REACTION_SHORTCUTS } from "../src/reaction-shortcuts";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("ReactionShortcutEditor", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("renders one horizontal assignment control for every digit", async () => {
		const view = await renderEditor();

		expect([
			...view.container.querySelectorAll(".reaction-shortcut"),
		]).toHaveLength(10);
		expect(
			[...view.container.querySelectorAll(".reaction-shortcut-key")].map(
				(node) => node.textContent,
			),
		).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]);

		await unmount(view.root);
	});

	it("opens a compact picker and assigns the selected emoji to the chosen key", async () => {
		const onAssign = vi.fn();
		const view = await renderEditor({ onAssign });

		await click(getButton(view.container, "Key 7: 👏. Change reaction"));
		expect(
			view.container.querySelector('[role="dialog"]')?.textContent,
		).toContain("Key 7");

		await click(getButton(view.container, "Assign 🥳 to key 7"));
		expect(onAssign).toHaveBeenCalledWith(6, "🥳");
		expect(view.container.querySelector('[role="dialog"]')).toBeNull();

		await unmount(view.root);
	});

	it("magnifies the hovered shortcut and its nearest neighbors without changing the list", async () => {
		const view = await renderEditor();
		const buttons = [
			...view.container.querySelectorAll<HTMLButtonElement>(
				".reaction-shortcut",
			),
		];

		await pointerOver(buttons[4]);

		expect(buttons[4].style.getPropertyValue("--reaction-dock-scale")).toBe(
			"1.34",
		);
		expect(buttons[3].style.getPropertyValue("--reaction-dock-scale")).toBe(
			"1.14",
		);
		expect(buttons[5].style.getPropertyValue("--reaction-dock-scale")).toBe(
			"1.14",
		);
		expect(buttons[2].style.getPropertyValue("--reaction-dock-scale")).toBe(
			"1",
		);
		expect(buttons).toHaveLength(10);

		await unmount(view.root);
	});

	it("marks the current assignment in the picker", async () => {
		const view = await renderEditor();

		await click(getButton(view.container, "Key 1: 😂. Change reaction"));

		expect(
			getButton(view.container, "Assign 😂 to key 1").getAttribute(
				"aria-pressed",
			),
		).toBe("true");

		await unmount(view.root);
	});
});

interface RenderedEditor {
	container: HTMLDivElement;
	root: Root;
}

async function renderEditor({
	onAssign = vi.fn(),
}: {
	onAssign?: (index: number, emoji: string) => void;
} = {}): Promise<RenderedEditor> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);

	await act(async () => {
		root.render(
			<ReactionShortcutEditor
				assignments={DEFAULT_REACTION_SHORTCUTS}
				onAssign={onAssign}
			/>,
		);
	});

	return { container, root };
}

function getButton(
	container: HTMLElement,
	ariaLabel: string,
): HTMLButtonElement {
	const button = container.querySelector(`button[aria-label="${ariaLabel}"]`);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Button not found: ${ariaLabel}`);
	}
	return button;
}

async function click(button: HTMLButtonElement): Promise<void> {
	await act(async () => {
		button.click();
	});
}

async function pointerOver(button: HTMLButtonElement): Promise<void> {
	await act(async () => {
		button.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
	});
}

async function unmount(root: Root): Promise<void> {
	await act(async () => {
		root.unmount();
	});
}
