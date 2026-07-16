import type { CSSProperties } from "react";

export interface SteppedSettingSliderProps {
	ariaValueText?: string;
	disabled?: boolean;
	endLabel: string;
	label: string;
	max: number;
	min: number;
	onValueChange: (value: number) => void;
	startLabel: string;
	step?: number;
	value: number;
	valueLabel: string;
}

export function SteppedSettingSlider({
	disabled = false,
	endLabel,
	label,
	max,
	min,
	onValueChange,
	startLabel,
	step = 1,
	value,
	valueLabel,
	ariaValueText = valueLabel,
}: SteppedSettingSliderProps) {
	const progress = max <= min ? 0 : ((value - min) / (max - min)) * 100;
	const sliderStyle = {
		"--setting-slider-progress": `${Math.max(0, Math.min(100, progress))}%`,
	} as CSSProperties;

	return (
		<label className="stepped-setting-slider-v2">
			<span className="stepped-setting-slider-header-v2">
				<span>{label}</span>
				<strong>{valueLabel}</strong>
			</span>
			<input
				aria-label={label}
				aria-valuetext={ariaValueText}
				className="stepped-setting-slider-input-v2"
				disabled={disabled}
				max={max}
				min={min}
				onChange={(event) => onValueChange(Number(event.currentTarget.value))}
				step={step}
				style={sliderStyle}
				type="range"
				value={value}
			/>
			<span aria-hidden="true" className="stepped-setting-slider-endpoints-v2">
				<span>{startLabel}</span>
				<span>{endLabel}</span>
			</span>
		</label>
	);
}
