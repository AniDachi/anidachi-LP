import { afterEach, expect, it, vi } from "vitest";
import { primeVideoDefinition } from "../../../src/source-adapters/primevideo/definition";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { readCurrentPrimePlayerBinding } from "../../../src/source-adapters/primevideo/contract";
import { bridgeTransport, fixture, gtis, ids } from "./fixture";

let stop: (() => void) | undefined;
afterEach(() => {
	stop?.();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.body.replaceChildren();
});

function setup() {
	vi.useFakeTimers();
	const player = fixture();
	const button = document.createElement("button");
	button.id = "atvwebplayersdk-next-episode-button";
	button.textContent = "Nächste Folge";
	player.root.append(button);
	const click = vi.fn();
	button.addEventListener("click", click);
	const switchEpisode = () => {
		player.next();
		player.video.dispatchEvent(new Event("loadedmetadata"));
	};
	const launch = vi.fn(async (message: { action: string }) =>
		message.action === "start"
			? { status: "prepared", intentId: "intent", ownerUserId: "owner" }
			: { status: "ready" },
	);
	vi.stubGlobal("chrome", { runtime: { sendMessage: launch } });
	bridgeTransport();
	stop = startPrimeBridge();
	const controller = new AbortController();
	const follow = (id = ids.second) => {
		const url = `https://www.primevideo.com/detail/${id}`;
		return primeVideoDefinition.ensureSource({
			provider: "primevideo", title: "Episode", sourceUrl: url, canonicalUrl: url,
			videoFingerprint: `primevideo|detail/${id}`,
		}, { roomProvider: "primevideo", roomId: "room", signal: controller.signal });
	};
	return { player, button, click, launch, follow, switchEpisode, controller };
}

it("follows exactly one localized native Next without leaving the season URL or player", async () => {
	const { player, button, click, launch, follow, switchEpisode } = setup();
	// Only this season is available. Room navigation does not require a season-one history anchor.
	const seasonList = player.data.init.preparations.body.atf.state.seasons[gtis.season]!;
	seasonList.splice(0, 1);
	player.write();
	button.addEventListener("click", () => setTimeout(switchEpisode, 1800));
	const href = location.href;
	const result = follow();
	await vi.advanceTimersByTimeAsync(3000);
	expect(await result).toMatchObject({ status: "navigation-started" });
	expect(click).toHaveBeenCalledTimes(1);
	expect(launch).not.toHaveBeenCalled();
	expect(location.href).toBe(href);
	expect(document.querySelector("#dv-web-player video")).toBe(player.video);
	expect(readCurrentPrimePlayerBinding(document)?.contentId).toBe(ids.second);
});

it.each([false, true])("adopts Prime autoplay, including a temporarily unbound player (%s)", async missingBinding => {
	const { player, click, launch, follow, switchEpisode } = setup();
	if (missingBinding) {
		player.context.webPlayer.currentTitleId = gtis.second;
		player.video.dispatchEvent(new Event("emptied"));
		expect(readCurrentPrimePlayerBinding(document)).toBeNull();
	}
	const result = follow();
	setTimeout(switchEpisode, missingBinding ? 1100 : 100);
	await vi.advanceTimersByTimeAsync(1500);
	expect(await result).toMatchObject({ status: "navigation-started" });
	expect(click).not.toHaveBeenCalled();
	expect(launch).not.toHaveBeenCalled();
});

it.each(["jump", "disabled", "ambiguous-ordinal", "conflicting-next", "no-play-action", "interstitial", "ignored-click"])(
	"uses only the host's exact URL when native Next is unsuitable or unconfirmed (%s)", async mode => {
		const { player, button, click, launch, follow } = setup();
		if (mode === "disabled") button.disabled = true;
		if (mode === "no-play-action") document.querySelectorAll('a[data-testid="episodes-playbutton"]').forEach(a => a.remove());
		if (mode === "interstitial") player.setAd(true);
		if (mode === "conflicting-next") Object.assign(player.context, { nextTitle: { nextTitleInfo: { titleId: gtis.movie } } });
		if (mode === "ambiguous-ordinal") {
			const state = player.data.init.preparations.body.btf.state;
			Object.assign(state.self, { [gtis.movie]: { ...state.self[gtis.second], gti: gtis.movie, compactGTI: ids.movie, link: `/detail/${ids.movie}` } });
			state.episodeList.cardTitleIds.push(gtis.movie);
			player.write();
		}
		const target = mode === "jump" ? ids.movie : ids.second;
		const result = follow(target);
		await vi.advanceTimersByTimeAsync(4500);
		expect(await result).toMatchObject({ status: "navigation-started" });
		expect(click).toHaveBeenCalledTimes(mode === "ignored-click" ? 1 : 0);
		expect(launch.mock.calls.map(([m]) => m.action)).toEqual(["start", "commit"]);
		expect(launch).toHaveBeenCalledWith(expect.objectContaining({ action: "start", contentId: target, roomId: "room" }));
	},
);

it.each(["before-click", "after-click", "player-closed"])("does not reopen a superseded or closed player (%s)", async mode => {
	const { player, click, launch, follow, controller } = setup();
	const result = follow();
	await vi.advanceTimersByTimeAsync(mode === "before-click" ? 520 : 650);
	if (mode === "player-closed") {
		player.context.webPlayer.isPlayerOpen = false;
		player.video.dispatchEvent(new Event("emptied"));
	} else controller.abort();
	await vi.advanceTimersByTimeAsync(4500);
	expect(await result).toMatchObject({ status: "failed" });
	expect(click).toHaveBeenCalledTimes(mode === "before-click" ? 0 : 1);
	expect(launch).not.toHaveBeenCalled();
});
