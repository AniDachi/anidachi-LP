import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
	PanelRoomActions,
	ROOM_START_PRESENTATION_TIMEOUT_MS,
	type PanelRoomActionsProps,
} from "../src/panel-room-actions";

let root: Root;
let host: HTMLDivElement;
let props: PanelRoomActionsProps;
async function render(patch: Partial<PanelRoomActionsProps> = {}) {
	props = { ...props, ...patch };
	await act(async () => root.render(<PanelRoomActions {...props} />));
}
function button(label: string) {
	const found = host.querySelector<HTMLButtonElement>(
		`button[aria-label="${label}"]`,
	);
	if (!found) throw new Error(`Missing action ${label}`);
	return found;
}
async function click(label: string) {
	await act(async () => button(label).click());
}
async function advance(ms: number) {
	await act(async () => vi.advanceTimersByTimeAsync(ms));
}
describe("real room action feedback", () => {
	beforeEach(() => {
		(
			globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		vi.useFakeTimers();
		host = document.createElement("div");
		document.body.append(host);
		root = createRoot(host);
		props = {
			scopeKey: "login-a:connection-1",
			roomId: "room-a",
			roomReady: true,
			isHost: true,
			label: "End room",
			disabled: false,
			busy: false,
			confirming: false,
			remainingSeconds: 754,
			onPrimaryAction: vi.fn(),
			onCopyInvite: async () => true,
			onSync: () => true,
			onToggleInvite: vi.fn(),
			inviteOpen: false,
			inviteDisabled: false,
			syncDisabled: false,
		};
	});
	afterEach(async () => {
		await act(async () => root.unmount());
		host.remove();
		vi.useRealTimers();
		vi.restoreAllMocks();
		delete (HTMLElement.prototype as any).animate;
	});
	it("reopens a pending legacy start without a captured allowance or NaN digits", async () => {
		await render({ roomReady: false, creating: true, remainingSeconds: null, retainIdleTimeWhileConnecting: true });
		expect(button("Creating room").disabled).toBe(true);
		expect(host.querySelector(".panel-time-counter")).toBeNull();
		expect(host.textContent).not.toContain("NaN");
	});
	it("does not replace an unknown or guest allowance with a zero timer", async () => {
		await render({ remainingSeconds: null });
		expect(button("End room").textContent).toContain("End room");
		expect(host.textContent).not.toContain("00:00");
		await render({ remainingSeconds: 754, isHost: false, label: "Leave room" });
		expect(button("Leave room").textContent).toContain("Leave room");
		expect(host.textContent).not.toContain("12:34");
	});
	it("keeps a disabled red closing action after terminal state until the idle time is ready", async () => {
		await render({ closing: true, roomId: null, remainingSeconds: null, idleTimePending: true, isHost: false });
		expect(button("Closing room").disabled).toBe(true);
		expect(button("Closing room").classList.contains("room-exit")).toBe(true);
		expect(host.querySelector(".panel-time-placeholder")).toBeNull();
		expect(host.querySelector(".panel-action-icons")).toBeNull();
		await render({ closing: false, remainingSeconds: 690, label: "Room closed" });
		expect(button("Create room").classList.contains("room-exit")).toBe(false);
		expect(host.querySelector(".panel-time-counter")?.textContent).toBe("11:30");
	});
	it("suppresses an early balance when closing times out before settlement", async () => {
		await render({ roomId: null, closing: false, remainingSeconds: 780, idleTimeUnavailable: true });
		expect(host.querySelector(".panel-time-counter")).toBeNull();
		expect(button("Retry loading remaining time")).toBeTruthy();
	});
	it("offers a compact retry after a failed idle read without inventing a time value", async () => {
		const retry = vi.fn();
		await render({ roomId: null, roomReady: false, remainingSeconds: null, idleTimePending: true, idleTimeUnavailable: true, onRetryHosting: retry });
		expect(host.querySelector(".panel-time-placeholder")).toBeNull();
		expect(host.querySelector(".panel-time-counter")).toBeNull();
		await click("Retry loading remaining time");
		expect(retry).toHaveBeenCalledTimes(1);
		expect(props.onPrimaryAction).not.toHaveBeenCalled();
		await render({ idleTimeUnavailable: false });
		expect(host.querySelector(".panel-time-placeholder")).not.toBeNull();
	});
	it("keeps the end action accessible while showing real time and confirmation", async () => {
		await render();
		expect(host.querySelector(".panel-action-timer")?.textContent).toContain("12:34");
		await click("End room");
		expect(props.onPrimaryAction).toHaveBeenCalledTimes(1);
		await render({ confirming: true, label: "Press again to end" });
		expect(button("Press again to end").dataset.showAction).toBe("true");
	});
	it("shows a copy failure and does not claim success", async () => {
		await render({ onCopyInvite: async () => false });
		await click("Copy invite");
		expect(host.querySelector('[role="status"]')?.textContent).toContain(
			"Could not copy",
		);
		expect(host.textContent).not.toContain("Invite link copied");
	});
	it("ignores an old copy result after room or login change", async () => {
		let complete!: (value: boolean) => void;
		await render({
			onCopyInvite: () =>
				new Promise((resolve) => {
					complete = resolve;
				}),
		});
		await click("Copy invite");
		await render({ scopeKey: "login-b:connection-1", roomId: "room-b" });
		await act(async () => complete(true));
		expect(host.textContent).not.toContain("Invite link copied");
	});
	it("only the latest action can publish feedback", async () => {
		let complete!: (value: boolean) => void;
		await render({
			onCopyInvite: () =>
				new Promise((resolve) => {
					complete = resolve;
				}),
		});
		await click("Copy invite");
		await click("Sync now");
		await act(async () => complete(true));
		await advance(650);
		expect(host.querySelector('[role="status"]')?.textContent).toContain(
			"Synced",
		);
		expect(host.textContent).not.toContain("Invite link copied");
	});
	it("does not celebrate a dropped sync and clears a pending animation on disconnect", async () => {
		await render({ onSync: () => false });
		await click("Sync now");
		await advance(650);
		expect(host.textContent).not.toContain("Synced");
		expect(host.querySelector('[role="status"]')?.textContent).toContain(
			"Sync unavailable",
		);
		await render({ onSync: () => true });
		await click("Sync now");
		await render({ scopeKey: "login-a:disconnected", syncDisabled: true });
		await advance(650);
		expect(host.textContent).not.toContain("Synced");
	});
	function emulateLayoutAndAnimation() {
		const animations: { finish(): void }[] = [];
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(298);
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
			new DOMRect(0, 0, 298, 36),
		);
		Object.defineProperty(HTMLElement.prototype, "animate", {
			configurable: true,
			value: () => {
				let finish!: () => void;
				let reject!: (reason: Error) => void;
				const finished = new Promise<void>((resolve, rejectPromise) => {
					finish = resolve;
					reject = rejectPromise;
				});
				animations.push({ finish });
				return { finished, cancel: () => reject(new Error("Animation cancelled")) };
			},
		});
		return animations;
	}
	it("keeps the timer visible through pointer jitter and movement during the create transition", async () => {
		const animations = emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await act(async () => button("Create room").dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 150, clientY: 18 })));
		await render({ roomId: "room-a", roomReady: true, label: "End room" });
		const move = async (x: number, y: number) => {
			await act(async () => button("End room").dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y })));
		};
		await move(158, 18); // Moving the button and the hand together must not interrupt its arrival.
		expect(button("End room").dataset.suppressStartHover).toBe("true");
		await act(async () => animations.forEach(animation => animation.finish()));
		await move(158.2, 18.2); // Trackpad/subpixel drift is not a new hover request.
		expect(button("End room").dataset.suppressStartHover).toBe("true");
		await move(165, 18);
		expect(button("End room").dataset.suppressStartHover).toBe("false");
	});
	it("waits for the asynchronous room snapshot before moving the idle timer", async () => {
		emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({
			roomId: "room-a",
			roomReady: false,
			busy: true,
			remainingSeconds: null,
			label: "Create room",
		});
		expect(host.querySelector(".panel-idle-time")?.textContent).toContain(
			"12:34",
		);
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
		await render({
			roomReady: true,
			busy: false,
			remainingSeconds: 754,
			label: "End room",
		});
		expect(host.querySelector(".panel-action-timer")?.textContent).toContain(
			"12:34",
		);
		await render({ roomId: null, roomReady: false });
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
	});
	it("keeps a stalled admission neutral and animates its eventual confirmed room", async () => {
		emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({ roomId: "room-a", creating: true, remainingSeconds: null, isHost: false, label: "Leave room" });
		await render({ creating: false, connectionStalled: true });
		expect(button("Cancel connection").disabled).toBe(false);
		expect(button("Cancel connection").classList.contains("room-exit")).toBe(false);
		expect(host.querySelector(".panel-time-counter,.panel-time-placeholder,.panel-action-icons")).toBeNull();
		await render({ connectionStalled: false, roomReady: true, isHost: true, label: "End room", remainingSeconds: 742 });
		expect(host.querySelector("[data-room-motion=true]")).not.toBeNull();
		expect(host.querySelector(".panel-action-timer strong")?.textContent).toBe("12:22");
	});
	it("keeps one counter through admission, movement and the first live observation", async () => {
		emulateLayoutAndAnimation();
		const startingTime = { seconds: 754, capturedAt: performance.now(), wall: Date.now(), expiresAt: performance.now() + 8_000 };
		await render({ roomId: null, roomReady: false, label: "Create room", retainIdleTimeWhileConnecting: false });
		const counter = host.querySelector(".panel-time-counter");
		await click("Create room");
		await render({ roomId: "room-a", creating: true, remainingSeconds: null, startingTime });
		expect(host.querySelector(".panel-time-counter")).toBe(counter);
		expect(counter?.textContent).toContain("12:34");
		await render({ roomReady: true, creating: false, label: "End room", awaitingHostingTime: true });
		expect(host.querySelector(".panel-action-timer .panel-time-counter")).toBe(counter);
		expect(host.querySelector(".panel-action-time-pending")).toBeNull();
		await render({ startingTime: null, remainingSeconds: 742, awaitingHostingTime: false });
		expect(host.querySelector(".panel-time-counter")).toBe(counter);
		expect(counter?.textContent).toContain("12:22");
	});
	it.each([2_000, 8_000])("keeps the starting number still and retires it at the bounded display deadline: %s", async validFor => {
		const capturedAt = performance.now(), wall = Date.now();
		vi.spyOn(performance, "now").mockImplementation(() => capturedAt + Date.now() - wall);
		await render({ remainingSeconds: null, creating: false, awaitingHostingTime: true,
			startingTime: { seconds: 754, capturedAt, wall, expiresAt: capturedAt + validFor } });
		const counter = host.querySelector(".panel-time-counter");
		await advance(1_000);
		expect(counter?.textContent).toBe("12:34"); // No allowance or countdown is started locally.
		await advance(validFor - 1_001);
		expect(host.querySelector(".panel-time-counter")).toBe(counter);
		await advance(1);
		expect(host.querySelector(".panel-time-counter")).toBeNull();
		expect(button("End room").disabled).toBe(false);
	});
	it("retires the starting number on clock discontinuity and never substitutes it for live time", async () => {
		const capturedAt = performance.now();
		vi.spyOn(performance, "now").mockReturnValue(capturedAt);
		await render({ remainingSeconds: null, creating: false, awaitingHostingTime: true,
			startingTime: { seconds: 754, capturedAt, wall: Date.now(), expiresAt: capturedAt + 8_000 } });
		expect(host.querySelector(".panel-time-counter")?.textContent).toBe("12:34");
		vi.setSystemTime(Date.now() + 10_000);
		await render();
		expect(host.querySelector(".panel-time-counter")).toBeNull();
		await render({ startingTime: null, remainingSeconds: 742, awaitingHostingTime: false });
		expect(host.querySelector(".panel-time-counter")?.textContent).toBe("12:22");
	});

	it("hides a retired authoritative idle observation while waiting for a room snapshot", async () => {
		await render({ roomId: null, roomReady: false, label: "Create room", retainIdleTimeWhileConnecting: false });
		await click("Create room");
		await render({ roomId: "new-room", roomReady: false, label: "End room", remainingSeconds: null });
		expect(host.querySelector(".panel-time-counter")).toBeNull();
		expect(host.querySelector<HTMLElement>(".panel-room-actions")?.dataset.timedLayout).toBe("true");
	});
	it("fills the final timer slot in place when no valid starting observation exists", async () => {
		emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room", retainIdleTimeWhileConnecting: false });
		await click("Create room");
		await render({ roomId: "room-a", roomReady: false, busy: true, remainingSeconds: null });
		await render({ roomReady: true, busy: false, label: "End room", awaitingHostingTime: true });
		expect(button("End room").disabled).toBe(false);
		expect(button("Copy invite")).toBeDefined();
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
		await render({ remainingSeconds: 742, awaitingHostingTime: false });
		const flight = host.querySelector(".panel-time-counter");
		expect(flight?.textContent).toContain("12:22");
		await render({ remainingSeconds: 741 });
		expect(host.querySelector(".panel-time-counter")).toBe(flight);
		expect(flight?.textContent).toContain("12:21");
	});
	it("bounds a stalled initial snapshot without cancelling the room or locking its leave action", async () => {
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({ roomId: "room-a", label: "Leave room", isHost: false, remainingSeconds: null });
		expect(button("Creating room").disabled).toBe(true);
		await advance(ROOM_START_PRESENTATION_TIMEOUT_MS - 1);
		expect(button("Creating room").disabled).toBe(true);
		await advance(1);
		expect(button("Leave room").disabled).toBe(false);
		await click("Leave room");
		expect(props.onPrimaryAction).toHaveBeenCalledTimes(2);
	});
	it("shows a quiet timer placeholder for delayed time, with confirmation still available", async () => {
		await render({ remainingSeconds: null, awaitingHostingTime: true });
		expect(host.querySelector(".panel-action-time-pending")).not.toBeNull();
		expect(button("End room").dataset.showAction).toBe("false");
		expect(button("End room").disabled).toBe(false);
		expect(host.querySelector(".panel-time-counter")).toBeNull();
		await render({ confirming: true, label: "Press again to end" });
		expect(button("Press again to end").dataset.showAction).toBe("true");
		await render({ confirming: false, label: "End room", remainingSeconds: 742, awaitingHostingTime: false });
		expect(host.querySelector(".panel-action-time-pending")).toBeNull();
		expect(host.querySelector(".panel-action-timer")?.textContent).toContain("12:22");
	});
	it("fills late time in place instead of replaying a completed transition", async () => {
		const animations = emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({ roomId: "room-a", roomReady: true, label: "End room", remainingSeconds: null, awaitingHostingTime: true });
		await act(async () => animations.forEach(animation => animation.finish()));
		expect(host.querySelector("[data-room-motion]")).toBeNull();
		await render({ remainingSeconds: 742, awaitingHostingTime: false });
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
		await act(async () => animations.forEach(animation => animation.finish()));
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
		expect(host.querySelector("[data-room-motion]")).toBeNull();
		expect(host.querySelector(".panel-action-timer")?.textContent).toContain("12:22");
	});
	it("shows end confirmation immediately even during the start transition", async () => {
		emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({ roomId: "room-a", roomReady: true, label: "End room" });
		await render({ confirming: true, label: "Press again to end" });
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
		expect(host.querySelector("[data-room-motion]")).toBeNull();
		expect(button("Press again to end").dataset.showAction).toBe("true");
	});
	it("uses the final state directly when reduced motion is requested", async () => {
		emulateLayoutAndAnimation();
		vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({ roomId: "room-a", roomReady: true, label: "End room", remainingSeconds: 742 });
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
		expect(host.querySelector("[data-room-motion]")).toBeNull();
		expect(host.querySelector(".panel-action-timer")?.textContent).toContain("12:22");
	});
	it("uses the current server time for the flight instead of the pre-create value", async () => {
		emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({ roomId: "room-a", roomReady: true, label: "End room", remainingSeconds: 742 });
		expect(host.querySelector(".panel-action-timer")?.textContent).toContain("12:22");
	});
	it("retires the real counter as soon as live time becomes unknown and does not replay on recovery", async () => {
		emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({ roomId: "room-a", roomReady: true, label: "End room" });
		expect(host.querySelector(".panel-time-counter")).not.toBeNull();
		await render({ remainingSeconds: null, awaitingHostingTime: true });
		expect(host.querySelector(".panel-time-counter")).toBeNull();
		await render({ remainingSeconds: 742, awaitingHostingTime: false });
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
	});
	it("discards a pending timer flight on unlimited access or a different source", async () => {
		emulateLayoutAndAnimation();
		for (const boundary of ["unlimited", "source"] as const) {
			await render({ roomId: null, roomReady: false, label: "Create room", remainingSeconds: 754 });
			await click("Create room");
			await render({ roomId: "room-a", roomReady: true, label: "End room", remainingSeconds: null, awaitingHostingTime: true });
			await render(boundary === "unlimited" ? { awaitingHostingTime: false } : { scopeKey: "login-a:source-2" });
			await render({ remainingSeconds: 742, awaitingHostingTime: false });
			expect(host.querySelector(".panel-flying-counter")).toBeNull();
		}
	});
	it("discards a failed start and never replays it for another login or restored room", async () => {
		emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({ busy: true });
		await render({ busy: false });
		await render({
			roomId: "restored-room",
			roomReady: true,
			label: "End room",
		});
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await act(async () =>
			root.render(
				<PanelRoomActions
					key="another-login"
					{...props}
					roomId="other-room"
					roomReady
					remainingSeconds={600}
				/>,
			),
		);
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
	});
	it("finishes a pending transition for a confirmed untimed room without a fake timer", async () => {
		emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({
			roomId: "room-a",
			roomReady: false,
			busy: true,
			remainingSeconds: null,
		});
		await render({
			roomReady: true,
			busy: false,
			remainingSeconds: null,
			label: "End room",
		});
		expect(
			host.querySelector(
				".panel-idle-time,.panel-flying-counter,.panel-action-timer",
			),
		).toBeNull();
		expect(button("End room")).toBeDefined();
	});
});
