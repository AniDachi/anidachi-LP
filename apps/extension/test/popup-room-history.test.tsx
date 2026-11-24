import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PopupRoomHistory, roomDuration } from "../src/popup-room-history";
import { RoomsCard } from "../src/popup-rooms";
import type { ExtensionAuthTokens } from "../src/auth-tokens";

const tokens: ExtensionAuthTokens = {
	user: {
		id: "dd000000-0000-4000-8000-000000000001",
		email: "test@example.test",
		displayName: "Test",
		avatarUrl: null,
		plan: "free",
	},
	accessToken: "test",
	refreshToken: "test",
};
const room = {
	roomId: "a",
	provider: "youtube",
	createdAt: "2026-11-01T23:30:00Z",
	endedAt: "2026-11-02T00:44:00Z",
	companions: [
		{ id: "dd000000-0000-4000-8000-000000000002", name: "Anna", avatar: null },
	],
};
const container = document.createElement("div");
const root = () => createRoot(container);
afterEach(() => {
	vi.unstubAllGlobals();
	container.remove();
});
it("keeps companions in details and paginates only on demand", async () => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	const fetchPage = vi
		.fn()
		.mockResolvedValueOnce(
			Response.json({
				ownerUserId: tokens.user.id,
				rooms: ["a", "b", "c"].map((roomId) => ({ ...room, roomId })),
				next: { endedAt: room.endedAt, roomId: "c" },
			}),
		)
		.mockResolvedValueOnce(
			Response.json({
				ownerUserId: tokens.user.id,
				rooms: [{ ...room, roomId: "d" }],
				next: null,
			}),
		);
	vi.stubGlobal("fetch", fetchPage);
	const view = root();
	try {
		await act(async () => view.render(<PopupRoomHistory tokens={tokens} />));
		expect(container.querySelectorAll("details")).toHaveLength(3);
		const summary = container.querySelector("summary")!;
		expect(summary.textContent).toContain("YouTube");
		expect(summary.textContent).toContain("1 h 14 min");
		expect(summary.textContent).not.toContain("Anna");
		expect(container.querySelector("details")?.textContent).toContain("Anna");
		expect(fetchPage).toHaveBeenCalledTimes(1);
		await act(async () =>
			container.querySelector<HTMLButtonElement>("header button")!.click(),
		);
		expect(container.querySelectorAll("details")).toHaveLength(4);
		expect(
			new URL(fetchPage.mock.calls[1]![0]).searchParams.get("roomId"),
		).toBe("c");
		await act(async () =>
			container.querySelector<HTMLButtonElement>("header button")!.click(),
		);
		expect(container.querySelectorAll("details")).toHaveLength(3);
		expect(fetchPage).toHaveBeenCalledTimes(2);
	} finally {
		await act(async () => view.unmount());
	}
});
it("opens the selector, selects a platform without creating a room, and restores focus", async () => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	const view = root(),
		select = vi.fn(),
		create = vi.fn();
	document.body.append(container);
	try {
		await act(async () =>
			view.render(
				<RoomsCard
					state={{ here: "netflix", room: null }}
					selected="netflix"
					onSelect={select}
					onAction={create}
					label="Create room"
					disabled={false}
					error=""
				/>,
			),
		);
		const trigger =
			container.querySelector<HTMLButtonElement>(".rooms-trigger")!;
		await act(async () => trigger.click());
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		const option = Array.from(
			container.querySelectorAll<HTMLButtonElement>(".rooms-option"),
		).find((button) => button.textContent?.includes("Disney+"))!;
		await act(async () => option.click());
		expect(select).toHaveBeenCalledWith("disneyplus");
		expect(create).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	} finally {
		await act(async () => view.unmount());
	}
});
it("keeps the active platform and room status in the shared heading above the invite action", async () => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	const view = root();
	const state = { here: null, room: { provider: "crunchyroll", here: true, tabId: 7, invite: "test-invite" } };
	try {
		await act(async () => view.render(
			<RoomsCard state={state} selected={null} onSelect={vi.fn()} onAction={vi.fn()}
				label="Copy invite" disabled={false} error="" />,
		));
		const heading = container.querySelector(".rooms-card > .rooms-heading");
		expect(heading?.querySelector("strong")?.textContent).toBe("Crunchyroll");
		expect(heading?.textContent).toContain("Active room");
		expect(heading?.nextElementSibling?.textContent).toBe("Copy invite");
		expect(container.querySelector(".rooms-picker")).toBeNull();
	} finally {
		await act(async () => view.unmount());
	}
});
it("shows sub-minute rooms and whole hours", () => {
	expect(roomDuration("2026-11-02T00:00:00Z", "2026-11-02T00:00:45Z")).toBe(
		"<1 min",
	);
	expect(roomDuration("2026-11-02T00:00:00Z", "2026-11-02T02:00:00Z")).toBe(
		"2 h",
	);
});
