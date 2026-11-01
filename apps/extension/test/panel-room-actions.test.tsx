import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
	PanelRoomActions,
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
	it("does not replace an unknown or guest allowance with a zero timer", async () => {
		await render({ remainingSeconds: null });
		expect(button("End room").textContent).toContain("End room");
		expect(host.textContent).not.toContain("00:00");
		await render({ remainingSeconds: 754, isHost: false, label: "Leave room" });
		expect(button("Leave room").textContent).toContain("Leave room");
		expect(host.textContent).not.toContain("12:34");
	});
	it("keeps the end action accessible while showing real time and confirmation", async () => {
		await render();
		expect(button("End room").textContent).toContain("12:34");
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
			"Sync sent",
		);
		expect(host.textContent).not.toContain("Invite link copied");
	});
	it("does not celebrate a dropped sync and clears a pending animation on disconnect", async () => {
		await render({ onSync: () => false });
		await click("Sync now");
		await advance(650);
		expect(host.textContent).not.toContain("Sync sent");
		expect(host.querySelector('[role="status"]')?.textContent).toContain(
			"Sync unavailable",
		);
		await render({ onSync: () => true });
		await click("Sync now");
		await render({ scopeKey: "login-a:disconnected", syncDisabled: true });
		await advance(650);
		expect(host.textContent).not.toContain("Sync sent");
	});
	function emulateLayoutAndAnimation() {
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(298);
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
			new DOMRect(0, 0, 298, 36),
		);
		Object.defineProperty(HTMLElement.prototype, "animate", {
			configurable: true,
			value: () => ({ finished: new Promise(() => {}), cancel: () => {} }),
		});
	}
	it("waits for the asynchronous room snapshot before moving the idle timer", async () => {
		emulateLayoutAndAnimation();
		await render({ roomId: null, roomReady: false, label: "Create room" });
		await click("Create room");
		await render({
			roomId: "room-a",
			roomReady: false,
			busy: true,
			remainingSeconds: null,
			label: "Creating room",
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
		expect(host.querySelector(".panel-flying-counter")?.textContent).toContain(
			"12:34",
		);
		await render({ roomId: null, roomReady: false });
		expect(host.querySelector(".panel-flying-counter")).toBeNull();
	});

	it("hides a retired authoritative idle observation while waiting for a room snapshot", async () => {
		await render({ roomId: null, roomReady: false, label: "Create room", retainIdleTimeWhileConnecting: false });
		await click("Create room");
		await render({ roomId: "new-room", roomReady: false, label: "End room", remainingSeconds: null });
		expect(host.querySelector(".panel-time-counter")).toBeNull();
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
