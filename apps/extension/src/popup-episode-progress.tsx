import { Play } from "lucide-react";

export function PopupEpisodeProgress({
	title,
	elapsed,
	duration,
	progress,
	action,
	actionLabel,
	disabled,
	onOpen,
}: {
	title: string;
	elapsed: string;
	duration?: string;
	progress: number;
	action: string;
	actionLabel?: string;
	disabled: boolean;
	onOpen: () => void;
}) {
	const percent = Math.max(0, Math.min(100, progress * 100));
	return (
		<div className="popup-selected-progress">
			<div
				className="popup-progress-track"
				role="progressbar"
				aria-label={`Watch progress: ${title}`}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={percent}
				aria-valuetext={duration ? `${elapsed} / ${duration}` : elapsed}
			>
				<span style={{ width: `${percent}%` }} />
			</div>
			<div className="popup-selected-episode-bottom">
				<span className="popup-selected-time" dir="ltr">
					{elapsed}
					{duration ? (
						<span className="popup-selected-duration"> / {duration}</span>
					) : null}
				</span>
				<button
					className="popup-selected-resume"
					type="button"
					aria-label={actionLabel}
					disabled={disabled}
					onClick={onOpen}
				>
					<Play size={12} fill="currentColor" aria-hidden="true" />
					<span>{action}</span>
				</button>
			</div>
		</div>
	);
}
