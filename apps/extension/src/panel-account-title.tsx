import { useLayoutEffect, useRef } from "react";
import type { AuthenticatedUserPlan } from "./auth-tokens";

interface PanelAccountTitleProps {
	displayName: string;
	plan: AuthenticatedUserPlan | null;
}

const PLAN_LABELS: Record<AuthenticatedUserPlan, string> = {
	free: "Free",
	plus: "Plus",
	pro: "Pro",
};

export function PanelAccountTitle({
	displayName,
	plan,
}: PanelAccountTitleProps) {
	const nameRef = useRef<HTMLElement>(null);
	const planRef = useRef<HTMLSpanElement>(null);
	const planText = plan ? PLAN_LABELS[plan] : null;

	useLayoutEffect(() => {
		const nameElement = nameRef.current;
		const planElement = planRef.current;
		if (!nameElement || !planElement || !planText) return;

		let cancelled = false;
		const alignToLastGlyph = () => {
			if (cancelled) return;
			const lastGrapheme = getLastVisibleGrapheme(displayName);
			if (!lastGrapheme) return;

			const context = document.createElement("canvas").getContext("2d");
			if (!context) return;

			const nameAscent = measureGlyphAscent(
				context,
				lastGrapheme,
				getComputedStyle(nameElement),
			);
			const planAscent = measureGlyphAscent(
				context,
				planText,
				getComputedStyle(planElement),
			);
			if (nameAscent === null || planAscent === null) return;

			const offset = calculatePlanGlyphOffset(nameAscent, planAscent);
			planElement.style.setProperty(
				"--plan-glyph-offset",
				`${offset.toFixed(2)}px`,
			);
		};

		alignToLastGlyph();
		void document.fonts?.ready.then(alignToLastGlyph);

		return () => {
			cancelled = true;
		};
	}, [displayName, planText]);

	return (
		<div className="panel-account-title-row">
			<strong className="panel-account-name" ref={nameRef} title={displayName}>
				{displayName}
			</strong>
			{plan && planText ? (
				<span className={`plan-badge ${plan}`} ref={planRef}>
					{planText}
				</span>
			) : null}
		</div>
	);
}

export function getLastVisibleGrapheme(value: string): string {
	const codePoints = Array.from(value.trimEnd());
	let grapheme = codePoints.pop() ?? "";
	while (codePoints.length > 0 && /^\p{Mark}$/u.test(grapheme[0] ?? "")) {
		grapheme = `${codePoints.pop() ?? ""}${grapheme}`;
	}
	return grapheme;
}

export function calculatePlanGlyphOffset(
	nameAscent: number,
	planAscent: number,
): number {
	if (!Number.isFinite(nameAscent) || !Number.isFinite(planAscent)) return 0;
	return Math.max(-8, Math.min(8, planAscent - nameAscent));
}

function measureGlyphAscent(
	context: CanvasRenderingContext2D,
	text: string,
	style: CSSStyleDeclaration,
): number | null {
	context.font = [
		style.fontStyle,
		style.fontVariant,
		style.fontWeight,
		style.fontSize,
		style.fontFamily,
	]
		.filter(Boolean)
		.join(" ");
	context.textBaseline = "alphabetic";
	const ascent = context.measureText(text).actualBoundingBoxAscent;
	return Number.isFinite(ascent) && ascent > 0 ? ascent : null;
}
