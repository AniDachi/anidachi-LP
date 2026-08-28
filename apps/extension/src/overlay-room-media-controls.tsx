import type { Participant } from "@anidachi/protocol";
import {
	CircleCheck,
	CircleMinus,
	CirclePlus,
	Radio,
	UsersRound,
	Video,
	VideoOff,
	X,
} from "lucide-react";
import type { ReactNode } from "react";

export interface PanelCameraControlProps {
	cameraEnabled: boolean;
	disabled: boolean;
	disabledReason: string;
	onToggle: () => void;
}

export function PanelCameraControl({
	cameraEnabled,
	disabled,
	disabledReason,
	onToggle,
}: PanelCameraControlProps) {
	const label = disabled
		? "Camera unavailable"
		: cameraEnabled
			? "Turn camera off"
			: "Turn camera on";
	const CameraIcon = cameraEnabled && !disabled ? Video : VideoOff;
	const stateClassName = disabled
		? "unavailable"
		: cameraEnabled
			? "active"
			: "inactive";

	return (
		<button
			aria-checked={cameraEnabled && !disabled}
			aria-label={label}
			className={`icon-button panel-camera-control ${stateClassName}`}
			disabled={disabled}
			onClick={onToggle}
			role="switch"
			title={disabled ? disabledReason : label}
			type="button"
		>
			<span aria-hidden="true" className="panel-camera-control-thumb">
				<CameraIcon className="panel-camera-control-icon" size={12} />
			</span>
		</button>
	);
}

export interface RoomPeopleSectionProps {
	currentParticipantId: string | null;
	liveVoiceActiveSpeakerIds: string[];
	maxMediaSeats: number;
	occupiedMediaSeatCount: number;
	onCancelMediaSeatRequest: (participantId: string) => void;
	onGrantMediaSeat: (participantId: string) => void;
	onRequestMediaSeat: (participantId: string) => void;
	onRevokeMediaSeat: (participantId: string) => void;
	participants: Participant[];
	roomPeopleCountText: string;
}

export function RoomPeopleSection({
	currentParticipantId,
	liveVoiceActiveSpeakerIds,
	maxMediaSeats,
	occupiedMediaSeatCount,
	onCancelMediaSeatRequest,
	onGrantMediaSeat,
	onRequestMediaSeat,
	onRevokeMediaSeat,
	participants,
	roomPeopleCountText,
}: RoomPeopleSectionProps) {
	const orderedParticipants = orderRoomParticipants(
		participants,
		currentParticipantId,
	);
	const currentParticipant = participants.find(
		(item) => item.id === currentParticipantId,
	);
	const currentUserIsHost = currentParticipant?.role === "host";
	const mediaSeatsFull = occupiedMediaSeatCount >= maxMediaSeats;

	return (
		<section className="room-people-section" aria-label="Room participants">
			<div className="section-title room-people-heading">
				<span className="room-people-heading-label">
					<UsersRound
						aria-hidden="true"
						className="section-title-icon room-people-heading-icon"
						size={15}
						strokeWidth={1.8}
					/>
					<span>People</span>
				</span>
				<span className="room-people-count">{roomPeopleCountText}</span>
			</div>
			<div className="room-people-list">
				{orderedParticipants.map((item) => {
					const isSpeaking = liveVoiceActiveSpeakerIds.includes(item.id);
					const isSelf = item.id === currentParticipantId;
					const isHost = item.role === "host";
					const identityLabel = isHost ? (
						<span className="room-people-role">Host</span>
					) : isSelf ? (
						<span className="room-people-you">You</span>
					) : null;
					const mediaAction = getMediaAction({
						currentUserIsHost,
						isSelf,
						item,
						maxMediaSeats,
						mediaSeatsFull,
						onCancelMediaSeatRequest,
						onGrantMediaSeat,
						onRequestMediaSeat,
						onRevokeMediaSeat,
					});

					return (
						<div className="room-people-entry" key={item.id}>
							<div
								className={[
									"room-people-row",
									isHost ? "host" : "",
									isSelf ? "self" : "",
									isSpeaking ? "speaking" : "",
								]
									.filter(Boolean)
									.join(" ")}
							>
								<div className="room-people-main">
									<span className="mini-avatar room-people-avatar">
										{participantInitials(item.displayName)}
									</span>
									<span className="room-people-copy">
										<span className="room-people-name-row">
											<span className="room-people-name">
												{item.displayName}
											</span>
										</span>
										<span className="room-people-status">
											{participantMediaStatus(item)}
										</span>
									</span>
								</div>
								{identityLabel || mediaAction ? (
									<div
										className={`room-people-side ${identityLabel ? "identity" : "action"}`}
									>
										{identityLabel}
										{mediaAction}
									</div>
								) : null}
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}

export function orderRoomParticipants(
	participants: Participant[],
	currentParticipantId: string | null,
): Participant[] {
	return participants
		.map((participant, index) => ({ index, participant }))
		.sort((left, right) => {
			const rankDifference =
				participantOrderRank(left.participant, currentParticipantId) -
				participantOrderRank(right.participant, currentParticipantId);
			return rankDifference || left.index - right.index;
		})
		.map(({ participant }) => participant);
}

function participantOrderRank(
	participant: Participant,
	currentParticipantId: string | null,
) {
	if (participant.role === "host") return 0;
	if (participant.id === currentParticipantId) return 1;
	return 2;
}

function participantInitials(displayName: string): string {
	const parts = displayName.trim().split(/\s+/).filter(Boolean);
	return (
		parts
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "A"
	);
}

function participantMediaStatus(
	participant: Participant,
): ReactNode {
	if (participant.mediaSeat === "requested") return "Requested media";
	if (participant.mediaSeat !== "joined") return "Chat only";
	const CameraIcon = participant.cameraEnabled ? Video : VideoOff;
	const cameraLabel = participant.cameraEnabled ? "Camera on" : "Camera off";

	return (
		<span className="room-people-media-status">
			<span className="room-people-seat-status">
				<Radio aria-hidden="true" size={10} />
				Media seat
			</span>
			<span
				aria-label={cameraLabel}
				className={`room-people-camera-status ${participant.cameraEnabled ? "active" : "inactive"}`}
				role="img"
				title={cameraLabel}
			>
				<CameraIcon aria-hidden="true" size={10} />
			</span>
		</span>
	);
}

interface MediaActionInput {
	currentUserIsHost: boolean;
	isSelf: boolean;
	item: Participant;
	maxMediaSeats: number;
	mediaSeatsFull: boolean;
	onCancelMediaSeatRequest: (participantId: string) => void;
	onGrantMediaSeat: (participantId: string) => void;
	onRequestMediaSeat: (participantId: string) => void;
	onRevokeMediaSeat: (participantId: string) => void;
}

function getMediaAction({
	currentUserIsHost,
	isSelf,
	item,
	maxMediaSeats,
	mediaSeatsFull,
	onCancelMediaSeatRequest,
	onGrantMediaSeat,
	onRequestMediaSeat,
	onRevokeMediaSeat,
}: MediaActionInput): ReactNode {
	if (isSelf) {
		if (item.mediaSeat === "requested") {
			return (
				<button
					className="room-people-action"
					onClick={() => onCancelMediaSeatRequest(item.id)}
					type="button"
				>
					<X aria-hidden="true" size={11} />
					Cancel
				</button>
			);
		}
		if (item.mediaSeat === "none") {
			return (
				<button
					className="room-people-action"
					disabled={maxMediaSeats <= 0}
					onClick={() => onRequestMediaSeat(item.id)}
					type="button"
				>
					<CirclePlus aria-hidden="true" size={11} />
					Request
				</button>
			);
		}
		return null;
	}

	if (!currentUserIsHost) return null;

	if (item.mediaSeat === "joined") {
		return (
			<button
				className="room-people-action"
				onClick={() => onRevokeMediaSeat(item.id)}
				type="button"
			>
				<CircleMinus aria-hidden="true" size={11} />
				Remove
			</button>
		);
	}

	return (
		<button
			className="room-people-action"
			disabled={maxMediaSeats <= 0 || mediaSeatsFull}
			onClick={() => onGrantMediaSeat(item.id)}
			type="button"
		>
			{item.mediaSeat === "requested" ? (
				<>
					<CircleCheck aria-hidden="true" size={11} />
					Accept
				</>
			) : (
				<>
					<CirclePlus aria-hidden="true" size={11} />
					Give seat
				</>
			)}
		</button>
	);
}
