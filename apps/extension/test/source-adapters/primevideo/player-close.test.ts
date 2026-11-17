import { afterEach, expect, it, vi } from "vitest";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { subscribePrimePlayerClose } from "../../../src/source-adapters/primevideo/player-close";
import {
	PRIME_NAVIGATING,
	PRIME_PLAYER_STATE,
} from "../../../src/source-adapters/primevideo/contract";
import { fixture } from "./fixture";

const stops: (() => void)[] = [];
afterEach(() => {
	stops
		.splice(0)
		.reverse()
		.forEach((stop) => stop());
	vi.restoreAllMocks();
	vi.useRealTimers();
	document.body.replaceChildren();
});
function setup() {
	vi.useFakeTimers();
	const f = fixture();
	const button = document.createElement("button");
	button.id = "atvwebplayersdk-close-player-button";
	button.setAttribute("aria-label", "プレーヤーを閉じる");
	button.innerHTML = "<span>×</span>";
	f.root.append(button);
	stops.push(startPrimeBridge());
	const closed = vi.fn();
	stops.push(subscribePrimePlayerClose(f.root, f.video, closed));
	return { ...f, button, closed };
}
function gesture(
	target: Element,
	kind: "click" | "Escape" = "click",
	trusted = true,
) {
	const event =
		kind === "click"
			? new MouseEvent("click", { bubbles: true })
			: new KeyboardEvent("keydown", { key: kind, bubbles: true });
	Object.defineProperty(event, "isTrusted", { value: trusted });
	target.dispatchEvent(event);
	return event;
}
it.each([
	"click",
	"Escape",
] as const)("leaves exactly once after trusted %s and SDK close, independent of labels/metadata", async (kind) => {
	const f = setup();
	document.getElementById("dv-web-page-hydration-data")!.textContent = "{}";
	const event = gesture(
		kind === "click" ? f.button.firstElementChild! : f.root,
		kind,
	);
	expect(f.closed).not.toHaveBeenCalled();
	f.context.webPlayer.isPlayerOpen = false;
	f.video.remove();
	await vi.advanceTimersByTimeAsync(500);
	expect(f.root.getAttribute(PRIME_PLAYER_STATE)).toBe("closed");
	expect(f.closed).toHaveBeenCalledExactlyOnceWith(event);
	await vi.advanceTimersByTimeAsync(1500);
	expect(f.closed).toHaveBeenCalledTimes(1);
});
it.each([
	"synthetic",
	"next-episode",
	"metadata-gap",
	"video-replacement",
	"unknown-sdk",
	"fullscreen",
	"navigation",
	"pagehide",
	"disposed",
	"expired",
])("does not leave for %s", async (mode) => {
	const f = setup();
	if (mode === "fullscreen")
		Object.defineProperty(document, "fullscreenElement", {
			configurable: true,
			get: () => f.root,
		});
	if (mode === "next-episode") {
		const next = document.createElement("button");
		f.root.append(next);
		gesture(next);
		f.next();
	} else if (mode === "synthetic") gesture(f.button, "click", false);
	else gesture(f.root, "Escape");
	if (mode === "navigation")
		document.dispatchEvent(new Event(PRIME_NAVIGATING));
	if (mode === "pagehide") window.dispatchEvent(new Event("pagehide"));
	if (mode === "disposed") stops.pop()!();
	if (mode === "expired") await vi.advanceTimersByTimeAsync(2000);
	if (mode === "unknown-sdk")
		Reflect.deleteProperty(f.root, "_reactRootContainer");
	else if (mode === "video-replacement") {
		f.video.remove();
		f.root.append(document.createElement("video"));
	} else if (mode === "metadata-gap")
		document.getElementById("dv-web-page-hydration-data")!.textContent = "{}";
	else f.context.webPlayer.isPlayerOpen = false;
	await vi.advanceTimersByTimeAsync(500);
	expect(f.closed).not.toHaveBeenCalled();
	if (mode === "fullscreen")
		Reflect.deleteProperty(document, "fullscreenElement");
});
it("Escape closing only a menu does not become a later player exit", async () => {
	const f = setup();
	gesture(f.root, "Escape");
	await vi.advanceTimersByTimeAsync(300);
	gesture(f.root, "click");
	f.context.webPlayer.isPlayerOpen = false;
	await vi.advanceTimersByTimeAsync(500);
	expect(f.closed).not.toHaveBeenCalled();
});
