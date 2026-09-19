"use client";

import { useState } from "react";
import {
	Copy,
	RefreshCw,
	SendHorizontal,
	SmilePlus,
	UserPlus,
} from "lucide-react";
import type { Participant, RoomMediaV3Snapshot } from "@anidachi/protocol";
import { VoiceSettingsPanel } from "../../extension/src/overlay-voice-controls";
import { RoomDefaultsSettingsPanel } from "../../extension/src/overlay-room-defaults";
import { RoomPeopleSection } from "../../extension/src/overlay-room-media-controls";
import { ReactionShortcutEditor } from "../../extension/src/reaction-shortcut-editor";
import { DEFAULT_REACTION_SHORTCUTS } from "../../extension/src/reaction-shortcuts";
import {
	getDefaultRoomJoinDefaults,
	updateRoomJoinDefaults,
} from "../../extension/src/room-media-defaults";
import type { VoiceMode } from "../../extension/src/media-types";
import {
	ExtensionExampleFrame,
	ExtensionSettingsExample,
} from "./extension-example-frame";
import { OverlayInterfaceShowcase } from "./overlay-interface-preview";
import { OverlayLayoutShowcase } from "./overlay-layout-preview";

const noop = () => {};

// Controls embedded in OverlayApp have no standalone component. These static
// fragments use its markup and the imported production stylesheet, not a redraw.
function RoomActions({ highlight }: { highlight: "copy" | "friends" }) {
	return (
		<div className="panel-actions room-active">
			<button
				type="button"
				className="button primary panel-primary-action room-exit"
			>
				End room
			</button>
			<div className="panel-action-icons">
				<button
					type="button"
					className={`panel-icon-action${highlight === "copy" ? " example-highlight" : ""}`}
					aria-label="Copy invite"
				>
					<Copy size={14} />
				</button>
				<button
					type="button"
					className={`panel-icon-action${highlight === "friends" ? " example-highlight" : ""}`}
					aria-label="Invite friends"
				>
					<UserPlus size={14} />
				</button>
				<button
					type="button"
					className="panel-icon-action"
					aria-label="Sync now"
				>
					<RefreshCw size={14} />
				</button>
			</div>
		</div>
	);
}

export function OverlayBubbleMock() {
	return (
		<ExtensionExampleFrame label="Player bubble example">
			<div className="example-stage example-static" inert aria-hidden="true">
				<div className="top-bubble-reveal bubble-visible">
					<button type="button" className="top-bubble example-highlight">
						<img
							src="/Anidachi_logo.png"
							alt=""
							width={24}
							height={24}
							className="top-bubble-logo"
						/>
						<span className="sync-dot connected" />
						<span className="bubble-count">1</span>
					</button>
				</div>
				<span className="example-player-label">Video player</span>
			</div>
		</ExtensionExampleFrame>
	);
}

export function OverlayCreateRoomMock() {
	return (
		<ExtensionExampleFrame label="Create room and copy invite example">
			<div className="example-stack example-static" inert aria-hidden="true">
				<div className="mini-panel">
					<div className="panel-header">
						<div className="panel-account">
							<span className="mini-avatar panel-account-avatar">JD</span>
							<div className="panel-account-copy">
								<strong className="panel-account-name">John Doe</strong>
							</div>
						</div>
					</div>
					<div className="panel-actions room-empty">
						<button
							type="button"
							className="button primary panel-primary-action"
						>
							Create room
						</button>
					</div>
				</div>
				<div className="mini-panel">
					<RoomActions highlight="copy" />
				</div>
			</div>
		</ExtensionExampleFrame>
	);
}

export function OverlayInviteMock() {
	return (
		<ExtensionExampleFrame label="Friends and groups invitation example">
			<div className="mini-panel example-static" inert aria-hidden="true">
				<RoomActions highlight="friends" />
				<div className="invite-panel">
					<div className="invite-panel-header">
						<div className="invite-panel-heading">
							<strong>Friends & groups</strong>
							<span>2 available</span>
						</div>
						<button
							className="invite-panel-refresh"
							type="button"
							aria-label="Refresh friends and groups"
						>
							<RefreshCw size={14} />
						</button>
					</div>
					{[
						{
							section: "Groups",
							name: "Weekend watch",
							detail: "4 members",
							initials: "WW",
						},
						{
							section: "Friends",
							name: "Alex",
							detail: "Friend",
							initials: "AL",
						},
					].map((item) => (
						<section className="invite-target-section" key={item.section}>
							<div className="invite-target-section-title">
								<span>{item.section}</span>
								<b>1</b>
							</div>
							<div className="invite-target-row">
								<div className="participant-main">
									<span className="mini-avatar">{item.initials}</span>
									<span className="invite-target-copy">
										<strong>{item.name}</strong>
										<small>{item.detail}</small>
									</span>
								</div>
								<button
									type="button"
									className="button compact invite-target-action"
									data-state="idle"
								>
									Invite
								</button>
							</div>
						</section>
					))}
				</div>
			</div>
		</ExtensionExampleFrame>
	);
}

const participants: Participant[] = [
	{
		id: "example-host",
		participantSessionId: "example-host-session",
		displayName: "Heorhi Talochka",
		role: "host",
		cameraEnabled: false,
		mediaSeat: "none",
		syncStatus: "synced",
		lastSeenAt: 1,
	},
	{
		id: "example-guest",
		participantSessionId: "example-guest-session",
		displayName: "Alex",
		role: "viewer",
		cameraEnabled: false,
		mediaSeat: "none",
		syncStatus: "synced",
		lastSeenAt: 1,
	},
];
const initialMedia: RoomMediaV3Snapshot = {
	type: "ROOM_MEDIA_SNAPSHOT",
	roomId: "example-only",
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
	participants: participants.map((person, index) => ({
		participantSessionId: person.participantSessionId!,
		mediaSeatGranted: index === 0,
		seatRevision: 0,
		cameraGranted: false,
		microphoneGranted: false,
		cameraIntentSequence: 0,
		microphoneIntentSequence: 0,
		cameraRevocationEpoch: 0,
		microphoneRevocationEpoch: 0,
	})),
};

export function OverlaySeatsMock() {
	const [snapshot, setSnapshot] = useState(initialMedia);
	return (
		<ExtensionExampleFrame label="Media seats example">
			<div className="mini-panel">
				<RoomPeopleSection
					expanded={false}
					onExpandedChange={noop}
					mediaSnapshot={snapshot}
					mediaProtocolVersion={3}
					onSetMediaSeat={(id, granted) =>
						setSnapshot((current) => ({
							...current,
							participants: current.participants.map((person) => ({
								...person,
								mediaSeatGranted:
									person.participantSessionId ===
									participants.find((item) => item.id === id)
										?.participantSessionId
										? granted
										: person.mediaSeatGranted,
							})),
						}))
					}
					currentParticipantId="example-host"
					liveVoiceActiveSpeakerIds={[]}
					maxMediaSeats={6}
					occupiedMediaSeatCount={
						snapshot.participants.filter((person) => person.mediaSeatGranted)
							.length
					}
					onCancelMediaSeatRequest={noop}
					onGrantMediaSeat={noop}
					onRequestMediaSeat={noop}
					onRevokeMediaSeat={noop}
					participants={participants}
					roomPeopleCountText="2/6 in room"
				/>
			</div>
		</ExtensionExampleFrame>
	);
}

export function OverlayReactionsMock() {
	const [enabled, setEnabled] = useState(true);
	const [assignments, setAssignments] = useState<readonly string[]>(
		DEFAULT_REACTION_SHORTCUTS,
	);
	return (
		<ExtensionSettingsExample active="Reactions">
			<div className="settings-panel-stack reaction-settings-panel">
				<div className="settings-toggle-row">
					<span className="settings-toggle-switch-label">Quick reactions</span>
					<button
						type="button"
						role="switch"
						aria-label="Quick reactions"
						aria-checked={enabled}
						className="settings-toggle-switch"
						data-state={enabled ? "on" : "off"}
						onClick={() => setEnabled(!enabled)}
					>
						<span className="settings-toggle-switch-state">
							<span className="settings-toggle-switch-track" aria-hidden="true">
								<span className="settings-toggle-switch-thumb" />
							</span>
						</span>
					</button>
				</div>
				{enabled && (
					<ReactionShortcutEditor
						assignments={assignments}
						onAssign={(index, emoji) =>
							setAssignments((current) =>
								current.map((item, i) => (i === index ? emoji : item)),
							)
						}
					/>
				)}
			</div>
		</ExtensionSettingsExample>
	);
}

export function OverlayMessageMock() {
	return (
		<ExtensionExampleFrame label="Message field example" width="composer">
			<div className="example-composer example-static" inert aria-hidden="true">
				<div className="message-composer">
					<div className="message-composer-emoji">
						<button
							type="button"
							className="message-composer-emoji-button"
							aria-label="Choose emoji"
						>
							<SmilePlus size={17} strokeWidth={2.2} />
						</button>
					</div>
					<input
						aria-label="Anidachi message"
						type="text"
						value="That scene was amazing!"
						readOnly
						maxLength={140}
					/>
					<button
						type="button"
						className="message-composer-send"
						aria-label="Send message"
					>
						<SendHorizontal size={15} />
					</button>
				</div>
				<p className="example-shortcut">
					<kbd>Enter</kbd> to open · <kbd>Enter</kbd> to send
				</p>
			</div>
		</ExtensionExampleFrame>
	);
}

export function OverlayLayoutMock() {
	return (
		<ExtensionSettingsExample active="Layout">
			<OverlayLayoutShowcase />
		</ExtensionSettingsExample>
	);
}

export function OverlayVoiceMock() {
	const [mode, setMode] = useState<VoiceMode>("push-to-talk");
	return (
		<ExtensionSettingsExample active="Voice">
			<VoiceSettingsPanel mode={mode} onModeChange={setMode} />
		</ExtensionSettingsExample>
	);
}

export function OverlayInterfaceMock() {
	return (
		<ExtensionSettingsExample active="Interface">
			<OverlayInterfaceShowcase />
		</ExtensionSettingsExample>
	);
}

export function OverlayRoomMock() {
	const [preferences, setPreferences] = useState(getDefaultRoomJoinDefaults);
	return (
		<ExtensionSettingsExample active="Room">
			<RoomDefaultsSettingsPanel
				preferences={preferences}
				ready
				saving={false}
				error={null}
				onChange={(patch) =>
					setPreferences((current) => updateRoomJoinDefaults(current, patch))
				}
			/>
		</ExtensionSettingsExample>
	);
}
