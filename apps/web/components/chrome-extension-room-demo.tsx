"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	ChevronRight,
	CircleHelp,
	Copy,
	LogOut,
	MousePointer2,
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
import { useRoomDemo, type RoomDemoPhase } from "../lib/use-room-demo";
import styles from "./chrome-extension-room-demo.module.css";

const COPY: Record<RoomDemoPhase, { title: string; text: string }> = {
	pill: {
		title: "Your room starts here",
		text: "Open the AniDachi pill on your player.",
	},
	open: {
		title: "One click. Your room.",
		text: "Choose Create room to start watching together.",
	},
	creating: {
		title: "Getting your room ready",
		text: "Your controls stay right on the player.",
	},
	ready: {
		title: "Ready for company",
		text: "The room is ready. Next, invite your friends.",
	},
};
const EMOJIS = ["😂", "😱", "❤️", "🔥", "😭", "👀", "👏", "🤯", "😮‍💨", "💯"];

// Only framing and the guided reveal differ from the installed extension.
const SCENE_STYLES = `
  :host { display: block; position: absolute; inset: 0; }
  .anidachi-overlay { z-index: 2; }
  .mini-panel { animation: demo-panel-in 240ms cubic-bezier(.22,1,.36,1) both; }
  .demo-room-reveal { animation: demo-panel-in 240ms ease both; }
  .demo-preview-only { pointer-events: none; }
  .demo-cursor { position: absolute; z-index: 40; color: white; filter: drop-shadow(0 2px 3px #0009);
    top: 28px; right: 38px; pointer-events: none; transition: top 700ms ease, right 700ms ease, opacity 250ms ease; }
  .demo-cursor[data-phase="open"], .demo-cursor[data-phase="creating"] { top: 132px; right: 190px; }
  .demo-cursor[data-phase="ready"] { opacity: 0; }
  .demo-click { position: absolute; width: 28px; height: 28px; border: 2px solid #ffad72; border-radius: 50%; left: -12px; top: -12px;
    opacity: 0; animation: demo-click 650ms ease-out both; }
  .demo-cursor[data-phase="pill"] .demo-click { animation-delay: 1700ms; }
  .demo-cursor[data-phase="open"] .demo-click { animation-delay: 2300ms; }
  .demo-cursor[data-phase="creating"] .demo-click, .demo-cursor[data-phase="ready"] .demo-click { display: none; }
  @keyframes demo-click { from { opacity: .8; transform: scale(.25); } to { opacity: 0; transform: scale(1.5); } }
  .demo-settings-preview { margin-top: 16px; }
  @keyframes demo-panel-in { from { opacity: 0; transform: translateY(-7px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 374px) {
    .anidachi-overlay { inset: 0 0 auto auto; width: 117.6471%; height: 117.6471%; transform: scale(.85); transform-origin: top right; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`;

/** The surrounding controls are a non-interactive view of the current extension.
 * This scene shows only opening/creating; later scenes will demonstrate invites/settings. */
function SettingsPreview() {
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

function RoomScene({ phase }: { phase: RoomDemoPhase }) {
	const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
	const attach = useCallback((element: HTMLDivElement | null) => {
		if (element)
			setShadowRoot(
				element.shadowRoot ?? element.attachShadow({ mode: "open" }),
			);
	}, []);
	const panelId = useId();
	const ready = phase === "ready";
	const creating = phase === "creating";
	const panelOpen = phase !== "pill";
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
						<div className="anidachi-overlay">
							<div
								className={`top-bubble-reveal bubble-visible${panelOpen ? " panel-open" : ""}`}
							>
								<button
									type="button"
									className="top-bubble"
									aria-controls={panelOpen ? panelId : undefined}
									aria-expanded={panelOpen}
									aria-label={`${panelOpen ? "Close" : "Open"} AniDachi controls`}
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
									<span className={`sync-dot${ready ? " connected" : ""}`} />
									<span className="bubble-count">{ready ? 1 : 0}</span>
								</button>
							</div>
							<span
								className="demo-cursor"
								data-phase={phase}
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
							{panelOpen && (
								<section
									className="mini-panel"
									id={panelId}
									aria-label="AniDachi controls preview"
								>
									<div className="panel-header">
										<div className="panel-account">
											<span className="mini-avatar panel-account-avatar">
												Y
											</span>
											<div className="panel-account-copy">
												<div className="panel-account-title-row">
													<strong className="panel-account-name">You</strong>
													<span className="plan-badge plus">Plus</span>
												</div>
											</div>
										</div>
										{ready && (
											<div
												className="panel-header-actions demo-preview-only"
												inert
												aria-hidden="true"
											>
												<button
													type="button"
													className="icon-button panel-camera-control inactive"
													tabIndex={-1}
												>
													<span className="panel-camera-control-thumb">
														<VideoOff
															className="panel-camera-control-icon"
															size={12}
														/>
													</span>
												</button>
											</div>
										)}
									</div>
									<div
										className={`panel-actions ${ready ? "room-active" : "room-empty"}${creating ? " creating" : ""}`}
									>
										<button
											type="button"
											className={`button primary panel-primary-action${ready ? " room-exit" : ""}${creating ? " loading" : ""}`}
											tabIndex={-1}
											disabled={creating}
										>
											<span>
												{ready
													? "End room"
													: creating
														? "Creating…"
														: "Create room"}
											</span>
										</button>
										{ready && (
											<div
												className="panel-action-icons demo-preview-only"
												inert
												aria-hidden="true"
											>
												{[Copy, UserPlus, RefreshCw].map((Icon, i) => (
													<button
														type="button"
														className="panel-icon-action reveal-action"
														key={i}
														tabIndex={-1}
													>
														<Icon size={14} />
													</button>
												))}
											</div>
										)}
									</div>
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
									{ready && (
										<section
											className="room-people-section demo-room-reveal"
											aria-label="Room participants preview"
										>
											<div className="section-title room-people-heading">
												<span className="room-people-heading-label">
													<UsersRound
														className="section-title-icon"
														size={15}
													/>
													<span>People</span>
												</span>
												<span className="room-people-count">1/6 in room</span>
											</div>
											<div className="room-media-grants">
												<p className="room-people-count">
													1/6 media seats · 0/4 cameras
												</p>
											</div>
											<div className="room-people-list">
												<div className="room-people-entry">
													<div className="room-people-row host self">
														<div className="room-people-main">
															<span className="mini-avatar room-people-avatar">
																Y
															</span>
															<span className="room-people-copy">
																<span className="room-people-name-row">
																	<span className="room-people-name">You</span>
																	<span className="room-people-role">Host</span>
																</span>
																<span className="room-people-status">
																	Media seat
																</span>
															</span>
														</div>
														<div className="room-people-side action">
															<span
																className="room-media-seat-control active"
																role="img"
																aria-label="Media seat assigned"
															>
																<Radio size={15} />
															</span>
														</div>
													</div>
												</div>
											</div>
										</section>
									)}
									<SettingsPreview />
								</section>
							)}
						</div>
					</>,
					shadowRoot,
				)}
		</div>
	);
}

export function ChromeExtensionRoomDemo() {
	const ref = useRef<HTMLDivElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const [visible, setVisible] = useState(false);
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
	const copy = COPY[phase];

	return (
		<div
			className={styles.demo}
			ref={ref}
			aria-label="Create a room walkthrough"
		>
			<div className={styles.sceneHeading}>
				<span className={styles.sceneNumber}>01</span>
				<span>Open controls & create a room</span>
				<span className={styles.previewLabel}>Live demo</span>
			</div>
			<div className={styles.stage}>
				<div className={styles.backdrop} aria-hidden="true">
					<video
						ref={videoRef}
						src={
							visible && reducedMotion === false
								? "/demo/anidachi-demo-mobile.mp4"
								: undefined
						}
						poster="/demo/anidachi-demo-mobile-poster.jpg"
						muted
						playsInline
						loop
						preload="none"
						tabIndex={-1}
					/>
				</div>
				<div className={styles.shade} aria-hidden="true" />
				<div className={styles.narrative}>
					<span className={styles.eyebrow}>WATCH TOGETHER</span>
					<h3>{copy.title}</h3>
					<p>{copy.text}</p>
				</div>
				<RoomScene phase={phase} />
			</div>
			<div className={styles.mobileCaption}>
				<strong>{copy.title}</strong>
				<p>{copy.text}</p>
			</div>
			<div className={styles.footer}>
				<span
					className={styles.progress}
					data-phase={phase}
					aria-hidden="true"
				/>
				<span>Open controls</span>
				<ChevronRight size={12} aria-hidden="true" />
				<span>Create room</span>
			</div>
		</div>
	);
}
