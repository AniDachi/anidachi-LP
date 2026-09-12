import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PopupHistorySettings } from "../src/popup-history-settings";
import type {
	PopupWatchHistoryClient,
	PopupWatchHistorySnapshot,
} from "../src/popup-watch-history";
import type { WatchHistoryMessageResponse } from "../src/watch-history-client";
const OWNER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const meta = {
	schemaVersion: 3,
	ownerUserId: OWNER,
	accountGeneration: 1,
	serverTime: "2026-09-05T08:00:00.000Z",
};
const preference = (enabled: boolean, owner = OWNER) => ({
	meta: { ...meta, ownerUserId: owner },
	preferences: { youtubeHistoryEnabled: enabled },
});
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
	await act(async () => root?.unmount());
	container?.remove();
});
async function mount(
	request: PopupWatchHistoryClient["request"],
	subscribe?: PopupWatchHistoryClient["subscribe"],
) {
	const client: PopupWatchHistoryClient = {
		loadCached: async () => null,
		request,
		confirmDiscard: () => false,
		openUrl: async () => undefined,
		subscribe,
	};
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () =>
		root.render(<PopupHistorySettings ownerUserId={OWNER} client={client} />),
	);
	return client;
}
function toggle() {
	const node = container.querySelector('[role="switch"]') as HTMLButtonElement;
	expect(node).not.toBeNull();
	return node;
}
describe("History settings consent", () => {
	it("uses the rendered owner and keeps explicit optimistic consent when success omits data", async () => {
		const request = vi.fn<PopupWatchHistoryClient["request"]>(
			async (message) =>
				message.command === "get-preferences"
					? { ok: true, data: preference(false) }
					: { ok: true },
		);
		await mount(request);
		expect(toggle().getAttribute("aria-checked")).toBe("false");
		await act(async () => toggle().click());
		expect(toggle().getAttribute("aria-checked")).toBe("true");
		expect(request).toHaveBeenCalledWith({
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "update-preferences",
			expectedOwnerUserId: OWNER,
			input: { youtubeHistoryEnabled: true },
		});
		expect(container.textContent).toContain("browser");
		expect(container.textContent).toContain("account");
	});
	it("rolls back a failed update and remains usable after a failed preference read", async () => {
		await mount(async () => ({ ok: false, status: "retryable" }));
		expect(toggle().disabled).toBe(false);
		await act(async () => toggle().click());
		expect(toggle().getAttribute("aria-checked")).toBe("false");
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		expect(toggle().disabled).toBe(false);
	});
	it("retires an old owner's in-flight update and does not roll back the new owner", async () => {
		let finish!: (value: WatchHistoryMessageResponse) => void;
		const client = await mount(async (message) =>
			message.command === "get-preferences"
				? {
						ok: true,
						data: preference(
							message.expectedOwnerUserId === OTHER,
							message.expectedOwnerUserId,
						),
					}
				: new Promise((resolve) => {
						finish = resolve;
					}),
		);
		await act(async () => toggle().click());
		await act(async () =>
			root.render(<PopupHistorySettings ownerUserId={OTHER} client={client} />),
		);
		await act(async () => finish({ ok: false, status: "retryable" }));
		expect(toggle().getAttribute("aria-checked")).toBe("true");
		expect(toggle().disabled).toBe(false);
		expect(container.querySelector('[role="alert"]')).toBeNull();
	});
	it("ignores stale reads and snapshot rollback during a pending explicit change, then accepts newer authority", async () => {
		let read!: (value: WatchHistoryMessageResponse) => void;
		let write!: (value: WatchHistoryMessageResponse) => void;
		let publish!: (snapshot: PopupWatchHistorySnapshot | null) => void;
		await mount(
			(message) =>
				new Promise((resolve) => {
					if (message.command === "get-preferences") read = resolve;
					else write = resolve;
				}),
			(_owner, listener) => {
				publish = listener;
				return () => undefined;
			},
		);
		await act(async () => toggle().click());
		await act(async () => read({ ok: true, data: preference(false) }));
		expect(toggle().getAttribute("aria-checked")).toBe("true");
		const snapshot = {
			history: {
				meta,
				generatedAt: meta.serverTime,
				totalTitleCount: 0,
				items: [],
				nextCursor: null,
			},
			accountGeneration: 1,
			preferences: { youtubeHistoryEnabled: false },
			pendingEvents: [],
			localObservation: null,
			capturePaused: false,
		} as PopupWatchHistorySnapshot;
		await act(async () => publish(snapshot));
		expect(toggle().getAttribute("aria-checked")).toBe("true");
		await act(async () => write({ ok: true }));
		await act(async () => publish(snapshot));
		expect(toggle().getAttribute("aria-checked")).toBe("false");
	});
	it("does not let a delayed cached preference replace a completed live preference read", async () => {
		let cached!: (value: PopupWatchHistorySnapshot) => void;
		const client = await mount(async () => ({
			ok: true,
			data: preference(false),
		}));
		const replacement = {
			...client,
			loadCached: () =>
				new Promise<PopupWatchHistorySnapshot>((resolve) => {
					cached = resolve;
				}),
			request: async (): Promise<WatchHistoryMessageResponse> => ({
				ok: true,
				data: preference(true),
			}),
		};
		await act(async () =>
			root.render(
				<PopupHistorySettings ownerUserId={OWNER} client={replacement} />,
			),
		);
		expect(toggle().getAttribute("aria-checked")).toBe("true");
		await act(async () =>
			cached({
				history: {
					meta: { ...meta, schemaVersion: 3 },
					generatedAt: meta.serverTime,
					totalTitleCount: 0,
					items: [],
					nextCursor: null,
				},
				accountGeneration: 1,
				preferences: { youtubeHistoryEnabled: false },
				pendingEvents: [],
				localObservation: null,
				capturePaused: false,
			}),
		);
		expect(toggle().getAttribute("aria-checked")).toBe("true");
	});
});
