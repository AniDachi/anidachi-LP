import { type RefObject, useLayoutEffect, useRef } from "react";

// A cold query must not collapse the outer scroll range while it is loading.
// Keep only its previous size; content always belongs to the active query.
export function useWatchLoadingHeight(
	ref: RefObject<HTMLElement | null>,
	loading: boolean,
) {
	const height = useRef(0);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		if (loading) {
			element.style.minHeight = height.current ? `${height.current}px` : "";
			return;
		}
		element.style.minHeight = "";
		const measure = () => {
			height.current = element.getBoundingClientRect().height;
		};
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref, loading]);
}
