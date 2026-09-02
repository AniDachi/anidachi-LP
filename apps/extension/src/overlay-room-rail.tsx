import type { Participant } from "@anidachi/protocol";
import { VolumeX } from "lucide-react";
import {
	type PointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { ParticipantPillVisibility } from "./interface-preferences";
import {
	resolveParticipantPillPresentation,
	resolveParticipantRailPresentation,
} from "./interface-visibility";
import { ParticipantAudioInlineControl } from "./participant-audio-controls";
import {
	isRoomRailEdgeIntent,
	isRoomRailEdgeProximity,
	ROOM_RAIL_OPEN_DELAY_MS,
} from "./room-rail-intent";
import type { ParticipantAudioPreference } from "./voice-audio-preferences";

export const ROOM_RAIL_CLOSE_DELAY_MS = 160;
const EMPTY_REACTION_CUE_PARTICIPANT_IDS: ReadonlySet<string> = new Set();

export interface RoomRailProps {
	activeParticipantId?: string;
	getParticipantAudioPreference(
		participantId: string,
	): ParticipantAudioPreference;
	onParticipantAudioChange(
		participantId: string,
		preference: ParticipantAudioPreference,
	): void;
	participants: Participant[];
	reactionCueParticipantIds?: ReadonlySet<string>;
	speakingParticipantIds: string[];
	visibilityMode: ParticipantPillVisibility;
}

export function RoomRail({
	activeParticipantId,
	getParticipantAudioPreference,
	onParticipantAudioChange,
	participants,
	reactionCueParticipantIds = EMPTY_REACTION_CUE_PARTICIPANT_IDS,
	speakingParticipantIds,
	visibilityMode,
}: RoomRailProps) {
	const [edgeExpanded, setEdgeExpanded] = useState(false);
	const [edgeNear, setEdgeNear] = useState(false);
	const [interactedParticipantId, setInteractedParticipantId] = useState<
		string | null
	>(null);
	const [adjustingParticipantId, setAdjustingParticipantId] = useState<
		string | null
	>(null);
	const openTimerRef = useRef<number | undefined>(undefined);
	const closeTimerRef = useRef<number | undefined>(undefined);
	const railRef = useRef<HTMLElement | null>(null);
	const adjustingParticipantIdRef = useRef<string | null>(null);
	const focusedParticipantIdRef = useRef<string | null>(null);
	const pointerParticipantIdRef = useRef<string | null>(null);
	const panelPointerInsideRef = useRef(false);
	const panelFocusInsideRef = useRef(false);
	const interactionModalityRef = useRef<"keyboard" | "pointer">("keyboard");
	const visibleParticipants = participants.slice(0, 8);
	const hiddenCount = Math.max(
		0,
		participants.length - visibleParticipants.length,
	);
	const railPresentation = resolveParticipantRailPresentation({
		edgeExpanded,
		mode: visibilityMode,
	});
	const railEngaged =
		railPresentation.fullListExpanded ||
		interactedParticipantId !== null ||
		adjustingParticipantId !== null;

	const clearOpenTimer = useCallback(() => {
		if (openTimerRef.current !== undefined) {
			window.clearTimeout(openTimerRef.current);
			openTimerRef.current = undefined;
		}
	}, []);

	const clearCloseTimer = useCallback(() => {
		if (closeTimerRef.current !== undefined) {
			window.clearTimeout(closeTimerRef.current);
			closeTimerRef.current = undefined;
		}
	}, []);

	const scheduleOpen = useCallback(() => {
		clearCloseTimer();
		if (
			!railPresentation.edgeIntentEnabled ||
			edgeExpanded ||
			openTimerRef.current !== undefined
		) {
			return;
		}
		openTimerRef.current = window.setTimeout(() => {
			openTimerRef.current = undefined;
			setEdgeNear(false);
			setEdgeExpanded(true);
		}, ROOM_RAIL_OPEN_DELAY_MS);
	}, [clearCloseTimer, edgeExpanded, railPresentation.edgeIntentEnabled]);

	const scheduleClose = useCallback(() => {
		if (adjustingParticipantIdRef.current !== null) {
			return;
		}
		clearOpenTimer();
		clearCloseTimer();
		closeTimerRef.current = window.setTimeout(() => {
			closeTimerRef.current = undefined;
			const activeElement = document.activeElement;
			if (
				interactionModalityRef.current === "pointer" &&
				activeElement instanceof HTMLElement &&
				railRef.current?.contains(activeElement)
			) {
				activeElement.blur();
			}
			setEdgeExpanded(false);
			setInteractedParticipantId(
				focusedParticipantIdRef.current ?? pointerParticipantIdRef.current,
			);
		}, ROOM_RAIL_CLOSE_DELAY_MS);
	}, [clearCloseTimer, clearOpenTimer]);

	const handleEdgePointerIntent = useCallback(
		(event: PointerEvent<HTMLElement>) => {
			if (!railPresentation.edgeIntentEnabled) {
				return;
			}
			const edgeBounds = event.currentTarget.getBoundingClientRect();
			const edgeRight = edgeBounds.right;
			const nearEdge = isRoomRailEdgeProximity({
				clientX: event.clientX,
				edgeRight,
			});
			setEdgeNear(nearEdge);
			if (!nearEdge) {
				clearOpenTimer();
				return;
			}
			if (!isRoomRailEdgeIntent({ clientX: event.clientX, edgeRight })) {
				clearOpenTimer();
				return;
			}
			scheduleOpen();
		},
		[clearOpenTimer, railPresentation.edgeIntentEnabled, scheduleOpen],
	);

	const handleEdgePointerLeave = useCallback(() => {
		if (!railPresentation.edgeIntentEnabled) {
			return;
		}
		setEdgeNear(false);
		if (adjustingParticipantIdRef.current !== null) {
			return;
		}
		if (edgeExpanded) {
			scheduleClose();
			return;
		}
		clearOpenTimer();
	}, [
		clearOpenTimer,
		edgeExpanded,
		railPresentation.edgeIntentEnabled,
		scheduleClose,
	]);

	const startParticipantAudioAdjustment = useCallback(
		(participantId: string) => {
			clearCloseTimer();
			adjustingParticipantIdRef.current = participantId;
			setAdjustingParticipantId(participantId);
			setInteractedParticipantId(participantId);
			if (visibilityMode === "smart") {
				setEdgeExpanded(true);
			}
		},
		[clearCloseTimer, visibilityMode],
	);

	const finishParticipantAudioAdjustment = useCallback(() => {
		adjustingParticipantIdRef.current = null;
		setAdjustingParticipantId(null);
		const nextInteractedParticipantId =
			focusedParticipantIdRef.current ?? pointerParticipantIdRef.current;
		if (nextInteractedParticipantId !== null) {
			setInteractedParticipantId(nextInteractedParticipantId);
		}
		if (!panelPointerInsideRef.current && !panelFocusInsideRef.current) {
			scheduleClose();
		}
	}, [scheduleClose]);

	useEffect(() => {
		const participantId = adjustingParticipantIdRef.current;
		if (
			participantId !== null &&
			!visibleParticipants.some((item) => item.id === participantId)
		) {
			adjustingParticipantIdRef.current = null;
			setAdjustingParticipantId(null);
		}
	}, [visibleParticipants]);

	useEffect(() => {
		const handleKeyboardIntent = () => {
			interactionModalityRef.current = "keyboard";
		};
		window.addEventListener("keydown", handleKeyboardIntent, true);
		return () => {
			window.removeEventListener("keydown", handleKeyboardIntent, true);
		};
	}, []);

	useEffect(() => {
		clearOpenTimer();
		clearCloseTimer();
		setEdgeExpanded(false);
		setEdgeNear(false);
		if (visibilityMode === "smart") {
			pointerParticipantIdRef.current = null;
			focusedParticipantIdRef.current = null;
			setInteractedParticipantId(null);
		}
	}, [clearCloseTimer, clearOpenTimer, visibilityMode]);

	useEffect(
		() => () => {
			adjustingParticipantIdRef.current = null;
			focusedParticipantIdRef.current = null;
			pointerParticipantIdRef.current = null;
			clearOpenTimer();
			clearCloseTimer();
		},
		[clearCloseTimer, clearOpenTimer],
	);

	return (
		<aside
			aria-label="Room participants"
			className={`room-rail ${railPresentation.fullListExpanded ? "open" : ""} ${
				railPresentation.persistentCompact ? "persistent" : ""
			} ${edgeNear && !railPresentation.fullListExpanded ? "edge-near" : ""}`}
			data-visibility-mode={visibilityMode}
			ref={railRef}
			onKeyDownCapture={() => {
				interactionModalityRef.current = "keyboard";
			}}
			onPointerDownCapture={() => {
				interactionModalityRef.current = "pointer";
				focusedParticipantIdRef.current = null;
				panelFocusInsideRef.current = false;
			}}
		>
			<div
				className="room-rail-edge"
				onPointerEnter={handleEdgePointerIntent}
				onPointerLeave={handleEdgePointerLeave}
				onPointerMove={handleEdgePointerIntent}
			/>
			<div
				className={`room-rail-panel ${adjustingParticipantId ? "adjusting-audio" : ""}`}
				onBlurCapture={(event) => {
					if (
						event.relatedTarget instanceof Node &&
						event.currentTarget.contains(event.relatedTarget)
					) {
						return;
					}
					panelFocusInsideRef.current = false;
					scheduleClose();
				}}
				onFocusCapture={() => {
					if (interactionModalityRef.current === "keyboard") {
						panelFocusInsideRef.current = true;
						clearCloseTimer();
						if (railPresentation.edgeIntentEnabled) {
							setEdgeExpanded(true);
						}
					}
				}}
				onPointerEnter={() => {
					panelPointerInsideRef.current = true;
					if (railPresentation.fullListExpanded) {
						clearCloseTimer();
					}
				}}
				onPointerLeave={() => {
					panelPointerInsideRef.current = false;
					scheduleClose();
				}}
				onPointerMove={() => {
					panelPointerInsideRef.current = true;
					if (railPresentation.fullListExpanded) {
						clearCloseTimer();
					}
				}}
			>
				<div className="room-rail-list">
					{visibleParticipants.map((item) => {
						const speaking = speakingParticipantIds.includes(item.id);
						const reacting = reactionCueParticipantIds.has(item.id);
						const active = item.id === activeParticipantId;
						const hasParticipantAudioControl =
							!active && item.mediaSeat === "joined";
						const participantAudioPreference = hasParticipantAudioControl
							? getParticipantAudioPreference(item.id)
							: null;
						const roleLabel = item.role === "host" ? "host" : "guest";
						const statusLabel = speaking
							? `${roleLabel} · speaking`
							: roleLabel;
						const presentation = resolveParticipantPillPresentation({
							interacted:
								interactedParticipantId === item.id ||
								adjustingParticipantId === item.id,
							mode: visibilityMode,
							reacting,
							railExpanded: railEngaged,
							speaking,
						});
						const localMuteLabel = participantAudioPreference?.muted
							? " · muted locally"
							: "";

						return (
							<div
								className={`room-rail-slot ${speaking ? "speaking" : ""} ${active ? "active" : ""}`}
								data-adjusting={
									adjustingParticipantId === item.id ? "true" : undefined
								}
								data-participant-id={item.id}
								data-presentation={presentation}
								data-reaction-cue={reacting ? "true" : undefined}
								key={item.id}
								onBlurCapture={(event) => {
									if (
										event.relatedTarget instanceof Node &&
										event.currentTarget.contains(event.relatedTarget)
									) {
										return;
									}
									if (focusedParticipantIdRef.current === item.id) {
										focusedParticipantIdRef.current = null;
									}
									if (adjustingParticipantIdRef.current === null) {
										scheduleClose();
									}
								}}
								onFocusCapture={() => {
									if (interactionModalityRef.current === "keyboard") {
										focusedParticipantIdRef.current = item.id;
										clearCloseTimer();
										setInteractedParticipantId(item.id);
									}
								}}
								onPointerEnter={() => {
									pointerParticipantIdRef.current = item.id;
									clearCloseTimer();
									setInteractedParticipantId(item.id);
								}}
								onPointerLeave={() => {
									if (pointerParticipantIdRef.current === item.id) {
										pointerParticipantIdRef.current = null;
									}
									if (adjustingParticipantIdRef.current === null) {
										scheduleClose();
									}
								}}
							>
								<div
									aria-label={`${item.displayName}, ${statusLabel}${localMuteLabel}`}
									className={`room-rail-pill ${speaking ? "speaking" : ""}`}
									role="group"
									tabIndex={presentation === "hidden" ? -1 : 0}
								>
									<RoomRailAvatar
										avatarUrl={item.avatarUrl}
										displayName={item.displayName}
										speaking={speaking}
									/>
									<div className="room-rail-copy room-rail-content">
										<div className="room-rail-identity">
											<span className="room-rail-name" title={item.displayName}>
												{item.displayName}
											</span>
											<span className="room-rail-role">
												{roleLabel.toUpperCase()}
											</span>
										</div>
										{participantAudioPreference ? (
											<ParticipantAudioInlineControl
												displayName={item.displayName}
												onAdjustmentEnd={finishParticipantAudioAdjustment}
												onAdjustmentStart={() =>
													startParticipantAudioAdjustment(item.id)
												}
												onChange={(preference) =>
													onParticipantAudioChange(item.id, preference)
												}
												preference={participantAudioPreference}
											/>
										) : (
											<span className="room-rail-status room-rail-self-status">
												{speaking ? "You · speaking" : `You · ${roleLabel}`}
											</span>
										)}
									</div>
									{participantAudioPreference?.muted ? (
										<VolumeX
											aria-hidden="true"
											className="room-rail-compact-mute"
											size={12}
										/>
									) : null}
								</div>
							</div>
						);
					})}
					{hiddenCount ? (
						<div className="room-rail-more">+{hiddenCount}</div>
					) : null}
				</div>
			</div>
		</aside>
	);
}

function RoomRailAvatar({
	avatarUrl,
	displayName,
	speaking,
}: {
	avatarUrl?: string;
	displayName: string;
	speaking: boolean;
}) {
	const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
	const showProfileImage = Boolean(avatarUrl && failedAvatarUrl !== avatarUrl);

	return (
		<span className="room-rail-avatar" aria-hidden="true">
			{showProfileImage ? (
				<img
					alt=""
					className="room-rail-avatar-image"
					onError={() => setFailedAvatarUrl(avatarUrl ?? null)}
					src={avatarUrl}
				/>
			) : (
				<span className="room-rail-avatar-fallback">
					{participantInitials(displayName)}
				</span>
			)}
			<span
				className="room-rail-voice-bars"
				data-speaking={speaking ? "true" : undefined}
			>
				<i />
				<i />
				<i />
			</span>
		</span>
	);
}

function participantInitials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}
