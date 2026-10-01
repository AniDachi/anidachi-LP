import { afterEach, describe, expect, it, vi } from "vitest";
import { installComposerQuietRelease } from "../src/message-composer-quiet-release";

const cleanups: (() => void)[] = [];
afterEach(() => {
	cleanups.splice(0).forEach((cleanup) => cleanup());
	document.body.replaceChildren();
});
function setup(isOverlayShortcut?: (event: KeyboardEvent) => boolean) {
	const player = document.createElement("div");
	const video = document.createElement("video");
	const host = document.createElement("anidachi-overlay-root");
	const root = host.attachShadow({ mode: "closed" });
	const overlay = document.createElement("div");
	const button = document.createElement("button");
	overlay.append(button);
	root.append(overlay);
	player.append(video, host);
	document.body.append(player);
	const release = vi.fn();
	const cleanup = installComposerQuietRelease(
		player,
		overlay,
		release,
		isOverlayShortcut,
	);
	cleanups.push(cleanup);
	return { player, video, button, release, cleanup };
}
const pointer = (type: string) =>
	new PointerEvent(type, { bubbles: true, composed: true, cancelable: true });
describe("composer quiet release", () => {
	it("leaves AniDachi reaction and push-to-talk shortcuts quiet", () => {
		const { release } = setup((event) =>
			["Digit1", "KeyV"].includes(event.code),
		);
		for (const code of ["Digit1", "KeyV"]) {
			document.body.dispatchEvent(
				new KeyboardEvent("keydown", {
					code,
					key: code === "KeyV" ? "v" : "1",
					bubbles: true,
				}),
			);
		}
		expect(release).not.toHaveBeenCalled();
	});

	it("ignores overlay gestures and incidental hover/focus in a closed shadow tree", () => {
		const { player, button, release } = setup();
		button.dispatchEvent(pointer("pointerdown"));
		button.dispatchEvent(pointer("pointermove"));
		player.dispatchEvent(pointer("pointerover"));
		player.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		expect(release).not.toHaveBeenCalled();
	});
	it.each([
		"pointerdown",
		"pointermove",
	])("releases once on %s without eating or replaying the native event", (type) => {
		const { player, video, release } = setup();
		const native = vi.fn();
		player.addEventListener(type, native);
		const event = pointer(type);
		video.dispatchEvent(event);
		expect(release).toHaveBeenCalledOnce();
		expect(native).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBe(false);
		video.dispatchEvent(pointer(type));
		expect(release).toHaveBeenCalledOnce();
	});
	it("preserves reopening shortcuts and releases for native playback keyboard controls", () => {
		const { release } = setup();
		for (const init of [
			{ key: "Enter" },
			{ key: "c", code: "KeyC", altKey: true },
			{ key: "Shift" },
			{ key: "a", isComposing: true },
		]) {
			document.body.dispatchEvent(
				new KeyboardEvent("keydown", {
					...init,
					bubbles: true,
					cancelable: true,
				}),
			);
		}
		expect(release).not.toHaveBeenCalled();
		const native = vi.fn();
		document.body.addEventListener("keydown", native);
		const event = new KeyboardEvent("keydown", {
			key: " ",
			code: "Space",
			bubbles: true,
			cancelable: true,
		});
		document.body.dispatchEvent(event);
		expect(release).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBe(false);
		expect(native).toHaveBeenCalledOnce();
	});
	it("ignores typing outside the player", () => {
		const { release } = setup();
		const input = document.createElement("input");
		document.body.append(input);
		input.dispatchEvent(
			new KeyboardEvent("keydown", { key: "a", bubbles: true }),
		);
		expect(release).not.toHaveBeenCalled();
	});
	it("removes listeners on reopen or unmount", () => {
		const { cleanup, video, release } = setup();
		cleanup();
		video.dispatchEvent(pointer("pointermove"));
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
		expect(release).not.toHaveBeenCalled();
	});
});
