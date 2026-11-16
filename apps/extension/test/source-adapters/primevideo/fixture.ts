import { vi } from "vitest";
export const ids = {
	season: "0N9BB22P2FZ8UD2BBLNX07RP22",
	anchor: "0S1FYJ3LY9KTL9C7WFFAGA9F6F",
	first: "0SXKMY213EM2FCKUVVKUW95I2C",
	second: "0FX1R3RCDS4LZSFJ9KPUBXJFAA",
	movie: "0IUGS56V361WRU60PCC5XH5D8Z",
};
export const gtis = {
	season: "amzn1.dv.gti.88de2837-bb3f-4f7b-b41a-9c1ce670ee9a",
	anchor: "amzn1.dv.gti.d9a17eaa-1a66-416a-a169-610fc3ec9f17",
	first: "amzn1.dv.gti.e8b4ca5d-19d9-41fc-92d2-aa8bf71af3b4",
	second: "amzn1.dv.gti.0cdfdd1a-6b63-46d9-a907-47413460c122",
	movie: "amzn1.dv.gti.3e561ae5-0185-4a0d-a821-0163dadcf753",
};
export function fixture() {
	const locationValue = new URL(
		`https://www.primevideo.com/detail/${ids.season}`,
	);
	Object.defineProperty(window, "location", {
		configurable: true,
		value: locationValue,
	});
	const self = (
		id: string,
		compact: string,
		titleType: string,
		sequenceNumber: number,
	) => ({
		gti: id,
		compactGTI: compact,
		link: `/detail/${compact}`,
		titleType,
		sequenceNumber,
		isLaunched: true,
	});
	const data = {
		init: {
			preparations: {
				body: {
					atf: {
						state: {
							self: {
								[gtis.season]: self(gtis.season, ids.season, "season", 5),
								[gtis.first]: self(gtis.first, ids.first, "episode", 1),
							},
							detail: {
								headerDetail: {
									[gtis.season]: {
										title: "The Boys - Season 5",
										parentTitle: "The Boys",
										titleType: "season",
										seasonNumber: 5,
										images: {
											packshot: "https://m.media-amazon.com/images/show.jpg",
										},
									},
								},
							},
							seasons: {
								[gtis.season]: [
									{
										displayName: "Season 1",
										isSelected: false,
										seasonId: gtis.anchor,
										seasonLink: `/detail/${ids.anchor}?ref_=x`,
										sequenceNumber: 1,
									},
									{
										displayName: "Season 5",
										isSelected: true,
										seasonId: gtis.season,
										seasonLink: `/detail/${ids.season}`,
										sequenceNumber: 5,
									},
								],
							},
						},
					},
					btf: {
						state: {
							self: {
								[gtis.first]: self(gtis.first, ids.first, "episode", 1),
								[gtis.second]: self(gtis.second, ids.second, "episode", 2),
							},
							detail: {
								detail: {
									[gtis.first]: {
										title: "Fifteen Inches of Sheer Dynamite",
										titleType: "episode",
										episodeNumber: 1,
										duration: 3823,
									},
									[gtis.second]: {
										title: "Teenage Kix",
										titleType: "episode",
										episodeNumber: 2,
										duration: 3752,
									},
								},
							},
							episodeList: {
								cardTitleIds: [gtis.first, gtis.second],
								totalCardSize: 8,
							},
						},
					},
				},
			},
		},
	};
	document.body.innerHTML =
		'<script id="dv-web-page-hydration-data" type="application/json"></script><div class="draper-player-container"><video></video></div><div id="dv-web-player"><div class="atvwebplayersdk-video-surface"><video></video></div></div>';
	for (const compact of [ids.first, ids.second, ids.second]) {
		const action = document.createElement("a");
		action.dataset.testid = "episodes-playbutton";
		action.setAttribute("role", "button");
		action.href = `https://www.primevideo.com/detail/${compact}?autoplay=1`;
		document.body.append(action);
	}
	const write = () => {
		document.getElementById("dv-web-page-hydration-data")!.textContent =
			JSON.stringify(data);
	};
	write();
	const root = document.getElementById("dv-web-player")!,
		video = root.querySelector("video")!;
	Object.defineProperty(video, "readyState", { configurable: true, value: 4 });
	let desiredRate = 1;
	let playbackState = "Paused",
		contentState = "Ready",
		itemType = "Feature",
		ad: object | null = null;
	const titleInfo = {
		type: "EPISODE",
		entityType: "TV Show",
		titleId: gtis.first,
		title: "Fifteen Inches of Sheer Dynamite",
		seriesTitle: "The Boys",
		seasonNumber: 5,
		episodeNumber: 1,
		videoMaterialType: "Feature",
	};
	const controls = {
		fastSeekEnabled: true,
		pauseEnabled: true,
		seekForwardEnabled: true,
		seekBackwardEnabled: true,
	};
	const recap = {
		currentRecapIndex: null as number | null,
		isRecapPlaying: false,
		maxSlateDurationExceeded: false,
		recaps: null,
		shouldShowSlate: false,
		slateUrl: null,
	};
	const context = {
		webPlayer: {
			isPlayerOpen: true,
			hasPlaybackInitiated: true,
			currentTitleId: gtis.first,
			currentTime: { contentRelativeTimeMs: 1400000 },
		},
		title: { getTitleInfo: () => titleInfo, videoMaterialType: "Feature" },
		playback: {
			playbackSpeedEnabled: true,
			position: 1309433,
			getPlaybackState: () => playbackState,
			getContentState: () => contentState,
			getPlaybackRate: () => (ad ? 1 : desiredRate),
			player: {
				setPlaybackRate: vi.fn((rate: number) => {
					desiredRate = rate;
				}),
			},
			play: vi.fn(() => {
				playbackState = "Playing";
			}),
			pause: vi.fn(() => {
				playbackState = "Paused";
			}),
			seek: vi.fn((ms: number) => {
				context.playback.position = ms;
			}),
			setPlaybackRate: vi.fn(),
		},
		timeline: {
			getTimelineInfo: () => ({
				endPositionMs: titleInfo.episodeNumber === 1 ? 3823000 : 3752000,
			}),
			playhead: {
				item: {
					contentInfo: {
						get contentType() {
							return itemType;
						},
					},
				},
			},
		},
		adPlayback: {
			getAdBreakInfo: () => ad,
			getAdPlaybackInfo: () => ad,
			isAdTimerShowing: () => !!ad,
		},
		playbackControlsPolicy: { getPolicy: () => controls },
		recapStore: { getRecapInfo: () => recap },
		playerInfo: { info: { territory: "US" } },
		webLocale: "en_US",
	};
	const attach = (value = context) =>
		Reflect.set(root, "_reactRootContainer", {
			_internalRoot: {
				current: { child: { memoizedProps: { context: value } } },
			},
		});
	attach();
	return {
		root,
		video,
		data,
		write,
		context,
		titleInfo,
		controls,
		recap,
		attach,
		setAd(value: boolean) {
			ad = value ? { durationMs: 96096 } : null;
			itemType = value ? "Advertisement" : "Feature";
		},
		setContentState(value: string) {
			contentState = value;
		},
		next() {
			titleInfo.titleId = gtis.second;
			titleInfo.title = "Teenage Kix";
			titleInfo.episodeNumber = 2;
			context.webPlayer.currentTitleId = gtis.second;
			context.playback.position = 20000;
		},
	};
}
export function bridgeTransport() {
	return vi.spyOn(window, "postMessage").mockImplementation((data: unknown) => {
		queueMicrotask(() =>
			window.dispatchEvent(
				new MessageEvent("message", {
					data: structuredClone(data),
					origin: location.origin,
					source: window,
				}),
			),
		);
	});
}
