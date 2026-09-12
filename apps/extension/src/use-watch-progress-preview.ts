import { useEffect, type RefObject } from "react";

const triggerSelector = 'button[data-has-progress="true"]';

export function useWatchProgressPreview(
	rootRef: RefObject<HTMLElement | null>,
) {
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const document = root.ownerDocument;
		const view = document.defaultView;
		if (!view) return;
		let frame = 0;
		const position = (trigger: HTMLElement) => {
			const preview = trigger.querySelector<HTMLElement>(
				".popup-watch-progress-preview",
			);
			if (
				!preview ||
				!view.matchMedia("(hover: hover) and (pointer: fine)").matches
			)
				return;
			const anchor = (
				trigger.querySelector(".popup-watch-summary") ?? trigger
			).getBoundingClientRect();
			const shell = root.closest(".popup-shell")?.getBoundingClientRect();
			const left = Math.max(8, (shell?.left ?? 0) + 8);
			const right = Math.min(
				view.innerWidth - 8,
				(shell?.right ?? view.innerWidth) - 8,
			);
			const top = Math.max(8, (shell?.top ?? 0) + 8);
			const bottom = Math.min(
				view.innerHeight - 8,
				(shell?.bottom ?? view.innerHeight) - 8,
			);
			preview.dataset.ready = String(
				anchor.bottom > top && anchor.top < bottom,
			);
			const width = Math.min(224, right - left);
			preview.style.setProperty("--preview-width", `${width}px`);
			const height = preview.offsetHeight;
			const y =
				anchor.bottom + 5 + height <= bottom
					? anchor.bottom + 5
					: anchor.top - height - 5;
			preview.style.setProperty(
				"--preview-left",
				`${Math.max(left, Math.min(anchor.left, right - width))}px`,
			);
			preview.style.setProperty(
				"--preview-top",
				`${Math.max(top, Math.min(y, bottom - height))}px`,
			);
		};
		const enter = (event: Event) => {
			const target = event.target as Element | null;
			const trigger = target?.closest<HTMLElement>(triggerSelector);
			if (trigger && root.contains(trigger)) {
				const preview = trigger.querySelector<HTMLElement>(
					".popup-watch-progress-preview",
				);
				const previous = (event as PointerEvent).relatedTarget as Node | null;
				if (preview && (!previous || !trigger.contains(previous)))
					delete preview.dataset.dismissed;
				position(trigger);
			}
		};
		const refresh = () => {
			view.cancelAnimationFrame(frame);
			frame = view.requestAnimationFrame(() => {
				root
					.querySelectorAll<HTMLElement>(
						`${triggerSelector}:is(:hover, :focus-visible)`,
					)
					.forEach(position);
			});
		};
		const escape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			root
				.querySelectorAll<HTMLElement>(
					'.popup-watch-progress-preview[data-ready="true"]',
				)
				.forEach((preview) => {
					preview.dataset.dismissed = "true";
				});
		};
		document.addEventListener("keydown", escape);
		root.addEventListener("pointerover", enter);
		root.addEventListener("focusin", enter);
		document.addEventListener("scroll", refresh, true);
		view.addEventListener("resize", refresh);
		return () => {
			view.cancelAnimationFrame(frame);
			document.removeEventListener("keydown", escape);
			root.removeEventListener("pointerover", enter);
			root.removeEventListener("focusin", enter);
			document.removeEventListener("scroll", refresh, true);
			view.removeEventListener("resize", refresh);
		};
	}, [rootRef]);
}
