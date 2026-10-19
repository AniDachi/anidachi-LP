import {
	ArrowUpRight,
	ChevronRight,
	Copy,
	Eye,
	EyeOff,
	PanelsTopLeft,
	Play,
	RefreshCw,
	SlidersHorizontal,
	Smile,
	UserPlus,
	X,
} from "lucide-react";
import { ONBOARDING_CHECKOUT_OPEN, ONBOARDING_RETURN_PROBE } from "@anidachi/protocol";
import {
	type CSSProperties,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { AnidachiLogoMark } from "./anidachi-logo-mark";
import type { AuthenticatedUserPlan } from "./auth-tokens";
import {
	getHostingOfferUrl,
	getHostingEntry,
	type HostingEntry,
} from "./hosting-offer-link";
import type { CurrentResourceDisplay } from "./current-resource-display";
import {
	overlayHotkeyBoundaryProps,
	overlayInteractionBoundaryProps,
} from "./overlay-interaction-boundary";
import { SolidCameraIcon, SolidMicrophoneIcon } from "./panel-media-controls";
import { PracticeChat, type PracticeChatPhase } from "./player-onboarding-chat";
import { TourSketchCue } from "./player-onboarding-cue";
import {
	PLAYER_INTRODUCTION_ACTIVE_ATTR,
	PLAYER_INTRODUCTION_KEY_EVENT,
	registerPlayerIntroductionRoot,
} from "./player-onboarding-input";
import { PracticePanel } from "./player-onboarding-panel";
import { PLAYER_INTRODUCTION_MESSAGE } from "./player-onboarding-storage";
import { playerOnboardingStyles } from "./player-onboarding-styles";
import type { VideoAdapter } from "./source-adapters/core/types";
import type { HostingDisplayState } from "./use-hosting-access";

type Step = "launcher" | "create" | "invite" | "chat" | "camera" | "settings";
const STEP_COUNT = 6;
const VIDEO_WARMUP_MS = 2_000;
const FINISH_ROLL_MS = 1_200;
const FINISH_FADE_MS = 160;
export interface PlayerOnboardingProps {
	adapter: VideoAdapter;
	ready: boolean;
	canStart: () => boolean;
	roomId: string | null;
	resource: CurrentResourceDisplay | null;
	accountPlan?: AuthenticatedUserPlan | null;
	hosting?: HostingDisplayState;
	onRefreshHosting: () => void;
	onActiveChange: (active: boolean) => void;
}

/** Offer presentation only; checkout and room eligibility remain server-owned. */
export function getPlayerIntroductionOffer(
	accountPlan: AuthenticatedUserPlan | null | undefined,
	hosting?: HostingDisplayState,
): Exclude<HostingEntry, "check"> | "sign-in" | "loading" | "retry" | null {
	const plan = hosting?.access?.planCode ?? accountPlan;
	if (plan === "plus" || plan === "pro" || hosting?.access?.hosting?.canHost)
		return null;
	const entry = getHostingEntry(hosting);
	// Keep a confirmed same-owner offer during background revalidation.
	if (entry !== "check") return entry;
	// null is confirmed signed-out; undefined is identity still loading.
	if (accountPlan === null && !hosting?.access && !hosting?.busy) return "sign-in";
	if (hosting?.busy || (!hosting?.access && !hosting?.error)) return "loading";
	// Missing/failed terms are retryable, never a temporary purchase offer.
	return "retry";
}

const copy = {
	launcher: {
		number: 1,
		title: (
			<>
				Welcome to <br />
				<em>AniDachi</em>
			</>
		),
		text: "Watch together with friends.\nClick the icon to get started.",
	},
	create: {
		number: 2,
		title: (
			<>
				Your <em>room</em>
				<br />
				starts here.
			</>
		),
		text: "Create rooms with Plus or Pro.\nYour friends join free.",
	},
	invite: {
		number: 3,
		title: (
			<>
				Invite a <br />
				<em>friend.</em>
			</>
		),
		text: "Share the link with your friends.\nWatch, chat and react together.",
	},
	chat: {
		number: 4,
		title: (
			<>
				Chat with <em>Enter.</em>
			</>
		),
		text: "Press Enter to open chat while watching.",
	},
	camera: {
		number: 5,
		title: (
			<>
				Camera <em>&amp; mic.</em>
			</>
		),
		text: "Talk with friends while you watch.",
	},
	settings: {
		number: 6,
		title: (
			<>
				Make it <em>yours.</em>
			</>
		),
		text: "Your reactions, your layout, your preferences.",
	},
};

export function PlayerOnboarding(props: PlayerOnboardingProps) {
	const latest = useRef(props);
	latest.current = props;
	const [step, setStep] = useState<Step | null>(null);
	const [chatPhase, setChatPhase] = useState<PracticeChatPhase>("typing");
	const [practiceCameraOn, setPracticeCameraOn] = useState(false);
	const [exit, setExit] = useState<{
		size: number;
		angle: number;
		reduced: boolean;
	} | null>(null);
	const finishing = useRef(false);
	const root = useRef<HTMLDivElement>(null),
		tip = useRef<HTMLElement>(null);
	const close = useRef<(resume: boolean) => void>(() => {});
	const [layout, setLayout] = useState<{
		hole: { x: number; y: number; w: number; h: number };
		tip: CSSProperties;
		cue?: CSSProperties;
	} | null>(null);
	const active = step !== null;
	const checkoutReturn = useRef<{ token: string; fingerprint: string } | null>(null);
	const checkoutOpening = useRef(false);
	useEffect(() => {
		if (!active) { checkoutReturn.current = null; return; }
		const probe = (message: unknown, sender: chrome.runtime.MessageSender, respond: (value: unknown) => void) => {
			const value = message as { type?: string; token?: string } | null;
			if (value?.type !== ONBOARDING_RETURN_PROBE || sender.id !== chrome.runtime.id) return false;
			const pending = checkoutReturn.current;
			respond({ ready: !!pending && value.token === pending.token &&
				latest.current.ready && !latest.current.roomId &&
				latest.current.adapter.getFingerprint() === pending.fingerprint });
			return false;
		};
		chrome.runtime.onMessage?.addListener(probe);
		return () => chrome.runtime.onMessage?.removeListener(probe);
	}, [active]);
	const openCheckout = async (offer: HostingEntry) => {
		if (checkoutOpening.current) return;
		checkoutOpening.current = true;
		const token = crypto.randomUUID();
		checkoutReturn.current = { token, fingerprint: props.adapter.getFingerprint() };
		try {
			const result = await chrome.runtime.sendMessage({ type: ONBOARDING_CHECKOUT_OPEN, token, offer });
			if (result?.opened !== true) window.open(getHostingOfferUrl(offer), "_blank", "noopener,noreferrer");
		} catch {
			window.open(getHostingOfferUrl(offer), "_blank", "noopener,noreferrer");
		} finally { checkoutOpening.current = false; }
	};
	const finish = () => {
		if (finishing.current || step !== "settings" || !root.current) return;
		finishing.current = true;
		const { width, height } = root.current.getBoundingClientRect();
		const size = Math.max(1, Math.min(height * 0.56, width * 0.48, 420));
		root.current.focus({ preventScroll: true });
		setExit({
			size,
			angle: ((width + size) / (Math.PI * size)) * 360,
			reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
		});
	};

	useEffect(() => {
		if (!exit) return;
		// animationend normally completes the transition; a bounded fallback also
		// releases the player if the browser suppresses animations or their events.
		const timer = window.setTimeout(
			() => close.current(true),
			(exit.reduced ? FINISH_FADE_MS : FINISH_ROLL_MS) + 200,
		);
		const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
		const reduce = () => {
			if (preference.matches) close.current(true);
		};
		preference.addEventListener("change", reduce);
		return () => {
			clearTimeout(timer);
			preference.removeEventListener("change", reduce);
		};
	}, [exit]);

	useEffect(() => {
		if (!props.ready) return;
		const { adapter } = props;
		let disposed = false,
			attempted = false,
			shown = false,
			wasPlaying = false;
		let fingerprint: string | null = null;
		let warmup: { fingerprint: string; startedAt: number } | null = null;
		const safe = () =>
			!disposed &&
			latest.current.ready &&
			adapter.video.isConnected &&
			adapter.getPlaybackSnapshot().phase === "content";
		const available = () =>
			safe() &&
			!latest.current.roomId &&
			latest.current.canStart() &&
			document.visibilityState === "visible" &&
			adapter.video.readyState >= 2 &&
			!!root.current &&
			root.current.getBoundingClientRect().width >= 600 &&
			root.current.getBoundingClientRect().height >= 340;
		const frameReady = () =>
			!adapter.video.seeking &&
			(!adapter.getPlaybackSnapshot().playing || adapter.video.readyState >= 3);
		const stop = (resume: boolean) => {
			if (!shown) return;
			shown = false;
			finishing.current = false;
			setExit(null);
			setStep(null);
			latest.current.onActiveChange(false);
			if (
				resume &&
				wasPlaying &&
				!latest.current.roomId &&
				safe() &&
				document.visibilityState === "visible" &&
				adapter.getFingerprint() === fingerprint
			)
				void adapter.play().catch(() => {});
		};
		close.current = stop;
		const check = async () => {
			if (disposed) return;
			if (shown) {
				// Pricing opens in another tab. Keep the current step and draft when
				// backgrounded; only a changed player/source or real room ends the tour.
				if (
					!safe() ||
					latest.current.roomId ||
					adapter.getFingerprint() !== fingerprint
				) {
					stop(false);
					return;
				}
				if (adapter.getPlaybackSnapshot().playing) adapter.pause();
				return;
			}
			if (attempted) return;
			if (!available() || !frameReady()) {
				warmup = null;
				return;
			}
			const source = adapter.getFingerprint();
			if (!warmup || warmup.fingerprint !== source) {
				warmup = { fingerprint: source, startedAt: performance.now() };
				return;
			}
			// Let the content render before pausing it behind the tour. Claim only
			// after this wait so navigation/loading does not consume the one-time tour.
			if (performance.now() - warmup.startedAt < VIDEO_WARMUP_MS) return;
			attempted = true;
			try {
				const result = await chrome.runtime.sendMessage({
					type: PLAYER_INTRODUCTION_MESSAGE,
				});
				if (
					result?.allowed !== true ||
					!available() ||
					!frameReady() ||
					!warmup ||
					adapter.getFingerprint() !== source
				)
					return;
				fingerprint = source;
				wasPlaying = adapter.getPlaybackSnapshot().playing;
				if (wasPlaying) adapter.pause();
				shown = true;
				setStep("launcher");
				latest.current.onActiveChange(true);
			} catch {
				/* A lost extension context must leave the player usable. */
			}
		};
		void check();
		const timer = window.setInterval(() => {
			void check();
		}, 500);
		const unsubscribe = adapter.subscribe(() => {
			void check();
		});
		const update = () => {
				void check();
			},
			resetWarmup = () => {
				warmup = null;
			},
			hide = () => {
				resetWarmup();
				stop(false);
			};
		const loadingEvents = ["emptied", "waiting", "seeking"] as const;
		for (const event of loadingEvents)
			adapter.video.addEventListener(event, resetWarmup);
		document.addEventListener("visibilitychange", update);
		window.addEventListener("pagehide", hide);
		return () => {
			stop(true);
			disposed = true;
			clearInterval(timer);
			unsubscribe();
			for (const event of loadingEvents)
				adapter.video.removeEventListener(event, resetWarmup);
			document.removeEventListener("visibilitychange", update);
			window.removeEventListener("pagehide", hide);
		};
	}, [props.adapter, props.ready]);
	useEffect(() => {
		if (props.roomId) close.current(false);
	}, [props.roomId]);

	useEffect(() => {
		if (!active || !root.current) return;
		const releaseRoot = registerPlayerIntroductionRoot(root.current);
		document.documentElement.setAttribute(
			PLAYER_INTRODUCTION_ACTIVE_ATTR,
			"true",
		);
		const key = (message: Event) => {
			const event = (message as CustomEvent<KeyboardEvent>).detail;
			if (event.repeat || event.isComposing || event.keyCode === 229) return;
			const composer =
				step === "chat"
					? root.current?.querySelector<HTMLFormElement>(
							".tour-practice-composer",
						)
					: null;
			if (event.key === "Escape") {
				if (composer) {
					composer
						.querySelector<HTMLButtonElement>('[aria-label="Close message"]')
						?.click();
					return;
				}
				close.current(true);
				return;
			}
			if (finishing.current) return;
			const controls = [
				...(root.current?.querySelectorAll<HTMLElement>(
					"button:not(:disabled):not([aria-disabled=true]), input:not(:disabled), a[href]",
				) ?? []),
			].filter((el) => el.tabIndex !== -1 && !el.closest("[inert]"));
			const focused = (root.current?.getRootNode() as ShadowRoot | Document)
				?.activeElement;
			if (
				composer &&
				focused === composer.querySelector("input") &&
				focused instanceof HTMLInputElement &&
				event.key === "Enter" &&
				!event.shiftKey &&
				!event.altKey &&
				!event.ctrlKey &&
				!event.metaKey
			) {
				composer.requestSubmit();
				return;
			}
			if (event.key === "Tab" && controls.length) {
				const i = controls.indexOf(focused as HTMLButtonElement);
				controls[
					(i + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
				]?.focus();
			} else if (
				(event.key === "Enter" || event.key === " ") &&
				(focused instanceof HTMLButtonElement ||
					focused instanceof HTMLAnchorElement) &&
				controls.includes(focused)
			)
				focused.click();
		};
		window.addEventListener(PLAYER_INTRODUCTION_KEY_EVENT, key);
		return () => {
			document.documentElement.removeAttribute(PLAYER_INTRODUCTION_ACTIVE_ATTR);
			window.removeEventListener(PLAYER_INTRODUCTION_KEY_EVENT, key);
			releaseRoot();
		};
	}, [active, step]);

	useLayoutEffect(() => {
		if (!step) return;
		const target = root.current?.querySelector<HTMLElement>(
			`[data-tour-target="${step}"]`,
		);
		const focusTarget =
			step === "settings"
				? target?.querySelector<HTMLElement>('[aria-selected="true"]')
				: step === "camera"
					? target?.querySelector<HTMLButtonElement>(".panel-media-camera")
					: step === "invite"
						? target?.querySelector<HTMLButtonElement>("button")
						: step === "chat" && chatPhase === "closed"
							? target
							: step === "chat" && chatPhase === "typing"
								? target?.querySelector<HTMLInputElement>("input")
								: target;
		focusTarget?.focus({ preventScroll: true });
		const update = () => {
			if (!root.current || !tip.current) return;
			const r = root.current.getBoundingClientRect(),
				t = target?.getBoundingClientRect(),
				p = tip.current.getBoundingClientRect();
			const panel = root.current
				.querySelector(".mini-panel")
				?.getBoundingClientRect();
			const x = Math.max(0, (t?.left ?? r.left) - r.left - 5),
				y = Math.max(0, (t?.top ?? r.top) - r.top - 5);
			// Hide the target ring when scrolling moves its button out of the panel.
			const targetVisible =
				t && (!panel || (t.top >= panel.top && t.bottom <= panel.bottom));
			const hole = targetVisible
				? {
						x,
						y,
						w: Math.max(0, Math.min(t.right - r.left + 5, r.width) - x),
						h: Math.max(0, Math.min(t.bottom - r.top + 5, r.height) - y),
					}
				: { x: 0, y: 0, w: 0, h: 0 };
			// The title stays in the left column; only the small click cue
			// follows the real target as native player controls move the panel.
			const left = r.width >= 950 ? r.width * 0.057 : 20;
			const footer = root.current
				.querySelector(".tour-footer")
				?.getBoundingClientRect();
			const compactOverview =
				(step === "settings" || step === "camera") && r.height <= 430;
			const minTop = compactOverview ? 52 : 60;
			const chatTargetTop =
				step === "chat" && t ? t.top - r.top - 24 : Infinity;
			const copyBottom = Math.min(
				chatTargetTop,
				(footer ? footer.top - r.top : r.height - 56) -
					(compactOverview ? 12 : 28),
			);
			const maxHeight = Math.max(120, copyBottom - minTop);
			const top = Math.max(
				minTop,
				Math.min(r.height * 0.31, copyBottom - Math.min(p.height, maxHeight)),
			);
			const compact = r.width < 950;
			const cueWidth =
				step === "launcher"
					? compact
						? 56
						: 80
					: compact
						? 38
						: step === "settings"
							? r.width < 1050
								? 38
								: 64
							: 96;
			const cueEndY = step === "launcher" ? 22 : 38;
			// Keep annotations outside the drawer. Compact players retain the
			// short pointer; their left-column instructions stay readable.
			const cue =
				targetVisible && step !== "chat"
					? step === "camera"
						? {
								// Approach the pair from its left edge, clear of the capsule.
								left: hole.x - 8 - (103 / 112) * 80,
								top: hole.y + hole.h / 2 - (66 / 112) * 80,
							}
						: step === "invite"
							? {
									left: hole.x + 10 - (100 / 112) * 120,
									top: Math.max(12, hole.y - 10 - (78 / 112) * 120),
								}
							: {
									width: cueWidth,
									left:
										hole.x -
										(103 / 112) * cueWidth -
										(step === "launcher" ? 8 : 12),
									top: hole.y + hole.h / 2 - (cueEndY / 112) * cueWidth,
								}
					: undefined;
			setLayout({
				hole,
				tip: { left, top, maxHeight },
				cue,
			});
		};
		update();
		const resize = new ResizeObserver(update);
		if (root.current) resize.observe(root.current);
		if (tip.current) resize.observe(tip.current);
		if (target) resize.observe(target);
		const panel = root.current?.querySelector(".mini-panel");
		if (panel) resize.observe(panel);
		// Native controls can move the overlay via CSS variables without a
		// window resize (for example after entering fullscreen).
		const positions = new MutationObserver(update);
		const overlay = root.current?.closest(".anidachi-overlay");
		if (overlay)
			positions.observe(overlay, {
				attributes: true,
				attributeFilter: ["style"],
			});
		panel?.addEventListener("scroll", update);
		window.addEventListener("resize", update);
		return () => {
			resize.disconnect();
			positions.disconnect();
			panel?.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, [step, chatPhase]);

	const created =
		step === "invite" ||
		step === "chat" ||
		step === "camera" ||
		step === "settings";
	const details = step ? copy[step] : null;
	const offer = getPlayerIntroductionOffer(props.accountPlan, props.hosting);
	const h = layout?.hole;
	const chatClosed = step === "chat" && chatPhase === "closed";
	// Dim the surrounding controls as well as the video. The visual masks
	// let pointer events through so the practice drawer remains explorable.
	const opening = chatClosed ? undefined : h;
	const masks: CSSProperties[] =
		opening && opening.w > 0
			? [
					{ left: 0, top: 0, width: "100%", height: opening.y },
					{ left: 0, top: opening.y + opening.h, width: "100%", bottom: 0 },
					{ left: 0, top: opening.y, width: opening.x, height: opening.h },
					{
						left: opening.x + opening.w,
						right: 0,
						top: opening.y,
						height: opening.h,
					},
				]
			: [{ inset: 0 }];
	return (
		<div
			ref={root}
			className={`player-introduction${exit ? " tour-exiting" : ""}`}
			tabIndex={-1}
			{...(active ? overlayInteractionBoundaryProps : {})}
			style={
				{
					position: "absolute",
					inset: 0,
					zIndex: 1000,
					pointerEvents: active ? "auto" : "none",
					...(exit
						? {
								"--tour-roll-size": `${exit.size}px`,
								"--tour-roll-angle": `${exit.angle}deg`,
								"--tour-exit-duration": `${exit.reduced ? FINISH_FADE_MS : FINISH_ROLL_MS}ms`,
							}
						: {}),
				} as CSSProperties
			}
		>
			{active && (
				<>
					<style>{playerOnboardingStyles}</style>
					<div
						className="tour-scene"
						inert={!!exit}
						aria-hidden={exit ? true : undefined}
						onAnimationEnd={(event) => {
							if (
								finishing.current &&
								event.target === event.currentTarget &&
								(event.animationName === "tour-wipe" ||
									event.animationName === "tour-fade-out")
							)
								close.current(true);
						}}
					>
						<div className="tour-backdrop" aria-hidden />
						<div className="top-bubble-reveal bubble-visible panel-open">
							<button
								className="top-bubble"
								type="button"
								data-tour-target="launcher"
								aria-label="Open AniDachi controls"
								aria-expanded={step !== "launcher" && step !== "chat"}
								tabIndex={step === "launcher" ? 0 : -1}
								onClick={() => {
									if (step === "launcher") setStep("create");
								}}
							>
								<AnidachiLogoMark className="top-bubble-logo" size={24} />
								<span className={`sync-dot${created ? " connected" : ""}`} />
								<span className="bubble-count">{created ? 1 : 0}</span>
							</button>
						</div>
						{(step === "create" ||
							step === "invite" ||
							step === "camera" ||
							step === "settings") && (
							<PracticePanel
								created={created}
								settingsActive={step === "settings"}
								cameraActive={step === "camera"}
								cameraEnabled={practiceCameraOn}
								onCameraToggle={() => {
									if (step !== "camera") return;
									setPracticeCameraOn((value) => !value);
									setStep("settings");
								}}
								onMicrophoneToggle={() => {
									if (step === "camera") setStep("settings");
								}}
								copied={false}
								resource={props.resource}
								onCreate={() => {
									if (step === "create") setStep("invite");
								}}
								onCopy={() => {
									if (step === "invite") setStep("chat");
								}}
								onInviteFriends={() => {
									if (step === "invite") setStep("chat");
								}}
							/>
						)}
						{step === "chat" && (
							<PracticeChat
								onPhaseChange={setChatPhase}
								onContinue={() => setStep("camera")}
							/>
						)}
						{masks.map((style, i) => (
							<div key={i} className="tour-mask" style={style} aria-hidden />
						))}
						{h && h.w > 0 && !chatClosed && (
							<div
								className={`tour-ring${step === "settings" ? " tour-settings-ring" : ""}${step === "chat" ? " tour-chat-ring" : ""}${step === "camera" ? " tour-camera-ring" : ""}`}
								style={{ left: h.x, top: h.y, width: h.w, height: h.h }}
							/>
						)}
						{details && layout?.cue && (
							<TourSketchCue
								className={`tour-cue tour-cue-${step}`}
								style={layout.cue}
								direction={
									step === "launcher"
										? "up-right"
										: step === "camera"
											? "down-right"
											: step === "invite"
												? "down"
												: "right"
								}
								label={
									step === "launcher"
										? "Start here!"
										: step === "create"
											? "Click to create"
											: step === "invite"
												? "Try either one"
												: step === "camera"
													? "Click either to continue"
													: "Explore the settings"
								}
							/>
						)}
						<button
							type="button"
							className="tour-close"
							aria-label="Close tour"
							onClick={() => close.current(true)}
						>
							<X size={20} />
						</button>
						<section
							ref={tip}
							className={`tour-tip tour-step-${step}`}
							style={layout?.tip ?? { visibility: "hidden" }}
							role="dialog"
							aria-label="AniDachi guided tour"
							{...overlayHotkeyBoundaryProps}
							{...overlayInteractionBoundaryProps}
						>
							{details && (
								<>
									{step === "settings" && (
										<div className="tour-eyebrow">Explore the tabs</div>
									)}
									<h2>{details.title}</h2>
									{step === "invite" ? (
										<div className="tour-invite-options">
											<div className="tour-invite-option">
												<Copy size={21} aria-hidden />
												<div>
													<h3>Copy invite</h3>
													<p>Share the link anywhere.</p>
												</div>
											</div>
											<div className="tour-invite-option">
												<UserPlus size={21} aria-hidden />
												<div>
													<h3>Invite friends</h3>
													<p>
														Add friends in your account →{" "}
														<strong>Friends &amp; Groups</strong>, then invite
														them here.
													</p>
												</div>
											</div>
										</div>
									) : step === "chat" ? (
										<p id="tour-chat-help">{details.text}</p>
									) : step === "camera" ? (
										<>
											<p>{details.text}</p>
											<ul
												className="tour-media-states"
												aria-label="Camera and microphone states"
											>
												<li>
													<span className="tour-media-state-icon tour-media-state-ptt">
														<SolidMicrophoneIcon />
													</span>
													<span>
														Hold <kbd>V</kbd> to talk
													</span>
												</li>
												<li>
													<span className="tour-media-state-icon tour-media-state-on">
														<SolidMicrophoneIcon />
													</span>
													<span>Microphone always on</span>
												</li>
												<li>
													<span className="tour-media-state-icon tour-media-state-on">
														<SolidCameraIcon enabled />
													</span>
													<span>Camera on</span>
												</li>
												<li>
													<span className="tour-media-state-icon tour-media-state-off">
														<SolidCameraIcon enabled={false} />
													</span>
													<span>Camera off</span>
												</li>
											</ul>
										</>
									) : step === "settings" ? (
										<>
											<p className="tour-settings-subtitle">{details.text}</p>
											<div className="tour-settings-note">
												<svg
													className="tour-settings-outline"
													viewBox="0 0 460 330"
													preserveAspectRatio="none"
													fill="none"
													aria-hidden="true"
													focusable="false"
												>
													<path d="M47 10C129 7 306 12 410 10C439 10 449 22 450 48C453 116 449 218 450 278C451 306 436 317 409 318C302 320 153 317 48 319C20 320 11 308 10 282C7 209 11 111 10 53C10 26 23 12 47 10Z" />
													<path d="M3 51C5 25 20 5 47 3M411 327C437 325 455 313 457 288" />
												</svg>
												<dl className="tour-settings-overview">
													<div>
														<dt>
															<Smile aria-hidden />
															Reactions
														</dt>
														<dd>Pick emojis for quick reactions.</dd>
													</div>
													<div>
														<dt>
															<PanelsTopLeft aria-hidden />
															Layout
														</dt>
														<dd>Arrange chat and cameras.</dd>
													</div>
													<div>
														<dt>
															<Eye aria-hidden />
															Interface
														</dt>
														<dd>Show or auto-hide controls.</dd>
													</div>
													<div>
														<dt>
															<SlidersHorizontal aria-hidden />
															Room
														</dt>
														<dd>Choose your mic &amp; camera defaults.</dd>
													</div>
												</dl>
											</div>
											<button
												type="button"
												className="tour-finish"
												onClick={finish}
											>
												<Play aria-hidden fill="currentColor" />
												Let’s watch
											</button>
										</>
									) : (
										<p>
											{step === "create" && !offer
												? "Your plan includes room creation.\nYour friends join free."
												: step === "create" && offer === "trial"
													? "Try Plus free for 3 days. No card required.\nYour friends join free."
													: details.text}
										</p>
									)}
									{step === "create" && offer === "loading" ? (
										<button
											type="button"
											className="tour-plan-link"
											aria-label="Loading plan options"
											aria-busy="true"
											disabled
										>
											<span className="tour-plan-spinner" aria-hidden="true" />
										</button>
									) : step === "create" && offer === "retry" ? (
										<button
											type="button"
											className="tour-plan-link"
											onClick={props.onRefreshHosting}
										>
											Try again
											<RefreshCw size={17} aria-hidden />
										</button>
									) : step === "create" &&
										offer && offer !== "loading" && offer !== "retry" ? (
										<a
											className="tour-plan-link"
											href={getHostingOfferUrl(
												offer === "sign-in" ? "check" : offer,
											)}
											onClick={(event) => {
												event.preventDefault();
												void openCheckout(offer === "sign-in" ? "check" : offer);
											}}
											target="_blank"
											rel="noopener noreferrer"
										>
											{offer === "trial"
												? "Try 3 days free"
												: offer === "sign-in"
													? "Sign in"
													: "View plans"}
											<ArrowUpRight size={17} aria-hidden />
										</a>
									) : null}
								</>
							)}
						</section>
						{step === "launcher" && (
							<aside
								className="tour-hide-hint"
								style={
									h
										? {
												top: h.y + h.h + 30,
												left: Math.max(20, h.x + h.w - 252),
											}
										: { visibility: "hidden" }
								}
								aria-label="How to hide the AniDachi capsule"
								{...overlayInteractionBoundaryProps}
							>
								<svg
									className="tour-hide-hint-outline"
									viewBox="0 0 252 88"
									preserveAspectRatio="none"
									fill="none"
									aria-hidden="true"
									focusable="false"
								>
									<path
										d="M24 14C70 13 143 15 201 14C215 14 225 10 231 2C232 7 229 13 233 15C245 18 250 24 250 37C251 46 250 57 250 64C249 80 241 85 225 86C167 87 86 85 26 86C10 86 3 79 3 65C2 55 2 43 3 34C4 21 10 15 24 14Z"
										stroke="currentColor"
										strokeWidth="0.95"
										strokeLinecap="round"
										strokeLinejoin="round"
										vectorEffect="non-scaling-stroke"
									/>
									<path
										d="M7 35C7 24 15 19 28 19M220 81C236 81 244 76 246 64"
										stroke="currentColor"
										strokeWidth="0.65"
										strokeLinecap="round"
										opacity="0.8"
										vectorEffect="non-scaling-stroke"
									/>
								</svg>
								<p>
									<EyeOff size={15} aria-hidden />
									<span>You can hide the capsule</span>
								</p>
								<div className="tour-settings-path">
									<span>Settings</span>
									<ChevronRight size={10} aria-hidden />
									<span>Interface</span>
									<ChevronRight size={10} aria-hidden />
									<strong>Auto hide</strong>
								</div>
							</aside>
						)}
						<div
							className={`tour-footer${step === "settings" ? " tour-footer-final" : ""}`}
						>
							{details && (
								<ol
									className="tour-progress"
									aria-label={`Step ${details.number} of ${STEP_COUNT}`}
									data-total={` / ${STEP_COUNT}`}
								>
									{Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map(
										(number) => (
											<li
												key={number}
												aria-current={
													number === details.number ? "step" : undefined
												}
											>
												{number}
											</li>
										),
									)}
								</ol>
							)}
							{step !== "settings" && (
								<button
									type="button"
									className="tour-skip"
									onClick={() => close.current(true)}
								>
									Skip tour
								</button>
							)}
						</div>
					</div>
					{exit && !exit.reduced && (
						<div className="tour-exit-roll" aria-hidden>
							<AnidachiLogoMark size={exit.size} className="tour-exit-logo" />
						</div>
					)}
				</>
			)}
		</div>
	);
}
