import { afterEach, expect, it, vi } from "vitest";
import { mountOverlay, startContentLifecycle } from "../../../entrypoints/content";
import { fixture, bridgeTransport, ids } from "./fixture";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { PrimeVideoAdapter } from "../../../src/source-adapters/primevideo/adapter";
import type { VideoAdapter } from "../../../src/source-adapters/core/types";
const stops: (() => void)[] = [];
afterEach(() => {
	stops
		.splice(0)
		.reverse()
		.forEach((stop) => stop());
	vi.restoreAllMocks();
	vi.useRealTimers();
	document.body.innerHTML = "";
});

// Keep MAIN, discovery and the real overlay host. Only the React account/room UI
// is replaced here; it needs a signed-in extension background, unrelated to mount.
function mountPlayerOverlay(adapter: VideoAdapter) {
	const unsubscribe = adapter.subscribe(() => {});
	const overlay = mountOverlay(adapter, {
		renderer: { render() {}, unmount: unsubscribe },
	});
	return overlay;
}
// happy-dom aliases PageTransitionEvent to Event and drops persisted.
function pageTransition(type: string, persisted: boolean) {
	return Object.defineProperty(new Event(type), "persisted", { value: persisted });
}
const supportedFamilies = [
	"primevideo.com", "amazon.com", "amazon.co.uk", "amazon.de",
	"amazon.co.jp", "amazon.ca", "amazon.in", "amazon.com.mx",
];
const storefronts = supportedFamilies.flatMap((family) =>
	[family, `www.${family}`, `edge-2.video.${family}`].map((host) => ({
		host, path: family === "primevideo.com" ? "/region/na/storefront/home" : "/gp/video/storefront",
	})),
);
storefronts.push({ host: "www.amazon.com", path: "/Amazon-Video/b/?node=2858778011" });
it.each(storefronts)(
	"mounts inside the primary player after delayed SPA startup on $host$path", async ({ host, path }) => {
		vi.useFakeTimers();
		const f = fixture();
		const prefix = host.endsWith("primevideo.com")
			? "/region/na/-/ja_JP/detail/" : "/-/ja_JP/gp/video/detail/";
		Object.defineProperty(window, "location", { configurable: true, value: new URL(
			`https://${host}${path}`,
		) });
		bridgeTransport();
		stops.push(startPrimeBridge());
		const runtime = startContentLifecycle({
			ensureStyles: () => {}, startProviderStudy: () => null,
			mount: mountPlayerOverlay,
		});
		stops.push(runtime.dispose);
		await vi.advanceTimersByTimeAsync(300);
		expect(document.querySelector("anidachi-overlay-root")).toBeNull();
		Object.defineProperty(window, "location", { configurable: true,
			value: new URL(`https://${host}${prefix}${ids.season}?ref_=test&language=ja_JP`),
		});
		document.getElementById("dv-web-page-hydration-data")!.textContent =
			JSON.stringify(f.data).replaceAll("/detail/", prefix);
		// No DOM insertion or navigation event: the SDK and URL become ready later.
		await vi.advanceTimersByTimeAsync(350);
		expect(f.root.querySelectorAll("anidachi-overlay-root")).toHaveLength(1);
		expect(f.video.dataset.anidachiVideo).toBe("true");
		expect(f.root.dataset.anidachiAdapter).toBe("primevideo");
		runtime.dispose();
		expect(document.querySelector("anidachi-overlay-root")).toBeNull();
	},
);

it("restores one Prime overlay after browser-cache return and never revives after explicit disposal", async () => {
	vi.useFakeTimers();
	const f = fixture();
	bridgeTransport();
	let stopBridge = startPrimeBridge();
	stops.push(() => stopBridge());
	const runtime = startContentLifecycle({
		ensureStyles: () => {}, startProviderStudy: () => null, mount: mountPlayerOverlay,
	});
	stops.push(runtime.dispose);
	await vi.advanceTimersByTimeAsync(100);
	expect(f.root.querySelectorAll("anidachi-overlay-root")).toHaveLength(1);
	window.dispatchEvent(pageTransition("pagehide", true));
	expect(document.querySelector("anidachi-overlay-root")).toBeNull();
	expect(vi.getTimerCount()).toBe(0);
	// MAIN has its own pageshow owner. Exercise the reverse listener order too:
	// isolated world resumes before MAIN makes a fresh binding available.
	window.dispatchEvent(pageTransition("pageshow", true));
	stopBridge = startPrimeBridge();
	await vi.advanceTimersByTimeAsync(100);
	expect(f.root.querySelectorAll("anidachi-overlay-root")).toHaveLength(1);
	window.dispatchEvent(pageTransition("pageshow", false));
	await vi.advanceTimersByTimeAsync(100);
	expect(f.root.querySelectorAll("anidachi-overlay-root")).toHaveLength(1);
	runtime.dispose();
	window.dispatchEvent(pageTransition("pageshow", true));
	await vi.advanceTimersByTimeAsync(300);
	expect(document.querySelector("anidachi-overlay-root")).toBeNull();
});

it("does not replay a consumed invitation fragment when restoring the capsule", async () => {
	vi.useFakeTimers();
	fixture();
	Object.defineProperty(window, "location", { configurable: true,
		value: new URL(`https://www.primevideo.com/detail/${ids.first}#anidachiRoom=original-room`),
	});
	bridgeTransport();
	let stopBridge = startPrimeBridge();
	stops.push(() => stopBridge());
	let mounts = 0;
	const runtime = startContentLifecycle({
		ensureStyles: () => {}, startProviderStudy: () => null,
		mount(adapter, launch) {
			mounts++;
			if (mounts === 1) {
				expect(launch?.readRoom(location.href, adapter.getFingerprint())).toBe("original-room");
				launch?.consumeRoom();
			} else {
				expect(launch?.readRoom(location.href, adapter.getFingerprint())).toBeNull();
				expect(launch?.blocksFragment?.(location.href)).toBe(true);
			}
			return mountPlayerOverlay(adapter);
		},
	});
	stops.push(runtime.dispose);
	await vi.advanceTimersByTimeAsync(100);
	window.dispatchEvent(pageTransition("pagehide", true));
	stopBridge = startPrimeBridge();
	window.dispatchEvent(pageTransition("pageshow", true));
	await vi.advanceTimersByTimeAsync(100);
	expect(mounts).toBe(2);
});
it.each([
	"root",
	"regional",
	"amazon",
	"synthetic-subdomain",
	"synthetic-amazon-subdomain",
])("replaces same-video source through MAIN binding, registry and mount on %s", async (route) => {
	vi.useFakeTimers();
	const f = fixture();
	if (route !== "root") {
		const origin =
			route === "synthetic-subdomain"
				? "https://synthetic-2.edge3.primevideo.com"
				: route === "synthetic-amazon-subdomain"
					? "https://synthetic-2.edge3.amazon.co.uk"
					: route === "amazon"
						? "https://www.amazon.com"
						: "https://www.primevideo.com";
		const prefix = route.includes("amazon")
			? "/gp/video/detail/"
			: "/region/na/detail/";
		const original = f.write;
		f.write = () => {
			original();
			document.getElementById("dv-web-page-hydration-data")!.textContent =
				JSON.stringify(f.data).replaceAll("/detail/", prefix);
		};
		f.write();
		Object.defineProperty(window, "location", {
			configurable: true,
			value: new URL(`${origin}${prefix}${ids.season}`),
		});
	}
	bridgeTransport();
	stops.push(startPrimeBridge());
	let active: VideoAdapter | null = null,
		unsubscribe: (() => void) | null = null;
	const replace = vi.fn((adapter: VideoAdapter) => {
		unsubscribe?.();
		active = adapter;
		unsubscribe = adapter.subscribe(() => {});
	});
	const runtime = startContentLifecycle({
		ensureStyles: () => {},
		installKeyboardGuard: () => () => {},
		startProviderStudy: () => null,
		mount: (adapter) => {
			active = adapter;
			unsubscribe = adapter.subscribe(() => {});
			return {
				adapter,
				replaceAdapter: replace,
				relocate() {},
				suspend() {},
				dispose() {
					unsubscribe?.();
				},
			};
		},
	});
	stops.push(runtime.dispose);
	await vi.advanceTimersByTimeAsync(100);
	const first = active as unknown as PrimeVideoAdapter;
	expect(first.getSourceDescriptor()?.sourceUrl).toContain(ids.first);
	f.next();
	f.video.dispatchEvent(new Event("timeupdate"));
	await vi.advanceTimersByTimeAsync(100);
	expect(replace).toHaveBeenCalledTimes(1);
	expect((active as unknown as PrimeVideoAdapter).getFingerprint()).toContain(
		ids.second,
	);
	expect(first.getPrimeSnapshot()).toBeNull();
	first.seek(200);
	await vi.advanceTimersByTimeAsync(100);
	expect(f.context.playback.seek).not.toHaveBeenCalled();
	runtime.dispose();
	stops[0]!();
	expect(vi.getTimerCount()).toBe(0);
});
it("isolates Prime composer keyboard events and releases the guard on disposal", () => {
	fixture();
	const runtime = startContentLifecycle({
		detect: () => ({ status: "none" }),
		ensureStyles: () => {},
		mount: vi.fn(),
		startProviderStudy: () => null,
	});
	stops.push(runtime.dispose);
	const native = vi.fn();
	window.addEventListener("keydown", native, true);
	stops.push(() => window.removeEventListener("keydown", native, true));
	document.documentElement.setAttribute("data-anidachi-composer-open", "true");
	try {
		window.dispatchEvent(
			new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true }),
		);
		expect(native).not.toHaveBeenCalled();
		runtime.dispose();
		window.dispatchEvent(
			new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true }),
		);
		expect(native).toHaveBeenCalledTimes(1);
	} finally {
		document.documentElement.removeAttribute("data-anidachi-composer-open");
	}
});

it("recovers snapshots and commands after binding loss/restoration before one reconciliation frame", async () => {
	vi.useFakeTimers();
	const f = fixture();
	bridgeTransport();
	stops.push(startPrimeBridge());
	let adapter!: PrimeVideoAdapter,
		unsubscribe: (() => void) | null = null;
	const replace = vi.fn();
	const runtime = startContentLifecycle({
		ensureStyles: () => {},
		installKeyboardGuard: () => () => {},
		startProviderStudy: () => null,
		mount: (active) => {
			adapter = active as PrimeVideoAdapter;
			unsubscribe = adapter.subscribe(() => {});
			return {
				adapter,
				replaceAdapter: replace,
				relocate() {},
				suspend() {},
				dispose() {
					unsubscribe?.();
				},
			};
		},
	});
	stops.push(runtime.dispose);
	await vi.advanceTimersByTimeAsync(100);
	expect(adapter.getPrimeSnapshot()?.contentId).toBe(ids.first);
	adapter.seek(50);
	await vi.advanceTimersByTimeAsync(1);
	f.context.webPlayer.isPlayerOpen = false;
	f.video.dispatchEvent(new Event("timeupdate"));
	expect(adapter.getPrimeSnapshot()).toBeNull();
	f.context.webPlayer.isPlayerOpen = true;
	f.video.dispatchEvent(new Event("timeupdate"));
	await vi.advanceTimersByTimeAsync(100);
	expect(replace).not.toHaveBeenCalled();
	expect(adapter.getPrimeSnapshot()?.contentId).toBe(ids.first);
	expect(f.context.playback.seek).not.toHaveBeenCalled();
	adapter.seek(200);
	await vi.advanceTimersByTimeAsync(100);
	expect(f.context.playback.seek).toHaveBeenCalledExactlyOnceWith(200000);
});
