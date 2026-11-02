export type PanelRoomStart = {
	button: DOMRect;
	background: string;
	borderColor: string;
	boxShadow: string;
	label: string;
	labelColor: string;
	counter: { rect: DOMRect } | null;
};

export function capturePanelRoomStart(
	strip: HTMLElement,
	button: HTMLElement,
): PanelRoomStart {
	const counter = strip.querySelector<HTMLElement>(".panel-time-counter");
	const style = getComputedStyle(button);
	return {
		button: button.getBoundingClientRect(),
		background: style.background,
		borderColor: style.borderColor,
		boxShadow: style.boxShadow,
		label: button.querySelector(".panel-action-label")?.textContent ?? "",
		labelColor: style.color,
		counter: counter ? { rect: counter.getBoundingClientRect() } : null,
	};
}

/** Presentation only. No countdown starts here and no room operation waits for it. */
export function animatePanelRoomStart(
	from: PanelRoomStart,
	strip: HTMLElement,
	button: HTMLElement,
) {
	const animations = new Set<Animation>();
	const ghosts = new Set<HTMLElement>();
	let cancelled = false;
	const clearMotionFlag = () => {
		if (!cancelled && animations.size === 0)
			strip.removeAttribute("data-room-motion");
	};
	const removeGhost = (node: HTMLElement) => {
		node.remove();
		ghosts.delete(node);
	};
	const cancel = () => {
		if (cancelled) return;
		cancelled = true;
		animations.forEach((animation) => animation.cancel());
		animations.clear();
		ghosts.forEach((node) => node.remove());
		ghosts.clear();
		strip.removeAttribute("data-room-motion");
		document.removeEventListener("visibilitychange", onVisibilityChange);
		window.removeEventListener("resize", cancel);
	};
	const onVisibilityChange = () => {
		if (document.visibilityState === "hidden") cancel();
	};
	const noMotion = { cancel };
	if (
		!button.animate ||
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	)
		return noMotion;
	const rect = strip.getBoundingClientRect();
	const scale = rect.width / strip.offsetWidth;
	if (!Number.isFinite(scale) || scale <= 0) return noMotion;
	document.addEventListener("visibilitychange", onVisibilityChange);
	window.addEventListener("resize", cancel);
	const to = button.getBoundingClientRect();
	const targetStyle = getComputedStyle(button);
	const animate = (
		node: HTMLElement,
		frames: Keyframe[],
		duration: number,
		delay = 0,
		onFinished?: () => void,
	) => {
		const animation = node.animate(frames, {
			duration,
			delay,
			easing: "cubic-bezier(.22,.8,.24,1)",
			fill: "both",
		});
		animations.add(animation);
		strip.setAttribute("data-room-motion", "true");
		void animation.finished.catch(() => {}).then(() => {
			animation.cancel();
			animations.delete(animation);
			onFinished?.();
			clearMotionFlag();
		});
		return animation;
	};
	animate(
		button,
		[
			{
				transform: `translateX(${(from.button.left - to.left) / scale}px)`,
				width: `${from.button.width / scale}px`,
				borderColor: from.borderColor,
				boxShadow: from.boxShadow,
			},
			{
				transform: "translateX(0)",
				width: `${to.width / scale}px`,
				borderColor: targetStyle.borderColor,
				boxShadow: targetStyle.boxShadow,
			},
		],
		640,
	);
	const surface = document.createElement("span");
	surface.className = "panel-start-surface";
	surface.setAttribute("aria-hidden", "true");
	surface.style.background = from.background;
	button.prepend(surface);
	ghosts.add(surface);
	animate(
		surface,
		[
			{ opacity: 1, offset: 0 },
			{ opacity: 1, offset: 0.18 },
			{ opacity: 0, offset: 1 },
		],
		640,
		0,
		() => removeGhost(surface),
	);
	const label = document.createElement("span");
	label.className = "panel-start-label";
	label.setAttribute("aria-hidden", "true");
	label.textContent = from.label;
	label.style.color = from.labelColor;
	button.append(label);
	ghosts.add(label);
	animate(label, [{ opacity: 1 }, { opacity: 0 }], 150, 0, () =>
		removeGhost(label),
	);

	// Move the existing DOM counter once with the button. Its text can change
	// from the bounded last observation to live time without another mount/flight.
	const counter = strip.querySelector<HTMLElement>(".panel-action-timer .panel-time-counter");
	if (from.counter && counter) {
		const target = counter.getBoundingClientRect();
		animate(counter, [
			{ transform: `translate(${(from.counter.rect.left - target.left) / scale}px,${(from.counter.rect.top - target.top) / scale}px)` },
			{ transform: "translate(0,0)" },
		], 640);
	}
	// Let the moving button clear the action slots before revealing them. Their
	// own entry animations finish behind this fade, so no icon slides over it.
	const actions = strip.querySelector<HTMLElement>(".panel-action-icons");
	if (actions) animate(actions, [{ opacity: 0 }, { opacity: 1 }], 160, 360);
	return { cancel };
}
