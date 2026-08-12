import { Volume2, VolumeX } from "lucide-react";
import {
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	useEffect,
	useRef,
} from "react";
import {
	overlayHotkeyBoundaryProps,
	overlayInteractionBoundaryProps,
} from "./overlay-interaction-boundary";
import {
	getParticipantVolumeFromKey,
	getParticipantVolumeFromPointer,
} from "./participant-volume-geometry";
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
			{...overlayHotkeyBoundaryProps}
			{...overlayInteractionBoundaryProps}
		>
			<input
				aria-label={`${displayName} volume`}
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
	const sliderRef = useRef<HTMLDivElement | null>(null);
	const capturedPointerIdRef = useRef<number | null>(null);
	const latestValueRef = useRef(
		Math.round(getParticipantAudioSliderValue(preference) * 100),
	);
	const sliderValue = Math.round(
		getParticipantAudioSliderValue(preference) * 100,
	);
	latestValueRef.current = sliderValue;

	const applyValue = (value: number) => {
		latestValueRef.current = value;
		onChange(applyParticipantAudioSliderValue(preference, value / 100));
	};

	const readPointerValue = (
		event: PointerEvent<HTMLDivElement>,
		captured: boolean,
	) => {
		const rect = event.currentTarget.getBoundingClientRect();
		return getParticipantVolumeFromPointer({
			captured,
			centerX: rect.left + rect.width / 2,
			centerY: rect.top + rect.height / 2,
			pointerX: event.clientX,
			pointerY: event.clientY,
			previousValue: latestValueRef.current,
			radius: Math.max(0, Math.min(rect.width, rect.height) / 2 - 4),
		});
	};

	const finishAdjustment = () => {
		if (capturedPointerIdRef.current === null) {
			return;
		}
		capturedPointerIdRef.current = null;
		onAdjustmentEnd?.();
	};

	useEffect(
		() => () => {
			if (capturedPointerIdRef.current !== null) {
				onAdjustmentEnd?.();
			}
		},
		[onAdjustmentEnd],
	);

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const nextValue = getParticipantVolumeFromKey(
			latestValueRef.current,
			event.key,
		);
		if (nextValue === null) {
			return;
		}
		event.preventDefault();
		applyValue(nextValue);
	};

	const style = {
		"--participant-volume-progress": `${sliderValue * 2.7}deg`,
	} as CSSProperties;

	return (
		<div
			className={`participant-audio-contour-control ${
				preference.muted ? "muted" : ""
			}`}
			style={style}
			{...overlayHotkeyBoundaryProps}
			{...overlayInteractionBoundaryProps}
		>
			<div
				aria-label={`${displayName} volume`}
				aria-valuemax={100}
				aria-valuemin={0}
				aria-valuenow={sliderValue}
				aria-valuetext={preference.muted ? "Muted" : `${sliderValue}%`}
				className="participant-audio-contour-slider"
				onKeyDown={handleKeyDown}
				onLostPointerCapture={finishAdjustment}
				onPointerCancel={finishAdjustment}
				onPointerDown={(event) => {
					if (event.button !== 0 || !event.isPrimary) {
						return;
					}
					const nextValue = readPointerValue(event, false);
					if (nextValue === null) {
						return;
					}
					capturedPointerIdRef.current = event.pointerId;
					event.currentTarget.setPointerCapture?.(event.pointerId);
					onAdjustmentStart?.();
					applyValue(nextValue);
				}}
				onPointerMove={(event) => {
					if (capturedPointerIdRef.current !== event.pointerId) {
						return;
					}
					const nextValue = readPointerValue(event, true);
					if (nextValue !== null && nextValue !== latestValueRef.current) {
						applyValue(nextValue);
					}
				}}
				onPointerUp={(event) => {
					if (capturedPointerIdRef.current !== event.pointerId) {
						return;
					}
					if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
						event.currentTarget.releasePointerCapture(event.pointerId);
					}
					finishAdjustment();
				}}
				ref={sliderRef}
				role="slider"
				tabIndex={0}
			>
				<span aria-hidden="true" className="participant-audio-contour-arc" />
			</div>
			<ParticipantMuteButton
				displayName={displayName}
				onChange={onChange}
				preference={preference}
			/>
		</div>
	);
}

function ParticipantMuteButton({
	displayName,
	onChange,
	preference,
}: Pick<
	ParticipantAudioControlProps,
	"displayName" | "onChange" | "preference"
>) {
	const muted = preference.muted;
	const Icon = muted ? VolumeX : Volume2;
	return (
		<button
			aria-label={`${muted ? "Unmute" : "Mute"} ${displayName}`}
			className="participant-audio-mute"
			onClick={() => onChange(toggleParticipantAudioMute(preference))}
			title={`${muted ? "Unmute" : "Mute"} ${displayName}`}
			type="button"
		>
			<Icon aria-hidden="true" size={12} />
		</button>
	);
}
