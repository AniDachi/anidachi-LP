import { useLayoutEffect, type RefObject } from "react";

export function useWatchFilterPopover({
	open,
	triggerRef,
	panelRef,
	dismiss,
	close,
	preferredWidth = 304,
	align = "end",
}: {
	open: boolean;
	triggerRef: RefObject<HTMLButtonElement | null>;
	panelRef: RefObject<HTMLDivElement | null>;
	dismiss: () => void;
	close: () => void;
	preferredWidth?: number;
	align?: "start" | "end";
}) {
	useLayoutEffect(() => {
		const trigger = triggerRef.current;
		const panel = panelRef.current;
		if (!open || !trigger || !panel) return;
		const document = trigger.ownerDocument;
		const view = document.defaultView;
		if (!view) return;
		const shell = trigger.closest<HTMLElement>(".popup-shell");
		let frame = 0;
		const position = () => {
			const anchor = trigger.getBoundingClientRect();
			const shellBounds = shell?.getBoundingClientRect();
			const left = Math.max(8, (shellBounds?.left ?? 0) + 12);
			const right = Math.min(
				view.innerWidth - 8,
				(shellBounds?.right ?? view.innerWidth) - 12,
			);
			const top = Math.max(8, (shellBounds?.top ?? 0) + 8);
			const bottom = Math.min(
				view.innerHeight - 8,
				(shellBounds?.bottom ?? view.innerHeight) - 8,
			);
			if (anchor.height > 0 && (anchor.bottom <= top || anchor.top >= bottom)) {
				dismiss();
				return;
			}
			const width = Math.min(preferredWidth, Math.max(0, right - left));
			panel.style.width = `${width}px`;
			const height = panel.scrollHeight + 2;
			const below = Math.max(0, bottom - anchor.bottom - 8);
			const above = Math.max(0, anchor.top - top - 8);
			const placeBelow = below >= Math.min(height, 360) || below >= above;
			const maxHeight = Math.min(360, placeBelow ? below : above);
			panel.style.maxHeight = `${maxHeight}px`;
			panel.style.left = `${Math.max(left, Math.min(align === "start" ? anchor.left : anchor.right - width, right - width))}px`;
			panel.style.top = `${placeBelow ? anchor.bottom + 8 : anchor.top - 8 - Math.min(height, maxHeight)}px`;
			panel.dataset.side = placeBelow ? "bottom" : "top";
		};
		const schedulePosition = () => {
			view.cancelAnimationFrame(frame);
			frame = view.requestAnimationFrame(position);
		};
		const isOutside = (event: Event) => {
			const path = event.composedPath();
			return !path.includes(panel) && !path.includes(trigger);
		};
		const onOutside = (event: Event) => {
			if (isOutside(event)) dismiss();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !event.defaultPrevented) {
				event.preventDefault();
				event.stopPropagation();
				close();
			}
		};
		position();
		const selected = panel.querySelector<HTMLElement>(
			'input[type="radio"]:checked, [role="option"][aria-selected="true"]',
		);
		selected?.focus({ preventScroll: true });
		if (selected?.getAttribute("role") === "option") {
			const bounds = panel.getBoundingClientRect(),
				option = selected.getBoundingClientRect();
			if (option.bottom > bounds.bottom)
				panel.scrollTop += option.bottom - bounds.bottom + 5;
		}
		const observer =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(schedulePosition);
		observer?.observe(panel);
		if (shell) observer?.observe(shell);
		document.addEventListener("pointerdown", onOutside, true);
		document.addEventListener("focusin", onOutside);
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("scroll", schedulePosition, true);
		view.addEventListener("resize", schedulePosition);
		return () => {
			observer?.disconnect();
			view.cancelAnimationFrame(frame);
			document.removeEventListener("pointerdown", onOutside, true);
			document.removeEventListener("focusin", onOutside);
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("scroll", schedulePosition, true);
			view.removeEventListener("resize", schedulePosition);
		};
	}, [open, triggerRef, panelRef, dismiss, close, preferredWidth, align]);
}
