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
	let counterStarted = false;
	let counterRetired = false;
	let counterGhost: HTMLElement | null = null;
	let counterAnimation: Animation | null = null;
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
	const noMotion = { cancel, updateCounter: (_awaitingTime: boolean) => {} };
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
	const startedAt = performance.now();
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

	// Room readiness and the authoritative time can arrive in different renders.
	// Keep the button's transition independent; only fresh digits may join it.
	const updateCounter = (awaitingTime: boolean) => {
		if (cancelled || counterRetired || !from.counter) return;
		const counter = button.querySelector<HTMLElement>(".panel-time-counter");
		if (!counter) {
			if (counterStarted || !awaitingTime) {
				counterRetired = true;
				if (counterAnimation) {
					counterAnimation.cancel();
					animations.delete(counterAnimation);
				}
				if (counterGhost) removeGhost(counterGhost);
				clearMotionFlag();
			}
			return;
		}
		if (counterStarted) {
			const digits = counterGhost?.querySelector("strong");
			if (digits)
				digits.textContent = counter.querySelector("strong")?.textContent ?? "";
			return;
		}
		counterStarted = true;
		const targetCounter = counter.getBoundingClientRect();
		const currentButton = button.getBoundingClientRect();
		const currentStrip = strip.getBoundingClientRect();
		// Remove the in-flight button transform/width from the measured destination.
		const targetLeft =
			targetCounter.left + to.left - currentButton.left +
			(to.width - currentButton.width) / 2;
		const ghost = counter.cloneNode(true) as HTMLElement;
		counterGhost = ghost;
		ghost.classList.add("panel-flying-counter");
		ghost.setAttribute("aria-hidden", "true");
		Object.assign(ghost.style, {
			left: `${(from.counter.rect.left - currentStrip.left) / scale}px`,
			top: `${(from.counter.rect.top - currentStrip.top) / scale}px`,
		});
		strip.append(ghost);
		ghosts.add(ghost);
		const elapsed = Math.max(0, performance.now() - startedAt);
		const delay = Math.max(0, 30 - elapsed);
		counterAnimation = animate(
			ghost,
			[
				{ transform: "translate(0,0)" },
				{
					transform: `translate(${(targetLeft - from.counter.rect.left) / scale}px,${(targetCounter.top - from.counter.rect.top) / scale}px)`,
				},
			],
			Math.max(260, 640 - elapsed - delay),
			delay,
			() => {
				removeGhost(ghost);
				counterGhost = null;
			},
		);
	};
	return { cancel, updateCounter };
}
