"use client";

import { useEffect, useState } from "react";

export type RoomDemoPhase = "pill" | "open" | "creating" | "ready";
const NEXT: Record<RoomDemoPhase, RoomDemoPhase> = {
	pill: "open",
	open: "creating",
	creating: "ready",
	ready: "pill",
};
const DELAY: Record<RoomDemoPhase, number> = {
	pill: 2200,
	open: 2800,
	creating: 800,
	ready: 4200,
};

/** Local, automatic illustration. No room API, media devices or account state. */
export function useRoomDemo(visible: boolean, reducedMotion: boolean | null) {
	const [phase, setPhase] = useState<RoomDemoPhase>("pill");
	useEffect(() => {
		if (!visible || reducedMotion !== false) return;
		const timer = setTimeout(() => setPhase(NEXT[phase]), DELAY[phase]);
		return () => clearTimeout(timer);
	}, [phase, visible, reducedMotion]);

	// Reduced-motion users get the complete scene without automatic movement.
	return reducedMotion ? "ready" : phase;
}
