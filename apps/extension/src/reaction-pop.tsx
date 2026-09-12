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
	curveX: number;
	curveY: number;
	delayMs: number;
	durationMs: number;
	endX: number;
	kind: ReactionOriginKind;
	liftX: number;
	liftY: number;
	peakScale: number;
	riseY: number;
	rotation: number;
	x: number;
	y: number;
}

interface ReactionMotionProfile {
	curveX: number;
	curveY: number;
	delayMs: number;
	durationMs: number;
	endX: number;
	liftX: number;
	liftY: number;
	peakScale: number;
	riseY: number;
	rotation: number;
}

const REACTION_MOTION_PROFILES: readonly ReactionMotionProfile[] = [
	{
		curveX: 14,
		curveY: 42,
		delayMs: 0,
		durationMs: 2360,
		endX: 24,
		liftX: 4,
		liftY: 13,
		peakScale: 1.07,
		riseY: 118,
		rotation: -4,
	},
	{
		curveX: 22,
		curveY: 48,
		delayMs: 55,
		durationMs: 2440,
		endX: 8,
		liftX: 7,
		liftY: 15,
		peakScale: 1.1,
		riseY: 132,
		rotation: 5,
	},
	{
		curveX: 11,
		curveY: 46,
		delayMs: 110,
		durationMs: 2280,
		endX: 30,
		liftX: 3,
		liftY: 12,
		peakScale: 1.05,
		riseY: 124,
		rotation: -6,
	},
	{
		curveX: 27,
		curveY: 54,
		delayMs: 165,
		durationMs: 2480,
		endX: 15,
		liftX: 8,
		liftY: 16,
		peakScale: 1.12,
		riseY: 140,
		rotation: 6,
	},
	{
		curveX: 16,
		curveY: 50,
		delayMs: 30,
		durationMs: 2400,
		endX: 27,
		liftX: 5,
		liftY: 14,
		peakScale: 1.08,
		riseY: 136,
		rotation: -3,
	},
	{
		curveX: 24,
		curveY: 44,
		delayMs: 85,
		durationMs: 2320,
		endX: 5,
		liftX: 6,
		liftY: 12,
		peakScale: 1.06,
		riseY: 116,
		rotation: 4,
	},
	{
		curveX: 12,
		curveY: 52,
		delayMs: 140,
		durationMs: 2460,
		endX: 21,
		liftX: 4,
		liftY: 15,
		peakScale: 1.11,
		riseY: 138,
		rotation: -5,
	},
	{
		curveX: 29,
		curveY: 47,
		delayMs: 195,
		durationMs: 2340,
		endX: 12,
		liftX: 8,
		liftY: 13,
		peakScale: 1.09,
		riseY: 128,
		rotation: 3,
	},
];

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
		curveX: -14,
		curveY: -42,
		delayMs: 0,
		durationMs: 2360,
		endX: -24,
		kind: "fallback" as const,
		liftX: -4,
		liftY: -13,
		peakScale: 1.07,
		riseY: -118,
		rotation: -4,
		x: 52,
		y: 94,
	};
	const style = {
		"--reaction-curve-x": `${resolvedPlacement.curveX}px`,
		"--reaction-curve-y": `${resolvedPlacement.curveY}px`,
		"--reaction-delay": `${resolvedPlacement.delayMs}ms`,
		"--reaction-duration": `${resolvedPlacement.durationMs}ms`,
		"--reaction-end-x": `${resolvedPlacement.endX}px`,
		"--reaction-lift-x": `${resolvedPlacement.liftX}px`,
		"--reaction-lift-y": `${resolvedPlacement.liftY}px`,
		"--reaction-origin-x": `${resolvedPlacement.x}px`,
		"--reaction-origin-y": `${resolvedPlacement.y}px`,
		"--reaction-peak-scale": resolvedPlacement.peakScale,
		"--reaction-rise-y": `${resolvedPlacement.riseY}px`,
		"--reaction-rotation": `${resolvedPlacement.rotation}deg`,
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
	const profile =
		REACTION_MOTION_PROFILES[safeLaneIndex % REACTION_MOTION_PROFILES.length] ??
		REACTION_MOTION_PROFILES[0];
	const availableRise = Math.max(0, sourceY - 22);
	const riseDistance = Math.min(profile.riseY, availableRise);

	return {
		curveX: directionToCenter * profile.curveX,
		curveY: -Math.min(profile.curveY, riseDistance),
		delayMs: profile.delayMs,
		durationMs: profile.durationMs,
		endX: directionToCenter * profile.endX,
		kind: anchor?.kind ?? "fallback",
		liftX: directionToCenter * profile.liftX,
		liftY: -Math.min(profile.liftY, riseDistance),
		peakScale: profile.peakScale,
		riseY: -riseDistance,
		rotation: profile.rotation,
		x: clamp(sourceX, 18, Math.max(18, overlayWidth - 18)),
		y: clamp(sourceY, 18, Math.max(18, overlayHeight - 18)),
	};
}

function usefulDimension(value: number, fallback: number): number {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}
