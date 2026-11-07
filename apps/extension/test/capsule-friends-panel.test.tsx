import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CapsuleFriendsPanel,
	type CapsuleFriendsPanelProps,
} from "../src/capsule-friends-panel";
import type { FriendListItem } from "../src/social-client";
const friend: FriendListItem = {
	friendshipId: "f",
	user: { userId: "mia", displayName: "Mia", handle: "mia", avatarUrl: null },
	status: "accepted",
	direction: "mutual",
	requestedAt: "2026-01-01",
	respondedAt: "2026-01-01",
	updatedAt: "2026-01-01",
};
const link = {
	url: "https://staging.anidachi.app/friend/invite/first",
	expiresAt: "2099-01-01T00:00:00Z",
};
const roots: Root[] = [];
function deferred<T>() {
	let resolve!: (v: T) => void;
	let reject!: (e: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}
async function mount(overrides: Partial<CapsuleFriendsPanelProps> = {}) {
	const props: CapsuleFriendsPanelProps = {
		open: true,
		targets: { friends: [friend], groups: [] },
		loading: false,
		statuses: new Map(),
		participants: [],
		membershipReady: true,
		sending: new Map(),
		failedTargets: new Set(),
		notice: null,
		onRefresh: vi.fn(),
		onClose: vi.fn(),
		onSendFriend: vi.fn(),
		onSendGroup: vi.fn(),
		onCreateLink: vi.fn().mockResolvedValue(link),
		...overrides,
	};
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const render = async (
		p: Partial<CapsuleFriendsPanelProps> = {},
		key = "owner-a",
	) => {
		Object.assign(props, p);
		await act(async () =>
			root.render(<CapsuleFriendsPanel key={key} {...props} />),
		);
	};
	await render();
	const button = (name: string) => {
		const found = [...container.querySelectorAll("button")].find(
			(b) =>
				b.textContent?.trim() === name || b.getAttribute("aria-label") === name,
		);
		if (!found) throw Error("Missing " + name);
		return found;
	};
	const click = async (name: string) => {
		await act(async () => button(name).click());
	};
	return { props, root, container, button, click, render };
}
afterEach(async () => {
	while (roots.length) await act(async () => roots.pop()?.unmount());
	vi.restoreAllMocks();
	vi.useRealTimers();
	document.body.replaceChildren();
});
describe("capsule friends panel", () => {
	it("creates one link on entry, retains it across closing, and replaces only on New link", async () => {
		const first = deferred<typeof link>();
		const create = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockResolvedValue({ ...link, url: link.url + "-new" });
		const v = await mount({ onCreateLink: create });
		await v.click("Add friend");
		expect(create).toHaveBeenCalledTimes(1);
		expect(v.button("Copy link").disabled).toBe(true);
		await v.click("Back to friends and groups");
		await v.click("Add friend");
		expect(create).toHaveBeenCalledTimes(1);
		await act(async () => first.resolve(link));
		expect(v.button("Copy link").disabled).toBe(false);
		await v.render({ open: false });
		expect(v.container.querySelector(".cf-reveal")?.hasAttribute("inert")).toBe(
			true,
		);
		await v.render({ open: true });
		expect(create).toHaveBeenCalledTimes(1);
		await v.click("New link");
		expect(create).toHaveBeenCalledTimes(2);
		expect(v.container.querySelector("input")?.value).toBe(link.url + "-new");
		expect(v.container.textContent).toContain(
			"Only one person can use this link.",
		);
	});
	it("confirms copying only after clipboard succeeds and reports failure without losing the URL", async () => {
		const write = vi
			.spyOn(navigator.clipboard, "writeText")
			.mockRejectedValueOnce(Error("denied"))
			.mockResolvedValue();
		const v = await mount();
		await v.click("Add friend");
		await v.click("Copy link");
		expect(v.container.textContent).toContain("copy it manually");
		expect(v.button("Copy link")).toBeDefined();
		await v.click("Copy link");
		expect(write).toHaveBeenLastCalledWith(link.url);
		expect(v.button("Copied")).toBeDefined();
	});
	it("recovers link errors and ignores results from an unmounted account", async () => {
		const old = deferred<typeof link>();
		const create = vi
			.fn()
			.mockRejectedValueOnce(Error("network"))
			.mockReturnValueOnce(old.promise)
			.mockResolvedValue({ ...link, url: link.url + "-new-owner" });
		const v = await mount({ onCreateLink: create });
		await v.click("Add friend");
		expect(v.button("Try again")).toBeDefined();
		await v.click("Try again");
		await v.render({}, "owner-b");
		await v.click("Add friend");
		await act(async () => old.resolve(link));
		expect(v.container.querySelector("input")?.value).toBe(
			link.url + "-new-owner",
		);
	});
	it("moves keyboard focus to Back and restores Add friend on returning", async () => {
		const v = await mount();
		v.button("Add friend").focus();
		await v.click("Add friend");
		expect(document.activeElement).toBe(v.button("Back to friends and groups"));
		await v.click("Back to friends and groups");
		expect(document.activeElement).toBe(v.button("Add friend"));
	});

	it("has only one Add friend action when the list is empty and refreshes after returning", async () => {
		const v = await mount({ targets: { friends: [], groups: [] } });
		expect(
			[...v.container.querySelectorAll("button")].filter(
				(b) => b.textContent === "Add friend",
			),
		).toHaveLength(1);
		await v.click("Add friend");
		await v.click("Back to friends and groups");
		expect(v.props.onRefresh).toHaveBeenCalledOnce();
	});
	it("keeps friend rows through refresh and updates Sent to In room only from membership", async () => {
		const v = await mount();
		await v.click("Invite: Mia");
		expect(v.props.onSendFriend).toHaveBeenCalledWith(friend);
		await v.render({
			loading: true,
			statuses: new Map([
				[
					"friend:mia",
					{
						state: "pending",
						recipientStatuses: new Map([["mia", "pending"]]),
					},
				],
			]),
		});
		expect(v.button("Sent: Mia").disabled).toBe(true);
		expect(v.container.querySelector(".cf-loading")).toBeNull();
		await v.render({ participants: [{ id: "mia" }] });
		expect(v.button("In room: Mia").disabled).toBe(true);
		await v.render({
			participants: [],
			statuses: new Map([
				[
					"friend:mia",
					{
						state: "accepted",
						recipientStatuses: new Map([["mia", "accepted"]]),
					},
				],
			]),
		});
		expect(v.button("Invite: Mia").disabled).toBe(false);
	});
	it("searches without losing tab queries, and returns from Add friend on Escape", async () => {
		const v = await mount();
		const input = v.container.querySelector("input")!;
		await act(async () => {
			Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			)!.set!.call(input, "nobody");
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
		expect(v.container.textContent).toContain("No matches");
		await v.click("Groups");
		expect(v.container.textContent).toContain("No groups yet");
		await v.click("Friends");
		expect(v.container.querySelector("input")?.value).toBe("nobody");
		await v.click("Clear search");
		await v.click("Add friend");
		await act(async () =>
			v.container
				.querySelector("section")!
				.dispatchEvent(
					new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
				),
		);
		expect(v.button("Invite: Mia")).toBeDefined();
		expect(v.props.onClose).not.toHaveBeenCalled();
	});
});
