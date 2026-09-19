"use client";

import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
	Check,
	ChevronRight,
	CircleHelp,
	SendHorizontal,
	SmilePlus,
	Copy,
	LogOut,
	MousePointer2,
	Mic,
	MessageCircle,
	RotateCcw,
	Video,
	Radio,
	RefreshCw,
	Settings2,
	UserPlus,
	UsersRound,
	VideoOff,
} from "lucide-react";
// Presentation only: never import OverlayApp, auth, room clients or device hooks.
// Shadow DOM keeps the extension's resets/tokens out of the website and Async.
import { overlayStyles } from "../../extension/src/styles";
import {
	getRoomDemoScene,
	useDemoTyping,
	DEMO_MESSAGE,
	useRoomDemo,
	type RoomDemoPhase,
} from "../lib/use-room-demo";
import styles from "./chrome-extension-room-demo.module.css";

// One caption per scene keeps the story readable while the controls animate.
const SCENES = {
	1: {
		heading: "Create a room",
		text: "Open AniDachi right on your player.",
	},
	2: {
		heading: "Invite friends",
		text: "Share a link or invite a friend directly.",
	},
	3: {
		heading: "Watch together",
		text: "Cameras, voice and messages, right on your video.",
	},
	4: {
		heading: "Your layout",
		text: "Resize your cameras. Put cameras and chat where you like.",
	},
} as const;
const SCENE_NUMBERS = [1, 2, 3, 4] as const;
const EMOJIS = ["😂", "😱", "❤️", "🔥", "😭", "👀", "👏", "🤯", "😮‍💨", "💯"];

// Only framing and the guided reveal differ from the installed extension.
const SCENE_STYLES = `
  :host { display: block; position: absolute; inset: 0; }
  .anidachi-overlay { --demo-move-time:900ms; --demo-move-ease:cubic-bezier(.45,0,.2,1); z-index: 2; width: calc(100% / var(--demo-scale, 1)); height: calc(100% / var(--demo-scale, 1));
    transform: scale(var(--demo-scale, 1)); transform-origin: top left; }
  .demo-layout-panel { --mini-panel-top: 48px; }
  .demo-layout-panel[data-applying="true"] { animation:demo-layout-out 200ms 500ms ease both; }
  @keyframes demo-layout-out { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(-5px); } }
  .demo-layout-panel .demo-settings-preview { margin-top: 0; }
  .demo-layout-panel .settings-section-title { margin: 0 0 4px; padding-top: 0; border-top: 0; }
  .demo-layout-panel .settings-category-tab { height: 32px; }
  .demo-layout-panel .settings-category-scroll::before { display: none; }
  .demo-layout-panel .settings-category-tab.active::after { content: ""; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: #ff8a3d; border-radius: 2px; }
  .demo-layout-panel .layout-object-selector-v2 button { height: 32px; padding-bottom: 6px; }
  .demo-layout-panel .layout-preview-v2 { position: relative; height: 144px; overflow: hidden; }
  .demo-layout-panel .layout-grid-preview-v2 { position: absolute; inset: 8px; }
  .demo-layout-panel .layout-video-slot-v2 { position: absolute; transition: left var(--demo-move-time) var(--demo-move-ease), top var(--demo-move-time) var(--demo-move-ease), width 650ms var(--demo-move-ease), height 650ms var(--demo-move-ease); }
  .demo-layout-panel .layout-chat-preview-v2 { position: absolute; width: 100px; height: 46px; padding: 6px; gap: 3px;
    transition: left var(--demo-move-time) var(--demo-move-ease), top var(--demo-move-time) var(--demo-move-ease); }
  .demo-layout-panel .layout-chat-preview-v2 span { height: 3px; width: 78%; border-radius: 2px; background: #aecbed70; }
  .demo-layout-panel .layout-chat-preview-v2 span:first-child { width: 38%; background: #ffad7280; }
  .demo-layout-panel .layout-controls-v2 { min-height: 86px; }
  .demo-layout-panel .demo-slider { position: relative; height: 18px; display: flex; align-items: center; }
  .demo-slider-track { height: 3px; width: 100%; background: #ffffff24; border-radius: 8px; }
  .demo-slider-fill { position: absolute; height: 3px; background: #ff9b52; transition: width 650ms var(--demo-move-ease); }
  .demo-slider-thumb { position: absolute; top: 2px; width: 14px; height: 14px; margin-left: -7px;
    border: 2px solid white; border-radius: 50%; background: #ff8a3d; transition: left 650ms var(--demo-move-ease); }
  .demo-layout-panel .demo-chat-controls { gap: 6px; }
  .demo-layout-panel .demo-chat-controls .stepped-setting-slider-v2 { min-height: 36px; padding-block: 2px; gap: 2px; }
  .demo-layout-panel .demo-chat-controls .stepped-setting-slider-endpoints-v2 { display: none; }
  .demo-layout-target { position: absolute; width: 1px; height: 1px; }

  .mini-panel { animation: demo-panel-in 240ms cubic-bezier(.22,1,.36,1) both; }
  .demo-room-reveal { animation: demo-panel-in 240ms ease both; }
  .demo-preview-only { pointer-events: none; }
  .demo-cursor { position: absolute; z-index: 60; color: white; filter: drop-shadow(0 2px 3px #0009);
    pointer-events: none; transition: top 350ms ease, left 350ms ease, opacity 250ms ease; }
  .demo-cursor[data-visible="false"] { opacity: 0; }
  .demo-click { position: absolute; width: 28px; height: 28px; border: 2px solid #ffad72; border-radius: 50%; left: -12px; top: -12px;
    opacity: 0; }
  .demo-cursor:is([data-phase="pill"],[data-phase="open"],[data-phase="copy-link"],[data-phase="open-invites"],[data-phase="friends"],[data-phase="camera"],[data-phase="camera-on"],[data-phase="send"]) .demo-click { animation: demo-click 250ms ease-out both; }
  .demo-cursor[data-phase="pill"] .demo-click { animation-delay: 750ms; }
  .demo-cursor[data-phase="open"] .demo-click { animation-delay: 1200ms; }
  .demo-cursor:is([data-phase="copy-link"],[data-phase="open-invites"]) .demo-click { animation-delay: 300ms; }
  .demo-cursor[data-phase="friends"] .demo-click { animation-delay: 600ms; }
  .demo-cursor[data-phase="camera"] .demo-click { animation-delay: 250ms; }
  .demo-cursor[data-phase="camera-on"] .demo-click { animation-delay: 150ms; }
  .demo-cursor[data-phase="send"] .demo-click { animation-delay: 350ms; }
  .demo-cursor:is([data-phase="layout-open"],[data-phase="layout-tab"],[data-phase="layout-preview"],[data-phase="layout-select-chat"],[data-phase="layout-apply"]) .demo-click { animation: demo-click 250ms 350ms ease-out both; }
  .demo-cursor:is([data-phase="layout-move-camera"],[data-phase="layout-move-chat"]) { transition: top var(--demo-move-time) var(--demo-move-ease), left var(--demo-move-time) var(--demo-move-ease); }

  .demo-social-preview { position: absolute; inset: 0; pointer-events: none;
    --cam-bubble-size: 104px; --cam-stack-direction: row; --cam-bubble-gap: 12px;
    --live-chat-top: 70px; --live-chat-left: 28px; --live-chat-width: 285px; --live-chat-height: 160px;
    --reaction-origin-x: calc(100% - 76px); --reaction-origin-y: calc(100% - 100px);
    --reaction-rise-y: -138px; --reaction-lift-x: -8px; --reaction-curve-x: -22px; --reaction-end-x: -35px;
    --reaction-duration: 1850ms; }
  .demo-social-preview .cam-stack { top: auto; left: auto; right: 24px; bottom: 28px; width: auto;
    animation: demo-panel-in 300ms ease both; }
  .demo-social-preview .cam-stack { left: calc(100% - 2 * var(--cam-bubble-size) - var(--cam-bubble-gap) - 24px); top: calc(100% - var(--cam-bubble-size) - 28px); right: auto; bottom: auto;
    transition: left var(--demo-move-time) var(--demo-move-ease), top var(--demo-move-time) var(--demo-move-ease); }
  .demo-social-preview[data-camera-large="true"] { --cam-bubble-size: 124px; }
  .demo-social-preview[data-camera-moved="true"] .cam-stack { left: 24px; top: 64px; }
  .demo-social-preview[data-camera-moved="false"] .cam-stack { transition-duration:650ms; }
  .demo-social-preview .cam-bubble { transition: width 650ms var(--demo-move-ease), height 650ms var(--demo-move-ease); }
  /* Anchor the visible messages to the corner, not an oversized empty column. */
  .demo-social-preview .live-chat-column.live { width:max-content; max-width:var(--live-chat-width); height:auto; max-height:var(--live-chat-height); padding:0; mask-image:none; overflow:hidden;
    top:calc(var(--live-chat-top) + var(--live-chat-height) - 10px); transform:translate(0,-100%);
    transition:left var(--demo-move-time) var(--demo-move-ease),top var(--demo-move-time) var(--demo-move-ease),transform var(--demo-move-time) var(--demo-move-ease); }
  .demo-social-preview .live-chat-column.live::before { display:none; }
  .demo-social-preview[data-chat-moved="true"] .live-chat-column.live { left:calc(100% - 24px); top:calc(100% - 24px); transform:translate(-100%,-100%); }
  .demo-social-preview .cam-media video { transform: none; object-fit: cover; }
  .demo-social-preview .live-chat-column { pointer-events: none; }
  .demo-social-preview .live-chat-message { --live-chat-font-size: 14px; --live-chat-line-height: 20px; }
  .demo-social-preview .live-chat-name { font-size: 11px; }
  .demo-social-preview .demo-reply { animation-delay: 350ms; }
  .demo-social-preview .message-composer { bottom: 230px; pointer-events: none; }
  .demo-social-preview .message-composer input { caret-color: #ffae74; }
  .demo-shortcut { position: absolute; left: 50%; bottom: 292px; transform: translateX(-50%);
    display: flex; align-items: center; gap: 8px; color: #eee5d9; font-size: 12px;
    animation: demo-shortcut-in 180ms ease both; }
  .demo-shortcut kbd { padding: 4px 8px; border: 1px solid #ffffff38; border-radius: 6px; background: #161419; }
  .demo-social-preview .reaction-pop { font-size: 30px; }
  .demo-social-preview .demo-reaction-john { --reaction-origin-x: calc(100% - 192px); --reaction-end-x: -15px; }
  .demo-social-preview .demo-reaction-laugh { --reaction-delay: 450ms; --reaction-end-x: -58px; }
  .anidachi-overlay[data-playing="false"] *, .anidachi-overlay[data-playing="false"] *::before { animation-play-state: paused !important; }
  @media (max-width: 767px) {
    .demo-social-preview { --cam-bubble-size: 82px; --live-chat-left: 22px; --live-chat-width: calc(100% - 44px);
      --reaction-origin-x: calc(100% - 59px); --reaction-origin-y: calc(100% - 80px); }
    .demo-social-preview { --live-chat-width: min(250px, calc(100% - 44px)); }
    .demo-social-preview .cam-stack { right: auto; bottom: auto; }
    .demo-social-preview[data-camera-large="true"] { --cam-bubble-size: 104px; }
    .demo-social-preview .demo-reaction-john { --reaction-origin-x: calc(100% - 153px); }
    .demo-social-preview .message-composer { bottom: 178px; }
    .demo-shortcut { bottom: 240px; }
  }
  .demo-invite-reveal { animation: demo-panel-in 220ms ease both; }
  .demo-invite-reveal[data-accepted="true"] { overflow:hidden; animation:demo-invite-dismiss 280ms 920ms ease-in-out forwards; }
  @keyframes demo-invite-dismiss { from { max-height:220px; opacity:1; } to { max-height:0; opacity:0; padding-block:0; margin-top:0; border-width:0; } }
  @keyframes demo-click { from { opacity: .8; transform: scale(.25); } to { opacity: 0; transform: scale(1.5); } }
  .demo-settings-preview { margin-top: 16px; }
  @keyframes demo-panel-in { from { opacity: 0; transform: translateY(-7px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes demo-shortcut-in { from { opacity: 0; transform: translate(-50%, -7px); } to { opacity: 1; transform: translate(-50%, 0); } }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
    .reaction-pop[data-ready="true"] { opacity: 1; transform: translate3d(-50%, -62px, 0); }
  }
`;

/** The surrounding controls are a non-interactive view of the current extension.
 * The first scenes use Reactions as context; the final scene demonstrates Layout. */
function SettingsPreview({
	layoutTabTarget = false,
}: {
	layoutTabTarget?: boolean;
}) {
	return (
		<div
			className="demo-preview-only demo-settings-preview"
			inert
			aria-hidden="true"
		>
			<div className="section-title settings-section-title">
				<Settings2 className="section-title-icon" size={15} />
				<span>Settings</span>
			</div>
			<div className="settings-shell">
				<div className="settings-category-rail">
					<div
						className="settings-category-scroll"
						data-active-category="reactions"
					>
						{["Reactions", "Layout", "Interface", "Voice", "Room"].map(
							(label, i) => (
								<button
									type="button"
									className={`settings-category-tab${i === 0 ? " active" : ""}`}
									data-demo-target={
										layoutTabTarget && label === "Layout"
											? "layout-tab"
											: undefined
									}
									key={label}
									tabIndex={-1}
								>
									{label}
								</button>
							),
						)}
					</div>
				</div>
				<div className="settings-panel">
					<div className="settings-panel-stack reaction-settings-panel">
						<div className="settings-toggle-row">
							<div className="settings-toggle-heading">
								<span className="settings-toggle-switch-label">
									Quick reactions
								</span>
								<CircleHelp size={14} />
							</div>
							<button
								type="button"
								className="settings-toggle-switch"
								data-state="on"
								tabIndex={-1}
							>
								<span className="settings-toggle-switch-state">
									<span className="settings-toggle-switch-track">
										<span className="settings-toggle-switch-thumb" />
									</span>
								</span>
							</button>
						</div>
						<div className="reaction-shortcut-editor">
							<div className="reaction-shortcut-grid">
								{EMOJIS.map((emoji, i) => (
									<button
										type="button"
										className="reaction-shortcut"
										key={emoji}
										tabIndex={-1}
									>
										<span className="reaction-shortcut-key">
											{(i + 1) % 10}
										</span>
										<span className="reaction-shortcut-emoji">{emoji}</span>
									</button>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className="account-footer">
				<button type="button" className="account-footer-action" tabIndex={-1}>
					<LogOut className="account-footer-action-icon" size={14} />
					<span>Sign out</span>
				</button>
			</div>
		</div>
	);
}

const CURSOR_TARGET: Partial<Record<RoomDemoPhase, string>> = {
	pill: "pill",
	open: "create",
	creating: "create",
	"copy-link": "copy",
	"link-copied": "copy",
	"open-invites": "invite-menu",
	friends: "invite-friend",
	inviting: "invite-friend",
	camera: "camera",
	"camera-on": "pill",
	compose: "message-input",
	send: "send-message",
	"layout-open": "pill",
	"layout-tab": "layout-tab",
	"layout-preview": "layout-size",
	"layout-size": "layout-camera",
	"layout-move-camera": "layout-camera-end",
	"layout-select-chat": "layout-chat",
	"layout-move-chat": "layout-chat-end",
	"layout-apply": "layout-apply",
};

function useDemoCursor(shadowRoot: ShadowRoot | null, phase: RoomDemoPhase) {
	const targetName = CURSOR_TARGET[phase];
	const [position, setPosition] = useState<{
		left: number;
		top: number;
	} | null>(null);
	useLayoutEffect(() => {
		if (!shadowRoot || !targetName) return;
		const canvas = shadowRoot.querySelector<HTMLElement>(".anidachi-overlay");
		const target = shadowRoot.querySelector<HTMLElement>(
			`[data-demo-target="${targetName}"]`,
		);
		if (!canvas || !target) return;
		const measure = () => {
			const canvasRect = canvas.getBoundingClientRect();
			const targetRect = target.getBoundingClientRect();
			const scale = canvasRect.width / canvas.offsetWidth;
			if (!Number.isFinite(scale) || scale <= 0) return;
			setPosition({
				left:
					(targetRect.left + targetRect.width / 2 - canvasRect.left) / scale,
				top: (targetRect.top + targetRect.height / 2 - canvasRect.top) / scale,
			});
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(canvas);
		observer.observe(target);
		canvas.addEventListener("scroll", measure, true);
		return () => {
			observer.disconnect();
			canvas.removeEventListener("scroll", measure, true);
		};
	}, [shadowRoot, targetName]);
	return { position, visible: Boolean(targetName) };
}

function InvitationPreview({ phase }: { phase: RoomDemoPhase }) {
	const sending = phase === "inviting";
	const sent = phase === "invited";
	const accepted = phase === "accepted";
	return (
		<div className="invite-panel demo-invite-reveal" data-accepted={accepted}>
			<div className="invite-panel-header">
				<div className="invite-panel-heading">
					<strong>Friends & groups</strong>
					<span>{accepted ? "1 friend joined" : "1 available"}</span>
				</div>
				<button type="button" className="invite-panel-refresh" tabIndex={-1}>
					<RefreshCw size={14} />
				</button>
			</div>
			{accepted && (
				<div className="invite-status-message" data-tone="success">
					<span className="invite-status-mark">✓</span>
					<span>Emma accepted your invitation.</span>
				</div>
			)}
			<section className="invite-target-section">
				<div className="invite-target-section-title">
					<span>Friends</span>
					<b>1</b>
				</div>
				<div className="invite-target-row">
					<div className="participant-main">
						<span className="mini-avatar">E</span>
						<span className="invite-target-copy">
							<strong>Emma</strong>
							<small>@emma</small>
						</span>
					</div>
					<button
						type="button"
						className="button compact invite-target-action"
						data-demo-target="invite-friend"
						data-state={accepted ? "accepted" : sent ? "pending" : "idle"}
						disabled={sending || sent || accepted}
						tabIndex={-1}
					>
						{accepted ? <><Check size={12} />Joined</> : sending ? "Sending…" : sent ? "Pending" : "Invite"}
					</button>
				</div>
			</section>
		</div>
	);
}

function PeoplePreview({
	together,
	camerasOn,
}: {
	together: boolean;
	camerasOn: boolean;
}) {
	const names = together ? ["Alex", "Emma"] : ["Alex"];
	return (
		<section
			className="room-people-section demo-room-reveal"
			aria-label="Room participants preview"
		>
			<div className="section-title room-people-heading">
				<span className="room-people-heading-label">
					<UsersRound className="section-title-icon" size={15} />
					<span>People</span>
				</span>
				<span className="room-people-count">{names.length}/6 in room</span>
			</div>
			<div className="room-media-grants">
				<p className="room-people-count">
					{names.length}/6 media seats · {camerasOn ? 2 : 0}/4 cameras
				</p>
			</div>
			<div className="room-people-list">
				{names.map((name, index) => (
					<div
						className={`room-people-entry${index ? " demo-room-reveal" : ""}`}
						key={name}
					>
						<div
							className={`room-people-row${index === 0 ? " host self" : ""}`}
						>
							<div className="room-people-main">
								<span className="mini-avatar room-people-avatar">{name[0]}</span>
								<span className="room-people-copy">
									<span className="room-people-name-row">
										<span className="room-people-name">{name}</span>
										{index === 0 && (
											<span className="room-people-role">Host</span>
										)}
									</span>
									<span className="room-people-status">Media seat</span>
								</span>
							</div>
							<div className="room-people-side action">
								<span className="room-media-seat-control active">
									<Radio size={15} />
								</span>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

/** Small silent local clips illustrate cameras without accessing any device. */
function DemoCamera({
	person,
	playing,
}: {
	person: "john" | "jane";
	playing: boolean;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (playing) void video.play().catch(() => undefined);
		else video.pause();
		return () => video.pause();
	}, [playing]);
	return (
		<video
			ref={videoRef}
			src={`/demo/cameras/${person}.mp4`}
			poster={`/demo/cameras/${person}.jpg`}
			muted
			playsInline
			loop
			preload="none"
			tabIndex={-1}
		/>
	);
}

function getDemoLayout(phase: RoomDemoPhase) {
	const layout = getRoomDemoScene(phase) === 4;
	return {
		layout,
		large:
			layout &&
			!["layout-open", "layout-tab", "layout-preview"].includes(phase),
		cameraMoved: [
			"layout-move-camera",
			"layout-select-chat",
			"layout-move-chat",
			"layout-apply",
			"layout-done",
		].includes(phase),
		chatSelected: [
			"layout-select-chat",
			"layout-move-chat",
			"layout-apply",
		].includes(phase),
		chatMoved: ["layout-move-chat", "layout-apply", "layout-done"].includes(
			phase,
		),
	};
}

function DemoSlider({
	label,
	value,
	progress,
	start = "Small",
	end = "XL",
	target,
}: {
	label: string;
	value: string;
	progress: number;
	start?: string;
	end?: string;
	target?: string;
}) {
	return (
		<div className="stepped-setting-slider-v2">
			<div className="stepped-setting-slider-header-v2">
				<span>{label}</span>
				<strong>{value}</strong>
			</div>
			<div className="demo-slider">
				<span className="demo-slider-track" />
				<span className="demo-slider-fill" style={{ width: `${progress}%` }} />
				<span className="demo-slider-thumb" style={{ left: `${progress}%` }} />
				<span
					className="demo-layout-target"
					data-demo-target={target}
					style={{ left: "65%", top: "50%" }}
				/>
			</div>
			<div className="stepped-setting-slider-endpoints-v2">
				<span>{start}</span>
				<span>{end}</span>
			</div>
		</div>
	);
}

/** Presentational copy of Layout settings; the timeline never saves preferences. */
function LayoutPreview({ phase }: { phase: RoomDemoPhase }) {
	const { large, cameraMoved, chatSelected, chatMoved } = getDemoLayout(phase);
	return (
		<section
			className="mini-panel demo-layout-panel"
			data-applying={phase === "layout-apply"}
			aria-label="Layout settings preview"
		>
			<div className="section-title settings-section-title">
				<Settings2 size={15} />
				<span>Settings</span>
			</div>
			<div className="settings-shell">
				<div className="settings-category-rail">
					<div
						className="settings-category-scroll"
						data-active-category="layout"
					>
						{["Reactions", "Layout", "Interface", "Voice", "Room"].map(
							(label) => (
								<button
									type="button"
									tabIndex={-1}
									key={label}
									className={`settings-category-tab${label === "Layout" ? " active" : ""}`}
								>
									{label}
								</button>
							),
						)}
					</div>
				</div>
				<div className="settings-panel">
					<div className="layout-editor-v2">
						<div className="layout-preview-v2">
							<div className="layout-grid-preview-v2" />
							{[0, 1].map((index) => (
								<span
									key={index}
									className={`layout-video-slot-v2 ${index ? "is-ghost" : "is-leader"}`}
									data-selected={!chatSelected}
									data-demo-target={index === 0 ? "layout-camera" : undefined}
									style={{
										left: cameraMoved
											? 12 + index * (large ? 32 : 26)
											: `calc(100% - ${12 + (2 - index) * (large ? 27 : 21) + (1 - index) * 5}px)`,
										top: cameraMoved ? 12 : `calc(100% - ${12 + (large ? 27 : 21)}px)`,
										width: large ? 27 : 21,
										height: large ? 27 : 21,
									}}
								/>
							))}
							<div
								className="layout-chat-preview-v2"
								data-selected={chatSelected}
								data-demo-target="layout-chat"
								style={{ left: chatMoved ? "calc(100% - 112px)" : 12, top: chatMoved ? "calc(100% - 58px)" : 16 }}
							>
								<span />
								<span />
								<span />
							</div>
							<span
								className="demo-layout-target"
								data-demo-target="layout-camera-end"
								style={{ left: 25, top: 25 }}
							/>
							<span
								className="demo-layout-target"
								data-demo-target="layout-chat-end"
								style={{ left: "calc(100% - 62px)", top: "calc(100% - 35px)" }}
							/>
						</div>
						<div className="layout-object-selector-v2">
							<button type="button" tabIndex={-1} aria-pressed={!chatSelected}>
								<Video size={15} />
								Video
							</button>
							<button type="button" tabIndex={-1} aria-pressed={chatSelected}>
								<MessageCircle size={15} />
								Chat
							</button>
						</div>
						{chatSelected ? (
							<div className="layout-controls-v2 demo-chat-controls">
								<div
									className="layout-chat-mode-segmented-v2"
									data-state="live"
								>
									<button type="button" tabIndex={-1} aria-pressed>
										Live
									</button>
									<button type="button" tabIndex={-1} aria-pressed={false}>
										History
									</button>
								</div>
								<DemoSlider
									label="Chat width"
									value="5 columns"
									progress={42}
									start="Narrow"
									end="Wide"
								/>
								<DemoSlider label="Text scale" value="Medium" progress={33} />
								<DemoSlider
									label="Visible messages"
									value="3"
									progress={33}
									start="1"
									end="Fill"
								/>
								<DemoSlider
									label="Text opacity"
									value="100%"
									progress={100}
									start="5%"
									end="100%"
								/>
							</div>
						) : (
							<div className="layout-controls-v2">
								<DemoSlider
									label="Camera size"
									value={large ? "Large" : "Medium"}
									progress={large ? 65 : 33}
									target="layout-size"
								/>
							</div>
						)}
						<div className="layout-editor-actions-v2">
							<button type="button" tabIndex={-1}>
								<RotateCcw size={15} />
								Revert
							</button>
							<button
								type="button"
								tabIndex={-1}
								data-demo-target="layout-apply"
							>
								<Check size={16} />
								Apply
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function WatchingPreview({
	phase,
	playing,
}: {
	phase: RoomDemoPhase;
	playing: boolean;
}) {
	const composing = ["compose", "typing", "send"].includes(phase);
	const layout = getDemoLayout(phase);
	const sent = phase === "chat" || phase === "reaction" || layout.layout;
	const typedText = useDemoTyping(phase, playing);
	const speakingIndex =
		phase === "speaking" ? 0 : phase === "reaction" ? 1 : -1;
	return (
		<div
			className="demo-social-preview"
			data-camera-large={layout.large}
			data-camera-moved={layout.cameraMoved}
			data-chat-moved={layout.chatMoved}
		>
			<div className="cam-stack">
				{(["john", "jane"] as const).map((person, index) => (
					<div
						key={person}
						className={`cam-bubble${speakingIndex === index ? " speaking" : ""}`}
						title={person === "john" ? "Alex" : "Emma"}
					>
						<div className="cam-media">
							<DemoCamera person={person} playing={playing} />
						</div>
						{speakingIndex === index && (
							<span className="mic-dot">
								<Mic size={15} strokeWidth={2.5} />
							</span>
						)}
					</div>
				))}
			</div>
			{phase !== "watching" && (
				<div className="live-chat-column live">
					<div className="live-chat-message">
						<span className="live-chat-name">Emma</span>
						<span className="live-chat-text">Here we go!</span>
					</div>
					{sent && (
						<div className="live-chat-message">
							<span className="live-chat-name">Alex</span>
							<span className="live-chat-text">{DEMO_MESSAGE}</span>
						</div>
					)}
					{(phase === "reaction" || layout.layout) && (
						<div className="live-chat-message demo-reply">
							<span className="live-chat-name">Emma</span>
							<span className="live-chat-text">I know, right? 😂</span>
						</div>
					)}
				</div>
			)}
			{composing && (
				<>
					<div className="demo-shortcut">
						<kbd>Enter</kbd>
						<span>Open chat</span>
					</div>
					<div className="message-composer">
						<div className="message-composer-emoji">
							<button
								type="button"
								className="message-composer-emoji-button"
								tabIndex={-1}
							>
								<SmilePlus size={17} />
							</button>
						</div>
						<input
							aria-label="Demo message"
							data-demo-target="message-input"
							value={typedText}
							readOnly
							placeholder="Type a quick reaction"
							tabIndex={-1}
						/>
						<button
							type="button"
							className="message-composer-send"
							data-demo-target="send-message"
							disabled={!typedText}
							tabIndex={-1}
						>
							<SendHorizontal size={15} />
						</button>
					</div>
				</>
			)}
			{sent && !layout.layout && (
				<div className="reaction-pop" data-ready="true">
					🔥
				</div>
			)}
			{phase === "reaction" && (
				<>
					<div className="reaction-pop demo-reaction-john" data-ready="true">
						❤️
					</div>
					<div className="reaction-pop demo-reaction-laugh" data-ready="true">
						😂
					</div>
				</>
			)}
		</div>
	);
}

function RoomScene({
	phase,
	playing,
}: {
	phase: RoomDemoPhase;
	playing: boolean;
}) {
	const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
	const attach = useCallback((element: HTMLDivElement | null) => {
		if (element)
			setShadowRoot(
				element.shadowRoot ?? element.attachShadow({ mode: "open" }),
			);
	}, []);
	const panelId = useId();
	const cursor = useDemoCursor(shadowRoot, phase);
	const roomActive = !["pill", "open", "creating"].includes(phase);
	const creating = phase === "creating";
	const layout = getRoomDemoScene(phase) === 4;
	const together = phase === "accepted" || phase === "together" || getRoomDemoScene(phase) >= 3;
	const watching = [
		"watching",
		"speaking",
		"compose",
		"typing",
		"send",
		"chat",
		"reaction",
	].includes(phase);
	const camerasOn = phase === "camera-on" || watching || layout;
	const copied = phase === "link-copied";
	const invitePanelOpen = [
		"friends",
		"inviting",
		"invited",
		"accepted",
	].includes(phase);
	const layoutSettingsOpen =
		layout && !["layout-open", "layout-tab", "layout-done"].includes(phase);
	const panelOpen =
		phase !== "pill" &&
		!watching &&
		!["layout-open", "layout-done"].includes(phase);
	// Scale only the illustration, keeping the surrounding copy at readable size.
	useLayoutEffect(() => {
		if (!shadowRoot) return;
		const host = shadowRoot.host as HTMLElement;
		const resize = () => {
			const scale = Math.min(
				1,
				host.clientHeight / 620,
				host.clientWidth / 360,
			);
			host.style.setProperty("--demo-scale", `${Math.max(0.1, scale)}`);
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		return () => observer.disconnect();
	}, [shadowRoot]);
	useLayoutEffect(() => {
		if (phase !== "layout-tab") return;
		const panel = shadowRoot?.querySelector<HTMLElement>(".mini-panel");
		const settings = panel?.querySelector<HTMLElement>(
			".demo-settings-preview",
		);
		if (panel && settings) panel.scrollTo({ top: settings.offsetTop - 16, behavior: "smooth" });
	}, [shadowRoot, phase]);
	return (
		<div
			className={styles.overlay}
			ref={attach}
			data-room-demo-host
			inert
			aria-hidden="true"
		>
			{shadowRoot &&
				createPortal(
					<>
						<style>
							{overlayStyles}
							{SCENE_STYLES}
						</style>
						<div className="anidachi-overlay" data-playing={playing}>
							<div
								className={`top-bubble-reveal bubble-visible${panelOpen ? " panel-open" : ""}`}
							>
								<button
									type="button"
									className="top-bubble"
									data-demo-target="pill"
									aria-controls={panelOpen ? panelId : undefined}
									aria-expanded={panelOpen}
									tabIndex={-1}
								>
									<img
										src="/Anidachi_logo.png"
										alt=""
										className="top-bubble-logo"
										width={24}
										height={24}
										draggable={false}
									/>
									<span
										className={`sync-dot${roomActive ? " connected" : ""}`}
									/>
									<span className="bubble-count">
										{together ? 2 : roomActive ? 1 : 0}
									</span>
								</button>
							</div>
							{cursor.position && (
								<span
									className="demo-cursor"
									data-phase={phase}
									data-visible={cursor.visible}
									style={cursor.position}
									aria-hidden="true"
								>
									<span className="demo-click" key={phase} />
									<MousePointer2
										size={24}
										fill="currentColor"
										stroke="#161318"
										strokeWidth={1.4}
									/>
								</span>
							)}
							{(watching || layout) && (
								<WatchingPreview phase={phase} playing={playing} />
							)}
							{layoutSettingsOpen && <LayoutPreview phase={phase} />}
							{panelOpen && !layoutSettingsOpen && (
								<section
									className="mini-panel"
									id={panelId}
									aria-label="AniDachi controls preview"
								>
									<div className="panel-header">
										<div className="panel-account">
											<span className="mini-avatar panel-account-avatar">
												A
											</span>
											<div className="panel-account-copy">
												<div className="panel-account-title-row">
													<strong className="panel-account-name">
														Alex
													</strong>
													<span className="plan-badge plus">Plus</span>
												</div>
											</div>
										</div>
										{roomActive && (
											<div className="panel-header-actions">
												<button
													type="button"
													className={`icon-button panel-camera-control ${camerasOn ? "active" : "inactive"}`}
													data-demo-target="camera"
													tabIndex={-1}
												>
													<span className="panel-camera-control-thumb">
														{camerasOn ? (
															<Video
																className="panel-camera-control-icon"
																size={12}
															/>
														) : (
															<VideoOff
																className="panel-camera-control-icon"
																size={12}
															/>
														)}
													</span>
												</button>
											</div>
										)}
									</div>
									<div
										className={`panel-actions ${roomActive ? "room-active" : "room-empty"}${creating ? " creating" : ""}`}
									>
										<button
											type="button"
											className={`button primary panel-primary-action${roomActive ? " room-exit" : ""}${creating ? " loading" : ""}`}
											data-demo-target="create"
											tabIndex={-1}
											disabled={creating}
										>
											<span>
												{roomActive
													? "End room"
													: creating
														? "Creating…"
														: "Create room"}
											</span>
										</button>
										{roomActive && (
											<div className="panel-action-icons">
												<button
													type="button"
													className={`panel-icon-action reveal-action${copied ? " success" : ""}`}
													data-demo-target="copy"
													tabIndex={-1}
												>
													{copied ? <Check size={14} /> : <Copy size={14} />}
												</button>
												<button
													type="button"
													className="panel-icon-action reveal-action"
													data-demo-target="invite-menu"
													tabIndex={-1}
												>
													<UserPlus size={14} />
												</button>
												<button
													type="button"
													className="panel-icon-action reveal-action"
													tabIndex={-1}
												>
													<RefreshCw size={14} />
												</button>
											</div>
										)}
									</div>
									{invitePanelOpen && <InvitationPreview phase={phase} />}
									<div className="panel-sync-card">
										<div className="section-title">Current resource</div>
										<div className="current-resource-card">
											<div className="current-resource-topline">
												<span className="resource-provider-dot crunchyroll" />
												<span>Crunchyroll</span>
												<ChevronRight size={12} />
												<span className="current-resource-time">
													4:01 / 24:30
												</span>
											</div>
											<div className="current-resource-title">
												E4 · Start Line
											</div>
											<span className="resource-progress">
												<span style={{ width: "16.4%" }} />
											</span>
										</div>
									</div>
									{roomActive && (
										<PeoplePreview together={together} camerasOn={camerasOn} />
									)}
									<SettingsPreview layoutTabTarget={phase === "layout-tab"} />
								</section>
							)}
						</div>
					</>,
					shadowRoot,
				)}
		</div>
	);
}

function SceneNarrative({
	scene,
	className,
}: {
	scene: keyof typeof SCENES;
	className: string;
}) {
	return (
		<div className={`${styles.copyStack} ${className}`}>
			{SCENE_NUMBERS.map((number) => (
				<div
					key={number}
					className={styles.sceneCopy}
					data-active={number === scene}
					aria-hidden={number !== scene}
				>
					<h3 className={styles.chapterHeading}>
						<span className={styles.chapterCount}>
							<span className="sr-only">Step </span>
							{number}
							<span className="sr-only"> of {SCENE_NUMBERS.length}</span>
						</span>
						<span>{SCENES[number].heading}</span>
					</h3>
					<p>{SCENES[number].text}</p>
				</div>
			))}
		</div>
	);
}

export function ChromeExtensionRoomDemo({
	title,
	controls,
}: {
	title: string;
	controls: ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const [visible, setVisible] = useState(false);
	useLayoutEffect(() => {
		const demo = ref.current;
		const section = demo?.closest("section");
		if (!demo || !section) return;
		const nav = document.querySelector<HTMLElement>(
			'nav[aria-label="Main navigation"]',
		);
		const resize = () => {
			const intro =
				demo.getBoundingClientRect().top - section.getBoundingClientRect().top;
			const chrome = intro + (nav?.getBoundingClientRect().height ?? 72) + 24;
			demo.style.setProperty("--demo-chrome", `${Math.ceil(chrome)}px`);
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(section);
		if (nav) observer.observe(nav);
		window.addEventListener("resize", resize);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", resize);
		};
	}, []);
	const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReducedMotion(media.matches);
		update();
		media.addEventListener("change", update);
		const observer = new IntersectionObserver(
			([entry]) => setVisible(entry.isIntersecting),
			{ threshold: 0.35 },
		);
		if (ref.current) observer.observe(ref.current);
		return () => {
			observer.disconnect();
			media.removeEventListener("change", update);
		};
	}, []);
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (visible && reducedMotion === false)
			void video.play().catch(() => undefined);
		else video.pause();
		return () => video.pause();
	}, [visible, reducedMotion]);
	const phase = useRoomDemo(visible, reducedMotion);
	const scene = getRoomDemoScene(phase);

	return (
		<div
			className={styles.demo}
			ref={ref}
			aria-label="Watch together walkthrough"
		>
			<div className={styles.presentationHeader}>
				<h2 className={styles.presentationTitle}>{title}</h2>
				{controls}
			</div>
			<div className={styles.stage} data-scene={scene}>
				<div className={styles.backdrop} aria-hidden="true">
					<video
						ref={videoRef}
						src={
							visible && reducedMotion === false
								? "/demo/anidachi-demo-background.mp4"
								: undefined
						}
						poster="/demo/anidachi-demo-background-poster.jpg"
						muted
						playsInline
						loop
						preload="none"
						tabIndex={-1}
					/>
				</div>
				<div className={styles.shade} aria-hidden="true" />
				<SceneNarrative scene={scene} className={styles.narrative} />
				<RoomScene phase={phase} playing={visible && reducedMotion === false} />
			</div>
			<span className={styles.comingSoon} aria-hidden="true">Coming soon</span>
			<SceneNarrative scene={scene} className={styles.mobileCaption} />
		</div>
	);
}
