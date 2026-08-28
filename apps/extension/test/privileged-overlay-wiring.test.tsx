import type { FriendListItem, RoomInvite } from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountOverlay, type OverlayRenderer } from "../entrypoints/content";
import { AUTH_TOKENS_KEY } from "../src/auth-tokens";
import * as overlayApp from "../src/overlay-app";
import type { PrivilegedOverlayContext } from "../src/privileged-overlay-intent";
import { REACTION_SHORTCUTS_STORAGE_KEY } from "../src/reaction-shortcuts";
import { RoomClient } from "../src/room-client";
import { listInviteTargets, listRoomInvites } from "../src/social-client";
import type { VideoAdapter } from "../src/source-adapters/core/types";

const extensionStorage = vi.hoisted(() => {
	const values = new Map<string, unknown>();
	const listeners = new Map<
		string,
		Set<(value: unknown, oldValue: unknown) => void>
	>();
	const storage = {
		async getItem<T>(key: string): Promise<T | null> {
			return (values.get(key) as T | undefined) ?? null;
		},
		async setItem<T>(key: string, value: T): Promise<void> {
			const oldValue = values.get(key);
			values.set(key, value);
			for (const listener of listeners.get(key) ?? [])
				listener(value, oldValue);
		},
		async removeItem(key: string): Promise<void> {
			const oldValue = values.get(key);
			values.delete(key);
			for (const listener of listeners.get(key) ?? []) listener(null, oldValue);
		},
		watch<T>(
			key: string,
			listener: (value: T | null, oldValue: T | null) => void,
		) {
			const scoped = listeners.get(key) ?? new Set();
			scoped.add(listener as (value: unknown, oldValue: unknown) => void);
			listeners.set(key, scoped);
			return () =>
				scoped.delete(listener as (value: unknown, oldValue: unknown) => void);
		},
	};
	return { storage, values };
});

vi.mock("wxt/utils/storage", () => ({ storage: extensionStorage.storage }));

vi.mock("../src/social-client", async (importOriginal) => ({
	...(await importOriginal<typeof import("../src/social-client")>()),
	listInviteTargets: vi.fn(),
	listRoomInvites: vi.fn(),
}));

describe("privileged overlay wiring", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		document.body.replaceChildren();
		extensionStorage.values.clear();
		vi.mocked(listInviteTargets).mockReset();
		vi.mocked(listRoomInvites).mockReset();
	});

	it("keeps the overlay tree closed to the hosting page", () => {
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0);
			return 1;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
			() => undefined,
		);
		const container = document.createElement("div");
		const video = document.createElement("video");
		container.append(video);
		document.body.append(container);
		const renderer: OverlayRenderer = { render: vi.fn(), unmount: vi.fn() };
		const mounted = mountOverlay(createAdapter(container, video), { renderer });

		const host = document.querySelector("anidachi-overlay-root");
		expect(host?.shadowRoot).toBeNull();

		mounted.dispose();
	});

	it("keeps both OverlayApp teardown paths untouched after synthetic privileged controls", async () => {
		const teardown = vi.fn();
		const context: PrivilegedOverlayContext = {
			accountUserId: "user-a",
			roomId: "room-a",
			role: "host",
			authorityGeneration: 3,
		};

		for (const action of ["sign-out", "end-room"] as const) {
			await expect(
				overlayApp.runOverlayPrivilegedAction(
					{ nativeEvent: { isTrusted: false } },
					action,
					action === "sign-out"
						? {
								...context,
								roomId: null,
								role: null,
								authorityGeneration: null,
							}
						: context,
					teardown,
				),
			).rejects.toThrow("Privileged action requires a trusted user gesture");
		}

		expect(teardown).not.toHaveBeenCalled();
	});

	it("runs an OverlayApp teardown once after a trusted privileged action succeeds", async () => {
		const sendMessage = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("chrome", { runtime: { sendMessage } });
		const teardown = vi.fn();

		await overlayApp.runOverlayPrivilegedAction(
			{ nativeEvent: { isTrusted: true } },
			"end-room",
			{
				accountUserId: "user-a",
				roomId: "room-a",
				role: "host",
				authorityGeneration: 3,
			},
			teardown,
		);

		expect(teardown).toHaveBeenCalledTimes(1);
	});

	it("does not suppress silent auth recovery after a trusted sign-out request is rejected", async () => {
		let currentSession: ReturnType<typeof sessionFor> | null =
			sessionFor("user-a");
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (
					message.type === "ANIDACHI_AUTH" &&
					message.command === "sign-in-silent"
				) {
					currentSession = sessionFor("user-a");
					return { ok: true, tokens: currentSession };
				}
				if (message.type === "ANIDACHI_AUTH") {
					return { ok: true, tokens: currentSession };
				}
				if (message.type === "ANIDACHI_PRIVILEGED_OVERLAY_INTENT") {
					return { ok: false, error: "Privileged sign-out rejected" };
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		await trustedClick(button(view.container, "Sign out"));
		await trustedClick(button(view.container, "Press again to sign out"));
		expect(button(view.container, "Sign out")).toBeInstanceOf(
			HTMLButtonElement,
		);

		currentSession = null;
		await extensionStorage.storage.removeItem(AUTH_TOKENS_KEY);
		await flushMountedWork();
		await click(button(view.container, "Close Anidachi controls"));
		await click(button(view.container, "Open Anidachi controls"));
		await flushMountedWork();

		expect(
			sendMessage.mock.calls.filter(
				([message]) =>
					(message as { type?: string; command?: string }).type ===
						"ANIDACHI_AUTH" &&
					(message as { command?: string }).command === "sign-in-silent",
			),
		).toHaveLength(1);
		expect(button(view.container, "Sign out")).toBeInstanceOf(
			HTMLButtonElement,
		);
		await unmount(view.root);
	});

	it("requires a second trusted click to sign out and resets the confirmation", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				if (message.type === "ANIDACHI_PRIVILEGED_OVERLAY_INTENT") {
					return { ok: false, error: "Privileged sign-out rejected" };
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const setTimeoutSpy = vi.spyOn(window, "setTimeout");
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		const timerCallCountBeforeConfirmation = setTimeoutSpy.mock.calls.length;
		const signOut = button(view.container, "Sign out");

		await trustedClick(signOut);

		expect(privilegedInvokes(sendMessage)).toHaveLength(0);
		expect(button(view.container, "Press again to sign out")).toBe(signOut);

		const confirmationTimer = setTimeoutSpy.mock.calls
			.slice(timerCallCountBeforeConfirmation)
			.at(-1)?.[0];
		if (typeof confirmationTimer !== "function") {
			throw new Error("Missing sign-out confirmation timer");
		}
		await act(async () => {
			confirmationTimer();
			await Promise.resolve();
		});

		expect(button(view.container, "Sign out")).toBe(signOut);
		await trustedClick(signOut);
		expect(privilegedInvokes(sendMessage)).toHaveLength(0);
		expect(button(view.container, "Press again to sign out")).toBe(signOut);

		await trustedClick(signOut);
		expect(privilegedInvokes(sendMessage)).toHaveLength(1);
		expect(button(view.container, "Sign out")).toBe(signOut);
		await unmount(view.root);
	});

	it("keeps sign out inactive outside its compact button", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		const footer = view.container.querySelector(".account-footer");
		if (!(footer instanceof HTMLDivElement)) {
			throw new Error("Missing account footer");
		}

		const footerClick = new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(footerClick, "isTrusted", {
			configurable: true,
			value: true,
		});
		await act(async () => {
			footer.dispatchEvent(footerClick);
			await Promise.resolve();
		});

		expect(privilegedInvokes(sendMessage)).toHaveLength(0);
		expect(button(view.container, "Sign out")).toBeInstanceOf(
			HTMLButtonElement,
		);
		await unmount(view.root);
	});

	it("uses scannable icons for settings and sign out without changing their actions", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));

		expect(
			view.container.querySelector(".settings-section-title-icon"),
		).toBeInstanceOf(SVGElement);
		expect(
			view.container.querySelector(".settings-section-title-label")
				?.textContent,
		).toBe("Settings");

		const signOut = button(view.container, "Sign out");
		expect(signOut.querySelector(".account-footer-action-icon")).toBeInstanceOf(
			SVGElement,
		);

		await unmount(view.root);
	});

	it("dismisses unavailable live-media guidance after a short delay", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH") {
					return { ok: true, tokens: sessionFor("user-a") };
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const setTimeoutSpy = vi.spyOn(window, "setTimeout");
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Voice"));
		const timersBeforeAction = setTimeoutSpy.mock.calls.length;
		await click(button(view.container, "Open mic"));

		const notice = view.container.querySelector(".panel-action-notice");
		expect(notice?.textContent).toContain(
			"Join a room before enabling Open mic.",
		);
		const dismissTimer = setTimeoutSpy.mock.calls
			.slice(timersBeforeAction)
			.find(
				([, delay]) => delay === overlayApp.TRANSIENT_PANEL_NOTICE_DURATION_MS,
			)?.[0];
		if (typeof dismissTimer !== "function") {
			throw new Error("Missing transient panel notice timer");
		}

		await act(async () => {
			dismissTimer();
			await Promise.resolve();
		});
		expect(view.container.querySelector(".panel-action-notice")).toBeNull();

		await unmount(view.root);
	});

	it.each([
		"sign-out",
		"end-room",
	] as const)("keeps the mounted room reconnect timer after a trusted %s request is rejected", async (action) => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH") {
					return { ok: true, tokens: sessionFor("user-a") };
				}
				if (
					message.type === "ANIDACHI_ROOM_HTTP" &&
					message.command === "create-room"
				) {
					return {
						ok: true,
						room: {
							roomId: "room-a",
							roomToken: "room-token-a",
							shareableLink: "http://localhost:3003/room/room-a",
							privilegedRoomAuthority: roomAuthority(),
							roomSession: confirmedRoomSession(),
						},
					};
				}
				if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
					const response = roomSessionStorageResponse(message.command);
					if (response) return response;
				}
				if (message.type === "ANIDACHI_PRIVILEGED_OVERLAY_INTENT") {
					return { ok: false, error: `Privileged ${action} rejected` };
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		let roomConnectionOptions: Parameters<RoomClient["connect"]>[0] | null =
			null;
		vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
			roomConnectionOptions = options;
			options.onStatus("connected");
			options.onEvent({
				type: "ROOM_SNAPSHOT",
				roomId: "room-a",
				roomGeneration: 1,
				sourceGeneration: 1,
				serverSeq: 1,
				participants: [hostParticipant()],
			});
		});
		const setTimeoutSpy = vi.spyOn(window, "setTimeout");
		const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
		const close = vi.spyOn(RoomClient.prototype, "close");
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Create room"));
		close.mockClear();
		await act(async () => {
			roomConnectionOptions?.onStatus("closed");
			await Promise.resolve();
		});
		const reconnectCallIndex = setTimeoutSpy.mock.calls.findIndex(
			([, delay]) => delay === 900,
		);
		expect(reconnectCallIndex).toBeGreaterThanOrEqual(0);
		const reconnectTimerId =
			setTimeoutSpy.mock.results[reconnectCallIndex]?.value;
		const actionButton =
			action === "sign-out"
				? button(view.container, "Sign out")
				: primaryRoomAction(view.container);

		await trustedClick(actionButton);
		if (action === "sign-out") {
			expect(privilegedInvokes(sendMessage)).toHaveLength(0);
			await trustedClick(button(view.container, "Press again to sign out"));
		}

		expect(privilegedInvokes(sendMessage)).toHaveLength(1);
		expect(close).not.toHaveBeenCalled();
		expect(clearTimeoutSpy).not.toHaveBeenCalledWith(reconnectTimerId);
		expect(button(view.container, "Sign out")).toBeInstanceOf(
			HTMLButtonElement,
		);
		expect(primaryRoomAction(view.container)).toBeInstanceOf(HTMLButtonElement);
		await unmount(view.root);
	});

	it("keeps the mounted OverlayApp signed in after a synthetic sign-out control click", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const view = await renderOverlay();
		const close = vi.spyOn(RoomClient.prototype, "close");

		await click(button(view.container, "Open Anidachi controls"));
		const signOut = button(view.container, "Sign out");
		await click(signOut);

		expect(privilegedInvokes(sendMessage)).toHaveLength(0);
		expect(close).not.toHaveBeenCalled();
		expect(button(view.container, "Sign out")).toBe(signOut);
		await unmount(view.root);
	});

	it("exposes quick reactions as a stateful switch that only toggles from the switch", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		const reactionsSwitch = view.container.querySelector(
			"button.settings-toggle-switch",
		);
		if (!(reactionsSwitch instanceof HTMLButtonElement)) {
			throw new Error("Missing on-screen reactions control");
		}

		expect(reactionsSwitch.getAttribute("aria-label")).toBe("Quick reactions");
		const reactionsLabel = view.container.querySelector(
			".settings-toggle-switch-label",
		);
		expect(reactionsLabel?.textContent).toBe("Quick reactions");
		expect(reactionsSwitch.contains(reactionsLabel)).toBe(false);
		expect(reactionsSwitch.textContent).not.toContain("On");
		expect(reactionsSwitch.getAttribute("role")).toBe("switch");
		expect(reactionsSwitch.getAttribute("aria-checked")).toBe("true");
		expect(
			view.container.querySelector('[aria-label="Reaction shortcut editor"]'),
		).toBeInstanceOf(HTMLDivElement);

		await act(async () => {
			reactionsLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});

		expect(reactionsSwitch.getAttribute("aria-checked")).toBe("true");

		await click(reactionsSwitch);

		expect(reactionsSwitch.getAttribute("aria-checked")).toBe("false");
		expect(reactionsSwitch.textContent).not.toContain("Off");
		expect(
			view.container.querySelector('[aria-label="Reaction shortcut editor"]'),
		).toBeNull();

		await click(reactionsSwitch);

		expect(reactionsSwitch.getAttribute("aria-checked")).toBe("true");
		expect(
			view.container.querySelector('[aria-label="Reaction shortcut editor"]'),
		).toBeInstanceOf(HTMLDivElement);
		await unmount(view.root);
	});

	it("explains quick reactions from a keyboard-accessible help control", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		const help = button(view.container, "About quick reactions");
		const tooltipId = help.getAttribute("aria-describedby");
		const tooltip = tooltipId
			? view.container.querySelector(`#${tooltipId}`)
			: null;

		expect(help.querySelector("svg")).toBeInstanceOf(SVGElement);
		expect(tooltip?.getAttribute("role")).toBe("tooltip");
		expect(tooltip?.textContent).toBe(
			"Assign emojis to keys 1–0. Press a number during a room to send a quick reaction.",
		);

		await unmount(view.root);
	});

	it("positions the settings track indicator from the selected label geometry", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		const categoryRail = view.container.querySelector(
			'[aria-label="Settings sections"]',
		);
		if (!(categoryRail instanceof HTMLDivElement)) {
			throw new Error("Missing settings category rail");
		}

		expect(categoryRail.dataset.activeCategory).toBe("reactions");
		categoryRail.getBoundingClientRect = vi.fn(
			() => ({ left: 100, right: 400, width: 300 }) as DOMRect,
		);
		const layoutTab = button(view.container, "Layout");
		layoutTab.getBoundingClientRect = vi.fn(
			() => ({ left: 170, right: 220, width: 50 }) as DOMRect,
		);

		await click(layoutTab);
		expect(categoryRail.dataset.activeCategory).toBe("layout");
		expect(
			categoryRail.style.getPropertyValue("--settings-indicator-left"),
		).toBe("70px");
		expect(
			categoryRail.style.getPropertyValue("--settings-indicator-width"),
		).toBe("50px");

		await unmount(view.root);
	});

	it("keeps the mounted OverlayApp host room intact after a synthetic end-room control click", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				if (
					message.type === "ANIDACHI_ROOM_HTTP" &&
					message.command === "create-room"
				) {
					return {
						ok: true,
						room: {
							roomId: "room-a",
							roomToken: "room-token-a",
							shareableLink: "http://localhost:3003/room/room-a",
							privilegedRoomAuthority: roomAuthority(),
							roomSession: confirmedRoomSession(),
						},
					};
				}
				if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
					const response = roomSessionStorageResponse(message.command);
					if (response) return response;
				}
				if (
					message.type === "ANIDACHI_PRIVILEGED_OVERLAY_INTENT" &&
					message.command === "invoke"
				) {
					return { ok: true, endedAt: "2026-08-21T00:00:00.000Z" };
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const view = await renderOverlay();

		const close = vi.spyOn(RoomClient.prototype, "close");
		vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
			options.onStatus("connected");
			options.onEvent({
				type: "ROOM_SNAPSHOT",
				roomId: "room-a",
				roomGeneration: 1,
				sourceGeneration: 1,
				serverSeq: 1,
				participants: [hostParticipant()],
			});
		});

		await click(button(view.container, "Open Anidachi controls"));
		const createRoom = button(view.container, "Create room");
		await click(createRoom);
		const endRoom = primaryRoomAction(view.container);
		close.mockClear();
		await click(endRoom);

		expect(privilegedInvokes(sendMessage)).toHaveLength(0);
		expect(close).not.toHaveBeenCalled();
		expect(primaryRoomAction(view.container)).toBe(endRoom);

		await trustedClick(endRoom);

		expect(privilegedInvokes(sendMessage)).toHaveLength(1);
		expect(close).toHaveBeenCalledTimes(1);
		expect(primaryRoomAction(view.container)).toBe(endRoom);
		expect(primaryRoomAction(view.container).classList).not.toContain(
			"room-exit",
		);
		await unmount(view.root);
	});

	it("opens the emoji picker and inserts an emoji inside a closed overlay", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				if (
					message.type === "ANIDACHI_ROOM_HTTP" &&
					message.command === "create-room"
				) {
					return {
						ok: true,
						room: {
							roomId: "room-a",
							roomToken: "room-token-a",
							shareableLink: "http://localhost:3003/room/room-a",
							privilegedRoomAuthority: roomAuthority(),
							roomSession: confirmedRoomSession(),
						},
					};
				}
				if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
					const response = roomSessionStorageResponse(message.command);
					if (response) return response;
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
			options.onStatus("connected");
			options.onEvent({
				type: "ROOM_SNAPSHOT",
				roomId: "room-a",
				roomGeneration: 1,
				sourceGeneration: 1,
				serverSeq: 1,
				participants: [hostParticipant()],
			});
		});
		const view = await renderOverlayInClosedShadow();

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Create room"));
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					bubbles: true,
					cancelable: true,
					code: "Enter",
					composed: true,
					key: "Enter",
				}),
			);
			await Promise.resolve();
		});

		const emojiPicker = button(view.container, "Choose emoji");
		await act(async () => {
			emojiPicker.dispatchEvent(
				new PointerEvent("pointerdown", {
					bubbles: true,
					cancelable: true,
					composed: true,
				}),
			);
			await Promise.resolve();
		});
		expect(button(view.container, "Choose emoji")).toBe(emojiPicker);
		await act(async () => {
			emojiPicker.click();
			await Promise.resolve();
		});

		expect(
			button(view.container, "Choose emoji").getAttribute("aria-expanded"),
		).toBe("true");
		const emojiPopover = view.container.querySelector(
			".message-composer-emoji-popover",
		);
		const emoji = emojiPopover?.querySelector<HTMLButtonElement>("button");
		if (!(emoji instanceof HTMLButtonElement))
			throw new Error("Missing composer emoji option");
		await act(async () => {
			emoji.dispatchEvent(
				new PointerEvent("pointerdown", {
					bubbles: true,
					cancelable: true,
					composed: true,
				}),
			);
			emoji.click();
			await Promise.resolve();
		});

		const input = view.container.querySelector<HTMLInputElement>(
			'input[aria-label="Anidachi message"]',
		);
		expect(input?.value).toContain(emoji.textContent);

		const shield = view.container.querySelector(".message-composer-shield");
		if (!(shield instanceof HTMLDivElement))
			throw new Error("Missing composer shield");
		await act(async () => {
			shield.dispatchEvent(
				new PointerEvent("pointerdown", {
					bubbles: true,
					cancelable: true,
					composed: true,
				}),
			);
			await Promise.resolve();
		});
		expect(
			view.container.querySelector<HTMLInputElement>(
				'input[aria-label="Anidachi message"]',
			),
		).toBeNull();
		expect(view.container.querySelector(".message-composer-shield")).toBeNull();
		expect(document.documentElement.dataset.anidachiComposerOpen).toBeUndefined();
		expect(
			view.container.parentElement?.dataset.anidachiComposerOpen,
		).toBeUndefined();
		await unmount(view.root);
	});

	it("does not attach composer dismissal to window when ShadowRoot constructor identity differs", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				if (
					message.type === "ANIDACHI_ROOM_HTTP" &&
					message.command === "create-room"
				) {
					return {
						ok: true,
						room: {
							roomId: "room-a",
							roomToken: "room-token-a",
							shareableLink: "http://localhost:3003/room/room-a",
							privilegedRoomAuthority: roomAuthority(),
							roomSession: confirmedRoomSession(),
						},
					};
				}
				if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
					const response = roomSessionStorageResponse(message.command);
					if (response) return response;
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
			options.onStatus("connected");
			options.onEvent({
				type: "ROOM_SNAPSHOT",
				roomId: "room-a",
				roomGeneration: 1,
				sourceGeneration: 1,
				serverSeq: 1,
				participants: [hostParticipant()],
			});
		});
		const view = await renderOverlayInClosedShadow();

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Create room"));
		const nativeAddEventListener = window.addEventListener.bind(window);
		const windowComposerListeners = new Map<
			string,
			EventListenerOrEventListenerObject[]
		>([
			["pointerdown", []],
			["pointermove", []],
			["mousemove", []],
		]);
		vi.spyOn(window, "addEventListener").mockImplementation(
			(type, listener, options) => {
				windowComposerListeners.get(type)?.push(listener);
				nativeAddEventListener(type, listener, options);
			},
		);
		vi.stubGlobal("ShadowRoot", class ForeignShadowRoot {});
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					bubbles: true,
					cancelable: true,
					code: "Enter",
					composed: true,
					key: "Enter",
				}),
			);
			await Promise.resolve();
		});
		expect(windowComposerListeners.get("pointerdown")).toHaveLength(0);
		expect(windowComposerListeners.get("pointermove")).toHaveLength(0);
		expect(windowComposerListeners.get("mousemove")).toHaveLength(0);

		await unmount(view.root);
	});

	it("sends the assigned quick reaction when enabled and releases the digit when disabled", async () => {
		await extensionStorage.storage.setItem(REACTION_SHORTCUTS_STORAGE_KEY, {
			version: 1,
			emojis: ["🥳", "😱", "❤️", "🔥", "😭", "👀", "👏", "🤯", "😮‍💨", "💯"],
		});
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				if (
					message.type === "ANIDACHI_ROOM_HTTP" &&
					message.command === "create-room"
				) {
					return {
						ok: true,
						room: {
							roomId: "room-a",
							roomToken: "room-token-a",
							shareableLink: "http://localhost:3003/room/room-a",
							privilegedRoomAuthority: roomAuthority(),
							roomSession: confirmedRoomSession(),
						},
					};
				}
				if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
					const response = roomSessionStorageResponse(message.command);
					if (response) return response;
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
			options.onStatus("connected");
			options.onEvent({
				type: "ROOM_SNAPSHOT",
				roomId: "room-a",
				roomGeneration: 1,
				sourceGeneration: 1,
				serverSeq: 1,
				participants: [hostParticipant()],
			});
		});
		const send = vi.spyOn(RoomClient.prototype, "send").mockReturnValue("sent");
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Create room"));
		await flushMountedWork();
		await click(button(view.container, "Close Anidachi controls"));
		send.mockClear();

		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					bubbles: true,
					cancelable: true,
					code: "Digit1",
					composed: true,
					key: "1",
				}),
			);
			await Promise.resolve();
		});

		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "REACTION",
				reaction: expect.objectContaining({ emoji: "🥳" }),
			}),
		);

		const repeatedDigit = new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			code: "Digit1",
			composed: true,
			key: "1",
			repeat: true,
		});
		const releasedDigit = new KeyboardEvent("keyup", {
			bubbles: true,
			cancelable: true,
			code: "Digit1",
			composed: true,
			key: "1",
		});

		await act(async () => {
			window.dispatchEvent(repeatedDigit);
			window.dispatchEvent(releasedDigit);
			await Promise.resolve();
		});

		expect(repeatedDigit.defaultPrevented).toBe(true);
		expect(releasedDigit.defaultPrevented).toBe(true);
		expect(send).toHaveBeenCalledTimes(1);

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Quick reactions"));
		send.mockClear();
		const disabledDigit = new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			code: "Digit1",
			composed: true,
			key: "1",
		});

		await act(async () => {
			window.dispatchEvent(disabledDigit);
			await Promise.resolve();
		});

		expect(disabledDigit.defaultPrevented).toBe(false);
		expect(send).not.toHaveBeenCalled();
		await unmount(view.root);
	});

	it("ignores incoming emoji reactions while disabled without hiding text chat", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				if (
					message.type === "ANIDACHI_ROOM_HTTP" &&
					message.command === "create-room"
				) {
					return {
						ok: true,
						room: {
							roomId: "room-a",
							roomToken: "room-token-a",
							shareableLink: "http://localhost:3003/room/room-a",
							privilegedRoomAuthority: roomAuthority(),
							roomSession: confirmedRoomSession(),
						},
					};
				}
				if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
					const response = roomSessionStorageResponse(message.command);
					if (response) return response;
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		let roomConnectionOptions: Parameters<RoomClient["connect"]>[0] | null =
			null;
		vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
			roomConnectionOptions = options;
			options.onStatus("connected");
			options.onEvent({
				type: "ROOM_SNAPSHOT",
				roomId: "room-a",
				roomGeneration: 1,
				sourceGeneration: 1,
				serverSeq: 1,
				participants: [hostParticipant(), guestParticipant()],
			});
		});
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Create room"));
		await flushMountedWork();
		await click(button(view.container, "Close Anidachi controls"));

		await act(async () => {
			roomConnectionOptions?.onEvent({
				type: "REACTION",
				reaction: {
					id: "reaction-visible-before-disable",
					userId: guestParticipant().id,
					roomId: "room-a",
					emoji: "😱",
					videoTime: 11,
					createdAt: 0,
				},
			});
			await Promise.resolve();
		});
		expect(
			view.container.querySelector(".reaction-pop")?.textContent,
		).toContain("😱");
		const reactingGuestSlot = view.container.querySelector(
			`.room-rail-slot[data-participant-id="${guestParticipant().id}"]`,
		);
		expect(reactingGuestSlot?.getAttribute("data-presentation")).toBe(
			"compact",
		);
		expect(reactingGuestSlot?.getAttribute("data-reaction-cue")).toBe("true");
		expect(
			view.container
				.querySelector(".reaction-pop")
				?.getAttribute("data-origin-kind"),
		).toBe("pill");

		const overlay = view.container.querySelector(".anidachi-overlay");
		if (!(overlay instanceof HTMLElement)) {
			throw new Error("Overlay root not found.");
		}
		const cameraAnchor = document.createElement("div");
		cameraAnchor.className = "cam-bubble";
		cameraAnchor.dataset.participantId = guestParticipant().id;
		overlay.append(cameraAnchor);
		await act(async () => {
			roomConnectionOptions?.onEvent({
				type: "REACTION",
				reaction: {
					id: "reaction-visible-from-camera",
					userId: guestParticipant().id,
					roomId: "room-a",
					emoji: "👏",
					videoTime: 11,
					createdAt: 1,
				},
			});
			await Promise.resolve();
		});
		await flushMountedWork();
		const cameraReaction = [
			...view.container.querySelectorAll(".reaction-pop"),
		].find((item) => item.textContent?.includes("👏"));
		expect(cameraReaction?.getAttribute("data-origin-kind")).toBe("camera");
		expect(cameraReaction?.getAttribute("data-lane-index")).toBe("1");

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Quick reactions"));
		expect(view.container.querySelector(".reaction-pop")).toBeNull();

		await act(async () => {
			roomConnectionOptions?.onEvent({
				type: "REACTION",
				reaction: {
					id: "reaction-emoji-disabled",
					userId: guestParticipant().id,
					roomId: "room-a",
					emoji: "😂",
					videoTime: 12,
					createdAt: 1,
				},
			});
			roomConnectionOptions?.onEvent({
				type: "REACTION",
				reaction: {
					id: "reaction-chat-enabled",
					userId: guestParticipant().id,
					roomId: "room-a",
					text: "Chat stays visible",
					videoTime: 12,
					createdAt: 2,
				},
			});
			await Promise.resolve();
		});
		await flushMountedWork();

		expect(view.container.querySelector(".reaction-pop")).toBeNull();
		expect(view.container.querySelector(".live-chat-text")?.textContent).toBe(
			"Chat stays visible",
		);
		await unmount(view.root);
	});

	it("refreshes an open invite panel when an invited participant joins", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				if (
					message.type === "ANIDACHI_ROOM_HTTP" &&
					message.command === "create-room"
				) {
					return {
						ok: true,
						room: {
							roomId: "room-a",
							roomToken: "room-token-a",
							shareableLink: "http://localhost:3003/room/room-a",
							privilegedRoomAuthority: roomAuthority(),
							roomSession: confirmedRoomSession(),
						},
					};
				}
				if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
					const response = roomSessionStorageResponse(message.command);
					if (response) return response;
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		vi.mocked(listInviteTargets).mockResolvedValue({
			friends: [inviteFriend()],
			groups: [],
		});
		vi.mocked(listRoomInvites)
			.mockResolvedValueOnce(invitesResponse("pending"))
			.mockResolvedValueOnce(invitesResponse("accepted"));

		let roomConnectionOptions: Parameters<RoomClient["connect"]>[0] | null =
			null;
		vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
			roomConnectionOptions = options;
			options.onStatus("connected");
			options.onEvent({
				type: "ROOM_SNAPSHOT",
				roomId: "room-a",
				roomGeneration: 1,
				sourceGeneration: 1,
				serverSeq: 1,
				participants: [hostParticipant()],
			});
		});
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Create room"));
		await click(button(view.container, "Invite friends and groups"));
		await flushMountedWork();

		expect(button(view.container, "Pending")).toBeInstanceOf(HTMLButtonElement);
		expect(listRoomInvites).toHaveBeenCalledTimes(1);

		await act(async () => {
			roomConnectionOptions?.onEvent({
				type: "PARTICIPANT_JOINED",
				participant: guestParticipant(),
			});
			await Promise.resolve();
		});
		await flushMountedWork();

		expect(listRoomInvites).toHaveBeenCalledTimes(2);
		expect(button(view.container, "Accepted")).toBeInstanceOf(
			HTMLButtonElement,
		);
		await unmount(view.root);
	});

	it("shows one active-room conflict and opens the authoritative room", async () => {
		const sendMessage = vi.fn(
			async (message: {
				type?: string;
				command?: string;
				roomId?: string | null;
			}) => {
				if (message.type === "ANIDACHI_AUTH")
					return { ok: true, tokens: sessionFor("user-a") };
				if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
					if (message.command === "load") return { ok: true, record: null };
					if (message.command === "prepare") {
						return {
							ok: true,
							record: null,
							prepared: {
								...preparedRoomSession(),
								roomId: message.roomId ?? null,
							},
						};
					}
					if (message.command === "discard-prepared") {
						return { ok: true, record: null, prepared: null };
					}
				}
				if (
					message.type === "ANIDACHI_ROOM_HTTP" &&
					message.command === "create-room"
				) {
					return {
						ok: false,
						error: "An active room already exists",
						code: "ACTIVE_ROOM_CONFLICT",
						status: 409,
						activeRoom: {
							roomId: "room-active",
							role: "member",
							provider: "youtube",
							title: "Active video",
						},
					};
				}
				if (
					message.type === "ANIDACHI_ROOM_HTTP" &&
					message.command === "connect-room" &&
					message.roomId === "room-active"
				) {
					return {
						ok: true,
						connection: {
							roomToken: "room-token-active",
							roomSession: {
								...confirmedRoomSession(),
								roomId: "room-active",
							},
						},
					};
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const connect = vi
			.spyOn(RoomClient.prototype, "connect")
			.mockImplementation((options) => {
				options.onStatus("connected");
			});
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Create room"));
		await flushMountedWork();

		expect(view.container.textContent).toContain(
			"You already have an active watch room.",
		);
		await click(button(view.container, "Open active room"));
		await flushMountedWork();

		expect(connect).toHaveBeenCalledWith(
			expect.objectContaining({
				roomId: "room-active",
				participantSessionId: "participant-session-a",
			}),
		);
		expect(view.container.textContent).not.toContain(
			"You already have an active watch room.",
		);
		await unmount(view.root);
	});

	it("does not take over an active room from a different provider tab", async () => {
		const sendMessage = vi.fn(
			async (message: { type?: string; command?: string }) => {
				if (message.type === "ANIDACHI_AUTH") {
					return { ok: true, tokens: sessionFor("user-a") };
				}
				if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
					if (message.command === "load") return { ok: true, record: null };
					if (message.command === "prepare") {
						return {
							ok: true,
							record: null,
							prepared: preparedRoomSession(),
						};
					}
					if (message.command === "discard-prepared") {
						return { ok: true, record: null, prepared: null };
					}
				}
				if (
					message.type === "ANIDACHI_ROOM_HTTP" &&
					message.command === "create-room"
				) {
					return {
						ok: false,
						error: "An active room already exists",
						code: "ACTIVE_ROOM_CONFLICT",
						status: 409,
						activeRoom: {
							roomId: "room-active",
							role: "member",
							provider: "crunchyroll",
							title: "Active episode",
						},
					};
				}
				throw new Error(
					`Unexpected runtime message ${message.type}:${message.command}`,
				);
			},
		);
		installOverlayRuntime(sendMessage);
		const connect = vi.spyOn(RoomClient.prototype, "connect");
		const view = await renderOverlay();

		await click(button(view.container, "Open Anidachi controls"));
		await click(button(view.container, "Create room"));
		await flushMountedWork();

		expect(view.container.textContent).toContain(
			"You already have an active watch room on Crunchyroll. Open that tab to continue.",
		);
		expect(view.container.textContent).not.toContain("Open active room");
		expect(connect).not.toHaveBeenCalled();
		await unmount(view.root);
	});
});

function createAdapter(
	container: HTMLElement,
	video: HTMLVideoElement,
): VideoAdapter {
	return {
		id: "youtube",
		provider: "youtube",
		video,
		container,
		getFingerprint: () => "youtube|test",
		getTitle: () => "Test video",
		getOverlayBinding: () => ({
			mountTarget: container,
			fillMountTarget: true,
			useNativePlayerDoubleClick: true,
		}),
		getOverlayGeometry: () => ({
			controlsVisible: true,
			viewport: { widthPx: 1280, heightPx: 720 },
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
			launcher: { topPx: 10, rightPx: 10 },
			panel: { topPx: 48, rightPx: 10 },
		}),
		subscribeOverlayGeometry: () => () => undefined,
		getCurrentTime: () => 0,
		getDuration: () => 0,
		getPlaybackRate: () => 1,
		getState: () => ({
			videoFingerprint: "youtube|test",
			sourceUrl: location.href,
			playing: false,
			hostTime: 0,
			updatedAt: 0,
			playbackRate: 1,
		}),
		getPlaybackSnapshot: () => ({
			currentTime: 0,
			duration: 0,
			paused: true,
			playbackRate: 1,
		}),
		isPaused: () => true,
		isFullscreen: () => false,
		pause: () => undefined,
		play: async () => undefined,
		seek: () => undefined,
		setPlaybackRate: () => undefined,
		subscribe: () => () => undefined,
		duckVolume: () => () => undefined,
		enterFullscreen: async () => undefined,
		exitFullscreen: async () => undefined,
		getSourceDescriptor: () => ({
			provider: "youtube",
			videoFingerprint: "youtube|test",
			sourceUrl: location.href,
			canonicalUrl: location.href,
			title: null,
		}),
	} as unknown as VideoAdapter;
}

function sessionFor(userId: string) {
	return {
		accessToken: `access-token-${userId}`,
		refreshToken: `refresh-token-${userId}`,
		user: {
			id: userId,
			email: `${userId}@example.com`,
			displayName: "User",
			avatarUrl: null,
			plan: "free" as const,
		},
	};
}

function roomAuthority(): PrivilegedOverlayContext {
	return {
		accountUserId: "user-a",
		roomId: "room-a",
		role: "host",
		authorityGeneration: 1,
	};
}

function preparedRoomSession() {
	return {
		version: 1 as const,
		preparationId: "preparation-room-a",
		roomId: null,
		ownerUserId: "user-a",
		participantSessionId: "participant-session-a",
	};
}

function confirmedRoomSession() {
	return {
		version: 1 as const,
		revision: 1,
		roomId: "room-a",
		ownerUserId: "user-a",
		participantSessionId: "participant-session-a",
		voiceMode: "push-to-talk" as const,
	};
}

function roomSessionStorageResponse(command: string | undefined) {
	if (command === "load") return { ok: true, record: null };
	if (command === "prepare") {
		return { ok: true, record: null, prepared: preparedRoomSession() };
	}
	if (command === "discard-prepared") {
		return { ok: true, record: null, prepared: null };
	}
	return null;
}

function hostParticipant() {
	return {
		id: "user-a",
		displayName: "User",
		role: "host" as const,
		cameraEnabled: false,
		mediaSeat: "none" as const,
		syncStatus: "unknown" as const,
		lastSeenAt: 0,
	};
}

function guestParticipant() {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		displayName: "Ads Mag",
		role: "viewer" as const,
		cameraEnabled: false,
		mediaSeat: "none" as const,
		syncStatus: "unknown" as const,
		lastSeenAt: 0,
	};
}

function inviteFriend(): FriendListItem {
	return {
		friendshipId: "22222222-2222-4222-8222-222222222222",
		user: {
			userId: guestParticipant().id,
			handle: null,
			displayName: guestParticipant().displayName,
			avatarUrl: null,
		},
		status: "accepted",
		direction: "mutual",
		requestedAt: "2026-08-22T08:00:00.000Z",
		respondedAt: "2026-08-22T08:01:00.000Z",
		updatedAt: "2026-08-22T08:01:00.000Z",
	};
}

function invitesResponse(status: RoomInvite["recipients"][number]["status"]) {
	const invite: RoomInvite = {
		id: "33333333-3333-4333-8333-333333333333",
		roomId: "room-a",
		sender: {
			userId: "44444444-4444-4444-8444-444444444444",
			handle: null,
			displayName: "Host",
			avatarUrl: null,
		},
		targetKind: "direct",
		targetGroupId: null,
		message: null,
		roomTitle: "Test video",
		sourceUrl: "https://www.youtube.com/watch?v=test",
		videoFingerprint: "youtube|test",
		createdAt: "2026-08-22T08:00:00.000Z",
		expiresAt: "2026-08-22T20:00:00.000Z",
		recipients: [
			{
				user: inviteFriend().user,
				status,
				updatedAt: "2026-08-22T08:01:00.000Z",
				respondedAt: status === "pending" ? null : "2026-08-22T08:01:00.000Z",
			},
		],
	};
	return {
		meta: { serverTime: "2026-08-22T08:01:00.000Z", schemaVersion: 1 as const },
		inbox: [],
		sent: [invite],
	};
}

async function renderOverlay(): Promise<{
	container: HTMLDivElement;
	root: Root;
}> {
	(
		globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	Object.defineProperty(navigator, "locks", {
		configurable: true,
		value: undefined,
	});
	const container = document.createElement("div");
	const video = document.createElement("video");
	container.append(video);
	document.body.append(container);
	const root = createRoot(container);
	await act(async () => {
		root.render(
			<overlayApp.OverlayApp adapter={createAdapter(container, video)} />,
		);
		await Promise.resolve();
		await Promise.resolve();
	});
	return { container, root };
}

async function renderOverlayInClosedShadow(): Promise<{
	container: HTMLDivElement;
	root: Root;
}> {
	(
		globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	Object.defineProperty(navigator, "locks", {
		configurable: true,
		value: undefined,
	});
	const adapterContainer = document.createElement("div");
	const video = document.createElement("video");
	const overlayHost = document.createElement("anidachi-overlay-root");
	const shadowRoot = overlayHost.attachShadow({ mode: "closed" });
	const container = document.createElement("div");
	shadowRoot.append(container);
	adapterContainer.append(video, overlayHost);
	document.body.append(adapterContainer);
	const root = createRoot(container);
	await act(async () => {
		root.render(
			<overlayApp.OverlayApp
				adapter={createAdapter(adapterContainer, video)}
			/>,
		);
		await Promise.resolve();
		await Promise.resolve();
	});
	return { container, root };
}

function installOverlayRuntime(sendMessage: ReturnType<typeof vi.fn>): void {
	vi.stubGlobal("chrome", {
		runtime: { sendMessage },
		storage: {
			onChanged: {
				addListener: () => undefined,
				removeListener: () => undefined,
			},
		},
	});
}

async function click(target: HTMLButtonElement): Promise<void> {
	await act(async () => {
		target.click();
		await Promise.resolve();
		await Promise.resolve();
	});
}

async function trustedClick(target: HTMLButtonElement): Promise<void> {
	const event = new MouseEvent("click", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "isTrusted", {
		configurable: true,
		value: true,
	});
	await act(async () => {
		target.dispatchEvent(event);
		await Promise.resolve();
		await Promise.resolve();
	});
}

function button(container: HTMLElement, name: string): HTMLButtonElement {
	const found = [...container.querySelectorAll("button")].find(
		(candidate) =>
			candidate.getAttribute("aria-label") === name ||
			candidate.textContent?.trim() === name,
	);
	if (!(found instanceof HTMLButtonElement))
		throw new Error(`Missing button ${name}`);
	return found;
}

function primaryRoomAction(container: HTMLElement): HTMLButtonElement {
	const action = container.querySelector("button.panel-primary-action");
	if (!(action instanceof HTMLButtonElement))
		throw new Error("Missing primary room action");
	return action;
}

function privilegedInvokes(sendMessage: ReturnType<typeof vi.fn>) {
	return sendMessage.mock.calls.filter(
		([message]) =>
			(message as { type?: string; command?: string }).type ===
				"ANIDACHI_PRIVILEGED_OVERLAY_INTENT" &&
			(message as { command?: string }).command === "invoke",
	);
}

async function unmount(root: Root): Promise<void> {
	await act(async () => root.unmount());
}

async function flushMountedWork(): Promise<void> {
	await act(async () => {
		for (let index = 0; index < 8; index += 1) {
			await Promise.resolve();
		}
	});
}
