import { AudioLines, MousePointer2, VolumeX } from "lucide-react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import type {
	InterfacePreferencesPatch,
	InterfacePreferencesV1,
	MainControlVisibility,
	ParticipantPillVisibility,
} from "./interface-preferences";
import {
	resolveMainControlPresentation,
	resolveParticipantPillPresentation,
	resolveParticipantRailPresentation,
} from "./interface-visibility";
import { overlayHotkeyBoundaryProps } from "./overlay-interaction-boundary";

export const INTERFACE_PREVIEW_STEP_MS = 720;

type PreviewMoment = "idle" | "proximity" | "speaking" | "interaction";

const PREVIEW_MOMENTS: readonly PreviewMoment[] = [
	"idle",
	"proximity",
	"speaking",
	"interaction",
];

const MAIN_CONTROL_OPTIONS: ReadonlyArray<{
	label: string;
	value: MainControlVisibility;
}> = [
	{ label: "Auto hide", value: "auto-hide" },
	{ label: "Always visible", value: "always-visible" },
];

const PARTICIPANT_PILL_OPTIONS: ReadonlyArray<{
	label: string;
	value: ParticipantPillVisibility;
}> = [
	{ label: "Smart", value: "smart" },
	{ label: "Always visible", value: "always-visible" },
];

export interface InterfaceSettingsPanelProps {
	error: string | null;
	onChange(patch: InterfacePreferencesPatch): void;
	preferences: InterfacePreferencesV1;
	ready: boolean;
	saving: boolean;
}

export function InterfaceSettingsPanel({
	error,
	onChange,
	preferences,
	ready,
	saving,
}: InterfaceSettingsPanelProps) {
	const reducedMotion = usePrefersReducedMotion();
	const moment = useLoopingPreviewMoment({
		preferences,
		reducedMotion,
	});

	return (
		<div
			{...overlayHotkeyBoundaryProps}
			aria-busy={saving}
			className="settings-panel-stack interface-settings-panel"
		>
			<InterfacePreview
				moment={moment}
				preferences={preferences}
				reducedMotion={reducedMotion}
			/>

			<div className="interface-settings-controls">
				<InterfaceSegmentedControl
					disabled={!ready}
					label="Main control"
					onSelect={(mainControlVisibility) =>
						onChange({ mainControlVisibility })
					}
					options={MAIN_CONTROL_OPTIONS}
					value={preferences.mainControlVisibility}
				/>
				<InterfaceSegmentedControl
					disabled={!ready}
					label="Participant pills"
					onSelect={(participantPillVisibility) =>
						onChange({ participantPillVisibility })
					}
					options={PARTICIPANT_PILL_OPTIONS}
					value={preferences.participantPillVisibility}
				/>
			</div>

			{error ? (
				<p
					aria-live="polite"
					className="interface-settings-feedback"
					role="status"
				>
					{error}
				</p>
			) : null}
		</div>
	);
}

function InterfacePreview({
	moment,
	preferences,
	reducedMotion,
}: {
	moment: PreviewMoment;
	preferences: InterfacePreferencesV1;
	reducedMotion: boolean;
}) {
	const mainPresentation = resolveMainControlPresentation({
		focused: false,
		forceVisible: false,
		mode: preferences.mainControlVisibility,
		panelOpen: false,
		phase:
			moment === "proximity"
				? "glow"
				: moment === "interaction"
					? "visible"
					: "hidden",
	});
	const railPresentation = resolveParticipantRailPresentation({
		edgeExpanded: moment === "interaction",
		mode: preferences.participantPillVisibility,
	});
	const pillPresentations = [0, 1, 2].map((index) =>
		resolveParticipantPillPresentation({
			interacted: index === 0 && moment === "interaction",
			mode: preferences.participantPillVisibility,
			railExpanded: railPresentation.fullListExpanded,
			speaking: index === 0 && moment === "speaking",
		}),
	);
	const participantNames = ["Mika", "Ren", "Niko"] as const;
	const participantInitials = ["MI", "RE", "NI"] as const;

	return (
		<div
			className="interface-settings-preview"
			data-main-glow={String(mainPresentation.edgeGlowVisible)}
			data-main-visible={String(mainPresentation.visible)}
			data-pill-visibility={pillPresentations[0]}
			data-preview-moment={moment}
			data-reduced-motion={String(reducedMotion)}
		>
			<div
				aria-hidden="true"
				className={[
					"interface-settings-silhouette",
					"interface-settings-main-control",
					mainPresentation.visible ? "is-visible" : "",
					mainPresentation.edgeGlowVisible ? "is-glowing" : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				<span className="interface-settings-main-avatar">A</span>
				<span className="interface-settings-main-status" />
				<span className="interface-settings-main-count">3</span>
			</div>

			<div aria-hidden="true" className="interface-settings-edge-glow" />

			<div aria-hidden="true" className="interface-settings-participant-stack">
				{pillPresentations.map((presentation, index) => (
					<div
						aria-hidden="true"
						className={[
							"interface-settings-silhouette",
							"interface-settings-participant-pill",
							`is-${presentation}`,
							index === 0 && moment === "speaking" ? "is-speaking" : "",
							index === 1 ? "is-muted" : "",
						]
							.filter(Boolean)
							.join(" ")}
						key={index}
					>
						<span className="interface-settings-participant-avatar">
							{participantInitials[index]}
						</span>
						<span className="interface-settings-participant-copy">
							<strong className="interface-settings-participant-name">
								{participantNames[index]}
							</strong>
							<small>{index === 0 ? "Speaking" : "In room"}</small>
						</span>
						{index === 0 && moment === "speaking" ? (
							<AudioLines
								className="interface-settings-speaking-icon"
								size={13}
							/>
						) : null}
						{index === 1 ? (
							<VolumeX className="interface-settings-muted-icon" size={12} />
						) : null}
					</div>
				))}
			</div>

			<MousePointer2
				aria-hidden="true"
				className="interface-settings-demo-cursor"
				size={19}
			/>
		</div>
	);
}

function InterfaceSegmentedControl<T extends string>({
	disabled,
	label,
	onSelect,
	options,
	value,
}: {
	disabled: boolean;
	label: string;
	onSelect(value: T): void;
	options: ReadonlyArray<{ label: string; value: T }>;
	value: T;
}) {
	const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		const focusedValue =
			event.target instanceof HTMLElement
				? (event.target.dataset.interfaceOption as T | undefined)
				: undefined;
		const currentIndex = Math.max(
			0,
			options.findIndex((option) => option.value === (focusedValue ?? value)),
		);
		const nextIndex = resolveSegmentedControlIndex(
			event.key,
			currentIndex,
			options.length,
		);
		if (nextIndex === null) {
			return;
		}

		event.preventDefault();
		const nextValue = options[nextIndex]?.value;
		if (!nextValue) {
			return;
		}
		event.currentTarget
			.querySelector<HTMLButtonElement>(
				`[data-interface-option="${nextValue}"]`,
			)
			?.focus();
		if (nextValue !== (focusedValue ?? value)) {
			onSelect(nextValue);
		}
	};

	return (
		<div className="interface-settings-control">
			<span className="interface-settings-control-label">{label}</span>
			<div
				aria-label={label}
				className="segmented-control interface-settings-segmented"
				onKeyDown={handleKeyDown}
				role="radiogroup"
			>
				{options.map((option) => {
					const selected = option.value === value;
					return (
						<button
							aria-checked={selected}
							aria-label={option.label}
							className={selected ? "selected" : undefined}
							data-interface-option={option.value}
							disabled={disabled}
							key={option.value}
							onClick={() => {
								if (!selected) {
									onSelect(option.value);
								}
							}}
							role="radio"
							tabIndex={selected ? 0 : -1}
							type="button"
						>
							{option.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function resolveSegmentedControlIndex(
	key: string,
	currentIndex: number,
	optionCount: number,
): number | null {
	if (key === "Home") {
		return 0;
	}
	if (key === "End") {
		return optionCount - 1;
	}
	if (key === "ArrowRight" || key === "ArrowDown") {
		return (currentIndex + 1) % optionCount;
	}
	if (key === "ArrowLeft" || key === "ArrowUp") {
		return (currentIndex - 1 + optionCount) % optionCount;
	}
	return null;
}

function useLoopingPreviewMoment({
	preferences,
	reducedMotion,
}: {
	preferences: InterfacePreferencesV1;
	reducedMotion: boolean;
}): PreviewMoment {
	const [momentIndex, setMomentIndex] = useState(
		reducedMotion ? PREVIEW_MOMENTS.length - 1 : 0,
	);
	const preferenceSignature = `${preferences.mainControlVisibility}:${preferences.participantPillVisibility}`;

	useEffect(() => {
		if (reducedMotion) {
			setMomentIndex(PREVIEW_MOMENTS.length - 1);
			return;
		}

		setMomentIndex(0);
		const interval = window.setInterval(() => {
			setMomentIndex(
				(currentIndex) => (currentIndex + 1) % PREVIEW_MOMENTS.length,
			);
		}, INTERFACE_PREVIEW_STEP_MS);

		return () => window.clearInterval(interval);
	}, [preferenceSignature, reducedMotion]);

	return PREVIEW_MOMENTS[momentIndex] ?? "idle";
}

function usePrefersReducedMotion(): boolean {
	const query = useMemo(
		() => window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null,
		[],
	);
	const [reducedMotion, setReducedMotion] = useState(query?.matches ?? false);
	const handleChange = useCallback(
		(event: MediaQueryListEvent) => setReducedMotion(event.matches),
		[],
	);

	useEffect(() => {
		query?.addEventListener?.("change", handleChange);
		return () => query?.removeEventListener?.("change", handleChange);
	}, [handleChange, query]);

	return reducedMotion;
}
