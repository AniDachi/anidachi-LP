import { Mic, MicOff } from "lucide-react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
} from "react";
import type { MicrophoneStatus, VoiceMode } from "./media-types";
import { overlayHotkeyBoundaryProps } from "./overlay-interaction-boundary";

export interface PanelMicrophoneControlProps {
	available: boolean;
	disabledReason: string;
	microphoneEnabled: boolean;
	mode: VoiceMode;
	onOpenMicChange: (enabled: boolean) => void;
	onPushToTalkChange: (held: boolean) => void;
	speaking: boolean;
}

type HoldSource =
	| { kind: "keyboard"; key: " " | "Enter" }
	| { kind: "pointer"; pointerId: number };

export function PanelMicrophoneControl({
	available,
	disabledReason,
	microphoneEnabled,
	mode,
	onOpenMicChange,
	onPushToTalkChange,
	speaking,
}: PanelMicrophoneControlProps) {
	const holdSourceRef = useRef<HoldSource | null>(null);
	const onPushToTalkChangeRef = useRef(onPushToTalkChange);
	onPushToTalkChangeRef.current = onPushToTalkChange;

	const stopPushToTalk = () => {
		if (!holdSourceRef.current) {
			return;
		}
		holdSourceRef.current = null;
		onPushToTalkChangeRef.current(false);
	};

	useEffect(() => {
		if (!available || mode !== "push-to-talk") {
			stopPushToTalk();
		}
	}, [available, mode]);

	useEffect(
		() => () => {
			stopPushToTalk();
		},
		[],
	);

	const active = available && microphoneEnabled;
	const activelySpeaking = active && speaking;
	const label = !available
		? "Microphone unavailable"
		: mode === "open-mic"
			? active
				? "Turn microphone off"
				: "Turn microphone on"
			: active
				? "Release to stop talking"
				: "Hold to talk";
	const MicrophoneIcon =
		available && (mode === "push-to-talk" || active) ? Mic : MicOff;

	const startPointerHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
		if (
			mode !== "push-to-talk" ||
			!available ||
			!event.isPrimary ||
			event.button !== 0 ||
			holdSourceRef.current
		) {
			return;
		}

		event.preventDefault();
		holdSourceRef.current = {
			kind: "pointer",
			pointerId: event.pointerId,
		};
		event.currentTarget.setPointerCapture?.(event.pointerId);
		onPushToTalkChangeRef.current(true);
	};

	const stopPointerHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
		const source = holdSourceRef.current;
		if (source?.kind !== "pointer" || source.pointerId !== event.pointerId) {
			return;
		}

		stopPushToTalk();
		if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
			event.currentTarget.releasePointerCapture?.(event.pointerId);
		}
	};

	const startKeyboardHold = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
		if (
			mode !== "push-to-talk" ||
			!available ||
			event.repeat ||
			(event.key !== " " && event.key !== "Enter") ||
			holdSourceRef.current
		) {
			return;
		}

		event.preventDefault();
		holdSourceRef.current = {
			kind: "keyboard",
			key: event.key,
		};
		onPushToTalkChangeRef.current(true);
	};

	const stopKeyboardHold = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
		const source = holdSourceRef.current;
		if (source?.kind !== "keyboard" || source.key !== event.key) {
			return;
		}

		event.preventDefault();
		stopPushToTalk();
	};

	return (
		<button
			{...overlayHotkeyBoundaryProps}
			{...(mode === "open-mic"
				? { "aria-checked": active, role: "switch" as const }
				: { "aria-pressed": active })}
			aria-label={label}
			className={[
				"icon-button",
				"panel-microphone-control",
				mode,
				!available ? "unavailable" : active ? "enabled" : "inactive",
				activelySpeaking ? "speaking" : "",
			]
				.filter(Boolean)
				.join(" ")}
			disabled={!available}
			onBlur={() => {
				if (holdSourceRef.current?.kind === "keyboard") {
					stopPushToTalk();
				}
			}}
			onClick={(event) => {
				if (mode !== "open-mic") {
					event.preventDefault();
					return;
				}
				onOpenMicChange(!active);
			}}
			onKeyDown={startKeyboardHold}
			onKeyUp={stopKeyboardHold}
			onLostPointerCapture={stopPointerHold}
			onPointerCancel={stopPointerHold}
			onPointerDown={startPointerHold}
			onPointerUp={stopPointerHold}
			title={!available ? disabledReason : label}
			type="button"
		>
			<span aria-hidden="true" className="panel-microphone-control-thumb">
				<MicrophoneIcon className="panel-microphone-control-icon" size={12} />
			</span>
		</button>
	);
}

export interface VoiceSettingsPanelProps {
	dictateAction?: ReactNode;
	hasMediaSeat: boolean;
	mediaSeatGuidance?: string;
	microphoneEnabled: boolean;
	microphoneStatus: MicrophoneStatus;
	mode: VoiceMode;
	onModeChange: (mode: VoiceMode) => void;
	speaking: boolean;
}

export function VoiceSettingsPanel({
	dictateAction,
	hasMediaSeat,
	mediaSeatGuidance,
	microphoneEnabled,
	microphoneStatus,
	mode,
	onModeChange,
	speaking,
}: VoiceSettingsPanelProps) {
	const status = getVoiceStatus({
		hasMediaSeat,
		microphoneEnabled,
		microphoneStatus,
		mode,
		speaking,
	});
	const statusClassName = [
		"voice-settings-status",
		!hasMediaSeat ? "unavailable" : "",
		microphoneStatus === "error" ? "error" : "",
		hasMediaSeat && microphoneEnabled ? "enabled" : "",
		hasMediaSeat && microphoneEnabled && speaking ? "speaking" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			{...overlayHotkeyBoundaryProps}
			className="settings-panel-stack voice-settings-panel"
		>
			<div
				aria-label="Microphone mode"
				className="segmented-control voice-mode-control"
				role="radiogroup"
			>
				<VoiceModeButton
					active={mode === "push-to-talk"}
					label="Push to talk"
					onSelect={() => onModeChange("push-to-talk")}
				/>
				<VoiceModeButton
					active={mode === "open-mic"}
					label="Open mic"
					onSelect={() => onModeChange("open-mic")}
				/>
			</div>

			<div className={statusClassName}>
				<span className="live-voice-label">
					{microphoneEnabled && hasMediaSeat ? (
						<Mic aria-hidden="true" size={13} />
					) : (
						<MicOff aria-hidden="true" size={13} />
					)}
					{mode === "open-mic" ? "Open mic" : "Push to talk"}
				</span>
				<span className="voice-settings-status-value">{status}</span>
			</div>

			{dictateAction ? (
				<div className="voice-settings-dictate-action">{dictateAction}</div>
			) : null}

			{!hasMediaSeat && mediaSeatGuidance ? (
				<div className="footnote voice-settings-guidance">
					{mediaSeatGuidance}
				</div>
			) : null}
		</div>
	);
}

interface VoiceModeButtonProps {
	active: boolean;
	label: string;
	onSelect: () => void;
}

function VoiceModeButton({ active, label, onSelect }: VoiceModeButtonProps) {
	return (
		<button
			aria-checked={active}
			aria-label={label}
			className={active ? "selected" : undefined}
			onClick={() => {
				if (!active) {
					onSelect();
				}
			}}
			role="radio"
			type="button"
		>
			{label}
		</button>
	);
}

interface VoiceStatusInput {
	hasMediaSeat: boolean;
	microphoneEnabled: boolean;
	microphoneStatus: MicrophoneStatus;
	mode: VoiceMode;
	speaking: boolean;
}

function getVoiceStatus({
	hasMediaSeat,
	microphoneEnabled,
	microphoneStatus,
	mode,
	speaking,
}: VoiceStatusInput): string {
	if (!hasMediaSeat) {
		return "Media seat required";
	}
	if (microphoneStatus === "error") {
		return "Microphone blocked";
	}
	if (microphoneStatus === "connecting") {
		return "Connecting";
	}
	if (microphoneEnabled && speaking) {
		return "Speaking";
	}
	if (microphoneEnabled || microphoneStatus === "on") {
		return "Microphone on";
	}
	return mode === "push-to-talk" ? "Hold V or hold the mic" : "Microphone off";
}
