import { afterEach, expect, it, vi } from "vitest";
import { buildPersonalHistoryResumeUrl } from "@anidachi/protocol";
import { startContentLifecycle } from "../entrypoints/content";
import type { PrimeLaunchHandoff } from "../src/prime-launch-capture";
import type {
	AdapterDetectionResult,
	VideoAdapter,
} from "../src/source-adapters/core/types";
import { historyOwner } from "./watch-history-personal-fixtures";
import { takePersonalHistoryResume } from "../src/watch-history-resume";

const id = "A".repeat(26);
const sourceUrl = `https://www.primevideo.com/detail/${id}`;
const fingerprint = `primevideo|detail/${id}`;
const stops: (() => void)[] = [];
afterEach(() => {
	stops
		.splice(0)
		.reverse()
		.forEach((stop) => stop());
	vi.restoreAllMocks();
	document.body.replaceChildren();
});
function navigate(href: string) {
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(href),
	});
}
function delayedMount(href: string, playingFingerprint = fingerprint, provider: "primevideo" | "hbomax" = "primevideo") {
	navigate(href);
	let detection: AdapterDetectionResult = { status: "none" };
	let launch: PrimeLaunchHandoff | null = null;
	const adapter = {
		id: provider,
		provider,
		getFingerprint: () => playingFingerprint,
		getSourceDescriptor: () => undefined,
		container: document.body,
		video: document.createElement("video"),
	} as unknown as VideoAdapter;
	const runtime = startContentLifecycle({
		detect: () => detection,
		ensureStyles() {},
		installKeyboardGuard: () => () => {},
		startProviderStudy: () => null,
		mount: (active, initialLaunch) => {
			launch = initialLaunch ?? null;
			return {
				adapter: active,
				relocate() {},
				replaceAdapter() {},
				suspend() {},
				dispose() {},
			};
		},
	});
	stops.push(runtime.dispose);
	return {
		runtime,
		mount() {
			detection = { status: "ready", adapter };
			runtime.reconcile();
			return launch;
		},
	};
}
async function resumeUrl() {
	return buildPersonalHistoryResumeUrl({
		ownerUserId: historyOwner,
		accountGeneration: 1,
		provider: "primevideo",
		sourceUrl,
		currentTime: 602,
	});
}

it("hands off initial Prime room after provider clears hash before adapter exists, then never revives it", () => {
	const page = delayedMount(`${sourceUrl}?autoplay=1#anidachiRoom=room-a`);
	navigate(`${sourceUrl}?ref_=atv_plr_detail_play`);
	const launch = page.mount();
	expect(launch).not.toBeNull();
	expect(launch!.readRoom(location.href, fingerprint, historyOwner)).toBe(
		"room-a",
	);
	launch!.consumeRoom();
	expect(launch!.readRoom(location.href, fingerprint, historyOwner)).toBeNull();
	page.runtime.reconcile();
	expect(launch!.readRoom(location.href, fingerprint, historyOwner)).toBeNull();
});
it("hands off bounded canonical Resume after provider clears hash before adapter exists only once", async () => {
	const page = delayedMount(await resumeUrl());
	navigate(`${sourceUrl}?ref_=atv_plr_detail_play`);
	const launch = page.mount();
	expect(launch).not.toBeNull();
	expect(launch!.takeResume(location.href, fingerprint)).toMatchObject({
		provider: "primevideo",
		sourceUrl,
		currentTime: 602,
	});
	expect(launch!.takeResume(location.href, fingerprint)).toBeNull();
});
it("preserves room precedence over a simultaneous personal Resume", async () => {
	const url = new URL(await resumeUrl());
	url.hash += "&anidachiRoom=room-a";
	const page = delayedMount(url.href);
	navigate(sourceUrl);
	const launch = page.mount()!;
	expect(launch).not.toBeNull();
	expect(launch.takeResume(location.href, fingerprint)).toBeNull();
	expect(launch.readRoom(location.href, fingerprint, historyOwner)).toBe(
		"room-a",
	);
});
it("keeps the room fallback when normal Resume acquisition removes only the ineligible Resume hash", async () => {
	const url = new URL(await resumeUrl());
	url.hash += "&anidachiRoom=room-a";
	const page = delayedMount(url.href);
	const launch = page.mount()!;
	expect(launch).not.toBeNull();
	expect(launch.takeResume(location.href, fingerprint)).toBeNull();
	expect(takePersonalHistoryResume(location, navigate)).toBeNull();
	window.dispatchEvent(new Event("hashchange"));
	navigate(sourceUrl);
	expect(launch.readRoom(location.href, fingerprint, historyOwner)).toBe(
		"room-a",
	);
});
it("rechecks Resume expiry at delayed handoff consumption", async () => {
	const page = delayedMount(await resumeUrl());
	navigate(sourceUrl);
	const launch = page.mount()!;
	expect(launch).not.toBeNull();
	expect(
		launch.takeResume(location.href, fingerprint, Date.now() + 300001),
	).toBeNull();
	expect(launch.takeResume(location.href, fingerprint)).toBeNull();
});
it.each([
	"source",
	"explicit",
	"owner",
	"expiry",
	"dispose",
] as const)("drops captured room on %s without resurrecting it", (change) => {
	const page = delayedMount(`${sourceUrl}#anidachiRoom=room-a`);
	navigate(sourceUrl);
	const launch = page.mount()!;
	expect(launch).not.toBeNull();
	expect(launch.readRoom(location.href, fingerprint, historyOwner)).toBe(
		"room-a",
	);
	if (change === "source")
		navigate(`https://www.primevideo.com/detail/${"B".repeat(26)}`);
	if (change === "explicit") navigate(`${sourceUrl}#anidachiRoom=room-b`);
	if (change === "dispose") page.runtime.dispose();
	expect(
		launch.readRoom(
			location.href,
			fingerprint,
			change === "owner" ? "other-owner" : historyOwner,
			change === "expiry" ? Date.now() + 300001 : Date.now(),
		),
	).toBeNull();
	navigate(sourceUrl);
	expect(launch.readRoom(location.href, fingerprint, historyOwner)).toBeNull();
});
it("replaces captured launch with a new explicit intent before delayed mount", () => {
	const page = delayedMount(`${sourceUrl}#anidachiRoom=room-a`);
	navigate(`${sourceUrl}#anidachiRoom=room-b`);
	window.dispatchEvent(new Event("hashchange"));
	navigate(sourceUrl);
	const launch = page.mount()!;
	expect(launch).not.toBeNull();
	expect(launch.readRoom(location.href, fingerprint, historyOwner)).toBe(
		"room-b",
	);
});
it("rejects a changed playing fingerprint before handoff", () => {
	const page = delayedMount(
		`${sourceUrl}#anidachiRoom=room-a`,
		`primevideo|detail/${"B".repeat(26)}`,
	);
	navigate(sourceUrl);
	expect(page.mount()).toBeNull();
});
it("does not rebind an old room fragment after source changes away and back before mount", () => {
	const page = delayedMount(`${sourceUrl}#anidachiRoom=room-a`);
	navigate(`https://www.primevideo.com/detail/${"B".repeat(26)}#anidachiRoom=room-a`);
	page.runtime.reconcile();
	navigate(`${sourceUrl}#anidachiRoom=room-a`);
	expect(page.mount()).toBeNull();
});
it("invalidates a new explicit Resume instead of reviving an older captured room", async () => {
	const page = delayedMount(`${sourceUrl}#anidachiRoom=room-a`);
	navigate(sourceUrl);
	const launch = page.mount()!;
	navigate(await resumeUrl());
	expect(launch.readRoom(location.href, fingerprint, historyOwner)).toBeNull();
	navigate(sourceUrl);
	expect(launch.readRoom(location.href, fingerprint, historyOwner)).toBeNull();
});

it("preserves initial room handoff across equivalent regional detail addresses", () => {
 const regional = sourceUrl.replace('/detail/', '/region/na/detail/');
 const page = delayedMount(`${regional}?autoplay=1#anidachiRoom=regional-room`);
 navigate(`${regional}?ref_=x`);
 expect(page.mount()?.readRoom(location.href, fingerprint, historyOwner)).toBe('regional-room');
});
it("preserves canonical Resume identity on a regional launch", async () => {
 const href = (await resumeUrl()).replace('/detail/', '/region/na/detail/');
 const page = delayedMount(href);
 navigate(sourceUrl.replace('/detail/', '/region/na/detail/'));
 expect(page.mount()?.takeResume(location.href, fingerprint)?.sourceUrl).toBe(sourceUrl);
});

it("preserves the owner-bound personal HBO resume once after same-document URL cleanup", async () => {
	const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	const href = "https://www.hbomax.com/video/watch/" + id;
	const fingerprint = "hbomax|video/watch/" + id;
	const input = await buildPersonalHistoryResumeUrl({ ownerUserId: historyOwner, accountGeneration: 1,
		provider: "hbomax", sourceUrl: href, currentTime: 37 });
	const page = delayedMount(input, fingerprint, "hbomax");
	navigate(href);
	const capture = page.mount();
	const resume = capture?.takeResume(href, fingerprint);
	expect(resume).toMatchObject({ provider: "hbomax", sourceUrl: href, accountGeneration: 1, currentTime: 37 });
	expect(resume?.ownerBinding).toBeTruthy();
	expect(capture?.takeResume(href, fingerprint)).toBeNull();
});
