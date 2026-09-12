import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	buildPersonalHistoryResumeUrl,
	parsePersonalHistoryResumeUrl,
} from "@anidachi/protocol";
import { CrunchyrollVideoAdapter } from "../src/source-adapters/crunchyroll/adapter";
import { applyPersonalHistoryResume } from "../src/watch-history-resume";
import {
	paidHistoryLease,
	historyOwner,
} from "./watch-history-personal-fixtures";
vi.mock("wxt/utils/define-content-script", () => ({
	defineContentScript: (value: unknown) => value,
}));
import script from "../entrypoints/crunchyroll.content";
const sourceUrl = "https://www.crunchyroll.com/watch/EPISODE1";
let video: HTMLVideoElement;
let adapter: CrunchyrollVideoAdapter;
let active = false;
let adBreak: object | null = null;
let seek: ReturnType<typeof vi.fn>;
let player: {
	getVideoElement: () => HTMLVideoElement;
	ads?: {
		isLinearAdActive: () => boolean;
		getActiveAdBreak: () => object | null;
	};
	sgai?: { getActiveAd: () => object | null };
	seek: ReturnType<typeof vi.fn>;
};
let currentNow: number;
beforeAll(() => {
	(script as unknown as { main(): void }).main();
});
beforeEach(() => {
	vi.useFakeTimers();
	currentNow = Date.now();
	active = false;
	adBreak = null;
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(sourceUrl),
	});
	document.body.innerHTML = "<div><video></video></div>";
	video = document.querySelector("video")!;
	video.getBoundingClientRect = () => ({ width: 640, height: 360 }) as DOMRect;
	Object.defineProperty(video, "readyState", { configurable: true, value: 4 });
	Object.defineProperty(video, "duration", { configurable: true, value: 100 });
	seek = vi.fn((time: number) => {
		video.currentTime = time;
		return true;
	});
	player = {
		getVideoElement: () => video,
		ads: { isLinearAdActive: () => active, getActiveAdBreak: () => adBreak },
		seek,
	};
	window.__anidachiCrunchyrollBitmovinPlayers = [player] as never;
	adapter = new CrunchyrollVideoAdapter(video, video.parentElement!);
	vi.spyOn(window, "postMessage").mockImplementation((data) => {
		queueMicrotask(() =>
			window.dispatchEvent(
				new MessageEvent("message", { source: window, data }),
			),
		);
	});
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});
async function launch() {
	return parsePersonalHistoryResumeUrl(
		await buildPersonalHistoryResumeUrl({
			ownerUserId: historyOwner,
			accountGeneration: 1,
			provider: "crunchyroll",
			sourceUrl,
			currentTime: 42,
			now: currentNow,
		}),
		currentNow,
	)!;
}
async function settle<T>(value: Promise<T>) {
	await vi.advanceTimersByTimeAsync(1);
	return value;
}
function input(claim: () => Promise<boolean> = vi.fn(async () => true)) {
	return {
		adapter,
		getOwner: () => historyOwner,
		roomActive: () => false,
		isCurrent: () => true,
		getLease: async () => paidHistoryLease(historyOwner, currentNow),
		claim,
		now: () => currentNow,
	};
}
describe("Crunchyroll personal Resume through actual adapter and MAIN bridge", () => {
	it("seeks confirmed content once without calling ordinary fallback or play", async () => {
		const intent = await launch();
		const ordinarySeek = vi.spyOn(adapter, "seek");
		const play = vi.spyOn(video, "play");
		expect(await settle(applyPersonalHistoryResume(intent, input()))).toBe(
			"consumed",
		);
		expect(ordinarySeek).not.toHaveBeenCalled();
		expect(play).not.toHaveBeenCalled();
		expect(seek).toHaveBeenCalledExactlyOnceWith(42, "anidachi");
		expect(await settle(adapter.seekPersonalResume(intent, () => true))).toBe(
			"consumed",
		);
		expect(seek).toHaveBeenCalledTimes(1);
	});
	it("cancels an ambiguous lost seek acknowledgement without rewinding on duplicate delivery", async () => {
		const intent = await launch();
		vi.mocked(window.postMessage).mockImplementation((data) => {
			if (
				data.action === "resumeSeek" &&
				data.source === "anidachi-crunchyroll-control-result"
			)
				return;
			queueMicrotask(() =>
				window.dispatchEvent(
					new MessageEvent("message", { source: window, data }),
				),
			);
		});
		const pending = applyPersonalHistoryResume(intent, input());
		await vi.waitFor(() => expect(seek).toHaveBeenCalledOnce());
		await vi.advanceTimersByTimeAsync(500);
		expect(await pending).toBe("cancelled");
		expect(seek).toHaveBeenCalledOnce();
		vi.mocked(window.postMessage).mockImplementation((data) =>
			queueMicrotask(() =>
				window.dispatchEvent(
					new MessageEvent("message", { source: window, data }),
				),
			),
		);
		expect(await settle(adapter.seekPersonalResume(intent, () => true))).toBe(
			"consumed",
		);
		expect(seek).toHaveBeenCalledOnce();
	});
	it("guards ad/source changes immediately before MAIN seek dispatch", async () => {
		const intent = await launch();
		vi.mocked(window.postMessage).mockImplementation((data) => {
			if (
				data.action === "resumeSeek" &&
				data.source === "anidachi-crunchyroll-control"
			)
				active = true;
			queueMicrotask(() =>
				window.dispatchEvent(
					new MessageEvent("message", { source: window, data }),
				),
			);
		});
		expect(await settle(applyPersonalHistoryResume(intent, input()))).toBe(
			"waiting",
		);
		expect(seek).not.toHaveBeenCalled();
		active = false;
		vi.mocked(window.postMessage).mockImplementation((data) => {
			if (
				data.action === "resumeSeek" &&
				data.source === "anidachi-crunchyroll-control"
			)
				Object.defineProperty(window, "location", {
					configurable: true,
					value: new URL("https://www.crunchyroll.com/watch/OTHER_DUB"),
				});
			queueMicrotask(() =>
				window.dispatchEvent(
					new MessageEvent("message", { source: window, data }),
				),
			);
		});
		expect(await settle(applyPersonalHistoryResume(intent, input()))).toBe(
			"cancelled",
		);
		expect(seek).not.toHaveBeenCalled();
	});
	it.each([
		false,
		true,
	])("waits for a linear ad even when paused=%s, without claiming", async (paused) => {
		active = true;
		Object.defineProperty(video, "paused", {
			configurable: true,
			value: paused,
		});
		const claim = vi.fn(async () => true);
		expect(
			await settle(applyPersonalHistoryResume(await launch(), input(claim))),
		).toBe("waiting");
		expect(claim).not.toHaveBeenCalled();
		expect(seek).not.toHaveBeenCalled();
	});
	it.each([
		"unknown",
		"throwing",
		"mismatched",
		"break",
		"sgai",
	])("waits on %s provider state without trusting the generic player fallback", async (state) => {
		if (state === "unknown") delete player.ads;
		if (state === "throwing")
			player.ads!.isLinearAdActive = () => {
				throw new Error("unavailable");
			};
		if (state === "mismatched")
			player.getVideoElement = () => document.createElement("video");
		if (state === "break") adBreak = {};
		if (state === "sgai") player.sgai = { getActiveAd: () => ({}) };
		const claim = vi.fn(async () => true);
		expect(
			await settle(applyPersonalHistoryResume(await launch(), input(claim))),
		).toBe("waiting");
		expect(claim).not.toHaveBeenCalled();
		expect(seek).not.toHaveBeenCalled();
	});
	it("retains a claimed intent through an ad transition, then seeks once when content returns", async () => {
		const intent = await launch();
		let claimed = false;
		const durableClaim = vi.fn(async () => true);
		const claim = async () => {
			if (!claimed) {
				claimed = await durableClaim();
				active = true;
			}
			return claimed;
		};
		expect(await settle(applyPersonalHistoryResume(intent, input(claim)))).toBe(
			"waiting",
		);
		expect(seek).not.toHaveBeenCalled();
		active = false;
		expect(await settle(applyPersonalHistoryResume(intent, input(claim)))).toBe(
			"consumed",
		);
		expect(durableClaim).toHaveBeenCalledOnce();
		expect(seek).toHaveBeenCalledOnce();
	});
	it("cancels a raw variant/source replacement and expiry while waiting", async () => {
		const intent = await launch();
		active = true;
		expect(await settle(applyPersonalHistoryResume(intent, input()))).toBe(
			"waiting",
		);
		Object.defineProperty(window, "location", {
			configurable: true,
			value: new URL("https://www.crunchyroll.com/watch/OTHER_DUB"),
		});
		active = false;
		Object.defineProperty(video, "readyState", {
			configurable: true,
			value: 0,
		});
		expect(await settle(applyPersonalHistoryResume(intent, input()))).toBe(
			"cancelled",
		);
		currentNow = intent.expiresAt;
		expect(await settle(applyPersonalHistoryResume(intent, input()))).toBe(
			"cancelled",
		);
		expect(seek).not.toHaveBeenCalled();
	});
});
