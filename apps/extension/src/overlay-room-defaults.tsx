import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { overlayHotkeyBoundaryProps } from "./overlay-interaction-boundary";
import type {
	CameraOnJoin,
	MicrophoneOnJoin,
	RoomJoinDefaultsPatch,
	RoomJoinDefaultsV1,
} from "./room-media-defaults";

const MICROPHONE_OPTIONS: ReadonlyArray<{
	label: string;
	value: MicrophoneOnJoin;
}> = [
	{ label: "Last used", value: "last-used" },
	{ label: "Push to talk", value: "push-to-talk" },
	{ label: "Open mic", value: "open-mic" },
];

const CAMERA_OPTIONS: ReadonlyArray<{ label: string; value: CameraOnJoin }> = [
	{ label: "Last used", value: "last-used" },
	{ label: "Off", value: "off" },
	{ label: "On", value: "on" },
];

export interface RoomDefaultsSettingsPanelProps {
	error: string | null;
	onChange(patch: RoomJoinDefaultsPatch): void;
	preferences: RoomJoinDefaultsV1;
	ready: boolean;
	saving: boolean;
}

export function RoomDefaultsSettingsPanel({
	error,
	onChange,
	preferences,
	ready,
	saving,
}: RoomDefaultsSettingsPanelProps) {
	return (
		<div
			{...overlayHotkeyBoundaryProps}
			aria-busy={saving}
			className="settings-panel-stack room-defaults-settings-panel"
		>
			<div className="room-defaults-intro">
				<h3 className="room-defaults-title">Room defaults</h3>
				<p className="room-defaults-description">
					Choose your starting setup for every room.
				</p>
			</div>

			<div className="room-defaults-controls">
				<RoomDefaultControl
					disabled={!ready}
					label="Microphone"
					onSelect={(microphoneOnJoin) => onChange({ microphoneOnJoin })}
					options={MICROPHONE_OPTIONS}
					value={preferences.microphoneOnJoin}
				/>
				<RoomDefaultControl
					disabled={!ready}
					label="Camera"
					onSelect={(cameraOnJoin) => onChange({ cameraOnJoin })}
					options={CAMERA_OPTIONS}
					value={preferences.cameraOnJoin}
				/>
			</div>

			{error ? (
				<p className="room-defaults-feedback" role="status">
					{error}
				</p>
			) : null}
		</div>
	);
}

function RoomDefaultControl<T extends string>({
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
	const selectedIndex = Math.max(
		0,
		options.findIndex((option) => option.value === value),
	);

	const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		const focusedValue =
			event.target instanceof HTMLElement
				? (event.target.dataset.roomDefaultOption as T | undefined)
				: undefined;
		const currentIndex = Math.max(
			0,
			options.findIndex((option) => option.value === (focusedValue ?? value)),
		);
		const nextIndex = resolveOptionIndex(
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
				`[data-room-default-option="${nextValue}"]`,
			)
			?.focus();
		if (nextValue !== (focusedValue ?? value)) {
			onSelect(nextValue);
		}
	};

	return (
		<div className="room-defaults-control">
			<span className="room-defaults-control-label">{label}</span>
			<div
				aria-label={label}
				className="segmented-control room-defaults-segmented"
				data-state={["first", "second", "third"][selectedIndex]}
				onKeyDown={handleKeyDown}
				role="radiogroup"
			>
				{options.map((option) => {
					const selected = option.value === value;
					return (
						<button
							aria-checked={selected}
							className={selected ? "selected" : undefined}
							data-room-default-option={option.value}
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

function resolveOptionIndex(
	key: string,
	currentIndex: number,
	optionCount: number,
): number | null {
	if (key === "Home") return 0;
	if (key === "End") return optionCount - 1;
	if (key === "ArrowRight" || key === "ArrowDown") {
		return (currentIndex + 1) % optionCount;
	}
	if (key === "ArrowLeft" || key === "ArrowUp") {
		return (currentIndex - 1 + optionCount) % optionCount;
	}
	return null;
}
