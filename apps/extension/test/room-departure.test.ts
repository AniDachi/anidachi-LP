import { describe, expect, it, vi } from "vitest";
import type { ExtensionAuthTokens } from "../src/auth-tokens";
import {
	confirmExplicitRoomDeparture,
	departActiveWebsiteRoomFromApi,
	departWebsiteRoomFromApi,
	handleActiveRoomRecovery,
	handleExplicitRoomDeparture,
	handleRoomTabDeparture,
	isRoomDepartureRuntimeMessage,
	type RoomDepartureRequestResult,
	requestCurrentRoomDeparture,
} from "../src/room-departure";
import type { RoomSessionRecord } from "../src/room-session-storage";

describe("closed-tab room departure", () => {
	it("releases the exact server assignment before clearing a closed tab", async () => {
		const requestDeparture = vi.fn(async () => ({
			kind: "ack" as const,
			outcome: "departed" as const,
		}));
		const recoverActiveDeparture = vi.fn();
		const clearRoomSession = vi.fn(async () => true);

		await expect(
			handleRoomTabDeparture(11, {
				loadRoomSession: async () => roomSession(),
				getStoredSession: async () => authSession(),
				requestDeparture,
				recoverActiveDeparture,
				clearRoomSession,
			}),
		).resolves.toBe("departed");

		expect(requestDeparture).toHaveBeenCalledWith(
			roomSession(),
			"access-user-a",
			expect.any(AbortSignal),
		);
		expect(recoverActiveDeparture).not.toHaveBeenCalled();
		expect(clearRoomSession).toHaveBeenCalledWith(11, roomSession());
		expect(requestDeparture.mock.invocationCallOrder[0]).toBeLessThan(
			clearRoomSession.mock.invocationCallOrder[0] ?? 0,
		);
	});

	it("still clears exact local state when the close accelerator cannot release", async () => {
		const clearRoomSession = vi.fn(async () => true);

		await expect(
			handleRoomTabDeparture(14, {
				loadRoomSession: async () => roomSession(),
				getStoredSession: async () => authSession(),
				requestDeparture: async () => ({
					kind: "retryable",
					code: "ROOM_DEPARTURE_UNAVAILABLE",
					message: "Try again",
				}),
				clearRoomSession,
			}),
		).resolves.toBe("retryable");

		expect(clearRoomSession).toHaveBeenCalledWith(14, roomSession());
	});

	it("leaves a newer local tab state intact when the close snapshot is missing", async () => {
		const requestDeparture = vi.fn();
		const recoverActiveDeparture = vi.fn();
		const replacementSession = {
			...roomSession(),
			participantSessionId: "participant-session-replacement",
		};
		let storedSession: RoomSessionRecord | null = null;
		const clearRoomSession = vi.fn(async () => {
			storedSession = null;
			return true;
		});

		await expect(
			handleRoomTabDeparture(12, {
				loadRoomSession: async () => {
					storedSession = replacementSession;
					return null;
				},
				requestDeparture,
				recoverActiveDeparture,
				clearRoomSession,
			}),
		).resolves.toBe("no-session");

		expect(clearRoomSession).not.toHaveBeenCalled();
		expect(storedSession).toEqual(replacementSession);
		expect(requestDeparture).not.toHaveBeenCalled();
		expect(recoverActiveDeparture).not.toHaveBeenCalled();
	});

	it("leaves a newer local tab state intact when the close snapshot is unreadable", async () => {
		const requestDeparture = vi.fn();
		const recoverActiveDeparture = vi.fn();
		const replacementSession = {
			...roomSession(),
			participantSessionId: "participant-session-replacement",
		};
		let storedSession: RoomSessionRecord | null = null;
		const clearRoomSession = vi.fn(async () => {
			storedSession = null;
			return true;
		});

		await expect(
			handleRoomTabDeparture(13, {
				loadRoomSession: async () => {
					storedSession = replacementSession;
					throw new Error("storage unavailable");
				},
				requestDeparture,
				recoverActiveDeparture,
				clearRoomSession,
			}),
		).resolves.toBe("failed");

		expect(clearRoomSession).not.toHaveBeenCalled();
		expect(storedSession).toEqual(replacementSession);
		expect(requestDeparture).not.toHaveBeenCalled();
		expect(recoverActiveDeparture).not.toHaveBeenCalled();
	});
});

describe("departure API responses", () => {
	it("sends only the exact session field to the public room route", async () => {
		const fetcher = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				Response.json({ ok: true, outcome: "departed" }, { status: 200 }),
		);
		const controller = new AbortController();

		await expect(
			departWebsiteRoomFromApi(
				roomSession(),
				"access-user-a",
				controller.signal,
				fetcher,
			),
		).resolves.toEqual({ kind: "ack", outcome: "departed" });

		const [url, init] = fetcher.mock.calls[0] ?? [];
		expect(String(url)).toContain("/api/rooms/room-a/depart");
		expect(init).toMatchObject({
			method: "POST",
			keepalive: true,
			headers: {
				Authorization: "Bearer access-user-a",
				"Content-Type": "application/json",
			},
			signal: controller.signal,
		});
		expect(JSON.parse(String(init?.body))).toEqual({
			participantSessionId: "participant-session-a",
		});
	});

	it("maps typed retryable, changed-assignment, and auth failures", async () => {
		const controller = new AbortController();
		const fetch503: typeof fetch = async () =>
			Response.json(
				{
					code: "ROOM_DEPARTURE_UNAVAILABLE",
					message: "Could not leave right now. Please try again.",
					retryable: true,
				},
				{ status: 503 },
			);
		const fetch409: typeof fetch = async () =>
			Response.json(
				{
					code: "ACTIVE_ROOM_CHANGED",
					message: "Your active room changed. Nothing was removed.",
				},
				{ status: 409 },
			);
		const fetch401: typeof fetch = async () =>
			Response.json(
				{ code: "AUTH_REQUIRED", message: "Sign in again before leaving." },
				{ status: 401 },
			);

		await expect(
			departWebsiteRoomFromApi(
				roomSession(),
				"access-user-a",
				controller.signal,
				fetch503,
			),
		).resolves.toEqual({
			kind: "retryable",
			code: "ROOM_DEPARTURE_UNAVAILABLE",
			message: "Could not leave right now. Please try again.",
		});
		await expect(
			departWebsiteRoomFromApi(
				roomSession(),
				"access-user-a",
				controller.signal,
				fetch409,
			),
		).resolves.toEqual({
			kind: "active-room-changed",
			message: "Your active room changed. Nothing was removed.",
		});
		await expect(
			departWebsiteRoomFromApi(
				roomSession(),
				"access-user-a",
				controller.signal,
				fetch401,
			),
		).resolves.toEqual({ kind: "unauthorized" });
	});

	it("rejects malformed bodies instead of trusting only the status code", async () => {
		const controller = new AbortController();

		await expect(
			departWebsiteRoomFromApi(
				roomSession(),
				"access-user-a",
				controller.signal,
				async () => Response.json({ message: "anything" }, { status: 401 }),
			),
		).resolves.toEqual({ kind: "failed" });
	});
});

describe("explicit room departure", () => {
	it("binds every explicit departure request to the account visible in the overlay", () => {
		expect(
			isRoomDepartureRuntimeMessage({
				type: "ANIDACHI_ROOM_DEPARTURE",
				command: "depart",
				roomId: "room-a",
				expectedUserId: "user-a",
				participantSessionId: "participant-session-a",
			}),
		).toBe(true);
		expect(
			isRoomDepartureRuntimeMessage({
				type: "ANIDACHI_ROOM_DEPARTURE",
				command: "depart",
				roomId: "room-a",
				expectedUserId: "user-a",
			}),
		).toBe(false);
		expect(
			isRoomDepartureRuntimeMessage({
				type: "ANIDACHI_ROOM_DEPARTURE",
				command: "recover-active",
				roomId: "room-a",
				expectedUserId: "user-a",
			}),
		).toBe(true);
		expect(
			isRoomDepartureRuntimeMessage({
				type: "ANIDACHI_ROOM_DEPARTURE",
				command: "recover-active",
				roomId: "room-a",
			}),
		).toBe(false);
	});

	it("does not invoke emergency recovery when the exact tab record is missing", async () => {
		const recoverActiveDeparture = vi.fn();

		await expect(
			handleExplicitRoomDeparture(16, "room-a", "user-a", "participant-session-a", {
				loadRoomSession: async () => null,
				recoverActiveDeparture,
			}),
		).resolves.toBe("no-session");

		expect(recoverActiveDeparture).not.toHaveBeenCalled();
	});

	it("accepts an exact stale acknowledgement without invoking emergency recovery", async () => {
		const depart = vi.fn().mockResolvedValue({ kind: "ack", outcome: "stale" });
		const recoverActiveDeparture = vi.fn();

		await expect(
			handleExplicitRoomDeparture(16, "room-a", "user-a", "participant-session-a", {
				loadRoomSession: async () => roomSession(),
				getStoredSession: async () => authSession(),
				refreshSession: async () => null,
				requestDeparture: depart,
				recoverActiveDeparture,
				timeoutMs: 100,
			}),
		).resolves.toBe("stale");

		expect(recoverActiveDeparture).not.toHaveBeenCalled();
	});

	it("does not depart a replacement participant session for an old leave command", async () => {
		const requestDeparture = vi.fn();

		await expect(
			handleExplicitRoomDeparture(
				16,
				"room-a",
				"user-a",
				"participant-session-old",
				{
					loadRoomSession: async () => roomSession(),
					getStoredSession: async () => authSession(),
					requestDeparture,
				},
			),
		).resolves.toBe("active-room-changed");

		expect(requestDeparture).not.toHaveBeenCalled();
	});

	it("keeps typed durable failures recoverable without emergency fallback", async () => {
		const recoverActiveDeparture = vi.fn();
		const clearRoomSession = vi.fn();

		await expect(
			handleExplicitRoomDeparture(16, "room-a", "user-a", "participant-session-a", {
				loadRoomSession: async () => roomSession(),
				getStoredSession: async () => authSession(),
				requestDeparture: async () => ({
					kind: "retryable",
					code: "ROOM_DEPARTURE_UNAVAILABLE",
					message: "Could not leave right now. Please try again.",
				}),
				recoverActiveDeparture,
				clearRoomSession,
			}),
		).resolves.toBe("retryable");

		expect(recoverActiveDeparture).not.toHaveBeenCalled();
		expect(clearRoomSession).not.toHaveBeenCalled();
	});

	it("keeps a changed active-room assignment recoverable", async () => {
		const clearRoomSession = vi.fn();

		await expect(
			handleExplicitRoomDeparture(16, "room-a", "user-a", "participant-session-a", {
				loadRoomSession: async () => roomSession(),
				getStoredSession: async () => authSession(),
				requestDeparture: async () => ({
					kind: "active-room-changed",
					message: "Your active room changed. Nothing was removed.",
				}),
				clearRoomSession,
			}),
		).resolves.toBe("active-room-changed");

		expect(clearRoomSession).not.toHaveBeenCalled();
	});

	it("refreshes only after an unauthorized exact departure and retries once", async () => {
		const requestDeparture = vi
			.fn<
				(
					record: RoomSessionRecord,
					accessToken: string,
				) => Promise<RoomDepartureRequestResult>
			>()
			.mockResolvedValueOnce({ kind: "unauthorized" })
			.mockResolvedValueOnce({ kind: "ack", outcome: "departed" });

		await expect(
			handleExplicitRoomDeparture(16, "room-a", "user-a", "participant-session-a", {
				loadRoomSession: async () => roomSession(),
				getStoredSession: async () => authSession(),
				refreshSession: async () => ({
					...authSession(),
					accessToken: "fresh-access",
				}),
				requestDeparture,
				timeoutMs: 100,
			}),
		).resolves.toBe("departed");

		expect(requestDeparture).toHaveBeenNthCalledWith(
			1,
			roomSession(),
			"access-user-a",
			expect.any(AbortSignal),
		);
		expect(requestDeparture).toHaveBeenNthCalledWith(
			2,
			roomSession(),
			"fresh-access",
			expect.any(AbortSignal),
		);
	});

	it("stops exact-session retry when token refresh switches accounts", async () => {
		const requestDeparture = vi
			.fn<
				(
					record: RoomSessionRecord,
					accessToken: string,
				) => Promise<RoomDepartureRequestResult>
			>()
			.mockResolvedValueOnce({ kind: "unauthorized" })
			.mockResolvedValueOnce({ kind: "ack", outcome: "departed" });
		const recoverActiveDeparture = vi.fn();

		await expect(
			handleExplicitRoomDeparture(16, "room-a", "user-a", "participant-session-a", {
				loadRoomSession: async () => roomSession(),
				getStoredSession: async () => authSession("user-a"),
				refreshSession: async () => authSession("user-b"),
				requestDeparture,
				recoverActiveDeparture,
				timeoutMs: 100,
			}),
		).resolves.toBe("account-changed");

		expect(requestDeparture).toHaveBeenCalledTimes(1);
		expect(recoverActiveDeparture).not.toHaveBeenCalled();
	});

	it("uses the emergency endpoint only for the explicit recovery command", async () => {
		const recoverActiveDeparture = vi.fn().mockResolvedValue({
			kind: "ack",
			outcome: "departed",
		});

		await expect(
			handleActiveRoomRecovery("room-a", "user-a", {
				getStoredSession: async () => authSession(),
				refreshSession: async () => null,
				recoverActiveDeparture,
			}),
		).resolves.toBe("departed");

		expect(recoverActiveDeparture).toHaveBeenCalledOnce();
	});

	it("tears down the local room exactly once for every acknowledged outcome", async () => {
		for (const outcome of [
			"departed",
			"room_ended",
			"already_departed",
			"stale",
		] as const) {
			const onConfirmed = vi.fn();
			await expect(
				confirmExplicitRoomDeparture({
					roomSession: roomSession(),
					cancelPendingJoin: vi.fn(),
					requestDeparture: async () => outcome,
					getCurrentRoomSession: () => roomSession(),
					onConfirmed,
				}),
			).resolves.toBe(outcome);
			expect(onConfirmed).toHaveBeenCalledOnce();
			expect(onConfirmed).toHaveBeenCalledWith(roomSession(), outcome);
		}
	});

	it("invalidates an in-flight join before departure and ignores an old acknowledgement after the session changes", async () => {
		const departingSession = roomSession();
		const replacementSession = {
			...roomSession(),
			participantSessionId: "participant-session-b",
		};
		let currentSession: RoomSessionRecord | null = departingSession;
		const events: string[] = [];
		const onConfirmed = vi.fn();

		await expect(
			confirmExplicitRoomDeparture({
				roomSession: departingSession,
				cancelPendingJoin: () => events.push("join-cancelled"),
				requestDeparture: async () => {
					events.push("departure-requested");
					currentSession = replacementSession;
					return "stale";
				},
				getCurrentRoomSession: () => currentSession,
				onConfirmed,
			}),
		).resolves.toBe("stale");

		expect(events).toEqual(["join-cancelled", "departure-requested"]);
		expect(onConfirmed).not.toHaveBeenCalled();
	});

	it("confirms teardown for the captured session after mutable session updates", async () => {
		const departingSession = roomSession();
		const currentSession = { ...departingSession, revision: 4 };
		const onConfirmed = vi.fn();

		await expect(
			confirmExplicitRoomDeparture({
				roomSession: departingSession,
				cancelPendingJoin: vi.fn(),
				requestDeparture: async () => "already_departed",
				getCurrentRoomSession: () => currentSession,
				onConfirmed,
			}),
		).resolves.toBe("already_departed");

		expect(onConfirmed).toHaveBeenCalledOnce();
		expect(onConfirmed).toHaveBeenCalledWith(
			departingSession,
			"already_departed",
		);
	});

	it("keeps the local room available for retry when departure is not confirmed", async () => {
		const teardown = vi.fn();

		await expect(
			confirmExplicitRoomDeparture({
				roomSession: roomSession(),
				cancelPendingJoin: vi.fn(),
				requestDeparture: async () => {
					throw new Error("temporary departure failure");
				},
				getCurrentRoomSession: () => roomSession(),
				onConfirmed: teardown,
			}),
		).rejects.toThrow("temporary departure failure");

		expect(teardown).not.toHaveBeenCalled();
	});

	it("keeps the background tab record until the overlay confirms local teardown", async () => {
		const clearRoomSession = vi.fn(async () => true);

		await expect(
			handleExplicitRoomDeparture(16, "room-a", "user-a", "participant-session-a", {
				loadRoomSession: async () => roomSession(),
				getStoredSession: async () => authSession(),
				requestDeparture: async () => ({
					kind: "ack",
					outcome: "already_departed",
				}),
				clearRoomSession,
			}),
		).resolves.toBe("already_departed");

		expect(clearRoomSession).not.toHaveBeenCalled();
	});

	it("binds the background departure command to the captured participant session", async () => {
		const sendMessage = vi.fn(async () => ({
			ok: true,
			outcome: "stale" as const,
		}));

		await expect(
			requestCurrentRoomDeparture(roomSession(), { sendMessage }),
		).resolves.toBe("stale");

		expect(sendMessage).toHaveBeenCalledWith({
			type: "ANIDACHI_ROOM_DEPARTURE",
			command: "depart",
			roomId: "room-a",
			expectedUserId: "user-a",
			participantSessionId: "participant-session-a",
		});
	});

	it("accepts legacy-compatible stale after a lost successful response", async () => {
		const sendMessage = vi.fn(async () => ({
			ok: true,
			outcome: "stale" as const,
		}));

		await expect(
			requestCurrentRoomDeparture(roomSession(), { sendMessage }),
		).resolves.toBe("stale");
	});

	it("sends only the selected room to the authenticated active-session recovery route", async () => {
		const fetcher = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				Response.json({ ok: true, outcome: "departed" }, { status: 200 }),
		);
		const controller = new AbortController();

		await expect(
			departActiveWebsiteRoomFromApi(
				"room-a",
				"access-user-a",
				controller.signal,
				fetcher,
			),
		).resolves.toEqual({ kind: "ack", outcome: "departed" });

		const [url, init] = fetcher.mock.calls[0] ?? [];
		expect(String(url)).toContain("/api/rooms/active-session/depart");
		expect(JSON.parse(String(init?.body))).toEqual({ roomId: "room-a" });
	});

	it("keeps explicit leave retryable when the background cannot confirm departure", async () => {
		const sendMessage = vi.fn(async () => ({
			ok: false,
			error: "Could not leave the room. Please try again.",
		}));

		await expect(
			requestCurrentRoomDeparture(roomSession(), { sendMessage }),
		).rejects.toThrow("Could not leave the room. Please try again.");
	});
});

function roomSession(): RoomSessionRecord {
	return {
		version: 1,
		revision: 3,
		roomId: "room-a",
		ownerUserId: "user-a",
		participantSessionId: "participant-session-a",
		cameraEnabled: false,
		voiceMode: "push-to-talk",
	};
}

function authSession(userId = "user-a"): ExtensionAuthTokens {
	return {
		accessToken: `access-${userId}`,
		refreshToken: `refresh-${userId}`,
		user: {
			id: userId,
			email: `${userId}@example.com`,
			displayName: userId,
			avatarUrl: null,
			plan: "free",
		},
	};
}
