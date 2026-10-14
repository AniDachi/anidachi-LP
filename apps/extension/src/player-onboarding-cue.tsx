import type { CSSProperties } from "react";

/** Decorative annotation; the real control keeps its accessible name and action. */
export function TourSketchCue({
	label,
	direction = "right",
	className = "",
	style,
}: {
	label: string;
	direction?: "right" | "up-right" | "down" | "down-right";
	className?: string;
	style?: CSSProperties;
}) {
	const path =
		direction === "down-right"
			? "M8 8C55 0 49 58 103 66M91 55L103 66L88 74"
			: direction === "down"
				? "M8 16C37 11 64 15 81 32C94 45 100 61 100 78M90 66L100 78L108 64"
				: direction === "up-right"
					? "M8 46C44 46 54 22 103 22M90 11L103 22L90 33"
					: "M8 16C35 12 47 37 72 41Q89 44 103 38M89 29L103 38L89 49";
	return (
		<span
			className={`tour-sketch-cue tour-sketch-${direction} ${className}`}
			style={style}
			aria-hidden="true"
		>
			<span className="tour-sketch-label">{label}</span>
			<svg
				viewBox="0 0 112 88"
				fill="none"
				focusable="false"
				aria-hidden="true"
			>
				<path d={path} vectorEffect="non-scaling-stroke" />
			</svg>
		</span>
	);
}
