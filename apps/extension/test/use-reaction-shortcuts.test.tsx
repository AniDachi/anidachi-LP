import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type ReactionShortcutPreferencesV1,
	REACTION_SHORTCUTS_VERSION,
} from "../src/reaction-shortcuts";
import {
	type ReactionShortcutPreferencesStorage,
	useReactionShortcuts,
} from "../src/use-reaction-shortcuts";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("useReactionShortcuts", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("loads stored assignments", async () => {
		const stored = preferences([
			"🥳",
			"😱",
			"❤️",
			"🔥",
			"😭",
			"👀",
			"👏",
			"🤯",
			"😮‍💨",
			"💯",
		]);
		const storage = createStorage(stored);
		const view = await render(<Harness storage={storage.api} />);
		await flush();

		expect(readAssignments(view.container)[0]).toBe("🥳");
		await unmount(view.root);
	});

	it("applies an assignment immediately and persists the versioned preference", async () => {
		const storage = createStorage(undefined);
		const view = await render(<Harness storage={storage.api} />);
		await flush();

		await click(getButton(view.container, "Assign party"));

		expect(readAssignments(view.container)[6]).toBe("🥳");
		expect(storage.write).toHaveBeenCalledWith(
			expect.objectContaining({
				version: REACTION_SHORTCUTS_VERSION,
				emojis: expect.arrayContaining(["🥳"]),
			}),
		);

		await unmount(view.root);
	});

	it("adopts an external storage change so open provider tabs stay in sync", async () => {
		const storage = createStorage(undefined);
		const view = await render(<Harness storage={storage.api} />);
		await flush();

		await act(async () => {
			storage.emit(
				preferences([
					"😎",
					"😱",
					"❤️",
					"🔥",
					"😭",
					"👀",
					"👏",
					"🤯",
					"😮‍💨",
					"💯",
				]),
			);
		});

		expect(readAssignments(view.container)[0]).toBe("😎");

		await unmount(view.root);
	});

	it("restores the last applied assignments when local persistence fails", async () => {
		const storage = createStorage(
			undefined,
			vi.fn().mockRejectedValue(new Error("unavailable")),
		);
		const view = await render(<Harness storage={storage.api} />);
		await flush();

		await click(getButton(view.container, "Assign party"));
		await flush();

		expect(readAssignments(view.container)[6]).toBe("👏");
		expect(readText(view.container, "error")).toBe(
			"Couldn't save reaction shortcuts.",
		);

		await unmount(view.root);
	});
});

function Harness({ storage }: { storage: ReactionShortcutPreferencesStorage }) {
	const controller = useReactionShortcuts(storage);
	return (
		<div
			data-assignments={JSON.stringify(controller.assignments)}
			data-error={controller.error ?? ""}
		>
			<button onClick={() => controller.assign(6, "🥳")} type="button">
				Assign party
			</button>
		</div>
	);
}

function createStorage(
	initial: unknown,
	customWrite?: ReactionShortcutPreferencesStorage["write"],
) {
	let listener: ((value: unknown) => void) | null = null;
	const write = customWrite ?? vi.fn().mockResolvedValue(undefined);
	const api: ReactionShortcutPreferencesStorage = {
		read: vi.fn().mockResolvedValue(initial),
		subscribe(nextListener) {
			listener = nextListener;
			return () => {
				listener = null;
			};
		},
		write,
	};
	return {
		api,
		emit(value: unknown) {
			listener?.(value);
		},
		write,
	};
}

function preferences(emojis: string[]): ReactionShortcutPreferencesV1 {
	return { version: REACTION_SHORTCUTS_VERSION, emojis };
}

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

async function flush(): Promise<void> {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

async function unmount(root: Root): Promise<void> {
	await act(async () => {
		root.unmount();
	});
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
	const button = [...container.querySelectorAll("button")].find(
		(candidate) => candidate.textContent?.trim() === label,
	);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Button not found: ${label}`);
	}
	return button;
}

function readAssignments(container: HTMLElement): string[] {
	return JSON.parse(
		container.firstElementChild?.getAttribute("data-assignments") ?? "[]",
	);
}

function readText(container: HTMLElement, key: string): string {
	return container.firstElementChild?.getAttribute(`data-${key}`) ?? "";
}
