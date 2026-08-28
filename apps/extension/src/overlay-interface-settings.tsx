import { AudioLines, MousePointer2, VolumeX } from "lucide-react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { AnidachiLogoMark } from "./anidachi-logo-mark";
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

type PreviewMoment =
	| "idle"
	| "proximity"
	| "main-visible"
	| "speaking"
	| "interaction";

type PreviewCursorTarget =
	| "rest"
	| "main-edge"
	| "rail-edge"
	| "participant-pill";

interface PreviewFrame {
	cursorTarget: PreviewCursorTarget;
	cursorVisible: boolean;
	durationMs: number;
	moment: PreviewMoment;
}

const PREVIEW_PAUSE_MS = 480;
const PREVIEW_CURSOR_TRAVEL_MS = 820;
const PREVIEW_CUE_MS = 320;
const PREVIEW_REVEAL_MS = 420;
const PREVIEW_HOLD_MS = 980;
const PREVIEW_CURSOR_FADE_MS = 200;
const PREVIEW_RESET_MS = 460;

const REDUCED_MOTION_PREVIEW_FRAME: PreviewFrame = {
	cursorTarget: "rest",
	cursorVisible: false,
	durationMs: 0,
	moment: "interaction",
};

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
	const previewFrame = useLoopingPreviewFrame({
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
				frame={previewFrame}
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
	frame,
	preferences,
	reducedMotion,
}: {
	frame: PreviewFrame;
	preferences: InterfacePreferencesV1;
	reducedMotion: boolean;
}) {
	const { cursorTarget, cursorVisible, moment } = frame;
	const mainPresentation = resolveMainControlPresentation({
		focused: false,
		forceVisible: false,
		mode: preferences.mainControlVisibility,
		panelOpen: false,
		phase:
			moment === "proximity"
				? "glow"
				: moment === "main-visible"
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
			data-cursor-target={cursorTarget}
			data-cursor-visible={String(cursorVisible)}
			data-pill-visibility={pillPresentations[0]}
			data-preview-moment={moment}
			data-reduced-motion={String(reducedMotion)}
		>
			<div aria-hidden="true" className="interface-settings-preview-scene" />

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
				<AnidachiLogoMark className="interface-settings-main-logo" size={18} />
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
						data-presentation={presentation}
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
				data-state={value === options[1]?.value ? "second" : "first"}
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

function useLoopingPreviewFrame({
	preferences,
	reducedMotion,
}: {
	preferences: InterfacePreferencesV1;
	reducedMotion: boolean;
}): PreviewFrame {
	const previewFrames = useMemo(
		() => resolvePreviewFrames(preferences),
		[preferences.mainControlVisibility, preferences.participantPillVisibility],
	);
	const [frameIndex, setFrameIndex] = useState(0);
	const preferenceSignature = `${preferences.mainControlVisibility}:${preferences.participantPillVisibility}`;
	const currentFrame =
		previewFrames[frameIndex] ??
		previewFrames[0] ??
		REDUCED_MOTION_PREVIEW_FRAME;

	useEffect(() => {
		setFrameIndex(0);
	}, [preferenceSignature]);

	useEffect(() => {
		if (reducedMotion) {
			return;
		}

		const timeout = window.setTimeout(() => {
			setFrameIndex(
				(currentIndex) => (currentIndex + 1) % previewFrames.length,
			);
		}, currentFrame.durationMs);

		return () => window.clearTimeout(timeout);
	}, [
		currentFrame.durationMs,
		frameIndex,
		previewFrames.length,
		reducedMotion,
	]);

	return reducedMotion ? REDUCED_MOTION_PREVIEW_FRAME : currentFrame;
}

function resolvePreviewFrames(
	preferences: InterfacePreferencesV1,
): readonly PreviewFrame[] {
	const frames: PreviewFrame[] = [
		{
			cursorTarget: "rest",
			cursorVisible: false,
			durationMs: PREVIEW_PAUSE_MS,
			moment: "idle",
		},
	];

	if (preferences.mainControlVisibility === "auto-hide") {
		frames.push(
			{
				cursorTarget: "main-edge",
				cursorVisible: true,
				durationMs: PREVIEW_CURSOR_TRAVEL_MS,
				moment: "idle",
			},
			{
				cursorTarget: "main-edge",
				cursorVisible: true,
				durationMs: PREVIEW_CUE_MS,
				moment: "proximity",
			},
			{
				cursorTarget: "main-edge",
				cursorVisible: true,
				durationMs: PREVIEW_REVEAL_MS + PREVIEW_HOLD_MS,
				moment: "main-visible",
			},
			{
				cursorTarget: "main-edge",
				cursorVisible: false,
				durationMs: PREVIEW_CURSOR_FADE_MS,
				moment: "main-visible",
			},
			{
				cursorTarget: "rest",
				cursorVisible: false,
				durationMs: PREVIEW_RESET_MS,
				moment: "idle",
			},
		);
	}

	frames.push(
		{
			cursorTarget: "rest",
			cursorVisible: false,
			durationMs: PREVIEW_HOLD_MS,
			moment: "speaking",
		},
		{
			cursorTarget: "rest",
			cursorVisible: false,
			durationMs: PREVIEW_RESET_MS,
			moment: "idle",
		},
	);

	const participantTarget =
		preferences.participantPillVisibility === "smart"
			? "rail-edge"
			: "participant-pill";
	frames.push(
		{
			cursorTarget: participantTarget,
			cursorVisible: true,
			durationMs: PREVIEW_CURSOR_TRAVEL_MS,
			moment: "idle",
		},
		{
			cursorTarget: participantTarget,
			cursorVisible: true,
			durationMs: PREVIEW_HOLD_MS,
			moment: "interaction",
		},
		{
			cursorTarget: participantTarget,
			cursorVisible: false,
			durationMs: PREVIEW_CURSOR_FADE_MS,
			moment: "interaction",
		},
		{
			cursorTarget: "rest",
			cursorVisible: false,
			durationMs: PREVIEW_RESET_MS,
			moment: "idle",
		},
	);

	return frames;
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
