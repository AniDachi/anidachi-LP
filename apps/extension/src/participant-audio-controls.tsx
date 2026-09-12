import { Volume2, VolumeX } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
	overlayHotkeyBoundaryProps,
	overlayInteractionBoundaryProps,
} from "./overlay-interaction-boundary";
import {
	applyParticipantAudioSliderValue,
	getParticipantAudioSliderValue,
	type ParticipantAudioPreference,
	toggleParticipantAudioMute,
} from "./voice-audio-preferences";

interface ParticipantAudioControlProps {
	displayName: string;
	onAdjustmentEnd?: () => void;
	onAdjustmentStart?: () => void;
	onChange: (preference: ParticipantAudioPreference) => void;
	preference: ParticipantAudioPreference;
}

export function ParticipantAudioInlineControl({
	displayName,
	onAdjustmentEnd,
	onAdjustmentStart,
	onChange,
	preference,
}: ParticipantAudioControlProps) {
	const adjustmentActiveRef = useRef(false);
	const onAdjustmentEndRef = useRef(onAdjustmentEnd);
	onAdjustmentEndRef.current = onAdjustmentEnd;
	const sliderValue = Math.round(
		getParticipantAudioSliderValue(preference) * 100,
	);
	const style = {
		"--participant-volume-progress": `${sliderValue}%`,
	} as CSSProperties;

	const finishAdjustment = () => {
		if (!adjustmentActiveRef.current) {
			return;
		}
		adjustmentActiveRef.current = false;
		onAdjustmentEndRef.current?.();
	};

	useEffect(
		() => () => {
			finishAdjustment();
		},
		[],
	);

	return (
		<div
			className="participant-audio-inline-control"
			data-muted={preference.muted ? "true" : "false"}
			style={style}
			{...overlayHotkeyBoundaryProps}
			{...overlayInteractionBoundaryProps}
		>
			<input
				aria-label={`${displayName} volume`}
				aria-valuetext={preference.muted ? "Muted" : `${sliderValue}%`}
				max={100}
				min={0}
				onChange={(event) => {
					onChange(
						applyParticipantAudioSliderValue(
							preference,
							Number(event.currentTarget.value) / 100,
						),
					);
				}}
				onLostPointerCapture={finishAdjustment}
				onPointerCancel={finishAdjustment}
				onPointerDown={(event) => {
					adjustmentActiveRef.current = true;
					event.currentTarget.setPointerCapture?.(event.pointerId);
					onAdjustmentStart?.();
				}}
				onPointerUp={(event) => {
					if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
						event.currentTarget.releasePointerCapture(event.pointerId);
					}
					finishAdjustment();
				}}
				step={1}
				type="range"
				value={sliderValue}
			/>
			<ParticipantMuteButton
				displayName={displayName}
				onChange={onChange}
				preference={preference}
			/>
		</div>
	);
}

export function ParticipantAudioContourControl({
	displayName,
	onAdjustmentEnd,
	onAdjustmentStart,
	onChange,
	preference,
}: ParticipantAudioControlProps) {
	const [adjusting, setAdjusting] = useState(false);
	const adjustmentActiveRef = useRef(false);
	const onAdjustmentEndRef = useRef(onAdjustmentEnd);
	onAdjustmentEndRef.current = onAdjustmentEnd;
	const sliderValue = Math.round(
		getParticipantAudioSliderValue(preference) * 100,
	);

	const finishAdjustment = () => {
		if (!adjustmentActiveRef.current) {
			return;
		}
		adjustmentActiveRef.current = false;
		setAdjusting(false);
		onAdjustmentEndRef.current?.();
	};

	useEffect(
		() => () => {
			if (adjustmentActiveRef.current) {
				adjustmentActiveRef.current = false;
				onAdjustmentEndRef.current?.();
			}
		},
		[],
	);

	const style = {
		"--participant-volume-progress": `${sliderValue}%`,
	} as CSSProperties;

	return (
		<div
			className={`participant-audio-video-control ${
				preference.muted ? "muted" : ""
			}`}
			data-adjusting={adjusting ? "true" : "false"}
			style={style}
			{...overlayHotkeyBoundaryProps}
			{...overlayInteractionBoundaryProps}
		>
			<input
				aria-label={`${displayName} volume`}
				aria-valuemax={100}
				aria-valuemin={0}
				aria-valuenow={sliderValue}
				aria-valuetext={preference.muted ? "Muted" : `${sliderValue}%`}
				className="participant-audio-video-slider"
				max={100}
				min={0}
				onBlur={finishAdjustment}
				onChange={(event) => {
					onChange(
						applyParticipantAudioSliderValue(
							preference,
							Number(event.currentTarget.value) / 100,
						),
					);
				}}
				onLostPointerCapture={finishAdjustment}
				onPointerCancel={finishAdjustment}
				onPointerDown={(event) => {
					if (event.button !== 0 || !event.isPrimary) {
						return;
					}
					if (!adjustmentActiveRef.current) {
						adjustmentActiveRef.current = true;
						setAdjusting(true);
						onAdjustmentStart?.();
					}
					event.currentTarget.setPointerCapture?.(event.pointerId);
				}}
				onPointerUp={(event) => {
					if (!adjustmentActiveRef.current) {
						return;
					}
					if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
						event.currentTarget.releasePointerCapture(event.pointerId);
					}
					finishAdjustment();
				}}
				step={1}
				type="range"
				value={sliderValue}
			/>
			<ParticipantMuteButton
				className="participant-audio-video-mute"
				displayName={displayName}
				onChange={onChange}
				preference={preference}
			/>
		</div>
	);
}

function ParticipantMuteButton({
	className,
	displayName,
	onChange,
	preference,
}: Pick<
	ParticipantAudioControlProps,
	"displayName" | "onChange" | "preference"
> & { className?: string }) {
	const muted = preference.muted;
	const Icon = muted ? VolumeX : Volume2;
	return (
		<button
			aria-label={`${muted ? "Unmute" : "Mute"} ${displayName}`}
			className={`participant-audio-mute${className ? ` ${className}` : ""}`}
			onClick={() => onChange(toggleParticipantAudioMute(preference))}
			title={`${muted ? "Unmute" : "Mute"} ${displayName}`}
			type="button"
		>
			<Icon aria-hidden="true" size={12} />
		</button>
	);
}
