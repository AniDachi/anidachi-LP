import { type CSSProperties, useId, useState } from "react";
import { overlayHotkeyBoundaryProps } from "./overlay-interaction-boundary";
import {
	REACTION_EMOJI_CATALOG,
	REACTION_SHORTCUT_KEYS,
} from "./reaction-shortcuts";

interface ReactionShortcutEditorProps {
	assignments: readonly string[];
	onAssign(index: number, emoji: string): void;
}

type DockScaleStyle = CSSProperties & {
	"--reaction-dock-scale": string;
};

export function ReactionShortcutEditor({
	assignments,
	onAssign,
}: ReactionShortcutEditorProps) {
	const pickerId = useId();
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
	const magnifiedIndex = hoveredIndex ?? focusedIndex;

	const closePicker = () => setActiveIndex(null);

	return (
		<div
			aria-label="Reaction shortcut editor"
			className="reaction-shortcut-editor"
			onKeyDown={(event) => {
				if (event.key === "Escape" && activeIndex !== null) {
					event.preventDefault();
					closePicker();
				}
			}}
			role="group"
			{...overlayHotkeyBoundaryProps}
		>
			<div
				aria-label="Quick reaction shortcuts"
				className="reaction-shortcut-grid"
				onPointerLeave={() => setHoveredIndex(null)}
				role="group"
			>
				{REACTION_SHORTCUT_KEYS.map((key, index) => {
					const emoji = assignments[index] ?? "";
					const distance =
						magnifiedIndex === null
							? Number.POSITIVE_INFINITY
							: Math.abs(index - magnifiedIndex);
					const scale = distance === 0 ? 1.34 : distance === 1 ? 1.14 : 1;
					const style: DockScaleStyle = {
						"--reaction-dock-scale": String(scale),
					};

					return (
						<button
							aria-controls={activeIndex === index ? pickerId : undefined}
							aria-expanded={activeIndex === index}
							aria-label={`Key ${key}: ${emoji}. Change reaction`}
							className={`reaction-shortcut${activeIndex === index ? " active" : ""}`}
							key={key}
							onBlur={() => setFocusedIndex(null)}
							onClick={() =>
								setActiveIndex((current) => (current === index ? null : index))
							}
							onFocus={() => setFocusedIndex(index)}
							onPointerEnter={() => setHoveredIndex(index)}
							style={style}
							type="button"
						>
							<span className="reaction-shortcut-key">{key}</span>
							<span aria-hidden="true" className="reaction-shortcut-emoji">
								{emoji}
							</span>
						</button>
					);
				})}
			</div>

			{activeIndex !== null ? (
				<div
					aria-label={`Choose reaction for key ${REACTION_SHORTCUT_KEYS[activeIndex]}`}
					className="reaction-emoji-picker"
					id={pickerId}
					role="dialog"
				>
					<div className="reaction-emoji-picker-header">
						<span>Key {REACTION_SHORTCUT_KEYS[activeIndex]}</span>
						<span>Choose reaction</span>
						<button
							aria-label="Close reaction picker"
							onClick={closePicker}
							type="button"
						>
							×
						</button>
					</div>
					<div className="reaction-emoji-picker-grid" role="group">
						{REACTION_EMOJI_CATALOG.map((emoji) => (
							<button
								aria-label={`Assign ${emoji} to key ${REACTION_SHORTCUT_KEYS[activeIndex]}`}
								aria-pressed={assignments[activeIndex] === emoji}
								className="reaction-emoji-option"
								key={emoji}
								onClick={() => {
									onAssign(activeIndex, emoji);
									closePicker();
								}}
								type="button"
							>
								<span aria-hidden="true">{emoji}</span>
							</button>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
