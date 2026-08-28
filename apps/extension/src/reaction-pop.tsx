import type { Participant, ReactionEvent } from "@anidachi/protocol";
import type { CSSProperties, RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";

export const REACTION_IDENTITY_CUE_DURATION_MS = 1100;
export const REACTION_VISIBLE_DURATION_MS = 2800;

export type ReactionOriginKind = "camera" | "pill" | "fallback";

interface RectLike {
	bottom: number;
	height: number;
	left: number;
	right: number;
	top: number;
	width: number;
}

interface ReactionAnchor {
	element: HTMLElement;
	kind: Exclude<ReactionOriginKind, "fallback">;
}

interface ReactionPlacement {
	driftX: number;
	kind: ReactionOriginKind;
	midDriftX: number;
	x: number;
	y: number;
}

export interface ReactionPopProps {
	fallbackParticipantId?: string;
	fallbackParticipantIndex: number;
	laneIndex: number;
	overlayRef: RefObject<HTMLDivElement | null>;
	participants: Participant[];
	reaction: ReactionEvent;
}

export function ReactionPop({
	fallbackParticipantId,
	fallbackParticipantIndex,
	laneIndex,
	overlayRef,
	participants,
	reaction,
}: ReactionPopProps) {
	const [placement, setPlacement] = useState<ReactionPlacement | null>(null);
	const reactionRef = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		const overlay =
			reactionRef.current?.closest<HTMLElement>(".anidachi-overlay") ??
			overlayRef.current;
		if (!overlay) {
			return;
		}

		setPlacement(
			resolveReactionPlacement({
				anchor: findReactionAnchor(overlay, reaction.userId),
				fallbackParticipantIndex,
				laneIndex,
				overlayRect: overlay.getBoundingClientRect(),
			}),
		);
	}, [fallbackParticipantIndex, laneIndex, overlayRef, reaction.userId]);

	const participant = participants.find((item) => item.id === reaction.userId);
	const isFallback =
		reaction.userId === fallbackParticipantId && participant === undefined;
	const displayName =
		participant?.displayName ?? (isFallback ? "You" : "Friend");
	const resolvedPlacement = placement ?? {
		driftX: -20,
		kind: "fallback" as const,
		midDriftX: -8,
		x: 52,
		y: 94,
	};
	const style = {
		"--reaction-drift-x": `${resolvedPlacement.driftX}px`,
		"--reaction-mid-drift-x": `${resolvedPlacement.midDriftX}px`,
		"--reaction-origin-x": `${resolvedPlacement.x}px`,
		"--reaction-origin-y": `${resolvedPlacement.y}px`,
	} as CSSProperties;

	return (
		<div
			className={`reaction-pop reaction-from-${resolvedPlacement.kind}`}
			data-lane-index={laneIndex}
			data-origin-kind={resolvedPlacement.kind}
			data-ready={placement ? "true" : undefined}
			ref={reactionRef}
			role="status"
			style={style}
		>
			{reaction.emoji ? <span>{reaction.emoji}</span> : null}
			{reaction.text ? (
				<span className="reaction-text">
					<span className="reaction-author">{displayName}</span>
					<span className="reaction-message">{reaction.text}</span>
				</span>
			) : null}
		</div>
	);
}

function findReactionAnchor(
	overlay: HTMLElement,
	participantId: string,
): ReactionAnchor | null {
	for (const camera of overlay.querySelectorAll<HTMLElement>(
		".cam-bubble[data-participant-id]",
	)) {
		if (camera.dataset.participantId === participantId) {
			return { element: camera, kind: "camera" };
		}
	}

	for (const slot of overlay.querySelectorAll<HTMLElement>(
		".room-rail-slot[data-participant-id]",
	)) {
		if (
			slot.dataset.participantId !== participantId ||
			slot.dataset.presentation === "hidden"
		) {
			continue;
		}
		const avatar = slot.querySelector<HTMLElement>(".room-rail-avatar");
		if (avatar) {
			return { element: avatar, kind: "pill" };
		}
	}

	return null;
}

function resolveReactionPlacement({
	anchor,
	fallbackParticipantIndex,
	laneIndex,
	overlayRect,
}: {
	anchor: ReactionAnchor | null;
	fallbackParticipantIndex: number;
	laneIndex: number;
	overlayRect: RectLike;
}): ReactionPlacement {
	const overlayWidth = usefulDimension(overlayRect.width, 640);
	const overlayHeight = usefulDimension(overlayRect.height, 360);
	const anchorRect = anchor?.element.getBoundingClientRect();
	const hasMeasuredAnchor =
		anchorRect !== undefined && anchorRect.width > 0 && anchorRect.height > 0;
	const sourceX = hasMeasuredAnchor
		? anchorRect.left - overlayRect.left + anchorRect.width / 2
		: overlayWidth - 28;
	const sourceY = hasMeasuredAnchor
		? anchorRect.top -
			overlayRect.top +
			anchorRect.height * (anchor?.kind === "camera" ? 0.32 : 0.5)
		: 92 + Math.max(0, fallbackParticipantIndex) * 49;
	const directionToCenter = sourceX >= overlayWidth / 2 ? -1 : 1;
	const safeLaneIndex = Math.max(0, Math.round(laneIndex));
	const laneOffset = Math.min(safeLaneIndex, 3) * 8 * directionToCenter;
	const driftX = directionToCenter * (22 + (safeLaneIndex % 3) * 5);

	return {
		driftX,
		kind: anchor?.kind ?? "fallback",
		midDriftX: Math.round(driftX * 0.42),
		x: clamp(sourceX + laneOffset, 18, Math.max(18, overlayWidth - 18)),
		y: clamp(
			sourceY - Math.floor(safeLaneIndex / 4) * 7,
			18,
			Math.max(18, overlayHeight - 18),
		),
	};
}

function usefulDimension(value: number, fallback: number): number {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}
