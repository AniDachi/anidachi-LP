import { afterEach, describe, expect, it } from "vitest";
import { startContentLifecycle } from "../../../entrypoints/content";
import { installComposerQuietRelease } from "../../../src/message-composer-quiet-release";

const cleanups: (() => void)[] = [];
afterEach(() => {
	cleanups
		.splice(0)
		.reverse()
		.forEach((cleanup) => cleanup());
	document.body.replaceChildren();
	document.getElementById("anidachi-page-style")?.remove();
	delete document.documentElement.dataset.anidachiComposerOpen;
});
function setup() {
	const runtime = startContentLifecycle({
		detect: () => ({ status: "none" }),
		installKeyboardGuard: () => () => {},
		startProviderStudy: () => null,
	});
	cleanups.push(() => runtime.dispose());
	const player = document.createElement("div");
	player.dataset.anidachiAdapter = "youtube";
	player.innerHTML = `
    <video></video>
    <div class="ytp-chrome-top"></div>
    <div class="ytp-chrome-bottom"><button style="pointer-events:auto;visibility:visible">Play</button></div>
    <div class="ytp-progress-bar-container"></div>
    <div class="ytp-gradient-top"></div><div class="ytp-gradient-bottom"></div>
    <div class="ytp-bezel"></div><div class="ytp-tooltip"></div>
    <div class="ytp-caption-window-container"></div><div class="ytp-ad-player-overlay"></div>
    <div class="ytp-spinner"></div><div class="ytp-error"></div>
  `;
	for (const child of player.children)
		(child as HTMLElement).style.opacity = "1";
	const host = document.createElement("anidachi-overlay-root");
	const shadow = host.attachShadow({ mode: "closed" });
	const overlay = document.createElement("div");
	shadow.append(overlay);
	player.append(host);
	document.body.append(player);
	return { player, overlay };
}
const chrome = [
	".ytp-chrome-top",
	".ytp-chrome-bottom",
	".ytp-progress-bar-container",
	".ytp-gradient-top",
	".ytp-gradient-bottom",
	".ytp-bezel",
	".ytp-tooltip",
];
const protectedSelectors = [
	"video",
	".ytp-caption-window-container",
	".ytp-ad-player-overlay",
	".ytp-spinner",
	".ytp-error",
	"anidachi-overlay-root",
];

describe("YouTube composer chrome", () => {
	it.each([
		"guard",
		"true",
		"quiet",
	])("hides native chrome in %s state without hiding video, captions or status UI", (mode) => {
		const { player } = setup();
		if (mode === "guard")
			document.documentElement.dataset.anidachiComposerOpen = mode;
		else player.dataset.anidachiComposerOpen = mode;
		for (const selector of chrome) {
			const style = getComputedStyle(player.querySelector(selector)!);
			expect(style.opacity, selector).toBe("0");
			expect(style.pointerEvents, selector).toBe("none");
		}
		const button = getComputedStyle(player.querySelector("button")!);
		expect(button.pointerEvents).toBe("none");
		expect(button.visibility).toBe("hidden");
		for (const selector of protectedSelectors)
			expect(
				getComputedStyle(player.querySelector(selector)!).visibility,
				selector,
			).not.toBe("hidden");
	});
	it("restores native styles and delivers the first real player click", () => {
		const { player, overlay } = setup();
		player.dataset.anidachiComposerOpen = "quiet";
		cleanups.push(
			installComposerQuietRelease(player, overlay, () => {
				delete player.dataset.anidachiComposerOpen;
			}),
		);
		const controls = player.querySelector<HTMLElement>(".ytp-chrome-bottom")!;
		expect(getComputedStyle(controls).opacity).toBe("0");
		let clicks = 0;
		player.addEventListener("pointerdown", () => clicks++);
		const event = new PointerEvent("pointerdown", {
			bubbles: true,
			cancelable: true,
		});
		player.querySelector("video")!.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
		expect(clicks).toBe(1);
		expect(getComputedStyle(controls).opacity).toBe("1");
		expect(
			getComputedStyle(player.querySelector("button")!).pointerEvents,
		).toBe("auto");
	});
	it("does not alter other providers, unmounted players or ad-mode controls", () => {
		const { player } = setup();
		const controls = player.querySelector<HTMLElement>(".ytp-chrome-bottom")!;
		expect(getComputedStyle(controls).opacity).toBe("1");
		player.dataset.anidachiComposerOpen = "quiet";
		player.dataset.anidachiAdapter = "generic-html5-video";
		expect(getComputedStyle(controls).opacity).toBe("1");
		player.dataset.anidachiAdapter = "youtube";
		player.classList.add("ad-showing");
		expect(getComputedStyle(controls).opacity).toBe("1");
		player.classList.remove("ad-showing");
		expect(getComputedStyle(controls).opacity).toBe("0");
		delete player.dataset.anidachiAdapter;
		expect(getComputedStyle(controls).opacity).toBe("1");
	});
});
