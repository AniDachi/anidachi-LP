import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogFixture } from "./catalog-fixture";
import { fixture, ids } from "./fixture";
import { inspectPrimeSdk } from "../../../src/source-adapters/primevideo/sdk";
import { readPrimeCatalogPage } from "../../../src/source-adapters/primevideo/catalog-page";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { readPrimeBinding } from "../../../src/source-adapters/primevideo/contract";
import { readPrimePageState } from "../../../src/source-adapters/primevideo/page-state";

// Observed on Grimm after Supernatural -> Home -> Grimm: initial hydration and
// canonical stay on Supernatural. The live page context moves to Grimm.
function livePage(body: unknown) {
	const root = document.createElement("div");
	root.id = "dv-web-page-hydration-root";
	document.body.append(root);
	const current = { child: { memoizedProps: { value: body } } };
	Reflect.set(root, "__reactContainer$observed", { stateNode: { current } });
	return current;
}
function staleHtml() {
	document.getElementById("dv-web-page-hydration-data")!.textContent = "{}";
	const canonical = document.createElement("link");
	canonical.rel = "canonical";
	canonical.href = `https://www.primevideo.com/detail/${ids.movie}`;
	document.head.append(canonical);
}
afterEach(() => {
	document.body.innerHTML = "";
	document.head.innerHTML = "";
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("Prime public page state after native SPA navigation", () => {
	it("binds the current SDK using live page metadata while initial HTML stays stale", () => {
		const f = fixture();
		livePage(f.data.init.preparations.body);
		staleHtml();
		const stop = startPrimeBridge();
		try {
			expect(readPrimeBinding(f.video)?.contentId).toBe(ids.first);
			expect(inspectPrimeSdk()?.page.metadata.title).toBe("The Boys");
			f.next();
			f.video.dispatchEvent(new Event("timeupdate"));
			expect(readPrimeBinding(f.video)?.contentId).toBe(ids.second);
		} finally {
			stop();
		}
	});
	it("uses the same current page state for catalog membership", () => {
		const f = catalogFixture();
		livePage(f.pages[3]!.data.init.preparations.body);
		staleHtml();
		expect(
			readPrimeCatalogPage(document, location.origin)?.selected.compact,
		).toBe(ids.season);
		expect(
			readPrimeCatalogPage(document, location.origin)?.season.episodes,
		).toHaveLength(2);
	});
	it("does not fall back to initial HTML when a live page contradicts playback", () => {
		const f = fixture();
		const body = structuredClone(f.data.init.preparations.body);
		body.btf.state.detail.detail[
			Object.keys(body.btf.state.detail.detail)[0]!
		]!.title = "Other title";
		livePage(body);
		expect(inspectPrimeSdk()).toBeNull();
	});
	it("follows the committed root rather than the container's old fiber", () => {
		const f = fixture();
		const root = livePage({ atf: { state: {} }, btf: { state: {} } });
		staleHtml();
		expect(inspectPrimeSdk()).toBeNull();
		root.child.memoizedProps.value = f.data.init.preparations.body;
		expect(inspectPrimeSdk()?.snapshot.contentId).toBe(ids.first);
	});
	it("keeps a direct marketplace canonical alias only while initial and live page IDs agree", () => {
		const f = catalogFixture();
		const body = f.pages[3]!.data.init.preparations.body;
		const current = livePage(body);
		vi.spyOn(window.performance, "getEntriesByType").mockReturnValue([
			{ name: location.href } as PerformanceEntry,
		]);
		const canonical = document.createElement("link");
		canonical.rel = "canonical";
		canonical.href = `https://www.primevideo.com/detail/${ids.season}`;
		document.head.append(canonical);
		expect(readPrimePageState(document)?.canonicalHref).toBe(canonical.href);
		window.location.pathname = "/detail/B012345678";
		expect(readPrimePageState(document)?.canonicalHref).toBeNull();
		window.location.pathname = `/detail/${ids.season}`;
		current.child.memoizedProps.value = f.pages[0]!.data.init.preparations.body;
		expect(readPrimePageState(document)?.canonicalHref).toBeNull();
	});
	it("rejects ambiguous live providers and bounds cycles without reviving static data", () => {
		const f = fixture();
		const current = livePage(f.data.init.preparations.body);
		Reflect.set(current.child, "sibling", {
			memoizedProps: { value: structuredClone(f.data.init.preparations.body) },
		});
		expect(inspectPrimeSdk()).toBeNull();
		Reflect.set(current.child, "sibling", current);
		expect(inspectPrimeSdk()?.snapshot.contentId).toBe(ids.first);
		let chain: Record<string, unknown> = {};
		for (let i = 0; i < 601; i++) chain = { child: chain };
		Reflect.set(current.child, "sibling", chain);
		expect(inspectPrimeSdk()).toBeNull();
	});
	it("cannot borrow a live title mapping from another route", () => {
		const f = fixture();
		livePage(f.data.init.preparations.body);
		staleHtml();
		window.location.pathname = `/detail/${ids.movie}`;
		expect(inspectPrimeSdk()).toBeNull();
	});
});
