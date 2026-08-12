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
	ROOM_RAIL_OPEN_DELAY_MS,
} from "./room-rail-intent";
import type { ParticipantAudioPreference } from "./voice-audio-preferences";

export const ROOM_RAIL_CLOSE_DELAY_MS = 340;

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
	speakingParticipantIds: string[];
	visibilityMode: ParticipantPillVisibility;
}

export function RoomRail({
	activeParticipantId,
	getParticipantAudioPreference,
	onParticipantAudioChange,
	participants,
	speakingParticipantIds,
	visibilityMode,
}: RoomRailProps) {
	const [edgeExpanded, setEdgeExpanded] = useState(false);
	const [interactedParticipantId, setInteractedParticipantId] = useState<
		string | null
	>(null);
	const [adjustingParticipantId, setAdjustingParticipantId] = useState<
		string | null
	>(null);
	const openTimerRef = useRef<number | undefined>(undefined);
	const closeTimerRef = useRef<number | undefined>(undefined);
	const adjustingParticipantIdRef = useRef<string | null>(null);
	const focusedParticipantIdRef = useRef<string | null>(null);
	const pointerParticipantIdRef = useRef<string | null>(null);
	const panelPointerInsideRef = useRef(false);
	const panelFocusInsideRef = useRef(false);
	const visibleParticipants = participants.slice(0, 8);
	const hiddenCount = Math.max(
		0,
		participants.length - visibleParticipants.length,
	);
	const railPresentation = resolveParticipantRailPresentation({
		edgeExpanded,
		mode: visibilityMode,
	});

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
			const edgeRight = event.currentTarget.getBoundingClientRect().right;
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
		clearOpenTimer();
		clearCloseTimer();
		setEdgeExpanded(false);
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
			}`}
			data-visibility-mode={visibilityMode}
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
					panelFocusInsideRef.current = true;
					clearCloseTimer();
					if (railPresentation.edgeIntentEnabled) {
						setEdgeExpanded(true);
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
							railExpanded: railPresentation.fullListExpanded,
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
									focusedParticipantIdRef.current = item.id;
									clearCloseTimer();
									setInteractedParticipantId(item.id);
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
									<span className="room-rail-avatar">
										{participantInitials(item.displayName)}
									</span>
									<span className="room-rail-voice-bars" aria-hidden="true">
										<i />
										<i />
										<i />
									</span>
									<span className="room-rail-copy">
										<span className="room-rail-name">{item.displayName}</span>
										<span className="room-rail-status">{statusLabel}</span>
									</span>
									{participantAudioPreference?.muted ? (
										<VolumeX
											aria-hidden="true"
											className="room-rail-compact-mute"
											size={12}
										/>
									) : null}
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

function participantInitials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}
