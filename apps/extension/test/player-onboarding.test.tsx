import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
	getPlayerIntroductionOffer,
	PlayerOnboarding,
} from "../src/player-onboarding";
import { installPlayerIntroductionKeyboardGuard } from "../src/player-onboarding-input";
import {
	createIntroductionClaim,
	PLAYER_INTRODUCTION_KEY,
	PLAYER_INTRODUCTION_MESSAGE,
} from "../src/player-onboarding-storage";
import type { VideoAdapter } from "../src/source-adapters/core/types";
import type { HostingDisplayState } from "../src/use-hosting-access";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, video: HTMLVideoElement;
let playing: boolean, fingerprint: string, eligible: boolean;
let motionPreference: EventTarget & { matches: boolean };
let props: React.ComponentProps<typeof PlayerOnboarding>;
let send: ReturnType<typeof vi.fn>,
	request: ReturnType<typeof vi.fn>,
	release: () => void;
const changed = vi.fn();
beforeEach(() => {
	vi.useFakeTimers();
	motionPreference = Object.assign(new EventTarget(), { matches: false });
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => motionPreference),
	);
	playing = true;
	fingerprint = "video-1";
	eligible = true;
	changed.mockReset();
	send = vi.fn(async () => ({ allowed: true }));
	request = vi.fn();
	vi.stubGlobal("chrome", {
		runtime: { sendMessage: send, getURL: (p: string) => p },
	});
	vi.stubGlobal("fetch", request);
	vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			disconnect() {}
		},
	);
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
		x: 0,
		y: 0,
		left: 0,
		top: 0,
		right: 1000,
		bottom: 650,
		width: 1000,
		height: 650,
		toJSON() {},
	});
	video = document.createElement("video");
	document.body.append(video);
	Object.defineProperty(video, "readyState", { value: 4, configurable: true });
	const adapter = {
		video,
		provider: "youtube",
		getFingerprint: () => fingerprint,
		getPlaybackSnapshot: () => ({ phase: "content", playing }),
		pause: () => {
			playing = false;
		},
		play: async () => {
			playing = true;
		},
		subscribe: () => () => {},
	} as unknown as VideoAdapter;
	host = document.createElement("div");
	document.body.append(host);
	root = createRoot(host);
	props = {
		adapter,
		ready: true,
		canStart: () => eligible,
		roomId: null,
		onActiveChange: changed,
		resource: null,
	} as React.ComponentProps<typeof PlayerOnboarding>;
	release = installPlayerIntroductionKeyboardGuard();
});
afterEach(async () => {
	await act(async () => root.unmount());
	release();
	host.remove();
	video.remove();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
async function render(
	patch: Partial<React.ComponentProps<typeof PlayerOnboarding>> = {},
	settle = true,
) {
	props = { ...props, ...patch };
	await act(async () => root.render(<PlayerOnboarding {...props} />));
	if (settle) await advance(2_000);
}
async function advance(ms: number) {
	await act(async () => vi.advanceTimersByTimeAsync(ms));
}
async function setVisibility(state: DocumentVisibilityState) {
	vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
	await act(async () => document.dispatchEvent(new Event("visibilitychange")));
}
async function click(label: string) {
	const b = [...host.querySelectorAll("button")].find(
		(el) =>
			el.textContent?.trim() === label ||
			el.getAttribute("aria-label") === label,
	);
	if (!b) throw Error(`Missing button: ${label}`);
	await act(async () => b.click());
}
async function createPractice() {
	await render();
	await click("Open AniDachi controls");
	await click("Create room");
}
async function press(key: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent("keydown", {
		key,
		code: key,
		bubbles: true,
		composed: true,
		cancelable: true,
		...init,
	});
	await act(async () =>
		(document.activeElement ?? window).dispatchEvent(event),
	);
	return event;
}
async function openPracticeChat() {
	await createPractice();
	await click("Copy invite");
}
async function openFinalStep() {
	await openPracticeChat();
	await click("Send message");
	await click("Turn camera on");
}
async function endFinishAnimation() {
	const scene = host.querySelector(".tour-scene");
	if (!scene) throw Error("Missing tour scene");
	await act(async () =>
		scene.dispatchEvent(
			Object.assign(new Event("animationend", { bubbles: true }), {
				animationName: "tour-wipe",
			}),
		),
	);
}
it("rolls away the final screen before resuming, and completes only once", async () => {
	const play = vi.spyOn(props.adapter, "play");
	await openFinalStep();
	await click("Let’s watch");
	expect(host.querySelector(".tour-exit-logo")).not.toBeNull();
	expect(host.querySelector(".tour-scene")?.hasAttribute("inert")).toBe(true);
	expect(document.activeElement).toBe(
		host.querySelector(".player-introduction"),
	);
	await press("Enter");
	await press("Tab");
	await click("Let’s watch"); // A queued duplicate click cannot restart the exit.
	await advance(700);
	expect(playing).toBe(false);
	expect(play).not.toHaveBeenCalled();
	await endFinishAnimation();
	expect(host.textContent).toBe("");
	expect(play).toHaveBeenCalledTimes(1);
	await advance(2_000);
	expect(play).toHaveBeenCalledTimes(1);
});
it("releases the player if an animationend event never arrives", async () => {
	await openFinalStep();
	await click("Let’s watch");
	await advance(1_399);
	expect(playing).toBe(false);
	await advance(1);
	expect(playing).toBe(true);
	expect(host.querySelector(".tour-scene")).toBeNull();
});
it("uses a brief fade without the rolling logo for reduced motion", async () => {
	motionPreference.matches = true;
	await openFinalStep();
	await click("Let’s watch");
	expect(host.querySelector(".tour-exit-roll")).toBeNull();
	await advance(360);
	expect(playing).toBe(true);
	expect(host.querySelector(".tour-scene")).toBeNull();
});
it("ends the roll immediately when reduced motion is enabled", async () => {
	await openFinalStep();
	await click("Let’s watch");
	motionPreference.matches = true;
	await act(async () => motionPreference.dispatchEvent(new Event("change")));
	expect(host.querySelector(".tour-scene")).toBeNull();
	expect(playing).toBe(true);
});
it.each([
	"source",
	"room",
	"pagehide",
])("cancels the roll without resuming after %s interruption", async (reason) => {
	const play = vi.spyOn(props.adapter, "play");
	await openFinalStep();
	await click("Let’s watch");
	if (reason === "source") fingerprint = "video-2";
	if (reason === "room") await render({ roomId: "real-room" }, false);
	if (reason === "pagehide")
		await act(async () => window.dispatchEvent(new Event("pagehide")));
	await advance(2_000);
	expect(host.querySelector(".tour-scene")).toBeNull();
	expect(play).not.toHaveBeenCalled();
});
it("Escape can skip the roll and its pending completion is cleaned up", async () => {
	const play = vi.spyOn(props.adapter, "play");
	await openFinalStep();
	await click("Let’s watch");
	await press("Escape");
	expect(host.querySelector(".tour-exit-roll")).toBeNull();
	await advance(2_000);
	expect(play).toHaveBeenCalledTimes(1);
});
it("keeps an originally paused video paused after the wipe", async () => {
	playing = false;
	await openFinalStep();
	await click("Let’s watch");
	await endFinishAnimation();
	expect(playing).toBe(false);
});
it("cleans up the pending finish callback on unmount", async () => {
	const play = vi.spyOn(props.adapter, "play");
	await openFinalStep();
	await click("Let’s watch");
	await act(async () => root.unmount());
	root = createRoot(host);
	await advance(2_000);
	expect(play).toHaveBeenCalledTimes(1);
});
async function typePracticeMessage(value: string) {
	const input = host.querySelector<HTMLInputElement>(
		".tour-practice-composer input",
	);
	if (!input) throw new Error("Practice composer must be open");
	await act(async () => {
		Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set?.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	});
	return input;
}
it("lets ready video play for two seconds before claiming and showing the tour", async () => {
	await render({}, false);
	await advance(1_999);
	expect(playing).toBe(true);
	expect(host.textContent).toBe("");
	expect(send).not.toHaveBeenCalled();
	await advance(1);
	expect(playing).toBe(false);
	expect(host.textContent).toContain("Welcome to AniDachi");
	expect(send).toHaveBeenCalledTimes(1);
});
it("waits for loaded video and restarts the delay after buffering", async () => {
	Object.defineProperty(video, "readyState", { value: 0, configurable: true });
	await render();
	expect(send).not.toHaveBeenCalled();
	Object.defineProperty(video, "readyState", { value: 4, configurable: true });
	await advance(1_500);
	video.dispatchEvent(new Event("waiting"));
	Object.defineProperty(video, "readyState", { value: 2, configurable: true });
	await advance(3_000);
	expect(playing).toBe(true);
	expect(send).not.toHaveBeenCalled();
	Object.defineProperty(video, "readyState", { value: 4, configurable: true });
	await advance(500); // The next eligibility poll begins the new delay.
	await advance(1_999);
	expect(send).not.toHaveBeenCalled();
	await advance(1);
	expect(playing).toBe(false);
});
it("restarts the delay for a new source instead of pausing it immediately", async () => {
	await render({}, false);
	await advance(1_500);
	fingerprint = "video-2";
	await act(async () => document.dispatchEvent(new Event("visibilitychange")));
	await advance(1_999);
	expect(send).not.toHaveBeenCalled();
	expect(playing).toBe(true);
	await advance(1);
	expect(playing).toBe(false);
});
it("does not claim or pause if a room takes over during the delay", async () => {
	await render({}, false);
	await advance(1_500);
	await render({ roomId: "real-room" });
	expect(send).not.toHaveBeenCalled();
	expect(playing).toBe(true);
});
it("cleans up a pending delay on unmount", async () => {
	await render({}, false);
	await advance(1_500);
	await act(async () => root.render(null));
	await advance(3_000);
	expect(send).not.toHaveBeenCalled();
	expect(playing).toBe(true);
	expect(vi.getTimerCount()).toBe(0);
});
it.each([
	"Copy invite",
	"Invite friends and groups",
])("practices %s without auth, rooms, clipboard or network calls", async (action) => {
	const clipboard = vi.fn();
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText: clipboard },
	});
	await createPractice();
	expect(host.textContent).toContain("Invite a friend");
	expect(host.textContent).toContain("Share the link anywhere.");
	expect(host.textContent).toContain(
		"Add friends in your account → Friends & Groups, then invite them here.",
	);
	const inviteTarget = host.querySelector('[data-tour-target="invite"]');
	expect(inviteTarget?.querySelectorAll("button")).toHaveLength(2);
	expect(inviteTarget?.querySelector('[aria-label="Sync now"]')).toBeNull();
	expect(host.querySelectorAll(".tour-ring")).toHaveLength(1);
	expect(document.activeElement?.getAttribute("aria-label")).toBe(
		"Copy invite",
	);
	expect(host.querySelector(".panel-actions.room-active")).not.toBeNull();
	expect(playing).toBe(false);
	await click(action);
	expect(host.querySelector(".tour-practice-composer input")).not.toBeNull();
	expect(host.querySelector(".mini-panel")).toBeNull();
	await click("Close message");
	await click("Open chat again");
	await click("Send message");
	await click("Turn camera on");
	expect(host.textContent).toContain("Make it yours.");
	expect(host.querySelector('[aria-label="Step 6 of 6"]')).not.toBeNull();
	expect(
		host
			.querySelector('[aria-label="Copy invite"]')
			?.getAttribute("aria-disabled"),
	).toBe("true");
	expect(playing).toBe(false);
	await click("Let’s watch");
	await advance(1_400);
	expect(host.textContent).toBe("");
	expect(playing).toBe(true);
	expect(send.mock.calls).toEqual([[{ type: PLAYER_INTRODUCTION_MESSAGE }]]);
	expect(request).not.toHaveBeenCalled();
	expect(clipboard).not.toHaveBeenCalled();
});
it("lets the final settings screen explore all tabs without saving preferences or playing video", async () => {
	await openPracticeChat();
	await click("Close message");
	await click("Open chat again");
	await click("Send message");
	await click("Turn camera on");
	expect(document.activeElement?.textContent).toBe("Reactions");
	expect(host.querySelector('[data-tour-target="settings"]')).not.toBeNull();
	expect(
		[...host.querySelectorAll(".tour-settings-overview dt")].map(
			(el) => el.textContent,
		),
	).toEqual(["Reactions", "Layout", "Interface", "Room"]);
	await click("Layout");
	expect(
		host.querySelector('[aria-label="Overlay layout editor"]'),
	).not.toBeNull();
	await click("Interface");
	expect(host.textContent).toContain("Main control");
	await click("Room");
	expect(host.textContent).toContain("Room defaults");
	await click("Reactions");
	expect(host.querySelector(".reaction-shortcut-grid")).not.toBeNull();
	expect(playing).toBe(false);
	expect(request).not.toHaveBeenCalled();
	expect(send.mock.calls).toEqual([[{ type: PLAYER_INTRODUCTION_MESSAGE }]]);
	await click("Let’s watch");
	await advance(1_400);
	expect(playing).toBe(true);
	expect(host.textContent).toBe("");
});
it.each([
	"Enter",
	"Send message",
])("advances to camera with %s without sending the typed practice message", async (action) => {
	await openPracticeChat();
	expect(document.activeElement?.getAttribute("aria-label")).toBe(
		"Anidachi message",
	);
	await typePracticeMessage("Hello friends 👋");
	expect(document.activeElement?.getAttribute("aria-label")).toBe(
		"Anidachi message",
	);
	if (action === "Enter") await press("Enter");
	else await click(action);
	expect(host.querySelector(".tour-practice-composer")).toBeNull();
	expect(host.textContent).not.toContain("Hello friends 👋");
	expect(send.mock.calls).toEqual([[{ type: PLAYER_INTRODUCTION_MESSAGE }]]);
	expect(request).not.toHaveBeenCalled();
	expect(playing).toBe(false);
	expect(host.querySelector('[data-tour-target="camera"]')).not.toBeNull();
	expect(document.activeElement?.getAttribute("aria-label")).toBe(
		"Turn camera on",
	);
	await click("Turn camera on");
	expect(host.querySelector(".tour-practice-message")).toBeNull();
	await click("Let’s watch");
	await advance(1_400);
	expect(playing).toBe(true);
});
it("shows the composer immediately on the chat step without an extra Enter", async () => {
	await createPractice();
	await click("Copy invite");
	const input = host.querySelector<HTMLInputElement>(
		".tour-practice-composer input",
	);
	expect(input).not.toBeNull();
	expect(input?.value.trim()).toBeTruthy();
	expect(host.querySelector(".tour-footer [data-tour-next]")).toBeNull();
	expect(document.activeElement).toBe(input);
	expect(playing).toBe(false);
});
it.each([
	"Enter",
	"Send message",
])("continues with %s without requiring a practice message", async (action) => {
	await openPracticeChat();
	await typePracticeMessage("");
	if (action === "Enter") await press("Enter");
	else await click(action);
	expect(host.querySelector('[data-tour-target="camera"]')).not.toBeNull();
	expect(host.querySelector(".tour-practice-composer")).toBeNull();
	expect(request).not.toHaveBeenCalled();
	expect(send.mock.calls).toEqual([[{ type: PLAYER_INTRODUCTION_MESSAGE }]]);
	expect(playing).toBe(false);
});
it.each([
	["camera", "click"],
	["camera", "Enter"],
	["camera", " "],
	["microphone", "click"],
	["microphone", "Enter"],
	["microphone", " "],
])("continues from %s with %s without capturing media", async (control, action) => {
	const capture = vi.fn();
	vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: capture } });
	await openPracticeChat();
	await click("Send message");
	expect(host.textContent).toContain("Talk with friends while you watch.");
	expect(
		[...host.querySelectorAll(".tour-media-states li")].map(
			(el) => el.textContent,
		),
	).toEqual([
		"Hold V to talk",
		"Microphone always on",
		"Camera on",
		"Camera off",
	]);
	expect(host.querySelector(".tour-footer [data-tour-next]")).toBeNull();
	const mic = host.querySelector<HTMLButtonElement>(".panel-media-mic");
	const camera = host.querySelector<HTMLButtonElement>(".panel-media-camera");
	if (!mic || !camera) throw new Error("Missing media controls");
	expect(document.activeElement).toBe(camera);
	const target = control === "camera" ? camera : mic;
	expect(target.closest("[inert]")).toBeNull();
	if (action === "click") await act(async () => target.click());
	else {
		target.focus();
		await press(action);
	}
	expect(host.querySelector('[aria-label="Step 6 of 6"]')).not.toBeNull();
	expect(document.activeElement?.textContent).toBe("Reactions");
	expect(target.closest("[inert]")).not.toBeNull();
	expect(mic.getAttribute("aria-pressed")).toBe(
		String(control === "microphone"),
	);
	expect(camera.getAttribute("aria-checked")).toBe(
		String(control === "camera"),
	);
	expect(
		[...host.querySelectorAll('[role="tab"]')].map((el) => el.textContent),
	).not.toContain("Voice");
	expect(playing).toBe(false);
	expect(capture).not.toHaveBeenCalled();
	expect(request).not.toHaveBeenCalled();
	expect(send.mock.calls).toEqual([[{ type: PLAYER_INTRODUCTION_MESSAGE }]]);
	await click("Let’s watch");
	await advance(1_400);
	expect(host.textContent).toBe("");
	expect(playing).toBe(true);
});
it.each([
	"Close message",
	"Escape",
])("discards a draft with %s without ending the tour", async (action) => {
	await openPracticeChat();
	await typePracticeMessage("Do not send this");
	if (action === "Escape") await press("Escape");
	else await click(action);
	expect(host.querySelector(".tour-practice-message")).toBeNull();
	expect(host.textContent).toContain("Chat with Enter.");
	expect(host.querySelector(".tour-practice-composer")).toBeNull();
	expect(document.activeElement?.getAttribute("aria-label")).toBe(
		"Open chat again",
	);
	await press("Enter");
	expect(
		host.querySelector<HTMLInputElement>(".tour-practice-composer input")
			?.value,
	).toBe("");
	expect(playing).toBe(false);
});
it("ignores held Enter and IME composition before continuing to camera", async () => {
	await openPracticeChat();
	await press("Enter", { repeat: true });
	expect(host.querySelector(".tour-practice-composer")).not.toBeNull();
	const composing = await press("Enter", { isComposing: true });
	expect(composing.defaultPrevented).toBe(false);
	expect(host.querySelector(".tour-practice-composer")).not.toBeNull();
	await press("Enter");
	expect(host.querySelector(".tour-practice-composer")).toBeNull();
	expect(host.querySelector('[data-tour-target="camera"]')).not.toBeNull();
	expect(playing).toBe(false);
});
it("preserves native editing inside the real closed-shadow boundary while shielding player keys", async () => {
	await act(async () => root.unmount());
	const shadowHost = host;
	const shadow = shadowHost.attachShadow({ mode: "closed" });
	host = document.createElement("div");
	shadow.append(host);
	root = createRoot(host);
	const player = vi.fn();
	window.addEventListener("keydown", player, true);
	window.addEventListener("keypress", player, true);
	try {
		await createPractice();
		await click("Copy invite");
		const input = host.querySelector<HTMLInputElement>(
			".tour-practice-composer input",
		);
		if (!input) throw new Error("Closed-shadow chat must open");
		expect(shadow.activeElement).toBe(input);
		for (const init of [
			{ key: "a" },
			{ key: " " },
			{ key: "ArrowLeft" },
			{ key: "v", metaKey: true },
			{ key: "Enter", isComposing: true },
		]) {
			for (const type of ["keydown", "keypress"]) {
				const event = new KeyboardEvent(type, {
					bubbles: true,
					composed: true,
					cancelable: true,
					...init,
				});
				input.dispatchEvent(event);
				expect(event.defaultPrevented).toBe(false);
			}
		}
		expect(player).not.toHaveBeenCalled();
		await typePracticeMessage("Closed shadow works");
		await act(async () =>
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					code: "Enter",
					bubbles: true,
					composed: true,
					cancelable: true,
				}),
			),
		);
		expect(host.querySelector('[data-tour-target="camera"]')).not.toBeNull();
		expect(player).not.toHaveBeenCalled();
		await click("Turn camera on");
		expect(host.querySelector(".tour-practice-composer")).toBeNull();
	} finally {
		window.removeEventListener("keydown", player, true);
		window.removeEventListener("keypress", player, true);
		await act(async () => root.unmount());
		shadowHost.remove();
		host = document.createElement("div");
		document.body.append(host);
		root = createRoot(host);
	}
});
it("walks through the same short scenario with the existing panel styling", async () => {
	await render();
	expect(playing).toBe(false);
	expect(host.textContent).toContain("You can hide the capsule");
	expect(host.textContent).toContain("Auto hide");
	expect(host.textContent).not.toContain("Show me");
	expect(host.querySelector(".top-bubble")).not.toBeNull();
	expect(host.querySelector(".mini-panel")).toBeNull();
	await click("Open AniDachi controls");
	expect(
		host.querySelector(".mini-panel .panel-account-name")?.textContent,
	).toBe("You");
	expect(host.querySelector(".panel-primary-action")?.textContent).toBe(
		"Create room",
	);
	expect(host.textContent).toContain("Practice mode");
	expect(host.querySelector(".tour-hide-hint")).toBeNull();
	const offer = host.querySelector<HTMLAnchorElement>(".tour-plan-link");
	expect(offer?.textContent).toBe("Try 3 days free");
	expect(offer?.href).toBe("http://localhost:3003/checkout?plan=plus&billing=monthly&confirm=trial");
	expect(offer?.target).toBe("_blank");
	expect(offer?.rel).toBe("noopener noreferrer");
	expect(host.textContent).not.toMatch(
		/Sign in|Choose a plan|Pro subscription/,
	);
});
it("uses confirmed trial eligibility, hides paid offers and updates account copy without restarting", async () => {
	const hosting: HostingDisplayState = {
		mode: "paid-hosting",
		busy: false,
		error: false,
		access: {
			ownerUserId: "11111111-1111-4111-8111-111111111111",
			serverTime: "2026-10-10T00:00:00Z",
			entitlementsVersion: 1,
			planCode: "free",
			hosting: {
				hostingPolicyVersion: 2,
				hostingActivationAt: "2026-10-01T00:00:00Z",
				canHost: false,
				trialEligibility: "eligible",
				trialEndsAt: null,
			},
		},
	};
	expect(getPlayerIntroductionOffer("plus")).toBeNull();
	expect(getPlayerIntroductionOffer("pro")).toBeNull();
	expect(getPlayerIntroductionOffer("free")).toBe("plans");
	expect(getPlayerIntroductionOffer("free", { ...hosting, busy: true })).toBe(
		"plans",
	);
	expect(getPlayerIntroductionOffer("free", { ...hosting, error: true })).toBe(
		"plans",
	);
	await render({ accountPlan: "free", hosting });
	await click("Open AniDachi controls");
	expect(host.querySelector(".tour-plan-link")?.textContent).toBe(
		"Try 3 days free",
	);
	if (!hosting.access?.hosting) throw new Error("Hosting fixture missing");
	expect(host.querySelector<HTMLAnchorElement>(".tour-plan-link")?.href).toBe(
		"http://localhost:3003/checkout?plan=plus&billing=monthly&confirm=trial",
	);

	hosting.access.hosting.trialEligibility = "used";
	await render({ hosting });
	expect(host.querySelector(".tour-plan-link")?.textContent).toBe("View plans");
	expect(host.querySelector<HTMLAnchorElement>(".tour-plan-link")?.href).toBe(
		"http://localhost:3003/pricing",
	);
	await render({ accountPlan: "plus", hosting: undefined });
	expect(host.querySelector(".tour-plan-link")).toBeNull();
	expect(host.textContent).toContain("Your plan includes room creation.");
	expect(send).toHaveBeenCalledTimes(1);
	expect(request).not.toHaveBeenCalled();
});
it("allows keyboard activation of the plans link without triggering player keys", async () => {
	await render();
	await click("Open AniDachi controls");
	const link = host.querySelector<HTMLAnchorElement>(".tour-plan-link");
	if (!link) throw new Error("Plan offer should be visible");
	const clicked = vi.fn((event: Event) => event.preventDefault());
	link.addEventListener("click", clicked);
	link.focus();
	await act(async () =>
		link.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Enter",
				code: "Enter",
				bubbles: true,
				cancelable: true,
			}),
		),
	);
	expect(clicked).toHaveBeenCalledTimes(1);
	expect(playing).toBe(false);
	expect(host.querySelector(".mini-panel")).not.toBeNull();
});
it("clears practice room state on skip", async () => {
	await createPractice();
	await click("Skip tour");
	expect(host.querySelector(".mini-panel")).toBeNull();
	expect(playing).toBe(true);
	expect(changed).toHaveBeenLastCalledWith(false);
});
it("shows every settings section with disposable preferences before creating a room", async () => {
	await render();
	await click("Open AniDachi controls");
	expect(
		[...host.querySelectorAll('[role="tab"]')].map((el) => el.textContent),
	).toEqual(["Reactions", "Layout", "Interface", "Room"]);
	expect(host.querySelector(".reaction-shortcut-grid")).not.toBeNull();
	expect(host.querySelector(".room-people-section")).toBeNull();
	await click("Room");
	expect(host.textContent).toContain("Room defaults");
	await click("Interface");
	expect(host.textContent).toContain("Participant pills");
	await click("Layout");
	expect(
		host.querySelector('[aria-label="Overlay layout editor"]'),
	).not.toBeNull();
	await click("Create room");
	expect(host.querySelector(".room-people-section")).not.toBeNull();
	expect(host.querySelector('[aria-label="1/6 media seats"]')).not.toBeNull();
	expect(host.querySelector(".panel-media-camera")).not.toBeNull();
	await click("Skip tour");
	await act(async () => root.render(null));
	await render();
	await click("Open AniDachi controls");
	expect(
		host.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
	).toBe("Reactions");
	expect(request).not.toHaveBeenCalled();
	expect(
		send.mock.calls.every(
			([message]) => message.type === PLAYER_INTRODUCTION_MESSAGE,
		),
	).toBe(true);
});
it("dims the panel around its target and follows the target while scrolling", async () => {
	await render();
	await click("Open AniDachi controls");
	const rect = (left: number, top: number, width: number, height: number) => ({
		x: left,
		y: top,
		left,
		top,
		right: left + width,
		bottom: top + height,
		width,
		height,
		toJSON() {},
	});
	const panel = host.querySelector<HTMLElement>(".mini-panel");
	const create = host.querySelector<HTMLElement>('[data-tour-target="create"]');
	if (!panel || !create) throw new Error("Practice panel must be visible");
	Object.defineProperty(panel, "getBoundingClientRect", {
		value: () => rect(650, 48, 324, 580),
	});
	const buttonRect = vi.fn(() => rect(665, 110, 294, 40));
	Object.defineProperty(create, "getBoundingClientRect", { value: buttonRect });
	await act(async () => panel.dispatchEvent(new Event("scroll")));
	const masks = [...host.querySelectorAll<HTMLElement>(".tour-mask")];
	expect(masks[0].style.height).toBe("105px");
	expect(masks[2].style.width).toBe("660px");
	expect(host.querySelector(".tour-ring")).not.toBeNull();
	buttonRect.mockReturnValue(rect(665, -40, 294, 40));
	await act(async () => panel.dispatchEvent(new Event("scroll")));
	expect(host.querySelector(".tour-ring")).toBeNull();
	expect(host.querySelector(".tour-cue")).toBeNull();
	expect(host.querySelectorAll(".tour-mask")).toHaveLength(1);
	expect(host.querySelector<HTMLElement>(".tour-mask")?.style.inset).toBe("0");
	buttonRect.mockReturnValue(rect(665, 80, 294, 40));
	await act(async () => panel.dispatchEvent(new Event("scroll")));
	expect(host.querySelectorAll(".tour-mask")).toHaveLength(4);
	expect(host.querySelector<HTMLElement>(".tour-ring")?.style.top).toBe("75px");
});
it("preserves native slider keys across the closed shadow boundary while shielding the player", async () => {
	await act(async () => root.unmount());
	const shadowHost = host;
	const shadow = shadowHost.attachShadow({ mode: "closed" });
	host = document.createElement("div");
	shadow.append(host);
	root = createRoot(host);
	const player = vi.fn();
	window.addEventListener("keydown", player, true);
	try {
		await render();
		await click("Open AniDachi controls");
		await click("Layout");
		const slider = host.querySelector<HTMLInputElement>('input[type="range"]');
		if (!slider) throw new Error("Practice layout slider must be visible");
		slider.focus();
		expect(shadow.activeElement).toBe(slider);
		for (const key of [
			"ArrowLeft",
			"ArrowRight",
			"ArrowUp",
			"ArrowDown",
			"Home",
			"End",
		]) {
			const event = new KeyboardEvent("keydown", {
				key,
				code: key,
				bubbles: true,
				cancelable: true,
				composed: true,
			});
			// Happy DOM leaks closed-root children here. Model the path seen by
			// the real browser's window listener, where only the host is exposed.
			vi.spyOn(event, "composedPath").mockReturnValue([
				shadowHost,
				document.body,
				document.documentElement,
				document,
				window,
			]);
			slider.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(false);
		}
		expect(player).not.toHaveBeenCalled();
		expect(playing).toBe(false);
	} finally {
		window.removeEventListener("keydown", player, true);
		await act(async () => root.unmount());
		shadowHost.remove();
		host = document.createElement("div");
		document.body.append(host);
		root = createRoot(host);
	}
});
it("routes practice settings navigation inside the shadow tree without seeking the player", async () => {
	await act(async () => root.unmount());
	const shadowHost = host;
	const shadow = shadowHost.attachShadow({ mode: "closed" });
	host = document.createElement("div");
	shadow.append(host);
	root = createRoot(host);
	const player = vi.fn();
	window.addEventListener("keydown", player, true);
	const pressFocused = async (key: string) => {
		const focused = shadow.activeElement;
		if (!focused) throw new Error("Practice control must be focused");
		await act(async () =>
			focused.dispatchEvent(
				new KeyboardEvent("keydown", {
					key,
					code: key,
					bubbles: true,
					cancelable: true,
					composed: true,
				}),
			),
		);
	};
	try {
		await render();
		await click("Open AniDachi controls");
		await click("Room");
		const mic = host.querySelector(
			'[role="radiogroup"][aria-label="Microphone"]',
		);
		(mic?.querySelector('[aria-checked="true"]') as HTMLElement).focus();
		await pressFocused("End");
		expect(mic?.querySelector('[aria-checked="true"]')?.textContent).toBe(
			"Open mic",
		);
		await pressFocused("Home");
		expect(mic?.querySelector('[aria-checked="true"]')?.textContent).toBe(
			"Last used",
		);
		await click("Interface");
		const group = host.querySelector('[role="radiogroup"]');
		const initial = group?.querySelector('[aria-checked="true"]');
		(initial as HTMLElement).focus();
		await pressFocused("ArrowRight");
		expect(group?.querySelector('[aria-checked="true"]')).not.toBe(initial);
		await click("Layout");
		const move = host.querySelector<HTMLElement>('[aria-label="Move video"]');
		if (!move) throw new Error("Layout control must be visible");
		const left = move.style.left;
		move.focus();
		await pressFocused("ArrowRight");
		expect(move.style.left).not.toBe(left);
		expect(player).not.toHaveBeenCalled();
		expect(playing).toBe(false);
	} finally {
		window.removeEventListener("keydown", player, true);
		await act(async () => root.unmount());
		shadowHost.remove();
		host = document.createElement("div");
		document.body.append(host);
		root = createRoot(host);
	}
});
it("does not resume when the enclosing content lifecycle unmounts first on pagehide", async () => {
	const dispose = () => {
		// mountOverlay.suspend renders adapterActive=false synchronously before
		// the enclosing lifecycle unmounts; verify that cleanup stays paused.
		flushSync(() => root.render(<PlayerOnboarding {...props} ready={false} />));
		root.unmount();
	};
	window.addEventListener("pagehide", dispose);
	try {
		await render();
		expect(playing).toBe(false);
		await act(async () => window.dispatchEvent(new Event("pagehide")));
		expect(playing).toBe(false);
		expect(changed).toHaveBeenLastCalledWith(false);
		root = createRoot(host);
	} finally {
		window.removeEventListener("pagehide", dispose);
	}
});
it("leaves originally paused video paused", async () => {
	playing = false;
	await render();
	await click("Skip tour");
	expect(playing).toBe(false);
});
it("does not start over an existing room or an ineligible player", async () => {
	eligible = false;
	await render();
	expect(send).not.toHaveBeenCalled();
	expect(playing).toBe(true);
});
it("drops pending display when eligibility changes before the claim returns", async () => {
	let resolve!: (v: unknown) => void;
	send.mockImplementation(
		() =>
			new Promise((r) => {
				resolve = r;
			}),
	);
	await render();
	eligible = false;
	await act(async () => resolve({ allowed: true }));
	expect(host.textContent).toBe("");
	expect(playing).toBe(true);
});
it.each([
	"visible",
	"hidden",
] as const)("never resumes playback if a real room starts in a %s tab", async (visibility) => {
	await createPractice();
	await setVisibility(visibility);
	await render({ roomId: "real-room" });
	expect(host.textContent).toBe("");
	expect(playing).toBe(false);
});
it("keeps the create step paused across a pricing-tab visit and continues on return", async () => {
	await render();
	await click("Open AniDachi controls");
	const create = [...host.querySelectorAll("button")].find(
		(button) => button.textContent?.trim() === "Create room",
	);
	if (!create) throw new Error("Practice create control must be present");
	await setVisibility("hidden");
	await advance(10_000);
	expect(host.contains(create)).toBe(true);
	expect(playing).toBe(false);
	await setVisibility("visible");
	expect(host.contains(create)).toBe(true);
	expect(playing).toBe(false);
	expect(send).toHaveBeenCalledTimes(1);
	await click("Create room");
	expect(host.textContent).toContain("Invite a friend");
	await click("Skip tour");
	expect(playing).toBe(true);
});
it("preserves an open practice message and its draft across tab changes", async () => {
	await openPracticeChat();
	const input = await typePracticeMessage("Keep this draft");
	await setVisibility("hidden");
	await advance(5_000);
	await setVisibility("visible");
	expect(host.contains(input)).toBe(true);
	expect(input.value).toBe("Keep this draft");
	expect(playing).toBe(false);
	await click("Send message");
	expect(host.querySelector('[data-tour-target="camera"]')).not.toBeNull();
});
it("waits for a visible tab before starting its warmup and pausing video", async () => {
	await setVisibility("hidden");
	await render();
	expect(host.textContent).toBe("");
	expect(send).not.toHaveBeenCalled();
	expect(playing).toBe(true);
	await setVisibility("visible");
	await advance(1_999);
	expect(playing).toBe(true);
	await advance(1);
	expect(playing).toBe(false);
	expect(host.textContent).toContain("Welcome to AniDachi");
});
it("cancels without resuming when the source changes in a background tab", async () => {
	await render();
	await setVisibility("hidden");
	fingerprint = "video-2";
	await advance(500);
	await setVisibility("visible");
	expect(host.textContent).toBe("");
	expect(playing).toBe(false);
});
it("contains the final Escape keyup so it does not reach the player", async () => {
	const player = vi.fn();
	window.addEventListener("keyup", player, true);
	try {
		await render();
		await act(async () =>
			window.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Escape", code: "Escape" }),
			),
		);
		window.dispatchEvent(
			new KeyboardEvent("keyup", { key: "Escape", code: "Escape" }),
		);
		expect(player).not.toHaveBeenCalled();
		expect(playing).toBe(true);
	} finally {
		window.removeEventListener("keyup", player, true);
	}
});
it("skips previously seen introductions without touching playback", async () => {
	send.mockResolvedValue({ allowed: false });
	await render();
	expect(host.textContent).toBe("");
	expect(playing).toBe(true);
});
it("serializes the installation-wide claim across tabs and worker restarts", async () => {
	const data: Record<string, unknown> = {};
	const area = {
		get: async (k: string) => ({ [k]: data[k] }),
		set: async (v: Record<string, unknown>) => {
			Object.assign(data, v);
		},
	};
	const claim = createIntroductionClaim(area);
	expect(await Promise.all([claim(), claim()])).toEqual([true, false]);
	expect(await createIntroductionClaim(area)()).toBe(false);
	expect(Object.keys(data)).toEqual([PLAYER_INTRODUCTION_KEY]);
});
it("does not claim on storage failure", async () => {
	const claim = createIntroductionClaim({
		get: async () => ({}),
		set: async () => {
			throw Error("unavailable");
		},
	});
	expect(await claim()).toBe(false);
});
