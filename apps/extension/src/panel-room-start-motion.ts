export type PanelRoomStart = {
	button: DOMRect;
	background: string;
	counter: { rect: DOMRect; clone: HTMLElement } | null;
};

export function capturePanelRoomStart(
	strip: HTMLElement,
	button: HTMLElement,
): PanelRoomStart {
	const counter = strip.querySelector<HTMLElement>(".panel-time-counter");
	return {
		button: button.getBoundingClientRect(),
		background: getComputedStyle(button).background,
		counter: counter
			? {
					rect: counter.getBoundingClientRect(),
					clone: counter.cloneNode(true) as HTMLElement,
				}
			: null,
	};
}

/** Presentation only. No countdown starts here and no room operation waits for it. */
export function animatePanelRoomStart(
	from: PanelRoomStart,
	strip: HTMLElement,
	button: HTMLElement,
) {
	const animations: Animation[] = [];
	const ghosts: HTMLElement[] = [];
	const cancel = () => {
		animations.forEach((animation) => animation.cancel());
		ghosts.forEach((node) => node.remove());
		strip.removeAttribute("data-room-motion");
	};
	if (
		!button.animate ||
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	)
		return { cancel };
	const rect = strip.getBoundingClientRect();
	const scale = rect.width / strip.offsetWidth;
	if (!Number.isFinite(scale) || scale <= 0) return { cancel };
	const to = button.getBoundingClientRect();
	const counter = button.querySelector<HTMLElement>(".panel-time-counter");
	const targetCounter = counter?.getBoundingClientRect();
	const animate = (
		node: HTMLElement,
		frames: Keyframe[],
		duration: number,
		delay = 0,
	) => {
		animations.push(
			node.animate(frames, {
				duration,
				delay,
				easing: "cubic-bezier(.22,.8,.24,1)",
				fill: "both",
			}),
		);
	};
	animate(
		button,
		[
			{
				transform: `translateX(${(from.button.left - to.left) / scale}px)`,
				width: `${from.button.width / scale}px`,
			},
			{ transform: "translateX(0)", width: `${to.width / scale}px` },
		],
		640,
	);
	const surface = document.createElement("span");
	surface.className = "panel-start-surface";
	surface.setAttribute("aria-hidden", "true");
	surface.style.background = from.background;
	button.prepend(surface);
	ghosts.push(surface);
	animate(surface, [{ opacity: 1 }, { opacity: 0 }], 500);
	if (from.counter && targetCounter) {
		const ghost = from.counter.clone;
		ghost.classList.add("panel-flying-counter");
		ghost.setAttribute("aria-hidden", "true");
		Object.assign(ghost.style, {
			left: `${(from.counter.rect.left - rect.left) / scale}px`,
			top: `${(from.counter.rect.top - rect.top) / scale}px`,
		});
		strip.append(ghost);
		ghosts.push(ghost);
		strip.setAttribute("data-room-motion", "true");
		animate(
			ghost,
			[
				{ transform: "translate(0,0)" },
				{
					transform: `translate(${(targetCounter.left - from.counter.rect.left) / scale}px,${(targetCounter.top - from.counter.rect.top) / scale}px)`,
				},
			],
			610,
			30,
		);
	}
	void Promise.all(
		animations.map((animation) => animation.finished.catch(() => {})),
	).then(cancel);
	return { cancel };
}
