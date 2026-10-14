import { SendHorizontal, SmilePlus, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { ANIDACHI_EMOJI_CATALOG } from "./emoji-catalog";
import {
	overlayHotkeyBoundaryProps,
	overlayInteractionBoundaryProps,
} from "./overlay-interaction-boundary";
import { TourSketchCue } from "./player-onboarding-cue";
import { registerPlayerIntroductionTextInput } from "./player-onboarding-input";

export type PracticeChatPhase = "typing" | "closed";

/** Mirrors the real composer with disposable local state.
 * Deliberately accepts no room, transport, auth or persistence callbacks. */
export function PracticeChat({
	onPhaseChange,
	onContinue,
}: {
	onPhaseChange: (phase: PracticeChatPhase) => void;
	onContinue: () => void;
}) {
	const [open, setOpen] = useState(true);
	const [text, setText] = useState("Hey, watch buddy! 🍿");
	const [emojiOpen, setEmojiOpen] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	const close = () => {
		setText("");
		setEmojiOpen(false);
		setOpen(false);
	};
	useLayoutEffect(() => {
		onPhaseChange(open ? "typing" : "closed");
	}, [open, onPhaseChange]);
	useLayoutEffect(() => {
		if (!open || !input.current) {
			trigger.current?.focus({ preventScroll: true });
			return;
		}
		const field = input.current;
		const release = registerPlayerIntroductionTextInput(field);
		field.focus({ preventScroll: true });
		return release;
	}, [open]);
	return (
		<>
			{open ? (
				<form
					className="message-composer tour-practice-composer"
					data-tour-target="chat"
					{...overlayInteractionBoundaryProps}
					{...overlayHotkeyBoundaryProps}
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						// This demonstration only advances the tour; typing is optional.
						onContinue();
					}}
				>
					<div className="message-composer-emoji">
						<button
							type="button"
							className="message-composer-emoji-button"
							aria-label="Choose emoji"
							aria-expanded={emojiOpen}
							onClick={() => setEmojiOpen((value) => !value)}
						>
							<SmilePlus size={17} strokeWidth={2.2} />
						</button>
						{emojiOpen && (
							<div className="message-composer-emoji-popover">
								{ANIDACHI_EMOJI_CATALOG.map((emoji) => (
									<button
										key={emoji}
										type="button"
										aria-label={`Add ${emoji}`}
										onClick={() => {
											setText((value) => `${value}${emoji}`.slice(0, 140));
											setEmojiOpen(false);
											input.current?.focus({ preventScroll: true });
										}}
									>
										{emoji}
									</button>
								))}
							</div>
						)}
					</div>
					<input
						ref={input}
						aria-label="Anidachi message"
						aria-describedby="tour-chat-help"
						maxLength={140}
						type="text"
						placeholder="Type a quick reaction"
						value={text}
						onChange={(event) => setText(event.currentTarget.value)}
					/>
					<button
						type="submit"
						aria-label="Send message"
						title="Send and continue the tour"
						className="message-composer-send"
					>
						<SendHorizontal size={15} />
						<TourSketchCue
							className="tour-chat-send-cue"
							direction="down"
							label="Click Send!"
						/>
					</button>
					<button
						type="button"
						aria-label="Close message"
						title="Close without sending"
						className="message-composer-close"
						onClick={close}
					>
						<X size={16} />
					</button>
				</form>
			) : (
				<button
					ref={trigger}
					type="button"
					className="tour-chat-trigger tour-chat-retry"
					data-tour-target="chat"
					onClick={() => {
						setOpen(true);
					}}
					aria-label="Open chat again"
				>
					<span>Open chat again</span>
				</button>
			)}
		</>
	);
}
