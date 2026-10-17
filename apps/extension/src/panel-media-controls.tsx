import { useEffect, useId, useRef, useState } from "react";
import type { MicrophoneStatus, VoiceMode } from "./media-types";

export function SolidMicrophoneIcon({ size = 16 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
			<rect x="8.5" y="2" width="7" height="12" rx="3.5" fill="currentColor" />
			<path
				d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function SolidCameraIcon({ enabled }: { enabled: boolean }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
			{enabled ? (
				<rect x="2" y="5" width="13" height="14" rx="2.5" fill="currentColor" />
			) : (
				<path
					d="M2 7.5V16.5A2.5 2.5 0 0 0 4.5 19H13L2 8ZM7 5h5.5A2.5 2.5 0 0 1 15 7.5V13L7 5Z"
					fill="currentColor"
				/>
			)}
			<path
				d="M17 9l4-2.5a.65.65 0 0 1 1 .55v9.9a.65.65 0 0 1-1 .55L17 15Z"
				fill="currentColor"
			/>
			{!enabled && (
				<path
					d="M2 2l20 20"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				/>
			)}
		</svg>
	);
}

/** Controlled UI shared by the live drawer and the isolated practice tour. */
export function PanelMediaControls({
	cameraEnabled,
	voiceMode,
	onCameraToggle,
	onVoiceModeChange,
	cameraDisabled = false,
	cameraDisabledReason = "",
	microphoneDisabled = false,
	microphoneDisabledReason = "",
	microphoneStatus,
	microphoneFeedback,
}: {
	cameraEnabled: boolean;
	voiceMode: VoiceMode;
	cameraDisabled?: boolean;
	cameraDisabledReason?: string;
	microphoneDisabled?: boolean;
	microphoneDisabledReason?: string;
	microphoneStatus?: MicrophoneStatus;
	microphoneFeedback?: string | null;
	onCameraToggle: () => void;
	onVoiceModeChange: (mode: VoiceMode) => void;
}) {
	const tooltipId = useId();
	const [tooltipVisible, setTooltipVisible] = useState(false);
	const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (tooltipTimer.current !== null) clearTimeout(tooltipTimer.current);
		},
		[],
	);
	const dismissTooltip = () => {
		if (tooltipTimer.current !== null) clearTimeout(tooltipTimer.current);
		tooltipTimer.current = null;
		setTooltipVisible(false);
	};
	const openMic = voiceMode === "open-mic" && !microphoneDisabled;
	const cameraOn = cameraEnabled && !cameraDisabled;
	const micLabel = microphoneDisabled
		? "Microphone unavailable"
		: openMic
			? "Microphone: always on. Switch to hold V"
			: "Microphone: hold V to talk. Switch to always on";
	const cameraLabel = cameraDisabled
		? "Camera unavailable"
		: cameraOn
			? "Turn camera off"
			: "Turn camera on";
	const micHint =
		microphoneStatus === "error"
			? "Microphone unavailable"
			: microphoneStatus === "connecting"
				? "Connecting microphone…"
				: openMic && microphoneStatus === "off"
					? "Microphone is off"
					: openMic
						? "Mic is always on"
						: "Hold V to talk";
	return (
		<div
			className="panel-media-dock"
			role="group"
			aria-label="Camera and microphone"
		>
			<div
				className="panel-media-mic-hint"
				data-visible={tooltipVisible && !microphoneDisabled}
			>
				<button
					className="panel-media-button panel-media-mic"
					onBlur={dismissTooltip}
					onKeyDown={(event) => {
						if (event.key === "Escape") dismissTooltip();
					}}
					data-mode={voiceMode}
					data-status={microphoneStatus}
					disabled={microphoneDisabled}
					aria-label={micLabel}
					aria-pressed={openMic}
					aria-describedby={microphoneDisabled ? undefined : tooltipId}
					aria-description={microphoneFeedback || undefined}
					title={microphoneDisabled ? microphoneDisabledReason : undefined}
					type="button"
					onClick={() => {
						onVoiceModeChange(openMic ? "push-to-talk" : "open-mic");
						if (tooltipTimer.current !== null)
							clearTimeout(tooltipTimer.current);
						setTooltipVisible(true);
						tooltipTimer.current = setTimeout(() => {
							setTooltipVisible(false);
							tooltipTimer.current = null;
						}, 1000);
					}}
				>
					<span className="panel-media-cap" aria-hidden="true">
						<span className="panel-media-symbol">
							<SolidMicrophoneIcon />
						</span>
					</span>
				</button>
				{!microphoneDisabled && (
					<div
						id={tooltipId}
						className="panel-media-tooltip"
						role="tooltip"
						data-mode={voiceMode}
					>
						<span className="panel-media-tooltip-icon" aria-hidden="true">
							<SolidMicrophoneIcon size={17} />
						</span>
						<span className="panel-media-tooltip-copy">
							<strong>
								{micHint === "Hold V to talk" ? (
									<>
										Hold <kbd>V</kbd> to talk
									</>
								) : (
									micHint
								)}
							</strong>
						</span>
					</div>
				)}
			</div>
			<button
				className="panel-media-button panel-media-camera"
				data-enabled={cameraOn}
				disabled={cameraDisabled}
				role="switch"
				aria-checked={cameraOn}
				aria-label={cameraLabel}
				title={cameraDisabled ? cameraDisabledReason : cameraLabel}
				type="button"
				onClick={onCameraToggle}
			>
				<span className="panel-media-cap" aria-hidden="true">
					<span className="panel-media-symbol">
						<SolidCameraIcon enabled={cameraOn} />
					</span>
				</span>
			</button>
		</div>
	);
}
