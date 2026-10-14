import { ProviderLogo } from "./provider-logo";
import type { CurrentResourceDisplay } from "./current-resource-display";

interface CurrentResourcePanelProps {
	entry: CurrentResourceDisplay | null;
}

export function CurrentResourcePanel({ entry }: CurrentResourcePanelProps) {
	if (!entry) {
		return null;
	}

	const progressText = `${formatProgressClock(entry.currentTime)} / ${formatProgressClock(
		entry.duration,
	)}`;

	return (
		<section className="current-resource-card" aria-label="Current resource">
			<div className="current-resource-topline">
				<ProviderLogo provider={entry.provider} label={entry.providerLabel} />
				<span>{entry.providerLabel}</span>
				<span className="current-resource-time">{progressText}</span>
			</div>
			<div className="current-resource-title" title={entry.title}>
				{entry.title}
			</div>
			{entry.itemKind === "series" && entry.episodeTitle ? (
				<div className="current-resource-episode">{entry.episodeTitle}</div>
			) : null}
			<div className="current-resource-progress-row">
				<ProgressBar progress={entry.progress} />
				<span className="current-resource-percent">
					{Math.round(entry.progress * 100)}%
				</span>
			</div>
		</section>
	);
}

export function ProgressBar({ progress }: { progress: number }) {
	return (
		<span className="resource-progress">
			<span
				style={{
					width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`,
				}}
			/>
		</span>
	);
}

function formatProgressClock(value: number): string {
	const wholeSeconds = Math.max(0, Math.floor(value));
	const minutes = Math.floor(wholeSeconds / 60);
	const seconds = wholeSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
