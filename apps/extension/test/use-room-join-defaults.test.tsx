import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoomJoinDefaultsStorage } from "../src/use-room-join-defaults";
import { useRoomJoinDefaults } from "../src/use-room-join-defaults";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("useRoomJoinDefaults", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("loads the current account and saves a selection immediately", async () => {
		const storage = createStorage({
			version: 1,
			microphoneOnJoin: "last-used",
			cameraOnJoin: "off",
		});
		const view = await render(<Harness storage={storage} userId="user-a" />);
		await flush();

		expect(readPreferences(view.container)).toEqual({
			version: 1,
			microphoneOnJoin: "last-used",
			cameraOnJoin: "off",
		});
		expect(readBoolean(view.container, "ready")).toBe(true);

		await click(getButton(view.container, "Open mic by default"));
		await flush();

		expect(storage.write).toHaveBeenCalledWith("user-a", {
			version: 1,
			microphoneOnJoin: "open-mic",
			cameraOnJoin: "off",
		});
		expect(readPreferences(view.container).microphoneOnJoin).toBe("open-mic");
		await unmount(view.root);
	});

	it("does not expose one account's defaults while the next account loads", async () => {
		const secondRead = deferred<unknown>();
		const storage: RoomJoinDefaultsStorage = {
			read: vi
				.fn()
				.mockResolvedValueOnce({
					version: 1,
					microphoneOnJoin: "open-mic",
					cameraOnJoin: "on",
				})
				.mockImplementationOnce(() => secondRead.promise),
			write: vi.fn(),
		};
		const view = await render(<Harness storage={storage} userId="user-a" />);
		await flush();
		expect(readPreferences(view.container).cameraOnJoin).toBe("on");

		await act(async () => {
			view.root.render(<Harness storage={storage} userId="user-b" />);
		});
		expect(readBoolean(view.container, "ready")).toBe(false);
		expect(readPreferences(view.container)).toEqual({
			version: 1,
			microphoneOnJoin: "last-used",
			cameraOnJoin: "off",
		});

		secondRead.resolve({
			version: 1,
			microphoneOnJoin: "push-to-talk",
			cameraOnJoin: "last-used",
		});
		await flush();
		expect(readPreferences(view.container).cameraOnJoin).toBe("last-used");
		await unmount(view.root);
	});

	it("restores the latest successful defaults if a later write fails", async () => {
		const firstWrite = deferred<void>();
		const secondWrite = deferred<void>();
		const storage: RoomJoinDefaultsStorage = {
			read: vi.fn().mockResolvedValue(undefined),
			write: vi
				.fn()
				.mockImplementationOnce(() => firstWrite.promise)
				.mockImplementationOnce(() => secondWrite.promise),
		};
		const view = await render(<Harness storage={storage} userId="user-a" />);
		await flush();

		await click(getButton(view.container, "Open mic by default"));
		await click(getButton(view.container, "Camera on by default"));
		firstWrite.resolve();
		await flush();
		secondWrite.reject(new Error("Storage unavailable"));
		await flush();

		expect(readPreferences(view.container)).toEqual({
			version: 1,
			microphoneOnJoin: "open-mic",
			cameraOnJoin: "off",
		});
		expect(view.container.firstElementChild?.getAttribute("data-error")).toBe(
			"Couldn't save room defaults.",
		);
		await unmount(view.root);
	});
});

function Harness({
	storage,
	userId,
}: {
	storage: RoomJoinDefaultsStorage;
	userId: string | null;
}) {
	const controller = useRoomJoinDefaults(userId, storage);
	return (
		<div
			data-error={controller.error ?? ""}
			data-preferences={JSON.stringify(controller.preferences)}
			data-ready={String(controller.ready)}
			data-saving={String(controller.saving)}
		>
		<button
			onClick={() => controller.update({ microphoneOnJoin: "open-mic" })}
				type="button"
			>
			Open mic by default
		</button>
		<button
			onClick={() => controller.update({ cameraOnJoin: "on" })}
			type="button"
		>
			Camera on by default
		</button>
		</div>
	);
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
	await act(async () => button.click());
}

async function flush(): Promise<void> {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

async function unmount(root: Root): Promise<void> {
	await act(async () => root.unmount());
}

function createStorage(storedValue: unknown): RoomJoinDefaultsStorage {
	return {
		read: vi.fn().mockResolvedValue(storedValue),
		write: vi.fn().mockResolvedValue(undefined),
	};
}

function readPreferences(container: HTMLElement) {
	return JSON.parse(
		container.firstElementChild?.getAttribute("data-preferences") ?? "{}",
	);
}

function readBoolean(container: HTMLElement, name: string): boolean {
	return container.firstElementChild?.getAttribute(`data-${name}`) === "true";
}

function getButton(container: HTMLElement, name: string): HTMLButtonElement {
	const button = [...container.querySelectorAll("button")].find(
		(candidate) => candidate.textContent?.trim() === name,
	);
	if (!(button instanceof HTMLButtonElement))
		throw new Error(`Button not found: ${name}`);
	return button;
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, reject, resolve };
}
