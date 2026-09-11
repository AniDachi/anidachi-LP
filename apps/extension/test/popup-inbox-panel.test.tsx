import type { AccountInboxResponse } from "@anidachi/protocol";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PopupInboxPanel } from "../src/popup-inbox-panel";
import { buildPopupInboxModel } from "../src/popup-people-model";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const now = "2026-09-11T12:00:00.000Z";
const sender = {
	userId: "sender",
	displayName: "Mei Tanaka",
	handle: "mei",
	avatarUrl: null,
};
const friend = {
	kind: "friend-request",
	friendshipId: "friend",
	sender,
	state: "pending",
	createdAt: now,
	activityAt: now,
	seenAt: null,
} as const;
const room = {
	kind: "room-invite",
	inviteId: "invite",
	roomId: "room",
	sender,
	targetKind: "group",
	targetGroupId: "group",
	targetGroupName: "Anime night",
	roomTitle: "Mushoku Tensei: Jobless Reincarnation",
	message: "Ready to watch?",
	sourceUrl: null,
	videoFingerprint: null,
	state: "active",
	createdAt: now,
	activityAt: now,
	seenAt: null,
	missedAt: null,
} as const;
type Props = ComponentProps<typeof PopupInboxPanel>;
function response(
	items: AccountInboxResponse["items"] = [],
): AccountInboxResponse {
	return {
		meta: { ownerUserId: "viewer", schemaVersion: 1, serverTime: now },
		items,
		counts: {
			unseen: items.length,
			actionable: items.length,
			pendingFriendRequests: 0,
			activeRoomInvites: 0,
		},
		nextCursor: null,
	};
}
function props(data = response()): Props {
	return {
		state: { status: "ready", data, ownerUserId: "viewer", error: null },
		model: buildPopupInboxModel(data),
		busyFriendRequestActionKey: null,
		busyInviteId: null,
		busyInviteAction: null,
		onAcceptFriendRequest: vi.fn(),
		onDeclineFriendRequest: vi.fn(),
		onAcceptInvite: vi.fn(),
		onDeclineInvite: vi.fn(),
		onRefresh: vi.fn(),
		onSignIn: vi.fn(),
		onOpenDashboard: vi.fn(),
	};
}
let root: Root;
let container: HTMLDivElement;
async function render(p: Props) {
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => root.render(<PopupInboxPanel {...p} />));
}
function button(label: string) {
	const result = [...container.querySelectorAll("button")].find(
		(b) => (b.getAttribute("aria-label") ?? b.textContent)?.trim() === label,
	);
	if (!result) throw new Error(`Missing ${label}`);
	return result;
}
afterEach(async () => {
	if (root) await act(async () => root.unmount());
	container?.remove();
});

describe("Inbox presentation", () => {
	it("has a single empty state and no empty counted sections", async () => {
		const p = props();
		await render(p);
		expect(container.textContent).toContain("You’re all caught up");
		expect(container.querySelectorAll(".inbox-section")).toHaveLength(0);
		await act(async () => button("View on website").click());
		expect(p.onOpenDashboard).toHaveBeenCalledOnce();
	});

	it("only renders populated sections and preserves group/message context for missed rooms without actions", async () => {
		await render(
			props(response([{ ...room, state: "missed", missedAt: now }])),
		);
		expect(
			[...container.querySelectorAll(".inbox-heading")].map(
				(h) => h.textContent,
			),
		).toEqual(["Missed1"]);
		expect(container.textContent).toContain("Anime night");
		expect(container.textContent).toContain("Ready to watch?");
		expect(container.querySelectorAll(".inbox-actions button")).toHaveLength(0);
		expect(container.querySelector("time")?.dateTime).toBe(now);
	});

	it.each([
		"join",
		"decline",
	] as const)("shows the selected %s action pending and disables every mutation and refresh", async (action) => {
		const p = {
			...props(response([friend, room, { ...room, inviteId: "another" }])),
			busyInviteId: room.inviteId,
			busyInviteAction: action,
		};
		await render(p);
		expect(container.textContent).toContain(
			action === "join" ? "Joining…" : "Declining…",
		);
		expect(
			container.querySelectorAll('article[aria-busy="true"]'),
		).toHaveLength(1);
		const actions = [
			...container.querySelectorAll<HTMLButtonElement>(".inbox-actions button"),
		];
		expect(actions).toHaveLength(6);
		expect(actions.every((b) => b.disabled)).toBe(true);
		expect(button("Refresh inbox").disabled).toBe(true);
		await act(async () => actions.forEach((b) => b.click()));
		expect(p.onAcceptInvite).not.toHaveBeenCalled();
		expect(p.onDeclineFriendRequest).not.toHaveBeenCalled();
	});

	it("shows friend acceptance feedback and disables room actions while the shared lock is busy", async () => {
		await render({
			...props(response([friend, room])),
			busyFriendRequestActionKey: "accept-friend:friend",
		});
		expect(container.textContent).toContain("Accepting…");
		expect(button("Join room invite from Mei Tanaka").disabled).toBe(true);
	});

	it.each([
		"loading",
		"error",
	] as const)("does not claim an empty %s cache is current", async (status) => {
		const p = props();
		await render({
			...p,
			state: {
				...p.state,
				status,
				error: status === "error" ? "Connection failed." : null,
			} as Props["state"],
		});
		expect(container.textContent).toContain("No saved invitations");
		expect(container.textContent).not.toContain("all caught up");
		expect(container.textContent).toContain("out of date");
	});

	it("retains invitations on refresh failure, disables stale actions, and retries", async () => {
		const p = props(response([friend, room]));
		await render({
			...p,
			state: {
				...p.state,
				status: "error",
				error: "Connection failed.",
			} as Props["state"],
		});
		expect(container.textContent).toContain(room.roomTitle);
		expect(button("Accept friend request from Mei Tanaka").disabled).toBe(true);
		await act(async () => button("Retry").click());
		expect(p.onRefresh).toHaveBeenCalledOnce();
	});

	it("shows initial loading and error states without a false empty state", async () => {
		const p = props();
		await render({
			...p,
			model: null,
			state: {
				status: "loading",
				data: null,
				ownerUserId: "viewer",
				error: null,
			},
		});
		expect(
			container.querySelector('[aria-label="Loading inbox"]'),
		).not.toBeNull();
		expect(container.querySelectorAll(".inbox-empty")).toHaveLength(0);
		await act(async () =>
			root.render(
				<PopupInboxPanel
					{...p}
					model={null}
					state={{
						status: "error",
						data: null,
						ownerUserId: "viewer",
						error: "Unavailable",
					}}
				/>,
			),
		);
		expect(container.textContent).toContain("Could not load invitations");
		expect(button("Retry").disabled).toBe(false);
	});

	it("never renders cached invitations after sign-out", async () => {
		const p = props(response([friend, room]));
		await render({
			...p,
			state: {
				status: "signed-out",
				ownerUserId: null,
				data: null,
				error: null,
			},
		});
		expect(container.textContent).not.toContain(room.roomTitle);
		await act(async () => button("Sign in").click());
		expect(p.onSignIn).toHaveBeenCalledOnce();
	});

	it("keeps optional text literal and falls back when an avatar fails", async () => {
		const name = "<script>long-name</script>";
		await render(
			props(
				response([
					{
						...room,
						sender: {
							...sender,
							displayName: name,
							avatarUrl: "https://example.com/avatar.png",
						},
					},
				]),
			),
		);
		expect(container.textContent).toContain(name);
		expect(container.querySelector("script")).toBeNull();
		await act(async () =>
			container.querySelector("img")!.dispatchEvent(new Event("error")),
		);
		expect(container.querySelector("img")).toBeNull();
		expect(container.querySelector(".inbox-avatar")?.textContent).toBe("<");
	});
});
