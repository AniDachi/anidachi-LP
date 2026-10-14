import type { Participant, RoomMediaV3Snapshot } from "@anidachi/protocol";
import {
	Check,
	CircleHelp,
	Copy,
	RefreshCw,
	Settings2,
	UserPlus,
} from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { CurrentResourceDisplay } from "./current-resource-display";
import { CurrentResourcePanel } from "./current-resource-panel";
import {
	getDefaultInterfacePreferences,
	updateInterfacePreferences,
} from "./interface-preferences";
import type { VoiceMode } from "./media-types";
import { overlayInteractionBoundaryProps } from "./overlay-interaction-boundary";
import { InterfaceSettingsPanel } from "./overlay-interface-settings";
import {
	type OverlayLayoutChatDisplayMode,
	OverlayLayoutEditor,
} from "./overlay-layout-editor";
import { getDefaultOverlayLayoutDefinition } from "./overlay-layout-model";
import { RoomDefaultsSettingsPanel } from "./overlay-room-defaults";
import { RoomPeopleSection } from "./overlay-room-media-controls";
import { PanelAccountTitle } from "./panel-account-title";
import { PanelMediaControls } from "./panel-media-controls";
import { ReactionShortcutEditor } from "./reaction-shortcut-editor";
import {
	assignReactionShortcut,
	getDefaultReactionShortcutPreferences,
} from "./reaction-shortcuts";
import {
	getDefaultRoomJoinDefaults,
	updateRoomJoinDefaults,
} from "./room-media-defaults";
import {
	DEFAULT_SETTINGS_PANEL_CATEGORY,
	SETTINGS_PANEL_CATEGORIES,
	type SettingsPanelCategory,
} from "./settings-panel-navigation";

const noop = () => {};
const practiceHost: Participant = {
	id: "practice-you",
	participantSessionId: "practice-session",
	displayName: "You",
	role: "host",
	mediaSeat: "none",
	cameraEnabled: false,
	lastSeenAt: 0,
	syncStatus: "synced",
};
// Presentation fixture only. Never passed to a room client or entitlement check.
const practiceMedia: RoomMediaV3Snapshot = {
	type: "ROOM_MEDIA_SNAPSHOT",
	roomId: "practice-room",
	roomGeneration: 1,
	snapshotSequence: 1,
	closingAt: null,
	capabilities: {
		mediaProtocolVersion: 3,
		hostPlanCode: "plus",
		maxParticipants: 6,
		maxMediaSeats: 6,
		maxCameras: 4,
		capabilityRevision: 1,
		capabilitiesValidUntil: "2099-01-01T00:00:00Z",
	},
	participants: [
		{
			participantSessionId: "practice-session",
			mediaSeatGranted: true,
			seatRevision: 0,
			cameraGranted: false,
			microphoneGranted: false,
			cameraIntentSequence: 0,
			microphoneIntentSequence: 0,
			cameraRevocationEpoch: 0,
			microphoneRevocationEpoch: 0,
		},
	],
};

/** A rehearsal of the existing mini-panel. Its only actions change tour state;
 * it has no room, auth, clipboard, media or checkout callbacks. */
export function PracticePanel({
	created,
	settingsActive,
	cameraActive,
	cameraEnabled,
	copied,
	resource,
	onCreate,
	onCopy,
	onInviteFriends,
	onCameraToggle,
	onMicrophoneToggle,
}: {
	created: boolean;
	settingsActive: boolean;
	cameraActive: boolean;
	cameraEnabled: boolean;
	copied: boolean;
	resource: CurrentResourceDisplay | null;
	onCreate: () => void;
	onCopy: () => void;
	onInviteFriends: () => void;
	onCameraToggle: () => void;
	onMicrophoneToggle: () => void;
}) {
	const panel = useRef<HTMLElement>(null);
	const [peopleExpanded, setPeopleExpanded] = useState(false);
	const [voiceMode, setVoiceMode] = useState<VoiceMode>("push-to-talk");
	const mediaSnapshot = cameraEnabled
		? {
				...practiceMedia,
				participants: practiceMedia.participants.map((participant) => ({
					...participant,
					cameraGranted: true,
				})),
			}
		: practiceMedia;
	useLayoutEffect(() => {
		const container = panel.current;
		if (!container) return;
		if (!settingsActive) {
			container.scrollTop = 0;
			return;
		}
		const revealSettings = () => {
			const settings = container.querySelector(".settings-section-title");
			if (settings)
				container.scrollTop +=
					settings.getBoundingClientRect().top -
					container.getBoundingClientRect().top -
					16;
		};
		revealSettings();
		// Keep the final target in view when the player changes size, without
		// constraining the user's scrolling while they explore a settings tab.
		const resize = new ResizeObserver(() => {
			const tabs = container.querySelector('[data-tour-target="settings"]');
			if (!tabs) return;
			const target = tabs.getBoundingClientRect();
			const viewport = container.getBoundingClientRect();
			if (target.top < viewport.top + 5 || target.bottom > viewport.bottom - 5)
				revealSettings();
		});
		resize.observe(container);
		return () => resize.disconnect();
	}, [created, settingsActive, cameraActive]);
	return (
		<section
			ref={panel}
			className="mini-panel tour-practice-panel"
			aria-label="AniDachi practice controls"
			{...overlayInteractionBoundaryProps}
		>
			<div className="panel-header">
				<div className="panel-account">
					<span className="mini-avatar panel-account-avatar">Y</span>
					<div className="panel-account-copy">
						<PanelAccountTitle displayName="You" plan={null} />
						<div className="panel-account-helper">Practice mode</div>
					</div>
				</div>
				{created && (
					<div
						className="panel-header-actions panel-media-actions"
						data-tour-target="camera"
						inert={!cameraActive}
					>
						<PanelMediaControls
							cameraEnabled={cameraEnabled}
							voiceMode={voiceMode}
							onCameraToggle={onCameraToggle}
							onVoiceModeChange={(mode) => {
								if (!cameraActive) return;
								setVoiceMode(mode);
								onMicrophoneToggle();
							}}
						/>
					</div>
				)}
			</div>
			<div
				className={`panel-actions ${created ? "room-active" : "room-empty"}`}
			>
				<button
					className={`button primary panel-primary-action${created ? " room-exit" : ""}`}
					type="button"
					data-tour-target={created ? undefined : "create"}
					tabIndex={created ? -1 : undefined}
					onClick={created ? undefined : onCreate}
					aria-disabled={created || undefined}
				>
					<span>{created ? "End room" : "Create room"}</span>
				</button>
				{created && (
					<div
						className="panel-action-icons"
						role="group"
						aria-label="Room actions"
					>
						<div
							className="tour-invite-actions"
							data-tour-target="invite"
							role="group"
							aria-label="Invite your friends"
						>
							<button
								aria-label={copied ? "Invite copied" : "Copy invite"}
								title="Copy invite"
								className={`panel-icon-action${copied ? " success" : ""}`}
								type="button"
								aria-disabled={settingsActive || cameraActive || undefined}
								tabIndex={settingsActive || cameraActive ? -1 : undefined}
								onClick={onCopy}
							>
								{copied ? <Check size={14} /> : <Copy size={14} />}
							</button>
							<button
								className="panel-icon-action"
								type="button"
								aria-disabled={settingsActive || cameraActive || undefined}
								tabIndex={settingsActive || cameraActive ? -1 : undefined}
								aria-label="Invite friends and groups"
								title="Invite friends and groups"
								onClick={onInviteFriends}
							>
								<UserPlus size={14} />
							</button>
						</div>
						<button
							className="panel-icon-action"
							type="button"
							tabIndex={-1}
							aria-label="Sync now"
							aria-disabled
						>
							<RefreshCw size={14} />
						</button>
					</div>
				)}
			</div>
			{resource && (
				<div className="panel-sync-card">
					<CurrentResourcePanel entry={resource} />
				</div>
			)}
			{created && (
				<div inert>
					<RoomPeopleSection
						expanded={peopleExpanded}
						onExpandedChange={setPeopleExpanded}
						mediaSnapshot={mediaSnapshot}
						currentParticipantId={practiceHost.id}
						liveVoiceActiveSpeakerIds={[]}
						maxMediaSeats={6}
						occupiedMediaSeatCount={1}
						participants={[{ ...practiceHost, cameraEnabled }]}
						roomPeopleCountText="1 / 6"
						onCancelMediaSeatRequest={noop}
						onGrantMediaSeat={noop}
						onRequestMediaSeat={noop}
						onRevokeMediaSeat={noop}
					/>
				</div>
			)}
			<PracticeSettings />
		</section>
	);
}

/** The same settings views with disposable local state, never storage hooks. */
function PracticeSettings() {
	const [category, setCategory] = useState<SettingsPanelCategory>(
		DEFAULT_SETTINGS_PANEL_CATEGORY,
	);
	const [reactionsEnabled, setReactionsEnabled] = useState(true);
	const [reactions, setReactions] = useState(
		getDefaultReactionShortcutPreferences,
	);
	const [interfacePreferences, setInterfacePreferences] = useState(
		getDefaultInterfacePreferences,
	);
	const [roomDefaults, setRoomDefaults] = useState(getDefaultRoomJoinDefaults);
	const [layout, setLayout] = useState(getDefaultOverlayLayoutDefinition);
	const [chatMode, setChatMode] =
		useState<OverlayLayoutChatDisplayMode>("live");
	const [viewport, setViewport] = useState({ width: 1280, height: 720 });
	const shell = useRef<HTMLDivElement>(null);
	const helpId = useId();
	useLayoutEffect(() => {
		const player = shell.current?.closest(".player-introduction");
		if (!player) return;
		const update = () => {
			const { width, height } = player.getBoundingClientRect();
			setViewport({ width, height });
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(player);
		return () => observer.disconnect();
	}, []);
	return (
		<div className="settings-surface">
			<div className="section-title settings-section-title">
				<Settings2
					aria-hidden
					className="section-title-icon settings-section-title-icon"
					size={15}
					strokeWidth={1.8}
				/>
				<span className="settings-section-title-label">Settings</span>
			</div>
			<div className="settings-shell" ref={shell}>
				<div className="settings-category-rail">
					<div
						aria-label="Settings sections"
						data-tour-target="settings"
						className="settings-category-scroll settings-category-scroll-static"
						role="tablist"
						data-active-category={category}
					>
						{SETTINGS_PANEL_CATEGORIES.map((item) => (
							<button
								key={item.id}
								type="button"
								role="tab"
								aria-selected={category === item.id}
								className={`settings-category-tab${category === item.id ? " active" : ""}`}
								onClick={() => setCategory(item.id)}
							>
								{item.label}
							</button>
						))}
					</div>
				</div>
				<div
					className="settings-panel"
					role="tabpanel"
					aria-label={
						SETTINGS_PANEL_CATEGORIES.find((item) => item.id === category)
							?.label
					}
				>
					{category === "reactions" && (
						<div className="settings-panel-stack reaction-settings-panel">
							<div className="settings-toggle-row">
								<div className="settings-toggle-heading">
									<span className="settings-toggle-switch-label">
										Quick reactions
									</span>
									<span className="settings-help">
										<button
											aria-describedby={helpId}
											aria-label="About quick reactions"
											className="settings-help-trigger"
											type="button"
										>
											<CircleHelp aria-hidden size={14} strokeWidth={1.8} />
										</button>
										<span
											className="settings-help-tooltip"
											id={helpId}
											role="tooltip"
										>
											Assign emojis to keys 1–0. Press a number during a room to
											send a quick reaction.
										</span>
									</span>
								</div>
								<button
									aria-checked={reactionsEnabled}
									aria-label="Quick reactions"
									className="settings-toggle-switch"
									data-state={reactionsEnabled ? "on" : "off"}
									role="switch"
									type="button"
									onClick={() => setReactionsEnabled((value) => !value)}
								>
									<span className="settings-toggle-switch-state">
										<span aria-hidden className="settings-toggle-switch-track">
											<span className="settings-toggle-switch-thumb" />
										</span>
									</span>
								</button>
							</div>
							{reactionsEnabled && (
								<ReactionShortcutEditor
									assignments={reactions.emojis}
									onAssign={(index, emoji) =>
										setReactions((value) =>
											assignReactionShortcut(value, index, emoji),
										)
									}
								/>
							)}
						</div>
					)}
					{category === "layout" && (
						<OverlayLayoutEditor
							appliedLayout={layout}
							chatDisplayMode={chatMode}
							layoutContext={{
								viewport: {
									...viewport,
									safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
								},
								reservedRects: [],
								cameraCount: 0,
							}}
							onApply={async (value) => setLayout(value)}
							onPreviewChange={noop}
							onChatDisplayModeChange={setChatMode}
						/>
					)}
					{category === "interface" && (
						<InterfaceSettingsPanel
							preferences={interfacePreferences}
							ready
							saving={false}
							error={null}
							onChange={(patch) =>
								setInterfacePreferences((value) =>
									updateInterfacePreferences(value, patch),
								)
							}
						/>
					)}
					{category === "room" && (
						<RoomDefaultsSettingsPanel
							preferences={roomDefaults}
							ready
							saving={false}
							error={null}
							onChange={(patch) =>
								setRoomDefaults((value) => updateRoomJoinDefaults(value, patch))
							}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
